import { ref } from "vue";
import { useApi } from "./useApi";
import { useRouter } from "vue-router";

export interface SearchResult {
  type: "block" | "transaction" | "address";
  value: string;
  label: string;
}

export function useSearch() {
  const api = useApi();
  const router = useRouter();
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isBech32Address = (value: string) => {
    // Allow common prefixes with flexible lengths (some CosmWasm addrs are longer)
    return (
      /^(retro|retrovaloper)[a-z0-9]{38,74}$/.test(value) ||
      /^(cosmos|cosmosvaloper)[a-z0-9]{38,74}$/.test(value)
    );
  };

  const search = async (query: string): Promise<void> => {
    const trimmed = String(query ?? "").trim();
    if (!trimmed.length) {
      error.value = "Enter a block height, tx hash, or address.";
      return;
    }
    loading.value = true;
    error.value = null;

    let routeTarget: { name: string; params?: Record<string, any> } | null = null;

    try {
      // Block height (numeric)
      if (/^\d+$/.test(trimmed)) {
        const height = parseInt(trimmed, 10);
        routeTarget = { name: "block-detail", params: { height } };
      }

      // Tx hash (64 hex)
      if (!routeTarget && /^[A-Fa-f0-9]{64}$/.test(trimmed)) {
        routeTarget = { name: "tx-detail", params: { hash: trimmed.toUpperCase() } };
      }

      // Bech32 account/validator/contract
      if (!routeTarget && isBech32Address(trimmed)) {
        try {
          await api.get(`/cosmwasm/wasm/v1/contract/${trimmed}`);
          routeTarget = { name: "contract-detail", params: { address: trimmed } };
        } catch {
          routeTarget = { name: "account", params: { address: trimmed } };
        }
      }

      // Fallback: attempt tx lookup
      if (!routeTarget) {
        try {
          const txRes = await api.get(`/cosmos/tx/v1beta1/txs/${trimmed}`);
          if (txRes.data?.tx_response) {
            routeTarget = { name: "tx-detail", params: { hash: trimmed } };
          }
        } catch {
          // ignore and fall through
        }
      }

      if (routeTarget) {
        await router.push(routeTarget);
      } else {
        error.value = "No results found. Search by block height, tx hash, or account address.";
      }
    } catch (e: any) {
      error.value = e?.message || "Search failed";
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    search
  };
}
