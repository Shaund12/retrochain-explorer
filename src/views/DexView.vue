<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useKeplr } from "@/composables/useKeplr";
import { useDex } from "@/composables/useDex";
import { useBridge } from "@/composables/useBridge";
import { useNetwork } from "@/composables/useNetwork";
import { formatAmount } from "@/utils/format";
import { useToast } from "@/composables/useToast";
import { useAccount } from "@/composables/useAccount";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { DEFAULT_WBTC_DENOM_ON_COSMOS, DEFAULT_WBTC_IBC_DENOM_ON_RETRO } from "@/constants/tokens";

interface TokenOption {
  symbol: string;
  denom: string;
  icon: string;
  decimals: number;
}

type BridgeAssetKind = "RETRO" | "ATOM" | "WBTC" | "OSMO";
type DexTab = "swap" | "pools" | "limit" | "bridge" | "create";

const { address, connect, isAvailable } = useKeplr();
const { pools, loading: dexLoading, fetchPools, simulateSwap, calculatePoolPrice, isModuleAvailable } = useDex();
const { assets: bridgeAssets, bridgeFromNoble, bridgeFromEVM, getEstimatedTime, getBridgeFee } = useBridge();
const { current: network } = useNetwork();
const toast = useToast();
const { balances, loading: accountLoading, load: loadAccount } = useAccount();

const activeTab = ref<DexTab>('bridge');
const swapTab = ref<'market' | 'limit'>('market');
const dexFeaturesEnabled = import.meta.env.VITE_ENABLE_DEX === "true";

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

const isMainnet = computed(() => network.value === "mainnet");
const retroToCosmosChannel = import.meta.env.VITE_IBC_CHANNEL_RETRO_COSMOS || "channel-0";
const cosmosToRetroChannel = import.meta.env.VITE_IBC_CHANNEL_COSMOS_RETRO || "channel-1638";
const retroToOsmosisChannel = import.meta.env.VITE_IBC_CHANNEL_RETRO_OSMOSIS || "channel-1";
const osmosisToRetroChannel = import.meta.env.VITE_IBC_CHANNEL_OSMOSIS_RETRO || "channel-108593";
const nobleToOsmosisChannel = import.meta.env.VITE_IBC_CHANNEL_NOBLE_OSMOSIS || "channel-750";
const cosmosHubChainId = import.meta.env.VITE_COSMOS_CHAIN_ID || "cosmoshub-4";
const ibcDirection = ref<"retroToCosmos" | "cosmosToRetro">("retroToCosmos");
const retroToCosmosAmount = ref("");
const retroToCosmosRecipient = ref("");
const retroToCosmosMemo = ref("");
const cosmosToRetroAmount = ref("");
const cosmosToRetroMemo = ref("");
const ibcTransferring = ref(false);
const cosmosWalletAddress = ref("");
const fetchingCosmosAddress = ref(false);
const cosmosInboundConfigured = computed(() => Boolean(cosmosToRetroChannel));
const ATOM_IBC_DENOM_ON_RETRO = "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2";
const RETRO_IBC_DENOM_ON_COSMOS = "ibc/54B4719F6F076B54A05D96E0D9CB0AA1770B9993C904A03C6110FFD0525B1B9A";
const WBTC_IBC_DENOM_ON_RETRO = import.meta.env.VITE_IBC_DENOM_WBTC_ON_RETRO || DEFAULT_WBTC_IBC_DENOM_ON_RETRO;
const WBTC_DENOM_ON_COSMOS =
  import.meta.env.VITE_DENOM_WBTC_ON_COSMOS ||
  import.meta.env.VITE_IBC_DENOM_WBTC_ON_COSMOS ||
  DEFAULT_WBTC_DENOM_ON_COSMOS;
const retroToCosmosAsset = ref<BridgeAssetKind>("RETRO");
const cosmosToRetroAsset = ref<BridgeAssetKind>("RETRO");

// Create pool state
const createTokenA = ref("RETRO");
const createTokenB = ref("USDC");
const createAmountA = ref("");
const createAmountB = ref("");
const createSwapFee = ref("0.3");
const creatingPool = ref(false);

const tokenDenom = computed(() => network.value === 'mainnet' ? 'uretro' : 'udretro');
const tokenSymbol = computed(() => network.value === 'mainnet' ? 'RETRO' : 'DRETRO');
const retroToCosmosAssetLabel = computed(() => (retroToCosmosAsset.value === "RETRO" ? tokenSymbol.value : retroToCosmosAsset.value));
const cosmosToRetroAssetLabel = computed(() => (cosmosToRetroAsset.value === "RETRO" ? tokenSymbol.value : cosmosToRetroAsset.value));
const dexAvailable = computed(() => isModuleAvailable.value);
const dexLive = computed(() => dexFeaturesEnabled && dexAvailable.value);
const poolCount = computed(() => pools.value.length);
const ibcCosmosLabel = computed(() => `Retro ${retroToCosmosChannel} / Cosmos ${cosmosToRetroChannel || '—'}`);
const ibcOsmosisLabel = computed(() => `Retro ${retroToOsmosisChannel} / Osmosis ${osmosisToRetroChannel}`);

const USDC_DENOMS_ON_RETRO = [
  // Noble USDC -> Osmosis -> Retro (known hash)
  "ibc/1EC890E294140C5562003AF676C013A2C75136F32A323274D91CEB9245FA593F",
  // Legacy placeholder / future compatibility
  "ibc/usdc"
];

const retroAssetOptions = computed<{ value: BridgeAssetKind; label: string }[]>(() => [
  { value: "RETRO", label: tokenSymbol.value },
  { value: "ATOM", label: "ATOM" },
  { value: "OSMO", label: "OSMO" },
  { value: "WBTC", label: "WBTC" }
]);

// Cosmos Hub only has RETRO (via IBC) or ATOM inbound; WBTC optional when configured
const cosmosAssetOptions = computed<{ value: BridgeAssetKind; label: string }[]>(() => [
  { value: "RETRO", label: tokenSymbol.value },
  { value: "ATOM", label: "ATOM" },
  { value: "WBTC", label: "WBTC" }
]);

const USDT_DENOMS_ON_RETRO = [
  // Placeholder until a real hash denom is known/added
  "ibc/usdt"
];

const OSMO_DENOMS_ON_RETRO = [
  // Osmosis -> Retro (known hash)
  "ibc/FE42E434C713D0A118E3CE46FC6A4B55A5C2B330A2A880C4D7A1B7935DA1E5A0",
  // Legacy placeholder / future compatibility
  "ibc/osmo"
];

const customTokens = ref<TokenOption[]>([]);

const availableTokens = computed<TokenOption[]>(() => [
  { symbol: tokenSymbol.value, denom: tokenDenom.value, icon: "🎮", decimals: 6 },
  { symbol: "USDC", denom: USDC_DENOMS_ON_RETRO[0], icon: "💵", decimals: 6 },
  { symbol: "USDT", denom: USDT_DENOMS_ON_RETRO[0], icon: "💲", decimals: 6 },
  { symbol: "ATOM", denom: ATOM_IBC_DENOM_ON_RETRO, icon: "⚛️", decimals: 6 },
  { symbol: "OSMO", denom: OSMO_DENOMS_ON_RETRO[0], icon: "🌊", decimals: 6 },
  ...customTokens.value
]);

const customSymbol = ref("");
const customDenom = ref("");
const customDecimals = ref("6");

const addCustomToken = () => {
  const symbol = customSymbol.value.trim().toUpperCase();
  const denom = customDenom.value.trim();
  const decimalsNum = Number(customDecimals.value || "6");
  if (!symbol || !denom) {
    toast.showWarning("Enter symbol and denom for custom token.");
    return;
  }
  if (!Number.isFinite(decimalsNum) || decimalsNum < 0 || decimalsNum > 18) {
    toast.showWarning("Decimals must be between 0 and 18.");
    return;
  }
  const exists = availableTokens.value.some((t) => t.symbol === symbol || t.denom === denom);
  if (exists) {
    toast.showInfo("Token already listed.");
    return;
  }
  customTokens.value.push({ symbol, denom, icon: "🔗", decimals: decimalsNum });
  customSymbol.value = "";
  customDenom.value = "";
  customDecimals.value = "6";
  toast.showSuccess(`Added custom token ${symbol}`);
};

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

const findTokenOption = (symbol: string) => availableTokens.value.find((t) => t.symbol === symbol);

const decimalsForSymbol = (symbol: string) => findTokenOption(symbol)?.decimals ?? 6;
const toBaseUnits = (amount: string, symbol: string) => {
  const dec = decimalsForSymbol(symbol);
  const amt = parseFloat(amount || "0");
  return Math.floor(amt * Math.pow(10, dec)).toString();
};

const tokenBalances = computed(() =>
  availableTokens.value.map((t) => ({
    symbol: t.symbol,
    denom: t.denom,
    formatted: formatAmount(rawBalanceForDenom(t.denom), t.denom, { minDecimals: 2, maxDecimals: t.decimals })
  }))
);

const candidateDenomsForSymbol = (symbol: string): string[] => {
  if (symbol === tokenSymbol.value) return [tokenDenom.value];
  if (symbol === "USDC") return USDC_DENOMS_ON_RETRO;
  if (symbol === "USDT") return USDT_DENOMS_ON_RETRO;
  if (symbol === "ATOM") return [ATOM_IBC_DENOM_ON_RETRO];
  if (symbol === "OSMO") return OSMO_DENOMS_ON_RETRO;
  const token = findTokenOption(symbol);
  return token ? [token.denom] : [];
};

const rawBalanceForSymbol = (symbol: string) => {
  const candidates = candidateDenomsForSymbol(symbol);
  for (const denom of candidates) {
    const entry = balances.value.find((b) => b.denom === denom);
    if (entry) return entry.amount ?? "0";
  }
  return "0";
};

const formatTokenBalance = (symbol: string) => {
  const token = findTokenOption(symbol);
  if (!token) return "0.00";
  return formatAmount(rawBalanceForSymbol(symbol), token.denom, { minDecimals: 2, maxDecimals: 6 });
};

const rawBalanceForDenom = (denom?: string) => {
  if (!denom) return "0";
  const entry = balances.value.find((b) => b.denom === denom);
  return entry?.amount ?? "0";
};

const wbtcBalanceDisplay = computed(() => {
  if (!WBTC_IBC_DENOM_ON_RETRO) return "0.00 WBTC";
  return formatAmount(rawBalanceForDenom(WBTC_IBC_DENOM_ON_RETRO), WBTC_IBC_DENOM_ON_RETRO, {
    minDecimals: 2,
    maxDecimals: 8
  });
});

const setTab = (tab: DexTab) => {
  activeTab.value = tab;
};

const assetDecimals = (asset: BridgeAssetKind) => (asset === "WBTC" ? 8 : 6);
const toBaseAmount = (amountFloat: number, asset: BridgeAssetKind) => {
  const decimals = assetDecimals(asset);
  return Math.floor(amountFloat * Math.pow(10, decimals)).toString();
};

const retroBalanceDisplay = computed(() => formatTokenBalance(tokenSymbol.value));
const ibcAtomBalanceDisplay = computed(() => formatTokenBalance("ATOM"));

const setMaxSwapAmount = () => {
  const token = findTokenOption(tokenIn.value);
  if (!token) return;
  const raw = rawBalanceForSymbol(tokenIn.value);
  const amount = Number(raw) / Math.pow(10, token.decimals);
  if (!Number.isFinite(amount) || amount <= 0) return;
  amountIn.value = amount.toFixed(Math.min(token.decimals, 6));
};

// Watch amountIn and simulate swap
watch([amountIn, tokenIn, tokenOut, dexAvailable], async ([newAmountIn, , , available]) => {
  if (!newAmountIn || parseFloat(newAmountIn) <= 0) {
    amountOut.value = "";
    return;
  }
  if (!available) {
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

watch(
  () => address.value,
  async (newAddress, oldAddress) => {
    if (newAddress && newAddress !== oldAddress) {
      await loadAccount(newAddress);
    }
    if (!newAddress) {
      balances.value = [];
    }
  }
);

onMounted(async () => {
  await fetchPools();
  if (address.value) {
    await loadAccount(address.value);
  }
});

const ensureDexAvailable = () => {
  if (!dexAvailable.value) {
    toast.showInfo("Native DEX module isn't enabled on this network yet.");
    return false;
  }
  return true;
};

const handleSwap = async () => {
  if (!address.value) return;
  if (!window.keplr) return;
  if (!ensureDexAvailable()) return;

  swapping.value = true;
  toast.showInfo("Preparing swap transaction...");
  
  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';
    
    // Get token denoms
    const tokenInDenom = availableTokens.value.find(t => t.symbol === tokenIn.value)?.denom || tokenDenom.value;
    const tokenOutDenom = availableTokens.value.find(t => t.symbol === tokenOut.value)?.denom || tokenDenom.value;
    
    // Convert to base units (micro tokens)
    const amountInBase = toBaseUnits(amountIn.value, tokenIn.value);
    const minAmountOut = toBaseUnits((parseFloat(amountOut.value) * (1 - parseFloat(slippage.value) / 100)).toString(), tokenOut.value);

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgSwapExactAmountIn",
      value: {
        sender: address.value,
        routes: [{
          poolId: "1", // Would be determined by routing
          tokenOutDenom: tokenOutDenom
        }],
        tokenIn: {
          denom: tokenInDenom,
          amount: amountInBase
        },
        tokenOutMinAmount: minAmountOut
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
      toast.showTxSuccess(result.transactionHash || "");
      amountIn.value = "";
      amountOut.value = "";
      // Refresh pools and balances
      await Promise.all([
        fetchPools(),
        loadAccount(address.value)
      ]);
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Swap failed:", e);
    toast.showTxError(e.message || "Transaction failed");
  } finally {
    swapping.value = false;
  }
};

const handleAddLiquidity = async () => {
  if (!address.value) return;
  if (!window.keplr) return;
  if (!ensureDexAvailable()) return;

  addingLiquidity.value = true;
  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';
    
    const tokenADenom = availableTokens.value.find(t => t.symbol === poolTokenA.value)?.denom || tokenDenom.value;
    const tokenBDenom = availableTokens.value.find(t => t.symbol === poolTokenB.value)?.denom || tokenDenom.value;
    
    const amountABase = toBaseUnits(poolAmountA.value, poolTokenA.value);
    const amountBBase = toBaseUnits(poolAmountB.value, poolTokenB.value);

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgAddLiquidity",
      value: {
        sender: address.value,
        tokenA: {
          denom: tokenADenom,
          amount: amountABase
        },
        tokenB: {
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
      await Promise.all([
        fetchPools(),
        loadAccount(address.value)
      ]);
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
  if (!ensureDexAvailable()) return;

  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';
    
    const amountBase = toBaseUnits(limitAmount.value, tokenIn.value);
    const priceBase = Math.floor(parseFloat(limitPrice.value) * 1_000_000).toString();

    const tokenInDenom = availableTokens.value.find((t) => t.symbol === tokenIn.value)?.denom || tokenDenom.value;
    const tokenOutDenom = availableTokens.value.find((t) => t.symbol === tokenOut.value)?.denom || tokenDenom.value;

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgPlaceLimitOrder",
      value: {
        creator: address.value,
        orderType: limitSide.value.toUpperCase(),
        tokenIn: tokenInDenom,
        tokenOut: tokenOutDenom,
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
      await loadAccount(address.value);
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
    const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';

    if (bridgeChain.value === "Noble") {
      // IBC Transfer from Noble (uusdc) → Osmosis channel-750, then onwards to Retro via Osmosis → Retro channel-108593
      const sourceChannel = nobleToOsmosisChannel; // Noble → Osmosis
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

const buildIbcTimeoutTimestamp = () => ((Date.now() + 15 * 60 * 1000) * 1_000_000).toString();

const ensureCosmosAccount = async () => {
  if (!window.keplr) {
    toast.showError("Keplr wallet not detected.");
    throw new Error("Keplr unavailable");
  }
  if (cosmosWalletAddress.value) {
    return cosmosWalletAddress.value;
  }
  fetchingCosmosAddress.value = true;
  try {
    await window.keplr.enable(cosmosHubChainId);
    const key = await window.keplr.getKey(cosmosHubChainId);
    cosmosWalletAddress.value = key?.bech32Address || "";
    if (!retroToCosmosRecipient.value && cosmosWalletAddress.value) {
      retroToCosmosRecipient.value = cosmosWalletAddress.value;
    }
    return cosmosWalletAddress.value;
  } catch (err: any) {
    toast.showTxError(err?.message || "Unable to access Cosmos Hub in Keplr");
    throw err;
  } finally {
    fetchingCosmosAddress.value = false;
  }
};

const handleRetroToCosmosTransfer = async () => {
  if (!address.value) {
    toast.showInfo("Connect your RetroChain wallet first.");
    return;
  }
  if (!window.keplr) {
    toast.showError("Keplr wallet not detected.");
    return;
  }
  if (!isMainnet.value) {
    toast.showWarning("IBC transfers to Cosmos Hub are only enabled on mainnet.");
    return;
  }
  if (!retroToCosmosChannel) {
    toast.showWarning("Set VITE_IBC_CHANNEL_RETRO_COSMOS in your env to enable this transfer.");
    return;
  }

  const recipient = retroToCosmosRecipient.value.trim();
  if (!recipient) {
    toast.showWarning("Enter a Cosmos Hub (cosmos1...) recipient address.");
    return;
  }

  const amountFloat = parseFloat(retroToCosmosAmount.value);
  if (!Number.isFinite(amountFloat) || amountFloat <= 0) {
    toast.showWarning(`Enter a valid ${retroToCosmosAssetLabel.value} amount.`);
    return;
  }

  const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';
  const selectedAsset = retroToCosmosAsset.value;
  const amountBase = toBaseAmount(amountFloat, selectedAsset);
  let tokenDenomToSend: string | null;
  if (selectedAsset === "RETRO") {
    tokenDenomToSend = tokenDenom.value;
  } else if (selectedAsset === "ATOM") {
    tokenDenomToSend = ATOM_IBC_DENOM_ON_RETRO;
  } else if (selectedAsset === "OSMO") {
    tokenDenomToSend = OSMO_DENOMS_ON_RETRO[0];
  } else {
    tokenDenomToSend = WBTC_IBC_DENOM_ON_RETRO || null;
  }
  if (!tokenDenomToSend) {
    toast.showWarning("WBTC denom for RetroChain is not configured.");
    return;
  }
  const memo = retroToCosmosMemo.value || `IBC transfer to Cosmos Hub (${retroToCosmosAssetLabel.value})`;

  const msg = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: {
      sourcePort: "transfer",
      sourceChannel: retroToCosmosChannel,
      token: {
        denom: tokenDenomToSend,
        amount: amountBase
      },
      sender: address.value,
      receiver: recipient,
      timeoutHeight: {
        revisionNumber: "0",
        revisionHeight: "0"
      },
      timeoutTimestamp: buildIbcTimeoutTimestamp(),
      memo
    }
  };

  const fee = {
    amount: [{ denom: tokenDenom.value, amount: "6000" }],
    gas: "250000"
  };

  ibcTransferring.value = true;
  toast.showInfo(`Preparing ${retroToCosmosAssetLabel.value} → Cosmos Hub transfer...`);
  try {
    const result = await window.keplr.signAndBroadcast(
      chainId,
      address.value,
      [msg],
      fee,
      memo
    );

    if (result.code === 0) {
      toast.showTxSuccess(result.transactionHash || "IBC transfer submitted");
      retroToCosmosAmount.value = "";
      retroToCosmosMemo.value = "";
      await loadAccount(address.value);
    } else {
      throw new Error(result.rawLog || "IBC transfer failed");
    }
  } catch (e: any) {
    toast.showTxError(e?.message || "IBC transfer failed");
  } finally {
    ibcTransferring.value = false;
  }
};

watch(ibcDirection, (direction) => {
  if (direction === "cosmosToRetro") {
    ensureCosmosAccount().catch(() => undefined);
  }
});

watch(cosmosWalletAddress, (value) => {
  if (value && !retroToCosmosRecipient.value) {
    retroToCosmosRecipient.value = value;
  }
});

const handleCosmosToRetroTransfer = async () => {
  if (!address.value) {
    toast.showInfo("Connect your RetroChain wallet first.");
    return;
  }
  if (!window.keplr) {
    toast.showError("Keplr wallet not detected.");
    return;
  }
  if (!isMainnet.value) {
    toast.showWarning("IBC transfers are only available on mainnet.");
    return;
  }
  if (!cosmosInboundConfigured.value) {
    toast.showWarning("Set VITE_IBC_CHANNEL_COSMOS_RETRO to enable Cosmos → Retro transfers.");
    return;
  }

  ibcTransferring.value = true;
  try {
    if (!cosmosWalletAddress.value) {
      await ensureCosmosAccount();
    }
  } catch {
    ibcTransferring.value = false;
    return;
  }

  const cosmosSender = cosmosWalletAddress.value;
  if (!cosmosSender) {
    ibcTransferring.value = false;
    return;
  }

  const amountFloat = parseFloat(cosmosToRetroAmount.value);
  if (!Number.isFinite(amountFloat) || amountFloat <= 0) {
    toast.showWarning(`Enter a valid ${cosmosToRetroAssetLabel.value} amount.`);
    ibcTransferring.value = false;
    return;
  }

  const selectedAsset = cosmosToRetroAsset.value;
  const amountBase = toBaseAmount(amountFloat, selectedAsset);
  let tokenDenomToSend: string | null;
  if (selectedAsset === "ATOM") {
    tokenDenomToSend = "uatom";
  } else if (selectedAsset === "RETRO") {
    tokenDenomToSend = RETRO_IBC_DENOM_ON_COSMOS;
  } else {
    tokenDenomToSend = WBTC_DENOM_ON_COSMOS || null;
  }
  if (!tokenDenomToSend) {
    toast.showWarning("WBTC denom for Cosmos Hub is not configured.");
    ibcTransferring.value = false;
    return;
  }
  const memo = cosmosToRetroMemo.value || `IBC transfer to RetroChain (${cosmosToRetroAssetLabel.value})`;

  const msg = {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: {
      sourcePort: "transfer",
      sourceChannel: cosmosToRetroChannel,
      token: {
        denom: tokenDenomToSend,
        amount: amountBase
      },
      sender: cosmosSender,
      receiver: address.value,
      timeoutHeight: {
        revisionNumber: "0",
        revisionHeight: "0"
      },
      timeoutTimestamp: buildIbcTimeoutTimestamp(),
      memo
    }
  };

  const fee = {
    amount: [{ denom: "uatom", amount: "8000" }],
    gas: "250000"
  };

  toast.showInfo(`Submitting ${cosmosToRetroAssetLabel} → RetroChain transfer...`);
  try {
    const result = await window.keplr.signAndBroadcast(
      cosmosHubChainId,
      cosmosSender,
      [msg],
      fee,
      memo
    );

    if (result.code === 0) {
      toast.showTxSuccess(result.transactionHash || "IBC transfer submitted");
      cosmosToRetroAmount.value = "";
      cosmosToRetroMemo.value = "";
      await loadAccount(address.value);
    } else {
      throw new Error(result.rawLog || "IBC transfer failed");
    }
  } catch (e: any) {
    toast.showTxError(e?.message || "IBC transfer failed");
  } finally {
    ibcTransferring.value = false;
  }
};

const swapTokens = () => {
  [tokenIn.value, tokenOut.value] = [tokenOut.value, tokenIn.value];
  [amountIn.value, amountOut.value] = [amountOut.value, amountIn.value];
};

const initialPrice = computed(() => {
  if (!createAmountA.value || !createAmountB.value) return "0";
  const priceA = parseFloat(createAmountB.value) / parseFloat(createAmountA.value);
  return priceA.toFixed(6);
});

const handleCreatePool = async () => {
  if (!address.value) return;
  if (!window.keplr) return;
  if (!ensureDexAvailable()) return;

  creatingPool.value = true;
  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';
    
    const tokenADenom = availableTokens.value.find(t => t.symbol === createTokenA.value)?.denom || tokenDenom.value;
    const tokenBDenom = availableTokens.value.find(t => t.symbol === createTokenB.value)?.denom || tokenDenom.value;
    
    const amountABase = toBaseUnits(createAmountA.value, createTokenA.value);
    const amountBBase = toBaseUnits(createAmountB.value, createTokenB.value);

    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgCreatePool",
      value: {
        creator: address.value,
        tokenA: {
          denom: tokenADenom,
          amount: amountABase
        },
        tokenB: {
          denom: tokenBDenom,
          amount: amountBBase
        },
        swapFee: (parseFloat(createSwapFee.value) / 100).toString() // Convert % to decimal
      }
    };

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "10000" }],
      gas: "300000"
    };

    const result = await window.keplr.signAndBroadcast(
      chainId,
      address.value,
      [msg],
      fee,
      "Create liquidity pool on RetroChain DEX"
    );

    if (result.code === 0) {
      console.log("Pool created!", result);
      createAmountA.value = "";
      createAmountB.value = "";
      await Promise.all([
        fetchPools(),
        loadAccount(address.value)
      ]);
      // Switch to pools tab to see the new pool
      activeTab.value = 'pools';
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Create pool failed:", e);
    alert(`Create pool failed: ${e.message}`);
  } finally {
    creatingPool.value = false;
  }
};
</script>

<template>
<div class="space-y-4">
  <!-- DISCLAIMER BANNER -->
  <RcDisclaimer
    v-if="dexLive"
    type="info"
    title="🚨 DEX ALERT · Mainnet Live"
  >
    <p>
      <strong>RetroChain DEX is armed and active!</strong>
    </p>
    <p class="mt-2">
      Swaps, pools, limit orders, and pool creation will hit mainnet the moment you confirm. Double-check tokens and slippage, then send it.
    </p>
    <p class="mt-2 text-emerald-200/80 text-[13px]">
      Pro tip: keep a little {{ tokenSymbol }} for gas and watch the toast alerts for Tx status.
    </p>
  </RcDisclaimer>
  <RcDisclaimer
    v-else
    type="warning"
    title="⚠️ DEX PAUSED · Alert"
  >
    <p>
      Trading actions are temporarily on hold while we finish the on-chain rollout.
    </p>
    <p class="mt-2">
      Use the IBC bridge below to move assets between RetroChain and Cosmos Hub (or Noble/other chains) until trading flips back on.
    </p>
    <p class="mt-2 text-amber-200/80 text-[13px]">
      Watch this banner for the go-live alert; your funds stay safe while the DEX rests.
    </p>
  </RcDisclaimer>

  <!-- DEX Status / Quick Actions -->
  <div class="grid gap-3 lg:grid-cols-3">
    <div class="card-soft border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs uppercase tracking-[0.2em] text-slate-400">Status</div>
        <span class="badge text-[10px]" :class="dexLive ? 'border-emerald-400/60 text-emerald-200' : 'border-amber-400/60 text-amber-200'">
          {{ dexLive ? 'Live' : 'Paused' }} · {{ isMainnet ? 'Mainnet' : 'Testnet' }}
        </span>
      </div>
      <div class="text-xl font-semibold text-white mb-1">Native DEX</div>
      <p class="text-xs text-slate-400">Trade, provide liquidity, place limit orders, and bridge via IBC.</p>
      <div class="flex flex-wrap gap-2 mt-3">
        <button v-if="dexLive" class="btn text-[11px]" @click="setTab('swap')">Swap</button>
        <button v-if="dexLive" class="btn text-[11px]" @click="setTab('pools')">Pools</button>
        <button class="btn text-[11px]" @click="setTab('bridge')">Bridge</button>
        <button v-if="dexLive" class="btn text-[11px]" @click="setTab('create')">Create Pool</button>
      </div>
    </div>

    <div class="card-soft border border-white/10 bg-slate-900/60">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs uppercase tracking-[0.2em] text-slate-400">Liquidity</div>
        <span class="text-[10px] text-slate-500">Live Pools</span>
      </div>
      <div class="text-3xl font-bold text-white mb-1">{{ poolCount }}</div>
      <p class="text-xs text-slate-400" v-if="poolCount > 0">Active pools detected from on-chain DEX module.</p>
      <p class="text-xs text-slate-500" v-else>No active pools reported by the DEX module.</p>
      <div v-if="poolCount > 0" class="gap-2 grid grid-cols-3 mt-3 text-center">
        <div
          v-for="pool in pools.slice(0, 3)"
          :key="pool.id"
          class="badge border-indigo-400/40 text-indigo-100"
        >
          <div class="text-xs">{{ pool.token_a }}/{{ pool.token_b }}</div>
          <div class="text-sm font-bold text-white">{{ formatAmount(pool.reserve_a, pool.token_a) }} / {{ formatAmount(pool.reserve_b, pool.token_b) }}</div>
        </div>
      </div>
    </div>

    <div class="card-soft border border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10">
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs uppercase tracking-[0.2em] text-slate-400">IBC Routes</div>
        <span class="text-[10px] text-slate-500">Channels</span>
      </div>
      <div class="text-sm text-slate-100 space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-300">Cosmos Hub</span>
          <code class="text-[11px] text-emerald-200">{{ ibcCosmosLabel }}</code>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-300">Osmosis</span>
          <code class="text-[11px] text-emerald-200">{{ ibcOsmosisLabel }}</code>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-300">Noble → Osmosis</span>
          <code class="text-[11px] text-emerald-200">{{ nobleToOsmosisChannel }}</code>
        </div>
      </div>
      <p class="text-[11px] text-slate-500 mt-2">Use bridge tab for two-hop Noble USDC via Osmosis → Retro.</p>
    </div>
  </div>

  <!-- Trading UI only when DEX is enabled -->
  <div v-if="dexLive" class="space-y-3">
    <div class="card p-4 border border-white/10 bg-slate-900/60">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-semibold text-slate-100">Custom Tokens (Factory / IBC)</h3>
        <span class="text-[11px] text-slate-500 mt-1">
          Add any denom to use in swaps/pools
        </span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input v-model="customSymbol" placeholder="Symbol (e.g. FACTORY)" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm" />
        <input v-model="customDenom" placeholder="Denom (factory/..., ibc/...)" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm" />
        <input v-model="customDecimals" type="number" min="0" max="18" placeholder="Decimals" class="p-2 rounded bg-slate-800 border border-slate-700 text-sm" />
        <button class="btn w-full text-xs" @click="addCustomToken">Add Token</button>
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
        :class="activeTab === 'create' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'create'"
      >
        ✨ Create Pool
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

    <!-- Quick balances + fees info -->
    <div class="grid gap-3 lg:grid-cols-3 mt-3">
      <div class="card p-3 border border-white/10 bg-slate-900/60">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-xs uppercase tracking-[0.2em] text-slate-400">Balances</h4>
          <span class="text-[10px] text-slate-500">live</span>
        </div>
        <div class="space-y-1 text-xs max-h-36 overflow-y-auto pr-1">
          <div v-for="b in tokenBalances" :key="b.denom" class="flex items-center justify-between">
            <span class="text-slate-300 font-mono">{{ b.symbol }}</span>
            <span class="text-slate-200 font-mono">{{ b.formatted }}</span>
          </div>
          <div v-if="!address" class="text-[11px] text-slate-500">Connect wallet to see balances.</div>
        </div>
      </div>
      <div class="card p-3 border border-white/10 bg-slate-900/60">
        <div class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Fees</div>
        <ul class="text-xs text-slate-300 space-y-1">
          <li>• Swap gas: ~200k (wallet will estimate)</li>
          <li>• Pool add gas: ~250k</li>
          <li>• Create pool gas: ~300k</li>
          <li>• Swap fee set per pool (e.g. 0.2%-0.3%)</li>
          <li>• IBC fee: chain-specific (see Keplr prompt)</li>
        </ul>
      </div>
      <div class="card p-3 border border-white/10 bg-sLate-900/60">
        <div class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Safety</div>
        <ul class="text-xs text-slate-300 space-y-1">
          <li>• Verify token denoms (factory/IBC)</li>
          <li>• Custom tokens appear exactly as entered</li>
          <li>• Check slippage before confirming</li>
          <li>• Keep a small RETRO for gas</li>
          <li>• IBC transfers are final once relayed</li>
        </ul>
      </div>
    </div>

    <!-- Swap Tab -->
    <div v-if="activeTab === 'swap'" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- From -->
      <div class="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs text-slate-400">From</label>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Balance:
              <span class="font-mono text-slate-300">
                <span v-if="!address">—</span>
                <span v-else-if="accountLoading">Syncing…</span>
                <span v-else>{{ formatTokenBalance(tokenIn) }}</span>
              </span>
            </span>
            <button
              class="btn text-[10px]"
              @click="setMaxSwapAmount"
              :disabled="!address || accountLoading"
            >
              Max
            </button>
          </div>
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
          <div class="text-xs text-slate-500">
            Balance:
            <span class="font-mono text-slate-300">
              <span v-if="!address">—</span>
              <span v-else-if="accountLoading">Syncing…</span>
              <span v-else>{{ formatTokenBalance(tokenOut) }}</span>
            </span>
          </div>
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
        :disabled="!dexAvailable || !address || !amountIn || !amountOut || swapping"
      >
        {{ swapping ? 'Swapping...' : address ? 'Swap' : 'Connect Wallet' }}
      </button>
      <p v-if="!dexAvailable" class="text-[11px] text-amber-300 text-center mt-2">
        DEX module offline – actions disabled on this network.
      </p>
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
  <div class="flex items-center justify-between mb-4">
    <h2 class="text-sm font-semibold text-slate-100">Add Liquidity</h2>
    <span v-if="!dexAvailable" class="text-[11px] text-amber-300">DEX actions disabled</span>
  </div>
  
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
        :disabled="!dexAvailable || !address || !poolAmountA || !poolAmountB || addingLiquidity"
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

    <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-xs text-slate-300 space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-slate-400">Total</span>
        <span class="text-slate-200">
          {{ limitPrice && limitAmount ? (parseFloat(limitPrice) * parseFloat(limitAmount)).toFixed(6) : '0.0' }} USDC
        </span>
      </div>
    </div>

    <button 
      class="btn btn-primary w-full"
      @click="handlePlaceLimitOrder"
      :disabled="!dexAvailable || !address || !limitPrice || !limitAmount"
    >
      Place {{ limitSide === 'buy' ? 'Buy' : 'Sell' }} Order
    </button>
    <p v-if="!dexAvailable" class="text-[11px] text-amber-300 text-center">
      Limit orders unavailable while the DEX module is offline.
    </p>
  </div>
  </div>


  <!-- Create Pool Tab -->
  <div v-if="activeTab === 'create'" class="card max-w-3xl mx-auto">
  <h2 class="text-sm font-semibold text-slate-100 mb-4">✨ Create New Liquidity Pool</h2>
  
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="space-y-3">
      <div class="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-3">
        <div class="text-xs text-purple-300 space-y-1">
          <div>🚀 Bootstrap a new trading pair!</div>
          <div>💡 You set the initial price ratio</div>
          <div>🎯 Be the first liquidity provider</div>
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-400 mb-2 block">Token A</label>
        <div class="flex items-center gap-2">
          <select v-model="createTokenA" class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
            <option v-for="token in availableTokens" :key="token.symbol" :value="token.symbol">
              {{ token.icon }} {{ token.symbol }}
            </option>
          </select>
          <input 
            v-model="createAmountA"
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
          <select v-model="createTokenB" class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
            <option v-for="token in availableTokens" :key="token.symbol" :value="token.symbol">
              {{ token.icon }} {{ token.symbol }}
            </option>
          </select>
          <input 
            v-model="createAmountB"
            type="number"
            step="0.000001"
            placeholder="0.0"
            class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>
      </div>

      <div>
        <label class="text-xs text-slate-400 mb-2 block">Swap Fee (%)</label>
        <div class="flex items-center gap-2">
          <button 
            v-for="fee in ['0.1', '0.3', '0.5', '1.0']" 
            :key="fee"
            class="px-3 py-2 rounded border text-xs"
            :class="createSwapFee === fee ? 'border-indigo-400/70 bg-indigo-500/10 text-indigo-300' : 'border-slate-700 text-slate-400'"
            @click="createSwapFee = fee"
          >
            {{ fee }}%
          </button>
          <input 
            v-model="createSwapFee"
            type="number"
            step="0.1"
            min="0.01"
            max="10"
            class="flex-1 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>
      </div>

      <button 
        class="btn btn-primary w-full"
        @click="handleCreatePool"
        :disabled="!dexAvailable || !address || !createAmountA || !createAmountB || createTokenA === createTokenB || creatingPool"
      >
        {{ creatingPool ? 'Creating Pool...' : 'Create Pool' }}
      </button>
      <p v-if="!dexAvailable" class="text-[11px] text-amber-300 text-center">
        Pool creation will unlock once the DEX module is deployed.
      </p>
    </div>

    <div class="space-y-3">
      <div class="p-4 rounded-lg bg-slate-900/60 border border-slate-700">
        <h3 class="text-xs font-semibold text-slate-100 mb-3">📊 Pool Details</h3>
        <div class="space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Pool Pair</span>
            <span class="text-slate-200 font-mono">{{ createTokenA }}/{{ createTokenB }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Initial Price</span>
            <span class="text-slate-200 font-mono">1 {{ createTokenA }} = {{ initialPrice }} {{ createTokenB }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Swap Fee</span>
            <span class="text-emerald-300 font-mono">{{ createSwapFee }}%</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">Your LP Share</span>
            <span class="text-indigo-300 font-mono">100%</span>
          </div>
        </div>
      </div>

      <div class="p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
        <h3 class="text-xs font-semibold text-slate-100 mb-2">💡 Example Scenarios</h3>
        <div class="text-xs text-slate-300 space-y-2">
          <div>
            <div class="text-indigo-300 font-semibold">Scenario 1: RETRO/USDC</div>
            <div class="text-slate-400">10,000 RETRO + 1,000 USDC</div>
            <div class="text-slate-500">= $0.10 per RETRO</div>
          </div>
          <div>
            <div class="text-indigo-300 font-semibold">Scenario 2: RETRO/ATOM</div>
            <div class="text-slate-400">10,000 RETRO + 100 ATOM</div>
            <div class="text-slate-500">= 0.01 ATOM per RETRO</div>
          </div>
        </div>
      </div>

      <div class="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <h3 class="text-xs font-semibold text-slate-100 mb-2">⚠️ Important Notes</h3>
        <ul class="text-xs text-slate-300 space-y-1">
          <li>• You set the initial price ratio</li>
          <li>• Requires both tokens in your wallet</li>
          <li>• You'll be the first LP (100% share)</li>
          <li>• Can't create duplicate pairs</li>
          <li>• Minimum liquidity applies</li>
        </ul>
      </div>
    </div>
  </div>
</div>

  <!-- Bridge experience (always available; gated by tab only when DEX is enabled) -->
  <div v-if="dexFeaturesEnabled ? activeTab === 'bridge' : true" class="space-y-4 max-w-2xl mx-auto">
    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-100">IBC Transfer · Cosmos Hub</h2>
          <p class="text-[11px] text-slate-500 mt-1">
            Retro channel:
            <span class="font-mono text-slate-300">{{ retroToCosmosChannel }}</span>
            <span v-if="cosmosInboundConfigured">
              · Cosmos channel:
              <span class="font-mono text-slate-300">{{ cosmosToRetroChannel || '—' }}</span>
            </span>
            <br />
            Osmosis channels: Retro → Osmosis <span class="font-mono text-slate-300">{{ retroToOsmosisChannel }}</span> · Osmosis → Retro <span class="font-mono text-slate-300">{{ osmosisToRetroChannel }}</span>
            <br />
            Noble USDC routes Noble → Osmosis on <span class="font-mono text-slate-300">{{ nobleToOsmosisChannel }}</span> then Osmosis → Retro on <span class="font-mono text-slate-300">{{ osmosisToRetroChannel }}</span>
          </p>
        </div>
        <span class="badge text-[10px]" :class="isMainnet ? 'border-emerald-400/60 text-emerald-200' : 'border-amber-400/60 text-amber-200'">
          {{ isMainnet ? 'Mainnet' : 'Unavailable' }}
        </span>
      </div>

      <div class="flex items-center gap-2 mb-3">
        <button 
          class="btn text-xs"
          :class="ibcDirection === 'retroToCosmos' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
          @click="ibcDirection = 'retroToCosmos'"
        >
          RetroChain → Cosmos Hub
        </button>
        <button 
          class="btn text-xs"
          :class="ibcDirection === 'cosmosToRetro' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
          @click="ibcDirection = 'cosmosToRetro'"
        >
          Cosmos Hub → RetroChain
        </button>
      </div>

      <div v-if="ibcDirection === 'retroToCosmos'" class="space-y-3">
        <p class="text-[11px] text-slate-500">
          Send {{ retroToCosmosAssetLabel }} over channel {{ retroToCosmosChannel }} into any Cosmos Hub address.
        </p>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Asset</label>
          <select
            v-model="retroToCosmosAsset"
            class="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          >
            <option v-for="opt in retroToCosmosAssetOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Recipient (Cosmos Hub)</label>
          <input
            v-model="retroToCosmosRecipient"
            type="text"
            placeholder="cosmos1..."
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono"
          />
        </div>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Amount ({{ retroToCosmosAssetLabel }})</label>
          <input
            v-model="retroToCosmosAmount"
            type="number"
            :step="retroToCosmosAsset === 'WBTC' ? '0.00000001' : '0.000001'"
            placeholder="0.0"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
          <div class="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>Available</span>
            <span class="font-mono text-slate-300">
              <template v-if="address">
                <span v-if="retroToCosmosAsset === 'RETRO'">{{ retroBalanceDisplay }}</span>
                <span v-else-if="retroToCosmosAsset === 'ATOM'">{{ ibcAtomBalanceDisplay }}</span>
                <span v-else>{{ wbtcBalanceDisplay }}</span>
              </template>
              <template v-else>Connect wallet</template>
            </span>
          </div>
        </div>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Memo (optional)</label>
          <input
            v-model="retroToCosmosMemo"
            type="text"
            placeholder="IBC transfer memo"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-xs text-slate-300 space-y-1">
          <div class="flex items-center justify-between">
            <span>Sender</span>
            <span class="font-mono text-slate-100">{{ address || 'Connect wallet' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Channel</span>
            <span class="font-mono text-slate-100">{{ retroToCosmosChannel }}</span>
          </div>
        </div>
        <button
          class="btn btn-primary w-full"
          @click="handleRetroToCosmosTransfer"
          :disabled="!isMainnet || !address || !retroToCosmosRecipient || !retroToCosmosAmount || ibcTransferring"
        >
          {{ ibcTransferring ? 'Submitting...' : `Send ${retroToCosmosAssetLabel} to Cosmos Hub` }}
        </button>
        <p v-if="!address" class="text-[11px] text-slate-500 text-center">
          Connect your RetroChain wallet to start an IBC transfer.
        </p>
      </div>

      <div v-else class="space-y-3">
        <p class="text-[11px] text-slate-500">
          Bridge {{ cosmosToRetroAssetLabel }} from Cosmos Hub into RetroChain. Keplr will prompt you to approve the Cosmos Hub transaction.
        </p>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Asset</label>
          <select
            v-model="cosmosToRetroAsset"
            class="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          >
            <option v-for="opt in cosmosToRetroAssetOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-slate-400">Cosmos Hub Wallet</span>
            <button
              class="btn text-[10px]"
              @click="ensureCosmosAccount"
              :disabled="fetchingCosmosAddress"
            >
              {{ fetchingCosmosAddress ? 'Connecting...' : cosmosWalletAddress ? 'Refresh' : 'Connect' }}
            </button>
          </div>
          <div v-if="cosmosWalletAddress" class="font-mono text-slate-200 text-xs break-all">
            {{ cosmosWalletAddress }}
          </div>
          <div v-else class="text-[11px] text-slate-500">
            Connect Keplr on Cosmos Hub to bridge ATOM/WBTC in.
          </div>
        </div>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Amount ({{ cosmosToRetroAssetLabel }})</label>
          <input
            v-model="cosmosToRetroAmount"
            type="number"
            :step="cosmosToRetroAsset === 'WBTC' ? '0.00000001' : '0.000001'"
            placeholder="0.0"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Memo (optional)</label>
          <input
            v-model="cosmosToRetroMemo"
            type="text"
            placeholder="IBC transfer memo"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-xs text-slate-300 space-y-1">
          <div class="flex items-center justify-between">
            <span>Destination</span>
            <span class="font-mono text-slate-100">{{ address || 'Connect wallet' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Channel</span>
            <span class="font-mono text-slate-100">{{ cosmosToRetroChannel || 'Set env var' }}</span>
          </div>
        </div>
        <button
          class="btn btn-primary w-full"
          @click="handleCosmosToRetroTransfer"
          :disabled="!isMainnet || !address || !cosmosInboundConfigured || !cosmosWalletAddress || !cosmosToRetroAmount || ibcTransferring"
        >
          {{ ibcTransferring ? 'Submitting...' : `Send ${cosmosToRetroAssetLabel} to RetroChain` }}
        </button>
        <p v-if="!cosmosInboundConfigured" class="text-[11px] text-amber-300 text-center">
          Configure <code class="font-mono">VITE_IBC_CHANNEL_COSMOS_RETRO</code> to enable Cosmos → Retro transfers.
        </p>
      </div>
    </div>
  </div>
</div>
</template>

