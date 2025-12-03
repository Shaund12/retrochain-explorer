// src/composables/useBridge.ts
import { ref } from "vue";
import { useApi } from "./useApi";
import { useKeplr } from "./useKeplr";

export interface BridgeAsset {
  denom: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  chains: string[];
  bridgeContract?: string;
}

export interface BridgeTransaction {
  id: string;
  from_chain: string;
  to_chain: string;
  asset: string;
  amount: string;
  status: "pending" | "success" | "failed";
  tx_hash: string;
  created_at: string;
}

export function useBridge() {
  const api = useApi();
  const { address } = useKeplr();

  const assets = ref<BridgeAsset[]>([
    {
      denom: "ibc/...", // Will be actual IBC denom after bridge setup
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      icon: "??",
      chains: ["Noble", "Ethereum", "Polygon", "Arbitrum"],
      bridgeContract: "axelar1..."
    },
    {
      denom: "ibc/...",
      symbol: "USDT",
      name: "Tether USD",
      decimals: 6,
      icon: "??",
      chains: ["Ethereum", "BSC", "Polygon"]
    },
    {
      denom: "ibc/...",
      symbol: "ATOM",
      name: "Cosmos Hub",
      decimals: 6,
      icon: "??",
      chains: ["Cosmos Hub"]
    }
  ]);

  const transactions = ref<BridgeTransaction[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch bridge transactions for user
  const fetchBridgeTransactions = async (userAddress?: string) => {
    const addr = userAddress || address.value;
    if (!addr) return;

    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/retrochain/bridge/v1/transactions/${addr}`);
      transactions.value = res.data?.transactions || [];
    } catch (e: any) {
      console.warn("Bridge transactions not available:", e?.message);
      transactions.value = [];
    } finally {
      loading.value = false;
    }
  };

  // Initiate IBC transfer from Noble (USDC native chain)
  const bridgeFromNoble = async (amount: string) => {
    // This would use IBC transfer message
    return {
      type: "IBC Transfer",
      from: "noble-1",
      to: "retrochain-1",
      denom: "uusdc",
      amount
    };
  };

  // Initiate bridge from EVM chain via Axelar
  const bridgeFromEVM = async (chain: string, asset: string, amount: string) => {
    // This would call Axelar's satellite.money or Squid Router
    const axelarUrl = `https://satellite.money/?` +
      `source=${chain}&` +
      `destination=retrochain-1&` +
      `asset=${asset}&` +
      `amount=${amount}&` +
      `destinationAddress=${address.value}`;
    
    window.open(axelarUrl, '_blank');
  };

  // Get estimated bridge time
  const getEstimatedTime = (fromChain: string, toChain: string) => {
    if (fromChain.includes('noble') || toChain.includes('noble')) {
      return "~60 seconds"; // IBC transfer
    }
    return "~5-10 minutes"; // Axelar bridge
  };

  // Get bridge fee
  const getBridgeFee = (fromChain: string, asset: string, amount: string) => {
    // Mock fees - in reality would query Axelar/IBC relayer
    if (fromChain.includes('noble')) {
      return "0.01 ATOM"; // IBC relayer fee
    }
    return "~$2-5 USD"; // Axelar bridge fee
  };

  return {
    assets,
    transactions,
    loading,
    error,
    fetchBridgeTransactions,
    bridgeFromNoble,
    bridgeFromEVM,
    getEstimatedTime,
    getBridgeFee
  };
}
