import { ref } from "vue";
import axios from "axios";

// Simple faucet client. Expects a POST to the faucet endpoint with { address, amount?, denom? }.
// Configure base via VITE_FAUCET_URL (default '/faucet').
export function useFaucet() {
  const base = import.meta.env.VITE_FAUCET_URL || "/faucet";
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastResponse = ref<any>(null);

  const requestTokens = async (address: string, amount?: string, denom?: string) => {
    loading.value = true;
    error.value = null;
    lastResponse.value = null;
    try {
      const res = await axios.post(base + "/request", { address, amount, denom });
      lastResponse.value = res.data;
      return res.data;
    } catch (e: any) {
      error.value = e?.response?.data?.error || e?.message || "Faucet request failed";
      throw e;
    } finally {
      loading.value = false;
    }
  };

  return { base, loading, error, lastResponse, requestTokens };
}
