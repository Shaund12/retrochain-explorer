import { ref } from "vue";
import { useApi } from "./useApi";

export interface Validator {
  operatorAddress: string;
  consensusPubkey: any;
  jailed: boolean;
  status: string;
  tokens: string;
  delegatorShares: string;
  description: {
    moniker: string;
    identity: string;
    website: string;
    securityContact: string;
    details: string;
  };
  unbondingHeight: string;
  unbondingTime: string;
  commission: {
    commissionRates: {
      rate: string;
      maxRate: string;
      maxChangeRate: string;
    };
    updateTime: string;
  };
  minSelfDelegation: string;
}

export interface ValidatorWithVotingPower extends Validator {
  votingPower: number;
  votingPowerPercent: number;
}

export function useValidators() {
  const api = useApi();
  const validators = ref<ValidatorWithVotingPower[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchValidators = async () => {
    loading.value = true;
    error.value = null;
    validators.value = []; // Clear previous data

    try {
      const res = await api.get("/cosmos/staking/v1beta1/validators", {
        params: {
          status: "BOND_STATUS_BONDED",
          "pagination.limit": 100
        }
      });

      console.log("Validators API Response:", res.data);

      const vals = res.data?.validators || [];
      
      if (vals.length === 0) {
        error.value = "No validators found. Make sure your chain has staking enabled and validators set up.";
        return;
      }
      
      // Calculate total voting power
      const totalTokens = vals.reduce((sum: number, v: any) => {
        return sum + parseInt(v.tokens || "0", 10);
      }, 0);

      validators.value = vals.map((v: any) => {
        const tokens = parseInt(v.tokens || "0", 10);
        return {
          operatorAddress: v.operator_address,
          consensusPubkey: v.consensus_pubkey,
          jailed: v.jailed,
          status: v.status,
          tokens: v.tokens,
          delegatorShares: v.delegator_shares,
          description: v.description || { moniker: "Unknown", identity: "", website: "", securityContact: "", details: "" },
          unbondingHeight: v.unbonding_height,
          unbondingTime: v.unbonding_time,
          commission: v.commission,
          minSelfDelegation: v.min_self_delegation,
          votingPower: tokens,
          votingPowerPercent: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0
        };
      }).sort((a: ValidatorWithVotingPower, b: ValidatorWithVotingPower) => 
        b.votingPower - a.votingPower
      );

    } catch (e: any) {
      console.error("Failed to fetch validators:", e);
      error.value = `Failed to load validators: ${e?.response?.data?.message || e?.message || String(e)}`;
      validators.value = []; // Ensure no fake data shows
    } finally {
      loading.value = false;
    }
  };

  return {
    validators,
    loading,
    error,
    fetchValidators
  };
}
