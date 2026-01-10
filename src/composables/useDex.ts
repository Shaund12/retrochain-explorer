// src/composables/useDex.ts
import { computed, ref } from "vue";
import { useApi } from "./useApi";
import { useKeplr } from "./useKeplr";
import { useNetwork } from "./useNetwork";
import { getDenomMeta } from "@/utils/format";

export interface Pool {
  id: string;
  denom_a: string;
  denom_b: string;
  reserve_a: string;
  reserve_b: string;
  total_shares: string;
  lp_denom?: string;
  fee_rate?: string;
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

export interface DexParams {
  enabled: boolean;
  swap_fee_bps?: number;
  stakers_fee_bps?: number;
  dev_fund_address?: string;
}

export function useDex() {
  const api = useApi();
  const { address, connect, signAndBroadcast } = useKeplr();
  const { current: network } = useNetwork();
  const chainId = computed(() => (network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"));

  const pools = ref<Pool[]>([]);
  const orderBooks = ref<OrderBook[]>([]);
  const userLiquidity = ref<any[]>([]);
  const userBalances = ref<Record<string, string>>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isModuleAvailable = ref(true);
  const params = ref<DexParams | null>(null);

  const markModuleUnavailable = (e: any) => {
    const status = e?.response?.status ?? e?.status;
    if (status === 404 || status === 501) {
      isModuleAvailable.value = false;
    }
  };

  const ensureWallet = async () => {
    if (!address.value) await connect();
    if (!address.value) throw new Error("Connect wallet");
    return address.value;
  };

  const swapExactIn = async (poolId: string, denomIn: string, amountIn: string, denomOut: string, slippageBps = 50) => {
    const sender = await ensureWallet();
    const quote = await api.get(`/retrochain/dex/v1/pools/${poolId}/quote_exact_in`, {
      params: { denom_in: denomIn, amount_in: amountIn, denom_out: denomOut }
    });
    const out = BigInt(quote.data?.amount_out || 0);
    const minOut = out > 0n ? BigInt(Math.floor(Number(out) * (1 - slippageBps / 10_000))) : 0n;
    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgSwapExactIn",
      value: {
        sender,
        poolId,
        denomIn,
        amountIn,
        denomOut,
        minAmountOut: minOut.toString()
      }
    };
    const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "400000" };
    return signAndBroadcast(chainId.value, [msg], fee, "");
  };

  const addLiquidity = async (pool: Pool, amountA: string, amountB: string, slippageBps = 100) => {
    const sender = await ensureWallet();
    const reserveA = BigInt(pool.reserve_a || "0");
    const reserveB = BigInt(pool.reserve_b || "0");
    const total = BigInt(pool.total_shares || "0");
    let expectedShares = 0n;
    if (total === 0n) {
      expectedShares = BigInt(Math.floor(Math.sqrt(Number(BigInt(amountA) * BigInt(amountB)))));
    } else {
      const s1 = (BigInt(amountA) * total) / reserveA;
      const s2 = (BigInt(amountB) * total) / reserveB;
      expectedShares = s1 < s2 ? s1 : s2;
    }
    const minShares = expectedShares > 0n ? BigInt(Math.floor(Number(expectedShares) * (1 - slippageBps / 10_000))) : 0n;
    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgAddLiquidity",
      value: {
        sender,
        poolId: pool.id,
        amountA,
        amountB,
        minShares: minShares.toString()
      }
    };
    const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "450000" };
    return signAndBroadcast(chainId.value, [msg], fee, "");
  };

  const removeLiquidity = async (pool: Pool, shares: string, slippageBps = 100) => {
    const sender = await ensureWallet();
    const total = BigInt(pool.total_shares || "0");
    if (total === 0n) throw new Error("Pool empty");
    const reserveA = BigInt(pool.reserve_a || "0");
    const reserveB = BigInt(pool.reserve_b || "0");
    const sh = BigInt(shares);
    const amtA = (reserveA * sh) / total;
    const amtB = (reserveB * sh) / total;
    const minA = amtA > 0n ? BigInt(Math.floor(Number(amtA) * (1 - slippageBps / 10_000))) : 0n;
    const minB = amtB > 0n ? BigInt(Math.floor(Number(amtB) * (1 - slippageBps / 10_000))) : 0n;
    const msg = {
      typeUrl: "/retrochain.dex.v1.MsgRemoveLiquidity",
      value: {
        sender,
        poolId: pool.id,
        shares,
        minAmountA: minA.toString(),
        minAmountB: minB.toString()
      }
    };
    const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "450000" };
    return signAndBroadcast(chainId.value, [msg], fee, "");
  };

  // Fetch all liquidity pools
  const fetchPools = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get("/retrochain/dex/v1/pools");
      pools.value = res.data?.pools || res.data?.pools_with_tvl || [];
      isModuleAvailable.value = true;
    } catch (e: any) {
      console.warn("DEX pools not available:", e?.message);
      pools.value = [];
      error.value = null; // Don't show error if module not enabled yet
      markModuleUnavailable(e);
    } finally {
      loading.value = false;
    }
  };

  const fetchParams = async () => {
    try {
      const res = await api.get("/retrochain/dex/v1/params");
      params.value = res.data?.params || res.data || null;
      isModuleAvailable.value = true;
    } catch (e: any) {
      console.warn("DEX params not available:", e?.message);
      params.value = null;
      markModuleUnavailable(e);
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
    if (!isModuleAvailable.value) {
      return {
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: amountIn,
        amount_out: (parseFloat(amountIn || "0") * 0.99 || 0).toFixed(6),
        price_impact: "0.01",
        route: [tokenIn, tokenOut]
      } as SwapRoute;
    }
    try {
      const pool = pools.value.find(
        (p) =>
          (p.denom_a === tokenIn && p.denom_b === tokenOut) ||
          (p.denom_b === tokenIn && p.denom_a === tokenOut)
      );
      if (!pool) throw new Error("Pool not found");
      const res = await api.get(`/retrochain/dex/v1/pools/${pool.id}/quote_exact_in`, {
        params: { denom_in: tokenIn, amount_in: amountIn, denom_out: tokenOut }
      });
      const data = res.data || {};
      return {
        token_in: tokenIn,
        token_out: tokenOut,
        amount_in: amountIn,
        amount_out: data.amount_out ?? "0",
        price_impact: "",
        route: [tokenIn, tokenOut]
      } as SwapRoute;
    } catch (e: any) {
      console.warn("Swap simulation failed:", e?.message);
      markModuleUnavailable(e);
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
      // Bank balances for LP denoms
      const res = await api.get(`/cosmos/bank/v1beta1/balances/${addr}`);
      const balances = res.data?.balances || [];
      userBalances.value = balances.reduce((acc: Record<string, string>, b: any) => {
        if (b?.denom) acc[b.denom] = b.amount;
        return acc;
      }, {});
      const lpBalances = balances.filter((b: any) => typeof b?.denom === "string" && b.denom.startsWith("dex/"));
      userLiquidity.value = lpBalances.map((b: any) => ({ lp_denom: b.denom, amount: b.amount }));
    } catch (e: any) {
      console.warn("User liquidity not available:", e?.message);
      userBalances.value = {};
      userLiquidity.value = [];
      markModuleUnavailable(e);
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

  const lpPositions = computed(() => {
    if (!userLiquidity.value?.length || !pools.value?.length) return [] as any[];
    return userLiquidity.value
      .map((pos: any) => {
        const pool = pools.value.find((p) => p.lp_denom === pos.lp_denom || `dex/${p.id}` === pos.lp_denom);
        if (!pool) return null;
        const shares = pos.amount;
        const pct = calculateUserShare(pool, shares);
        return {
          pool,
          shares,
          percent: pct,
          lp_denom: pos.lp_denom
        };
      })
      .filter(Boolean);
  });

  return {
    pools,
    orderBooks,
    userLiquidity,
    userBalances,
    lpPositions,
    loading,
    error,
    fetchPools,
    fetchParams,
    fetchOrderBook,
    simulateSwap,
    fetchUserLiquidity,
    calculatePoolPrice,
    calculateUserShare,
    isModuleAvailable,
    params,
    swapExactIn,
    addLiquidity,
    removeLiquidity
  };
}
