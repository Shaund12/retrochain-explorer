import { ref, computed } from "vue";
import { useApi } from "./useApi";
import { useNetwork } from "./useNetwork";

export interface BtcStakeParams {
  allowed_denom: string;
}

export interface BtcStakePool {
  allowed_denom: string;
  total_staked_amount: string;
  reward_balance_uretro: string;
  undistributed_uretro: string;
  reward_index?: string;
}

export interface BtcStakeUserPosition {
  staked_amount: string;
}

export interface BtcStakePendingRewards {
  pending_uretro: string;
}

export function useBtcStake() {
  const api = useApi();
  const { rpcBase, restBase } = useNetwork();

  const params = ref<BtcStakeParams | null>(null);
  const pool = ref<BtcStakePool | null>(null);
  const userStake = ref<BtcStakeUserPosition | null>(null);
  const pendingRewards = ref<BtcStakePendingRewards | null>(null);
  const userBalance = ref<string | null>(null);
  const loading = ref(false);
  const userLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const restHealthy = ref<boolean | null>(null);
  const rpcHealthy = ref<boolean | null>(null);

  let pollHandle: number | null = null;

  const allowedDenom = computed(() => params.value?.allowed_denom || "");
  const hasValidDenom = computed(() => !!allowedDenom.value && allowedDenom.value.startsWith("ibc/"));

  const fetchParams = async () => {
    try {
      const res = await api.get("/retrochain/btcstake/v1/params").catch(() => api.get("/btcstake/v1/params"));
      params.value = res.data?.params ?? res.data ?? null;
    } catch (err: any) {
      console.warn("Failed to load btcstake params", err);
      params.value = null;
      throw err;
    }
  };

  const fetchUserBalance = async (addr?: string | null) => {
    if (!addr) {
      userBalance.value = null;
      return;
    }
    if (!allowedDenom.value) {
      userBalance.value = null;
      return;
    }
    try {
      const res = await api.get(`/cosmos/bank/v1beta1/balances/${addr}`, {
        params: { "pagination.limit": "200" }
      });
      const balances: Array<{ denom: string; amount: string }> = res.data?.balances ?? [];
      const entry = balances.find((b) => b.denom === allowedDenom.value);
      userBalance.value = entry?.amount ?? "0";
    } catch (err) {
      console.warn("Failed to load btcstake balance", err);
      userBalance.value = null;
      throw err;
    }
  };

  const fetchPool = async () => {
    try {
      const res = await api.get("/retrochain/btcstake/v1/pool").catch(() => api.get("/btcstake/v1/pool"));
      pool.value = res.data ?? null;
      lastUpdated.value = new Date();
      restHealthy.value = true;
    } catch (err: any) {
      restHealthy.value = false;
      pool.value = null;
      throw err;
    }
  };

  const fetchUserStake = async (addr?: string | null) => {
    if (!addr) {
      userStake.value = null;
      return;
    }
    try {
      const res = await api.get(`/retrochain/btcstake/v1/stake/${addr}`).catch(() => api.get(`/btcstake/v1/stake/${addr}`));
      userStake.value = res.data ?? null;
    } catch (err: any) {
      console.warn("Failed to load btcstake position", err);
      userStake.value = null;
      throw err;
    }
  };

  const fetchPendingRewards = async (addr?: string | null) => {
    if (!addr) {
      pendingRewards.value = null;
      return;
    }
    try {
      const res = await api
        .get(`/retrochain/btcstake/v1/pending_rewards/${addr}`)
        .catch(() => api.get(`/btcstake/v1/pending_rewards/${addr}`));
      pendingRewards.value = res.data ?? null;
    } catch (err: any) {
      console.warn("Failed to load btcstake rewards", err);
      pendingRewards.value = null;
      throw err;
    }
  };

  const checkRpcHealth = async () => {
    const base = rpcBase.value?.trim();
    if (!base) {
      rpcHealthy.value = null;
      return;
    }
    try {
      const endpoint = base.endsWith("/") ? `${base}health` : `${base}/health`;
      await fetch(endpoint, { method: "GET", mode: "cors" });
      rpcHealthy.value = true;
    } catch (err) {
      rpcHealthy.value = false;
    }
  };

  const refreshAll = async (address?: string | null) => {
    loading.value = true;
    error.value = null;
    try {
      await fetchParams();
      await fetchPool();
      if (address) {
        userLoading.value = true;
        await Promise.allSettled([
          fetchUserStake(address),
          fetchPendingRewards(address),
          fetchUserBalance(address)
        ]);
      } else {
        userStake.value = null;
        pendingRewards.value = null;
        userBalance.value = null;
      }
      await checkRpcHealth();
    } catch (err: any) {
      error.value = err?.message ?? String(err);
    } finally {
      loading.value = false;
      userLoading.value = false;
    }
  };

  const startPolling = (address?: string | null, intervalMs = 25000) => {
    stopPolling();
    pollHandle = window.setInterval(() => {
      refreshAll(address).catch(() => {
        /* handled in refresh */
      });
    }, intervalMs);
  };

  const stopPolling = () => {
    if (pollHandle !== null) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  };

  const poolEndpoint = computed(() => {
    const base = restBase.value || "";
    const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${normalized || ''}/retrochain/btcstake/v1/pool`;
  });

  return {
    params,
    pool,
    userStake,
    pendingRewards,
    userBalance,
    loading,
    userLoading,
    error,
    lastUpdated,
    restHealthy,
    rpcHealthy,
    allowedDenom,
    hasValidDenom,
    poolEndpoint,
    fetchParams,
    fetchPool,
    fetchUserStake,
    fetchPendingRewards,
    fetchUserBalance,
    refreshAll,
    startPolling,
    stopPolling
  };
}
