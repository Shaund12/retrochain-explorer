import { ref } from "vue";
import { useApi } from "./useApi";

export interface Balance {
  denom: string;
  amount: string;
}

export function useAccount() {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const balances = ref<Balance[]>([]);
  const bech32Address = ref<string>("");
  const accountInfo = ref<any | null>(null);
  const delegations = ref<any[]>([]);
  const rewards = ref<any[]>([]);
  const unbondings = ref<any[]>([]);

  const load = async (address: string) => {
    loading.value = true;
    error.value = null;
    balances.value = [];
    accountInfo.value = null;
    delegations.value = [];
    rewards.value = [];
    unbondings.value = [];
    bech32Address.value = address;

    try {
      const [accRes, balRes, delRes, rewRes, unbRes] = await Promise.allSettled([
        api.get(`/cosmos/auth/v1beta1/accounts/${address}`),
        api.get(`/cosmos/bank/v1beta1/balances/${address}`),
        api.get(`/cosmos/staking/v1beta1/delegations/${address}`),
        api.get(`/cosmos/distribution/v1beta1/delegators/${address}/rewards`),
        api.get(`/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations`)
      ]);

      if (balRes.status === "fulfilled") {
        const rawBalances = balRes.value.data?.balances ?? [];
        balances.value = rawBalances.map((b: any) => ({
          denom: b.denom,
          amount: b.amount
        }));
      } else {
        balances.value = [];
      }

      if (accRes.status === "fulfilled") {
        const acc = accRes.value.data?.account ?? null;
        accountInfo.value = acc;
      } else {
        const resp = (accRes.reason?.response?.data) || accRes.reason;
        const msg = resp?.message || resp?.error || accRes.reason?.message || "Account query failed";
        // Helpful hint for common bech32/prefix issues
        const hint = /bech32|prefix|decod/i.test(String(msg))
          ? "Check the address prefix matches the selected network."
          : "";
        error.value = hint ? `${msg}  ${hint}` : msg;
      }

      if (delRes.status === "fulfilled") {
        delegations.value = delRes.value.data?.delegation_responses ?? [];
      }

      if (rewRes.status === "fulfilled") {
        rewards.value = rewRes.value.data?.total ?? [];
      }

      if (unbRes.status === "fulfilled") {
        unbondings.value = unbRes.value.data?.unbonding_responses ?? [];
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || String(e);
      error.value = msg;
    } finally {
      loading.value = false;
    }
  };

  return { balances, bech32Address, accountInfo, delegations, rewards, unbondings, loading, error, load };
}
