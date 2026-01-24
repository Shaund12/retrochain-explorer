// src/composables/useStaking.ts
import { ref, computed } from "vue";
import { useApi } from "./useApi";
import { useKeplr } from "./useKeplr";
import { ACCOUNT_LABELS } from "@/constants/accountLabels";

const DEFAULT_BURN_RATE = 0.008; // 0.8% burn by default when module params unavailable
const BASE_BLOCKED_DELEGATORS = [
  "cosmos1fscvf7rphx477z6vd4sxsusm2u8a70kewvc8wy",
  "cosmos1fx4dn48e74lvpd8anc60psrxzru5pk6t3ft5u9"
];

const BLOCKED_DELEGATORS = new Set(
  [...BASE_BLOCKED_DELEGATORS, ...Object.keys(ACCOUNT_LABELS)].map((addr) => addr.toLowerCase())
);

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

export interface StakingParams {
  unbonding_time: string;
  max_validators: number;
  max_entries: number;
  historical_entries: number;
  bond_denom: string;
}

export interface DistributionParams {
  community_tax: string;
  base_proposer_reward: string;
  bonus_proposer_reward: string;
  withdraw_addr_enabled: boolean;
}

export interface MintParams {
  mint_denom: string;
  inflation_rate_change: string;
  inflation_max: string;
  inflation_min: string;
  goal_bonded: string;
  blocks_per_year: string;
}

export interface BurnParams {
  fee_burn_rate: string;
  provision_burn_rate: string;
}

export interface NetworkStats {
  inflation: string;
  annualProvisions: string;
  bondedTokens: string;
  notBondedTokens: string;
  communityTax: string;
  baseAPR: number;
  effectiveAPR: number;
  feeBurnRate: number;
  provisionBurnRate: number;
}

export interface DelegatorLeaderboardEntry {
  delegatorAddress: string;
  totalStaked: string;
  validatorCount: number;
  validators: string[];
}

export function useStaking() {
const api = useApi();
const { address } = useKeplr();

const delegations = ref<Delegation[]>([]);
const rewards = ref<Reward[]>([]);
const unbonding = ref<UnbondingDelegation[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const stakingParams = ref<StakingParams | null>(null);
const distributionParams = ref<DistributionParams | null>(null);
const mintParams = ref<MintParams | null>(null);
const burnParams = ref<BurnParams | null>(null);
const networkStats = ref<NetworkStats | null>(null);
const delegatorLeaderboard = ref<DelegatorLeaderboardEntry[]>([]);
const delegatorLeaderboardLoading = ref(false);

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

  const fetchStakingParams = async () => {
    try {
      const res = await api.get("/cosmos/staking/v1beta1/params");
      stakingParams.value = res.data?.params || null;
    } catch (e: any) {
      console.warn("Failed to fetch staking params:", e?.message);
      stakingParams.value = null;
    }
  };

  const fetchDistributionParams = async () => {
    try {
      const res = await api.get("/cosmos/distribution/v1beta1/params");
      distributionParams.value = res.data?.params || null;
    } catch (e: any) {
      console.warn("Failed to fetch distribution params:", e?.message);
      distributionParams.value = null;
    }
  };

  const fetchMintParams = async () => {
    try {
      const res = await api.get("/cosmos/mint/v1beta1/params");
      mintParams.value = res.data?.params || null;
    } catch (e: any) {
      console.warn("Failed to fetch mint params:", e?.message);
      mintParams.value = null;
    }
  };

  const fetchBurnParams = async () => {
    const fallback = DEFAULT_BURN_RATE.toString();
    try {
      const res = await api.get("/cosmos/burn/v1beta1/params");
      burnParams.value = {
        fee_burn_rate: res.data?.params?.fee_burn_rate || fallback,
        provision_burn_rate: res.data?.params?.provision_burn_rate || fallback
      };
    } catch (e: any) {
      console.warn("Burn module not available:", e?.message);
      burnParams.value = {
        fee_burn_rate: fallback,
        provision_burn_rate: fallback
      };
    }
  };

  const fetchDelegatorLeaderboard = async (topValidatorCount = 5, delegationsPerValidator = 75) => {
    delegatorLeaderboardLoading.value = true;
    try {
      const bondedRes = await api.get("/cosmos/staking/v1beta1/validators", {
        params: {
          status: "BOND_STATUS_BONDED",
          "pagination.limit": 100
        }
      }).catch(() => ({ data: { validators: [] } }));

      const validators: any[] = bondedRes.data?.validators ?? [];
      const sorted = validators
        .slice()
        .sort((a, b) => (BigInt(b.tokens || "0") > BigInt(a.tokens || "0") ? 1 : -1))
        .slice(0, Math.max(1, topValidatorCount));

      const aggregate = new Map<string, { amount: bigint; validators: Set<string>; display: string }>();

      for (const validator of sorted) {
        const operatorAddress = validator?.operator_address;
        if (!operatorAddress) continue;

        try {
          const res = await api.get(`/cosmos/staking/v1beta1/validators/${operatorAddress}/delegations`, {
            params: {
              "pagination.limit": String(delegationsPerValidator),
              "pagination.reverse": "true"
            }
          });

          const delegations: any[] = res.data?.delegation_responses ?? [];
          delegations.forEach((entry: any) => {
            const delegatorRaw = entry?.delegation?.delegator_address;
            const delegator = typeof delegatorRaw === "string" ? delegatorRaw.toLowerCase() : "";
            const rawAmount = entry?.balance?.amount ?? "0";
            if (!delegator || BLOCKED_DELEGATORS.has(delegator)) return;
            let amount: bigint;
            try {
              amount = BigInt(rawAmount);
            } catch {
              amount = 0n;
            }
            if (amount <= 0n) return;

            const record = aggregate.get(delegator) ?? { amount: 0n, validators: new Set<string>(), display: delegatorRaw };
            record.amount += amount;
            record.validators.add(operatorAddress);
            if (!record.display && delegatorRaw) {
              record.display = delegatorRaw;
            }
            aggregate.set(delegator, record);
          });
        } catch (delegationErr) {
          console.warn(`Failed to load delegations for ${operatorAddress}`, delegationErr);
        }
      }

      const leaderboard = Array.from(aggregate.entries())
        .map(([delegatorAddress, info]) => ({
          delegatorAddress: info.display || delegatorAddress,
          totalStaked: info.amount.toString(),
          validatorCount: info.validators.size,
          validators: Array.from(info.validators)
        }))
        .sort((a, b) => (BigInt(b.totalStaked) > BigInt(a.totalStaked) ? 1 : -1))
        .slice(0, 10);

      delegatorLeaderboard.value = leaderboard;
    } catch (e: any) {
      console.warn("Failed to build delegator leaderboard", e);
      delegatorLeaderboard.value = [];
    } finally {
      delegatorLeaderboardLoading.value = false;
    }
  };

  const fetchNetworkStats = async () => {
    try {
      const [inflationRes, provisionsRes, poolRes] = await Promise.all([
        api.get("/cosmos/mint/v1beta1/inflation").catch(() => ({ data: { inflation: "0.1302" } })),
        api.get("/cosmos/mint/v1beta1/annual_provisions").catch(() => ({ data: { annual_provisions: "13022718955744" } })),
        api.get("/cosmos/staking/v1beta1/pool").catch(() => ({ data: { pool: { bonded_tokens: "10000000000000", not_bonded_tokens: "0" } } }))
      ]);

      await Promise.all([
        fetchDistributionParams(),
        fetchBurnParams()
      ]);

      const inflation = parseFloat(inflationRes.data?.inflation || "0.1302");
      const annualProvisions = parseFloat(provisionsRes.data?.annual_provisions || "13022718955744");
      const bondedTokens = parseFloat(poolRes.data?.pool?.bonded_tokens || "10000000000000");
      const notBondedTokens = parseFloat(poolRes.data?.pool?.not_bonded_tokens || "0");
      const communityTax = parseFloat(distributionParams.value?.community_tax || "0.02");
      const feeBurnRate = parseFloat(burnParams.value?.fee_burn_rate || "0");
      const provisionBurnRate = parseFloat(burnParams.value?.provision_burn_rate || "0");

      const baseAPR = bondedTokens > 0 ? (annualProvisions / bondedTokens) * (1 - communityTax) : 0;
      const effectiveAPR = baseAPR * (1 - provisionBurnRate);

      networkStats.value = {
        inflation: (inflation * 100).toFixed(2) + "%",
        annualProvisions: annualProvisions.toFixed(0),
        bondedTokens: bondedTokens.toFixed(0),
        notBondedTokens: notBondedTokens.toFixed(0),
        communityTax: (communityTax * 100).toFixed(2) + "%",
        baseAPR: baseAPR * 100,
        effectiveAPR: effectiveAPR * 100,
        feeBurnRate: feeBurnRate * 100,
        provisionBurnRate: provisionBurnRate * 100
      };
    } catch (e: any) {
      console.error("Failed to fetch network stats:", e);
      networkStats.value = null;
    }
  };

  return {
    delegations,
    rewards,
    unbonding,
    loading,
    error,
    stakingParams,
    distributionParams,
    mintParams,
    burnParams,
    networkStats,
    delegatorLeaderboard,
    delegatorLeaderboardLoading,
    fetchDelegations,
    fetchRewards,
    fetchUnbonding,
    fetchAll,
    fetchStakingParams,
    fetchDistributionParams,
    fetchMintParams,
    fetchBurnParams,
    fetchNetworkStats,
    fetchDelegatorLeaderboard
  };
}
