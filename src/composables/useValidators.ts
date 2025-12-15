import { ref } from "vue";
import { useApi } from "./useApi";
import { deriveConsensusAddressFromPubkey } from "@/utils/consensus";

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
  consensusAddressHex?: string | null;
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
      const statusFilters = [
        "BOND_STATUS_BONDED",
        "BOND_STATUS_UNBONDING",
        "BOND_STATUS_UNBONDED"
      ];

      const validatorMap = new Map<string, any>();

      for (const status of statusFilters) {
        try {
          const res = await api.get("/cosmos/staking/v1beta1/validators", {
            params: {
              status,
              "pagination.limit": 300
            }
          });

          const list: any[] = res.data?.validators || [];
          list.forEach((validator) => {
            if (!validator?.operator_address) return;
            validatorMap.set(validator.operator_address, validator);
          });
        } catch (statusErr) {
          console.warn(`Validator fetch failed for status ${status}`, statusErr);
        }
      }

      const vals = Array.from(validatorMap.values());

      if (vals.length === 0) {
        error.value = "No validators found. Make sure your chain has staking enabled and validators set up.";
        return;
      }
      
      const consensusAddresses = await Promise.all(
        vals.map((v: any) => deriveConsensusAddressFromPubkey(v.consensus_pubkey))
      );

      // Calculate total voting power
      const totalTokens = vals.reduce((sum: number, v: any) => {
        return sum + parseInt(v.tokens || "0", 10);
      }, 0);

      validators.value = vals.map((v: any, idx: number) => {
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
          votingPowerPercent: totalTokens > 0 ? (tokens / totalTokens) * 100 : 0,
          consensusAddressHex: consensusAddresses[idx]
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
