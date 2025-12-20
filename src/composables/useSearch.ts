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
    // Allow known prefixes (RetroChain + Cosmos derivations)
    return (
      /^retro[a-z0-9]{39}$/.test(value) ||
      /^retrovaloper[a-z0-9]{39}$/.test(value) ||
      /^cosmos[a-z0-9]{39}$/.test(value) ||
      /^cosmosvaloper[a-z0-9]{39}$/.test(value)
    );
  };

  const search = async (query: string): Promise<void> => {
    if (!query || query.trim().length === 0) {
      return;
    }

    const trimmed = query.trim();
    loading.value = true;
    error.value = null;

    try {
      // Check if it's a block height (numeric)
      if (/^\d+$/.test(trimmed)) {
        const height = parseInt(trimmed, 10);
        await router.push({ name: "block-detail", params: { height } });
        return;
      }

      // Check if it's a transaction hash (64 char hex)
      if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
        await router.push({ name: "tx-detail", params: { hash: trimmed.toUpperCase() } });
        return;
      }

      // Check if it's a bech32 account/validator address
      if (isBech32Address(trimmed)) {
        await router.push({ name: "account", params: { address: trimmed } });
        return;
      }

      // If nothing matches, try searching as a transaction hash anyway
      try {
        const txRes = await api.get(`/cosmos/tx/v1beta1/txs/${trimmed}`);
        if (txRes.data?.tx_response) {
          await router.push({ name: "tx-detail", params: { hash: trimmed } });
          return;
        }
      } catch {
        // Continue to error
      }

      error.value = "No results found. Search by block height, tx hash, or account address.";
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
