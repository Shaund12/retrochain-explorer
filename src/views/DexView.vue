<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useKeplr } from "@/composables/useKeplr";
import { useDex } from "@/composables/useDex";
import { useBridge } from "@/composables/useBridge";
import { useNetwork } from "@/composables/useNetwork";
import { formatAmount } from "@/utils/format";

const { address, connect, isAvailable } = useKeplr();
const { pools, loading: dexLoading, fetchPools, simulateSwap, calculatePoolPrice } = useDex();
const { assets: bridgeAssets, bridgeFromNoble, bridgeFromEVM, getEstimatedTime, getBridgeFee } = useBridge();
const { current: network } = useNetwork();

const activeTab = ref<'swap' | 'pools' | 'limit' | 'bridge'>('swap');
const swapTab = ref<'market' | 'limit'>('market');

// Swap state
const tokenIn = ref("RETRO");
const tokenOut = ref("USDC");
const amountIn = ref("");
const amountOut = ref("");
const slippage = ref("0.5");
const swapping = ref(false);

// Pool state
const poolTokenA = ref("RETRO");
const poolTokenB = ref("USDC");
const poolAmountA = ref("");
const poolAmountB = ref("");
const addingLiquidity = ref(false);

// Limit order state
const limitPrice = ref("");
const limitAmount = ref("");
const limitSide = ref<'buy' | 'sell'>('buy');

// Bridge state
const bridgeAsset = ref("USDC");
const bridgeChain = ref("Noble");
const bridgeAmount = ref("");
const bridging = ref(false);

const tokenDenom = computed(() => network.value === 'mainnet' ? 'uretro' : 'udretro');
const tokenSymbol = computed(() => network.value === 'mainnet' ? 'RETRO' : 'DRETRO');

const availableTokens = computed(() => [
  { symbol: tokenSymbol.value, denom: tokenDenom.value, icon: "🎮" },
  { symbol: "USDC", denom: "ibc/usdc", icon: "💵" },
  { symbol: "USDT", denom: "ibc/usdt", icon: "💲" },
  { symbol: "ATOM", denom: "ibc/atom", icon: "⚛️" },
  { symbol: "OSMO", denom: "ibc/osmo", icon: "🌊" }
]);

const selectedPool = computed(() => {
  return pools.value.find(p => 
    (p.token_a === poolTokenA.value && p.token_b === poolTokenB.value) ||
    (p.token_a === poolTokenB.value && p.token_b === poolTokenA.value)
  );
});

const poolPrice = computed(() => {
  if (!selectedPool.value) return "0";
  return calculatePoolPrice(selectedPool.value);
});

// Watch amountIn and simulate swap
watch([amountIn, tokenIn, tokenOut], async ([newAmountIn]) => {
  if (!newAmountIn || parseFloat(newAmountIn) <= 0) {
    amountOut.value = "";
    return;
  }

  try {
    const route = await simulateSwap(tokenIn.value, tokenOut.value, newAmountIn);
    amountOut.value = route.amount_out;
  } catch (e) {
    console.error("Swap simulation failed:", e);
  }
});

onMounted(async () => {
  await fetchPools();
});

const handleSwap = async () => {
  if (!address.value) return;
  if (!window.keplr) return;

  swapping.value = true;
  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-1' : 'retrochain-devnet-1';
    
    // Get token denoms
    const tokenInDenom = availableTokens.value.find(t => t.symbol === tokenIn.value)?.denom || tokenDenom.value;
    const tokenOutDenom = availableTokens.value.find(t => t.symbol === tokenOut.value)?.denom || tokenDenom.value;
    
    // Convert to base units (micro tokens)
    const amountInBase = Math.floor(parseFloat(amountIn.value) * 1_000_000).toString();
    const minAmountOut = Math.floor(parseFloat(amountOut.value) * (1 - parseFloat(slippage.value) / 100) * 1_000_000).toString();

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgSwapExactAmountIn",
      value: {
        sender: address.value,
        routes: [{
          pool_id: "1", // Would be determined by routing
          token_out_denom: tokenOutDenom
        }],
        token_in: {
          denom: tokenInDenom,
          amount: amountInBase
        },
        token_out_min_amount: minAmountOut
      }
    };

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "5000" }],
      gas: "200000"
    };

    const result = await window.keplr.signAndBroadcast(
      chainId,
      address.value,
      [msg],
      fee,
      "Swap on RetroChain DEX"
    );

    if (result.code === 0) {
      console.log("Swap successful!", result);
      amountIn.value = "";
      amountOut.value = "";
      // Refresh pools and balances
      await fetchPools();
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Swap failed:", e);
    alert(`Swap failed: ${e.message}`);
  } finally {
    swapping.value = false;
  }
};

const handleAddLiquidity = async () => {
  if (!address.value) return;
  if (!window.keplr) return;

  addingLiquidity.value = true;
  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-1' : 'retrochain-devnet-1';
    
    const tokenADenom = availableTokens.value.find(t => t.symbol === poolTokenA.value)?.denom || tokenDenom.value;
    const tokenBDenom = availableTokens.value.find(t => t.symbol === poolTokenB.value)?.denom || tokenDenom.value;
    
    const amountABase = Math.floor(parseFloat(poolAmountA.value) * 1_000_000).toString();
    const amountBBase = Math.floor(parseFloat(poolAmountB.value) * 1_000_000).toString();

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgAddLiquidity",
      value: {
        sender: address.value,
        token_a: {
          denom: tokenADenom,
          amount: amountABase
        },
        token_b: {
          denom: tokenBDenom,
          amount: amountBBase
        }
      }
    };

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "5000" }],
      gas: "250000"
    };

    const result = await window.keplr.signAndBroadcast(
      chainId,
      address.value,
      [msg],
      fee,
      "Add liquidity to RetroChain DEX"
    );

    if (result.code === 0) {
      console.log("Liquidity added!", result);
      poolAmountA.value = "";
      poolAmountB.value = "";
      await fetchPools();
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Add liquidity failed:", e);
    alert(`Add liquidity failed: ${e.message}`);
  } finally {
    addingLiquidity.value = false;
  }
};

const handlePlaceLimitOrder = async () => {
  if (!address.value) return;
  if (!window.keplr) return;

  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-1' : 'retrochain-devnet-1';
    
    const amountBase = Math.floor(parseFloat(limitAmount.value) * 1_000_000).toString();
    const priceBase = Math.floor(parseFloat(limitPrice.value) * 1_000_000).toString();

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgPlaceLimitOrder",
      value: {
        creator: address.value,
        order_type: limitSide.value.toUpperCase(),
        token_in: tokenIn.value,
        token_out: tokenOut.value,
        amount: amountBase,
        price: priceBase
      }
    };

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "5000" }],
      gas: "200000"
    };

    const result = await window.keplr.signAndBroadcast(
      chainId,
      address.value,
      [msg],
      fee,
      "Place limit order on RetroChain DEX"
    );

    if (result.code === 0) {
      console.log("Order placed!", result);
      limitPrice.value = "";
      limitAmount.value = "";
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Place order failed:", e);
    alert(`Place order failed: ${e.message}`);
  }
};

const handleBridge = async () => {
  if (!address.value) return;
  if (!window.keplr) return;

  bridging.value = true;
  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-1' : 'retrochain-devnet-1';

    if (bridgeChain.value === "Noble") {
      // IBC Transfer from Noble
      const sourceChannel = "channel-0"; // Noble -> RetroChain channel
      const amountBase = Math.floor(parseFloat(bridgeAmount.value) * 1_000_000).toString();

      const msg = {
        typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
        value: {
          sourcePort: "transfer",
          sourceChannel: sourceChannel,
          token: {
            denom: "uusdc", // Noble's USDC denom
            amount: amountBase
          },
          sender: address.value, // Noble address
          receiver: address.value, // RetroChain address
          timeoutHeight: {
            revisionNumber: "0",
            revisionHeight: "0"
          },
          timeoutTimestamp: (Date.now() + 600000) * 1000000, // 10 min timeout
          memo: "Bridge to RetroChain"
        }
      };

      const fee = {
        amount: [{ denom: "uusdc", amount: "1000" }],
        gas: "200000"
      };

      // Sign on Noble chain
      const result = await window.keplr.signAndBroadcast(
        "noble-1",
        address.value,
        [msg],
        fee,
        "IBC Transfer to RetroChain"
      );

      if (result.code === 0) {
        console.log("IBC transfer initiated!", result);
        bridgeAmount.value = "";
      } else {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }
    } else {
      // EVM bridge via Axelar - open Satellite
      await bridgeFromEVM(bridgeChain.value, bridgeAsset.value, bridgeAmount.value);
    }
  } catch (e: any) {
    console.error("Bridge failed:", e);
    alert(`Bridge failed: ${e.message}`);
  } finally {
    bridging.value = false;
  }
};

const swapTokens = () => {
  [tokenIn.value, tokenOut.value] = [tokenOut.value, tokenIn.value];
  [amountIn.value, amountOut.value] = [amountOut.value, amountIn.value];
};
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Native DEX
        </h1>
        <p class="text-sm text-slate-300 mb-4">
          Trade, provide liquidity, and bridge assets on RetroChain
        </p>

        <!-- Connect Wallet -->
        <div v-if="!address" class="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div class="flex items-center gap-3">
            <div class="text-3xl">👛</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-slate-100 mb-1">Connect Your Wallet</div>
              <div class="text-xs text-slate-400">Connect Keplr to trade on the DEX</div>
            </div>
            <button v-if="isAvailable" class="btn btn-primary text-xs" @click="connect">
              Connect Keplr
            </button>
            <a v-else href="https://www.keplr.app/download" target="_blank" class="btn text-xs">
              Install Keplr
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex items-center gap-2 overflow-x-auto">
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'swap' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'swap'"
      >
        🔄 Swap
      </button>
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'pools' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'pools'"
      >
        💧 Pools
      </button>
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'limit' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'limit'"
      >
        📊 Limit Orders
      </button>
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'bridge' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'bridge'"
      >
        🌉 Bridge
      </button>
    </div>

    <!-- Swap Tab -->
    <div v-if="activeTab === 'swap'" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-100">Swap Tokens</h2>
          <div class="flex items-center gap-2">
            <button 
              class="btn text-xs"
              :class="swapTab === 'market' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
              @click="swapTab = 'market'"
            >
              Market
            </button>
            <button 
              class="btn text-xs"
              :class="swapTab === 'limit' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
              @click="swapTab = 'limit'"
            >
              Limit
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <!-- From -->
          <div class="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-slate-400">From</label>
              <div class="text-xs text-slate-500">Balance: 0.00</div>
            </div>
            <div class="flex items-center gap-3">
              <input 
                v-model="amountIn"
                type="number"
                step="0.000001"
                placeholder="0.0"
                class="flex-1 bg-transparent text-2xl text-slate-100 outline-none"
              />
              <select v-model="tokenIn" class="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
                <option v-for="token in availableTokens" :key="token.symbol" :value="token.symbol">
                  {{ token.icon }} {{ token.symbol }}
                </option>
              </select>
            </div>
          </div>

          <!-- Swap Button -->
          <div class="flex justify-center">
            <button 
              class="p-2 rounded-full bg-slate-800 border border-slate-700 hover:border-indigo-500/50 transition-all"
              @click="swapTokens"
            >
              <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          <!-- To -->
          <div class="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-slate-400">To</label>
              <div class="text-xs text-slate-500">Balance: 0.00</div>
            </div>
            <div class="flex items-center gap-3">
              <input 
                v-model="amountOut"
                type="number"
                readonly
                placeholder="0.0"
                class="flex-1 bg-transparent text-2xl text-slate-100 outline-none"
              />
              <select v-model="tokenOut" class="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm">
                <option v-for="token in availableTokens" :key="token.symbol" :value="token.symbol">
                  {{ token.icon }} {{ token.symbol }}
                </option>
              </select>
            </div>
          </div>

          <!-- Slippage Settings -->
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400">Slippage Tolerance</span>
            <div class="flex items-center gap-2">
              <button 
                v-for="s in ['0.1', '0.5', '1.0']" 
                :key="s"
                class="px-2 py-1 rounded border text-[10px]"
                :class="slippage === s ? 'border-indigo-400/70 bg-indigo-500/10 text-indigo-300' : 'border-slate-700 text-slate-400'"
                @click="slippage = s"
              >
                {{ s }}%
              </button>
              <input 
                v-model="slippage"
                type="number"
                step="0.1"
                class="w-16 px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 text-[10px]"
              />
            </div>
          </div>

          <!-- Swap Button -->
          <button 
            class="btn btn-primary w-full"
            @click="handleSwap"
            :disabled="!address || !amountIn || !amountOut || swapping"
          >
            {{ swapping ? 'Swapping...' : address ? 'Swap' : 'Connect Wallet' }}
          </button>
        </div>
      </div>

      <!-- Pool Stats -->
      <div class="card">
        <h3 class="text-sm font-semibold text-slate-100 mb-3">Active Pools</h3>
        <div v-if="dexLoading" class="text-xs text-slate-400">Loading pools...</div>
        <div v-else-if="pools.length === 0" class="text-xs text-slate-400 text-center py-8">
          <div class="text-3xl mb-2">💧</div>
          <div>No pools yet</div>
          <div class="text-[11px] mt-1">Create the first pool!</div>
        </div>
        <div v-else class="space-y-2">
          <div 
            v-for="pool in pools.slice(0, 5)" 
            :key="pool.id"
            class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 hover:border-indigo-500/50 transition-all"
          >
            <div class="text-sm text-slate-100 mb-1">{{ pool.token_a }}/{{ pool.token_b }}</div>
            <div class="text-xs text-slate-400">
              TVL: {{ formatAmount(pool.reserve_a, pool.token_a) }}
            </div>
            <div class="text-xs text-emerald-300 mt-1">
              Fee: {{ (parseFloat(pool.fee_rate) * 100).toFixed(2) }}%
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pools Tab -->
    <div v-if="activeTab === 'pools'" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-4">Add Liquidity</h2>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="space-y-3">
          <div>
            <label class="text-xs text-slate-400 mb-2 block">Token A</label>
            <div class="flex items-center gap-2">
              <select v-model="poolTokenA" class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
                <option v-for="token in availableTokens" :key="token.symbol" :value="token.symbol">
                  {{ token.icon }} {{ token.symbol }}
                </option>
              </select>
              <input 
                v-model="poolAmountA"
                type="number"
                step="0.000001"
                placeholder="0.0"
                class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="text-xs text-slate-400 mb-2 block">Token B</label>
            <div class="flex items-center gap-2">
              <select v-model="poolTokenB" class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
                <option v-for="token in availableTokens" :key="token.symbol" :value="token.symbol">
                  {{ token.icon }} {{ token.symbol }}
                </option>
              </select>
              <input 
                v-model="poolAmountB"
                type="number"
                step="0.000001"
                placeholder="0.0"
                class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
              />
            </div>
          </div>

          <div v-if="selectedPool" class="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <div class="text-xs text-indigo-300 space-y-1">
              <div>Pool exists - adding to existing liquidity</div>
              <div>Current Price: 1 {{ poolTokenA }} = {{ poolPrice }} {{ poolTokenB }}</div>
            </div>
          </div>

          <button 
            class="btn btn-primary w-full"
            @click="handleAddLiquidity"
            :disabled="!address || !poolAmountA || !poolAmountB || addingLiquidity"
          >
            {{ addingLiquidity ? 'Adding...' : 'Add Liquidity' }}
          </button>
        </div>

        <div class="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
          <h3 class="text-sm font-semibold text-slate-100 mb-3">💡 Liquidity Provider Benefits</h3>
          <ul class="text-xs text-slate-300 space-y-2">
            <li>✅ Earn trading fees (0.2% - 0.3% per swap)</li>
            <li>✅ Liquidity mining rewards</li>
            <li>✅ Governance voting power</li>
            <li>✅ Support RetroChain ecosystem</li>
            <li>⚠️ Be aware of impermanent loss</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Limit Orders Tab -->
    <div v-if="activeTab === 'limit'" class="card max-w-2xl mx-auto">
      <h2 class="text-sm font-semibold text-slate-100 mb-4">Place Limit Order</h2>
      
      <div class="space-y-3">
        <div class="flex items-center gap-2">
          <button 
            class="flex-1 py-2 rounded-lg border transition-all"
            :class="limitSide === 'buy' ? 'border-emerald-400/70 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 text-slate-400'"
            @click="limitSide = 'buy'"
          >
            Buy
          </button>
          <button 
            class="flex-1 py-2 rounded-lg border transition-all"
            :class="limitSide === 'sell' ? 'border-rose-400/70 bg-rose-500/10 text-rose-300' : 'border-slate-700 text-slate-400'"
            @click="limitSide = 'sell'"
          >
            Sell
          </button>
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-2 block">Price</label>
          <input 
            v-model="limitPrice"
            type="number"
            step="0.000001"
            placeholder="0.0"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-2 block">Amount</label>
          <input 
            v-model="limitAmount"
            type="number"
            step="0.000001"
            placeholder="0.0"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>

        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-slate-400">Total</span>
            <span class="text-slate-200">
              {{ limitPrice && limitAmount ? (parseFloat(limitPrice) * parseFloat(limitAmount)).toFixed(6) : '0.0' }} USDC
            </span>
          </div>
        </div>

        <button 
          class="btn btn-primary w-full"
          @click="handlePlaceLimitOrder"
          :disabled="!address || !limitPrice || !limitAmount"
        >
          Place {{ limitSide === 'buy' ? 'Buy' : 'Sell' }} Order
        </button>
      </div>
    </div>

    <!-- Bridge Tab -->
    <div v-if="activeTab === 'bridge'" class="card max-w-2xl mx-auto">
      <h2 class="text-sm font-semibold text-slate-100 mb-4">Bridge Assets to RetroChain</h2>
      
      <div class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Asset</label>
          <select v-model="bridgeAsset" class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
            <option v-for="asset in bridgeAssets" :key="asset.symbol" :value="asset.symbol">
              {{ asset.icon }} {{ asset.name }} ({{ asset.symbol }})
            </option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-2 block">From Chain</label>
          <select v-model="bridgeChain" class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
            <option value="Noble">Noble (Native USDC)</option>
            <option value="Ethereum">Ethereum</option>
            <option value="Polygon">Polygon</option>
            <option value="Arbitrum">Arbitrum</option>
            <option value="BSC">BSC</option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-2 block">Amount</label>
          <input 
            v-model="bridgeAmount"
            type="number"
            step="0.000001"
            placeholder="0.0"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>

        <div class="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <div class="text-xs text-indigo-300 space-y-1">
            <div>⏱️ Estimated Time: {{ getEstimatedTime(bridgeChain, 'retrochain-1') }}</div>
            <div>💰 Bridge Fee: {{ getBridgeFee(bridgeChain, bridgeAsset, bridgeAmount) }}</div>
            <div>📍 Destination: {{ address || 'Connect wallet first' }}</div>
          </div>
        </div>

        <button 
          class="btn btn-primary w-full"
          @click="handleBridge"
          :disabled="!address || !bridgeAmount || bridging"
        >
          {{ bridging ? 'Bridging...' : 'Bridge to RetroChain' }}
        </button>
      </div>
    </div>
  </div>
</template>
