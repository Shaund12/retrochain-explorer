// src/composables/useDexV3.ts
import { computed, ref } from "vue";
import { useApi } from "./useApi";
import { useKeplr } from "./useKeplr";
import { useNetwork } from "./useNetwork";

export interface DexV3Pool {
  id: string;
  denom0: string;
  denom1: string;
  fee_bps: string;
  tick_spacing: string;
  current_tick?: string;
  sqrt_price_x96?: string;
  liquidity?: string;
  reserve0?: string;
  reserve1?: string;
}

export interface DexV3Params {
  enabled?: boolean;
  [key: string]: any;
}

export interface DexV3Position {
  id: string;
  pool_id: string;
  owner: string;
  lower_tick: string;
  upper_tick: string;
  liquidity: string;
  fees_owed0: string;
  fees_owed1: string;
  nft_class_id: string;
  nft_id: string;
}

export function useDexV3() {
  const api = useApi();
  const { address, connect } = useKeplr();
  const { current: network } = useNetwork();

  const chainId = computed(() =>
    network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"
  );

  const pools = ref<DexV3Pool[]>([]);
  const params = ref<DexV3Params | null>(null);
  const positions = ref<DexV3Position[]>([]);
  const poolDetail = ref<DexV3Pool | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchParams = async () => {
    try {
      const res = await api.get("/retrochain/dexv3/v1/params");
      params.value = res.data?.params || res.data || null;
    } catch (e: any) {
      params.value = null;
      error.value = e?.message ?? String(e);
    }
  };

  const fetchPools = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get("/retrochain/dexv3/v1/pools");
      pools.value = res.data?.pools || [];
    } catch (e: any) {
      pools.value = [];
      error.value = e?.message ?? String(e);
    } finally {
      loading.value = false;
    }
  };

  const fetchPoolDetail = async (poolId: string) => {
    if (!poolId) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/retrochain/dexv3/v1/pools/${poolId}`);
      poolDetail.value = res.data?.pool || res.data || null;
    } catch (e: any) {
      poolDetail.value = null;
      error.value = e?.message ?? String(e);
    } finally {
      loading.value = false;
    }
  };

  const fetchPositions = async (owner?: string) => {
    const addr = owner || address.value;
    if (!addr) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/retrochain/dexv3/v1/positions`, { params: { owner: addr } });
      positions.value = res.data?.positions || [];
    } catch (e: any) {
      positions.value = [];
      error.value = e?.message ?? String(e);
    } finally {
      loading.value = false;
    }
  };

  const ensureWallet = async () => {
    if (!address.value) await connect();
    if (!address.value) throw new Error("Connect wallet");
    return address.value;
  };

  return {
    pools,
    params,
    positions,
    poolDetail,
    loading,
    error,
    chainId,
    fetchParams,
    fetchPools,
    fetchPoolDetail,
    fetchPositions,
    ensureWallet
  };
}
