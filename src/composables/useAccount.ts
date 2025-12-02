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

  const load = async (address: string) => {
    loading.value = true;
    error.value = null;
    balances.value = [];
    bech32Address.value = address;

    try {
      const [accRes, balRes] = await Promise.allSettled([
        api.get(`/cosmos/auth/v1beta1/accounts/${address}`),
        api.get(`/cosmos/bank/v1beta1/balances/${address}`)
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

      if (accRes.status === "rejected") {
        const resp = (accRes.reason?.response?.data) || accRes.reason;
        const msg = resp?.message || resp?.error || accRes.reason?.message || "Account query failed";
        // Helpful hint for common bech32/prefix issues
        const hint = /bech32|prefix|decod/i.test(String(msg))
          ? "Check the address prefix matches the selected network."
          : "";
        error.value = hint ? `${msg} — ${hint}` : msg;
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || String(e);
      error.value = msg;
    } finally {
      loading.value = false;
    }
  };

  return { balances, bech32Address, loading, error, load };
}
