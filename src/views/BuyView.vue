<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useNetwork } from "@/composables/useNetwork";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import RcDisclaimer from "@/components/RcDisclaimer.vue";

const { current: network } = useNetwork();
const { address, connect, isAvailable } = useKeplr();
const toast = useToast();

const selectedMethod = ref<'swap' | 'pool' | 'bridge' | 'faucet'>('swap');
const swapAmount = ref("");
const swapFromToken = ref("USDC");
const poolAmount1 = ref("");
const poolAmount2 = ref("");
const selectedPool = ref("RETRO/USDC");

// Real Osmosis pool IDs (these would be actual pool IDs once RETRO is listed)
const liquidityPools = [
  {
    id: "TBD",
    name: "RETRO/USDC",
    tvl: "$0",
    apr: "TBD",
    myLiquidity: "$0",
    status: "pending"
  },
  {
    id: "TBD", 
    name: "RETRO/ATOM",
    tvl: "$0",
    apr: "TBD",
    myLiquidity: "$0",
    status: "pending"
  }
];

const swapOptions = [
  {
    name: "Squid Router",
    icon: "🦑",
    description: "Cross-chain swap from any chain to RETRO",
    url: "https://app.squidrouter.com",
    widget: true
  },
  {
    name: "Skip Protocol",
    icon: "⚡",
    description: "Fast IBC swaps across Cosmos chains",
    url: "https://go.skip.build",
    widget: true
  },
  {
    name: "Osmosis Frontier",
    icon: "🌊",
    description: "Create or join RETRO liquidity pools",
    url: "https://frontier.osmosis.zone",
    widget: false
  }
];

const bridgeOptions = [
  {
    name: "Axelar Bridge",
    icon: "🌉",
    description: "Bridge assets from EVM chains to Cosmos",
    url: "https://satellite.money"
  },
  {
    name: "IBC Transfer",
    icon: "🔗",
    description: "Native Cosmos IBC transfers",
    instructions: true
  }
];

const tokenInfo = computed(() => ({
  symbol: network.value === 'mainnet' ? 'RETRO' : 'DRETRO',
  denom: network.value === 'mainnet' ? 'uretro' : 'udretro',
  decimals: 6,
  chainId: 'retrochain-1'
}));

const copyAddress = async () => {
  if (address.value) {
    await navigator.clipboard?.writeText(address.value);
    toast.showSuccess("Address copied to clipboard!");
  }
};

// Squid Router integration
const initSquidWidget = () => {
  if (typeof window !== 'undefined' && (window as any).squid) {
    (window as any).squid.init({
      integratorId: 'retrochain-explorer',
      companyName: 'RetroChain',
      style: {
        neutralContent: '#959BB2',
        baseContent: '#E8ECF2',
        base100: '#0f1429',
        base200: '#0a0e27',
        base300: '#06091a',
        error: '#ED6A5E',
        warning: '#FFB155',
        success: '#2EAEB0',
        primary: '#6366f1',
        secondary: '#8b5cf6',
        secondaryContent: '#F7F7F8',
        neutral: '#1a1f37',
        roundedBtn: '26px',
        roundedCornerBtn: '999px',
        roundedBox: '1rem',
        roundedDropDown: '20rem'
      },
      slippage: 1.5,
      infiniteApproval: false,
      enableExpress: true,
      apiUrl: 'https://apiplus.squidrouter.com',
      mainLogoUrl: '/RCIcon.svg',
      titles: {
        swap: 'Buy RETRO',
        settings: 'Settings',
        wallets: 'Wallets',
        tokens: 'Select Token',
        chains: 'Select Chain',
        history: 'History',
        transaction: 'Transaction',
        allTokens: 'Select Token',
        destination: 'Destination address'
      }
    });
  }
};

onMounted(() => {
  // Load Squid widget script
  const script = document.createElement('script');
  script.src = 'https://cdn.squidrouter.com/widget/v2/squid.min.js';
  script.async = true;
  script.onload = initSquidWidget;
  document.head.appendChild(script);
});

const openSkipWidget = () => {
  const skipUrl = `https://go.skip.build/?src_chain=1&dest_chain=retrochain-1&dest_asset=uretro${address.value ? `&dest_address=${address.value}` : ''}`;
  window.open(skipUrl, '_blank');
};

const openOsmosisFrontier = () => {
  // Osmosis Frontier URL for creating a pool
  const poolUrl = 'https://frontier.osmosis.zone/pool/create';
  window.open(poolUrl, '_blank');
};

const handleAddLiquidity = () => {
  if (!address.value) {
    alert('Please connect your wallet first');
    return;
  }
  // This would open Osmosis pool interface
  const poolUrl = `https://app.osmosis.zone/pool/${liquidityPools.find(p => p.name === selectedPool.value)?.id}`;
  window.open(poolUrl, '_blank');
};

const estimateSwap = computed(() => {
  if (!swapAmount.value) return '0';
  // Mock calculation - in reality this would call Osmosis or Skip API
  const rate = 0.85; // Example: 1 USDC = 0.85 RETRO
  return (parseFloat(swapAmount.value) * rate).toFixed(6);
});

const openBridge = (url: string) => {
  window.open(url, '_blank');
};
</script>

<template>
<div class="space-y-4">
    <!-- DISCLAIMER BANNER -->
    <RcDisclaimer type="info" title="🚀 Cross-Chain Swaps Active">
      <p>
        <strong>Swap any token from any chain to RETRO using our integrated cross-chain swap providers!</strong>
      </p>
      <p class="mt-2">
        Squid Router supports 40+ chains including Ethereum, Polygon, Arbitrum, and all Cosmos chains. 
        Skip Protocol enables fast IBC swaps across the Cosmos ecosystem.
      </p>
      <p class="mt-2">
        <strong>Liquidity pools</strong> can be created on Osmosis Frontier. Once RetroChain's native DEX module is fully deployed, 
        you'll be able to create pools directly on RetroChain. Bridge functionality via Axelar and IBC is operational.
      </p>
    </RcDisclaimer>

  <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Buy {{ tokenInfo.symbol }}
        </h1>
        <p class="text-sm text-slate-300 mb-4">
          Swap any token cross-chain or add liquidity to earn fees
        </p>

        <!-- Connect Wallet -->
        <div v-if="!address" class="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div class="flex items-center gap-3">
            <div class="text-3xl">👛</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-slate-100 mb-1">Connect Your Wallet</div>
              <div class="text-xs text-slate-400">Connect Keplr to swap tokens and provide liquidity</div>
            </div>
            <button v-if="isAvailable" class="btn btn-primary text-xs" @click="connect">
              Connect Keplr
            </button>
            <a v-else href="https://www.keplr.app/download" target="_blank" class="btn text-xs">
              Install Keplr
            </a>
          </div>
        </div>

        <!-- Wallet Connected -->
        <div v-else class="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
          <div class="flex items-center gap-3">
            <div class="text-3xl">✅</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-slate-100 mb-1">Wallet Connected</div>
              <div class="flex items-center gap-2">
                <code class="text-xs text-slate-300">{{ address.slice(0, 20) }}...</code>
                <button class="btn text-[10px]" @click="copyAddress">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Method Selection -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'swap' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'swap'"
      >
        <div class="text-2xl mb-2">🔄</div>
        <div class="text-sm font-semibold text-slate-100">Swap</div>
        <div class="text-xs text-slate-400">Cross-chain</div>
      </button>

      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'pool' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'pool'"
      >
        <div class="text-2xl mb-2">💧</div>
        <div class="text-sm font-semibold text-slate-100">Liquidity</div>
        <div class="text-xs text-slate-400">Earn Fees</div>
      </button>

      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'bridge' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'bridge'"
      >
        <div class="text-2xl mb-2">🌉</div>
        <div class="text-sm font-semibold text-slate-100">Bridge</div>
        <div class="text-xs text-slate-400">Transfer</div>
      </button>

      <button
        v-if="network !== 'mainnet'"
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'faucet' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'faucet'"
      >
        <div class="text-2xl mb-2">🚰</div>
        <div class="text-sm font-semibold text-slate-100">Faucet</div>
        <div class="text-xs text-slate-400">Test Tokens</div>
      </button>
    </div>

    <!-- Swap Tab -->
    <div v-if="selectedMethod === 'swap'" class="space-y-3">
      <!-- Squid Router Widget Embed -->
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">🦑 Cross-Chain Swap (Squid Router)</h2>
        <p class="text-xs text-slate-400 mb-4">
          Swap from <strong>any token on any chain</strong> to RETRO. Supports Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, and all Cosmos chains.
        </p>
        
        <!-- Squid Widget Container -->
        <div id="squid-widget" class="min-h-[600px] rounded-lg overflow-hidden"></div>
        
        <div class="mt-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <div class="text-xs text-indigo-300 space-y-1">
            <div>✅ Automatic routing across 40+ chains</div>
            <div>✅ Best rates via aggregation</div>
            <div>✅ Gasless swaps on some chains</div>
            <div>✅ No registration required</div>
          </div>
        </div>
      </div>

      <!-- Skip Protocol -->
      <div class="card hover:border-indigo-500/50 transition-all cursor-pointer" @click="openSkipWidget">
        <div class="flex items-center gap-4">
          <div class="text-4xl">⚡</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">Skip Protocol</div>
            <div class="text-sm text-slate-400 mb-2">Fast IBC swaps across Cosmos chains</div>
            <div class="text-xs text-slate-500">
              Swap ATOM, OSMO, USDC, or any IBC token to RETRO
            </div>
          </div>
          <div class="text-slate-400">→</div>
        </div>
      </div>

      <!-- Osmosis Frontier -->
      <div class="card hover:border-indigo-500/50 transition-all cursor-pointer" @click="openOsmosisFrontier">
        <div class="flex items-center gap-4">
          <div class="text-4xl">🌊</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">Osmosis Frontier</div>
            <div class="text-sm text-slate-400 mb-2">Create or join RETRO liquidity pools</div>
            <div class="text-xs text-slate-500">
              Bootstrap liquidity for RETRO/USDC, RETRO/ATOM pools
            </div>
          </div>
          <div class="text-slate-400">→</div>
        </div>
      </div>
    </div>

    <!-- Liquidity Pool Tab -->
    <div v-if="selectedMethod === 'pool'" class="space-y-3">
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">💧 Liquidity Pools</h2>
        <p class="text-xs text-slate-400 mb-4">
          Provide liquidity to earn trading fees and liquidity mining rewards
        </p>

        <!-- Pool Selection -->
        <div class="space-y-2 mb-4">
          <div
            v-for="pool in liquidityPools"
            :key="pool.id"
            class="p-4 rounded-lg border transition-all cursor-pointer"
            :class="selectedPool === pool.name ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
            @click="selectedPool = pool.name"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm font-semibold text-slate-100">{{ pool.name }}</div>
              <span class="badge text-xs" :class="pool.status === 'active' ? 'border-emerald-400/60 text-emerald-200' : 'border-amber-400/60 text-amber-200'">
                {{ pool.status === 'active' ? 'Active' : 'Pending Creation' }}
              </span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div class="text-slate-500">TVL</div>
                <div class="text-slate-300 font-mono">{{ pool.tvl }}</div>
              </div>
              <div>
                <div class="text-slate-500">APR</div>
                <div class="text-emerald-300 font-mono">{{ pool.apr }}</div>
              </div>
              <div>
                <div class="text-slate-500">My Liquidity</div>
                <div class="text-slate-300 font-mono">{{ pool.myLiquidity }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Liquidity Form -->
        <div v-if="address" class="space-y-3 p-4 rounded-lg bg-slate-900/60 border border-slate-700">
          <h3 class="text-xs font-semibold text-slate-100">Add Liquidity to {{ selectedPool }}</h3>
          
          <div>
            <label class="text-xs text-slate-400 mb-2 block">{{ selectedPool.split('/')[0] }} Amount</label>
            <input 
              v-model="poolAmount1"
              type="number"
              step="0.000001"
              placeholder="0.000000"
              class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
            />
          </div>

          <div>
            <label class="text-xs text-slate-400 mb-2 block">{{ selectedPool.split('/')[1] }} Amount</label>
            <input 
              v-model="poolAmount2"
              type="number"
              step="0.000001"
              placeholder="0.000000"
              class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
            />
          </div>

          <button 
            class="btn btn-primary w-full"
            @click="handleAddLiquidity"
            :disabled="!poolAmount1 || !poolAmount2"
          >
            Add Liquidity on Osmosis
          </button>
        </div>

        <!-- Create Pool CTA -->
        <div class="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 mt-3">
          <div class="text-sm text-slate-100 mb-2">🚀 Bootstrap RETRO Liquidity</div>
          <div class="text-xs text-slate-400 mb-3">
            Be among the first liquidity providers and earn maximum fees
          </div>
          <button class="btn text-xs" @click="openOsmosisFrontier">
            Create Pool on Osmosis
          </button>
        </div>
      </div>
    </div>

    <!-- Bridge Tab -->
    <div v-if="selectedMethod === 'bridge'" class="space-y-3">
      <div
        v-for="bridge in bridgeOptions"
        :key="bridge.name"
        class="card"
        :class="!bridge.instructions ? 'hover:border-indigo-500/50 transition-all cursor-pointer' : ''"
        @click="!bridge.instructions && bridge.url && openBridge(bridge.url)"
      >
        <div class="flex items-center gap-4">
          <div class="text-4xl">{{ bridge.icon }}</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">{{ bridge.name }}</div>
            <div class="text-sm text-slate-400 mb-3">{{ bridge.description }}</div>
            
            <!-- IBC Instructions -->
            <div v-if="bridge.instructions" class="text-xs text-slate-500 space-y-1">
              <div>1. Open Keplr wallet extension</div>
              <div>2. Click "Send" and select "IBC Transfer"</div>
              <div>3. Choose RetroChain as destination</div>
              <div>4. Enter amount and confirm</div>
              <div>5. Tokens arrive in ~60 seconds</div>
            </div>
          </div>
          <div v-if="!bridge.instructions" class="text-slate-400">→</div>
        </div>
      </div>
    </div>

    <!-- Faucet Tab (Testnet Only) -->
    <div v-if="selectedMethod === 'faucet' && network !== 'mainnet'" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-3">🚰 Testnet Faucet</h2>
      <p class="text-xs text-slate-400 mb-4">
        Get free {{ tokenInfo.symbol }} tokens for testing purposes
      </p>
      
      <div v-if="!address" class="text-xs text-slate-400 text-center py-8">
        Connect your wallet to use the faucet
      </div>
      
      <div v-else class="space-y-3">
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
          <div class="text-xs text-slate-400 mb-1">Your Address</div>
          <div class="flex items-center gap-2">
            <code class="text-xs text-slate-300 font-mono">{{ address }}</code>
            <button class="btn text-[10px]" @click="copyAddress">Copy</button>
          </div>
        </div>
        
        <button class="btn btn-primary w-full">
          Request Testnet Tokens
        </button>
        
        <div class="text-xs text-slate-500 text-center">
          You can request tokens once every 24 hours
        </div>
      </div>
    </div>

    <!-- Token Info -->
    <div class="card">
      <h3 class="text-sm font-semibold text-slate-100 mb-3">Token Information</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div class="text-slate-400 mb-1">Symbol</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.symbol }}</div>
        </div>
        <div>
          <div class="text-slate-400 mb-1">Denomination</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.denom }}</div>
        </div>
        <div>
          <div class="text-slate-400 mb-1">Decimals</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.decimals }}</div>
        </div>
        <div>
          <div class="text-slate-400 mb-1">Chain ID</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.chainId }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
