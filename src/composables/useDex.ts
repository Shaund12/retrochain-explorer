// src/composables/useDex.ts
import { ref, computed } from "vue";
import { useApi } from "./useApi";
import { useKeplr } from "./useKeplr";

export interface Pool {
  id: string;
  token_a: string;
  token_b: string;
  reserve_a: string;
  reserve_b: string;
  total_shares: string;
  fee_rate: string;
}

export interface OrderBook {
  pair: string;
  bids: Array<{ price: string; amount: string; total: string }>;
  asks: Array<{ price: string; amount: string; total: string }>;
}

export interface SwapRoute {
  token_in: string;
  token_out: string;
  amount_in: string;
  amount_out: string;
  price_impact: string;
  route: string[];
}

export function useDex() {
  const api = useApi();
  const { address } = useKeplr();

  const pools = ref<Pool[]>([]);
  const orderBooks = ref<OrderBook[]>([]);
  const userLiquidity = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch all liquidity pools
  const fetchPools = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get("/dex/v1/pools");
      pools.value = res.data?.pools || [];
    } catch (e: any) {
      console.warn("DEX pools not available:", e?.message);
      pools.value = [];
      error.value = null; // Don't show error if module not enabled yet
    } finally {
      loading.value = false;
    }
  };

  // Fetch order book for a trading pair
  const fetchOrderBook = async (pair: string) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/dex/v1/orderbook/${pair}`);
      return res.data;
    } catch (e: any) {
      console.warn("Order book not available:", e?.message);
      return null;
    } finally {
      loading.value = false;
    }
  };

  // Simulate swap to get expected output
  const simulateSwap = async (tokenIn: string, tokenOut: string, amountIn: string) => {
    try {
      const res = await api.get("/dex/v1/simulate-swap", {
        params: { token_in: tokenIn, token_out: tokenOut, amount_in: amountIn }
      });
      return res.data as SwapRoute;
    } catch (e: any) {
      console.warn("Swap simulation failed:", e?.message);
      // Mock simulation for demo
      return {
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: amountIn,
        amount_out: (parseFloat(amountIn) * 0.99).toFixed(6), // Mock 1% slippage
        price_impact: "0.01",
        route: [tokenIn, tokenOut]
      } as SwapRoute;
    }
  };

  // Fetch user's liquidity positions
  const fetchUserLiquidity = async (userAddress?: string) => {
    const addr = userAddress || address.value;
    if (!addr) return;

    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/dex/v1/liquidity/${addr}`);
      userLiquidity.value = res.data?.positions || [];
    } catch (e: any) {
      console.warn("User liquidity not available:", e?.message);
      userLiquidity.value = [];
    } finally {
      loading.value = false;
    }
  };

  // Calculate pool price
  const calculatePoolPrice = (pool: Pool, reverse = false) => {
    const a = parseFloat(pool.reserve_a);
    const b = parseFloat(pool.reserve_b);
    if (a === 0 || b === 0) return "0";
    return reverse ? (a / b).toFixed(6) : (b / a).toFixed(6);
  };

  // Calculate user's share of pool
  const calculateUserShare = (pool: Pool, userShares: string) => {
    const shares = parseFloat(userShares);
    const total = parseFloat(pool.total_shares);
    if (total === 0) return 0;
    return (shares / total) * 100;
  };

  return {
    pools,
    orderBooks,
    userLiquidity,
    loading,
    error,
    fetchPools,
    fetchOrderBook,
    simulateSwap,
    fetchUserLiquidity,
    calculatePoolPrice,
    calculateUserShare
  };
}
