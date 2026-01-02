import { ref } from "vue";
import { useApi } from "./useApi";
import { useRouter } from "vue-router";
import { getAccountLabel } from "@/constants/accountLabels";

export interface SearchResult {
  type: "block" | "transaction" | "address" | "contract" | "validator" | "token";
  value: string;
  label: string;
  description?: string;
  icon?: string;
  route: { name: string; params?: Record<string, any> };
}

export interface SearchSuggestion {
  query: string;
  label: string;
  icon: string;
  type: "quick" | "recent" | "popular";
}

export function useSearch() {
  const api = useApi();
  const router = useRouter();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const results = ref<SearchResult[]>([]);
  const suggestions = ref<SearchSuggestion[]>([]);

  const RECENT_SEARCHES_KEY = "rc_recent_searches";
  const MAX_RECENT = 5;

  const isBech32Address = (value: string) => {
    // Allow common prefixes with flexible lengths (some CosmWasm addrs are longer)
    return (
      /^(retro|retrovaloper)[a-z0-9]{38,74}$/.test(value) ||
      /^(cosmos|cosmosvaloper)[a-z0-9]{38,74}$/.test(value)
    );
  };

  const isValidatorAddress = (value: string) => {
    return /^(retrovaloper|cosmosvaloper)[a-z0-9]{38,}$/i.test(value);
  };

  const isContractAddress = async (value: string): Promise<boolean> => {
    if (!isBech32Address(value)) return false;
    try {
      await api.get(`/cosmwasm/wasm/v1/contract/${value}`);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Multi-entity search - attempts to identify all possible matches
   */
  const searchAll = async (query: string): Promise<SearchResult[]> => {
    const trimmed = String(query ?? "").trim();
    if (!trimmed.length) return [];

    const matches: SearchResult[] = [];

    // Block height (numeric)
    if (/^\d+$/.test(trimmed)) {
      const height = parseInt(trimmed, 10);
      matches.push({
        type: "block",
        value: trimmed,
        label: `Block #${height.toLocaleString()}`,
        description: "Blockchain block",
        icon: "??",
        route: { name: "block-detail", params: { height } }
      });
    }

    // Tx hash (64 hex)
    if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
      matches.push({
        type: "transaction",
        value: trimmed,
        label: `Transaction ${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`,
        description: "Blockchain transaction",
        icon: "??",
        route: { name: "tx-detail", params: { hash: trimmed.toUpperCase() } }
      });
    }

    // Validator address
    if (isValidatorAddress(trimmed)) {
      matches.push({
        type: "validator",
        value: trimmed,
        label: `Validator ${trimmed.slice(0, 20)}...`,
        description: "Validator operator",
        icon: "???",
        route: { name: "validators", params: {} }
      });
    }

    // Bech32 address (account/contract)
    if (isBech32Address(trimmed)) {
      const accountLabel = getAccountLabel(trimmed);
      const isContract = await isContractAddress(trimmed);

      if (isContract) {
        matches.push({
          type: "contract",
          value: trimmed,
          label: accountLabel?.label || `Contract ${trimmed.slice(0, 20)}...`,
          description: accountLabel?.description || "Smart contract",
          icon: accountLabel?.icon || "??",
          route: { name: "contract-detail", params: { address: trimmed } }
        });
      } else {
        matches.push({
          type: "address",
          value: trimmed,
          label: accountLabel?.label || `Address ${trimmed.slice(0, 20)}...`,
          description: accountLabel?.description || "Blockchain account",
          icon: accountLabel?.icon || "??",
          route: { name: "account", params: { address: trimmed } }
        });
      }
    }

    // Token/denom search
    if (trimmed.startsWith("ibc/") || trimmed.startsWith("factory/") || /^u[a-z]+$/.test(trimmed)) {
      matches.push({
        type: "token",
        value: trimmed,
        label: `Token: ${trimmed}`,
        description: "Token denomination",
        icon: "??",
        route: { name: "tokens", params: {} }
      });
    }

    return matches;
  };

  /**
   * Save search to recent history
   */
  const saveRecentSearch = (query: string) => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const recent: string[] = stored ? JSON.parse(stored) : [];
      const updated = [query, ...recent.filter((q) => q !== query)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Failed to save recent search", err);
    }
  };

  /**
   * Get recent searches
   */
  const getRecentSearches = (): SearchSuggestion[] => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const recent: string[] = stored ? JSON.parse(stored) : [];
      return recent.map((query) => ({
        query,
        label: query,
        icon: "??",
        type: "recent" as const
      }));
    } catch {
      return [];
    }
  };

  /**
   * Get popular/quick search suggestions
   */
  const getQuickSuggestions = (): SearchSuggestion[] => [
    { query: "latest", label: "Latest Block", icon: "??", type: "quick" },
    { query: "txs", label: "Recent Transactions", icon: "??", type: "quick" },
    { query: "validators", label: "Validators", icon: "???", type: "quick" },
    { query: "tokens", label: "Tokens", icon: "??", type: "quick" }
  ];

  /**
   * Load suggestions (recent + quick)
   */
  const loadSuggestions = () => {
    const recent = getRecentSearches();
    const quick = getQuickSuggestions();
    suggestions.value = [...recent, ...quick];
  };

  /**
   * Primary search function (legacy compatibility)
   */
  const search = async (query: string): Promise<void> => {
    const trimmed = String(query ?? "").trim();
    if (!trimmed.length) {
      error.value = "Enter a block height, tx hash, or address.";
      return;
    }
    loading.value = true;
    error.value = null;
    results.value = [];

    try {
      const matches = await searchAll(trimmed);
      results.value = matches;

      if (matches.length === 0) {
        error.value = "No results found. Try a block height, tx hash, or address.";
      } else if (matches.length === 1) {
        // Auto-navigate to single result
        saveRecentSearch(trimmed);
        await router.push(matches[0].route);
      } else {
        // Multiple results - let user choose
        saveRecentSearch(trimmed);
        // Results are stored in results.value for display
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
    search,
    searchAll,
    results,
    suggestions,
    loadSuggestions,
    saveRecentSearch,
    getRecentSearches
  };
}
