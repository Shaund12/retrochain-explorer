// src/composables/useStaking.ts
import { ref } from "vue";
import { useApi } from "./useApi";
import { useKeplr } from "./useKeplr";

export interface Delegation {
  delegator_address: string;
  validator_address: string;
  shares: string;
  balance: {
    denom: string;
    amount: string;
  };
}

export interface Reward {
  validator_address: string;
  reward: Array<{ denom: string; amount: string }>;
}

export interface UnbondingDelegation {
  delegator_address: string;
  validator_address: string;
  entries: Array<{
    creation_height: string;
    completion_time: string;
    initial_balance: string;
    balance: string;
  }>;
}

export function useStaking() {
  const api = useApi();
  const { address } = useKeplr();

  const delegations = ref<Delegation[]>([]);
  const rewards = ref<Reward[]>([]);
  const unbonding = ref<UnbondingDelegation[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchDelegations = async (delegatorAddress?: string) => {
    const addr = delegatorAddress || address.value;
    if (!addr) throw new Error("No address provided");

    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/cosmos/staking/v1beta1/delegations/${addr}`);
      delegations.value = res.data?.delegation_responses || [];
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      delegations.value = [];
    } finally {
      loading.value = false;
    }
  };

  const fetchRewards = async (delegatorAddress?: string) => {
    const addr = delegatorAddress || address.value;
    if (!addr) throw new Error("No address provided");

    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/cosmos/distribution/v1beta1/delegators/${addr}/rewards`);
      rewards.value = res.data?.rewards || [];
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      rewards.value = [];
    } finally {
      loading.value = false;
    }
  };

  const fetchUnbonding = async (delegatorAddress?: string) => {
    const addr = delegatorAddress || address.value;
    if (!addr) throw new Error("No address provided");

    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/cosmos/staking/v1beta1/delegators/${addr}/unbonding_delegations`);
      unbonding.value = res.data?.unbonding_responses || [];
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      unbonding.value = [];
    } finally {
      loading.value = false;
    }
  };

  const fetchAll = async (delegatorAddress?: string) => {
    await Promise.all([
      fetchDelegations(delegatorAddress),
      fetchRewards(delegatorAddress),
      fetchUnbonding(delegatorAddress)
    ]);
  };

  return {
    delegations,
    rewards,
    unbonding,
    loading,
    error,
    fetchDelegations,
    fetchRewards,
    fetchUnbonding,
    fetchAll
  };
}
