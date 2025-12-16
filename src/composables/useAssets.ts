import { ref } from "vue";
import { useApi } from "./useApi";
import { getTokenMeta, type TokenMeta } from "@/constants/tokens";

export interface BankToken {
  denom: string;
  amount: string;
  displayAmount: string;
  displayDenom: string;
  decimals: number;
  metadata?: any;
  tokenMeta: TokenMeta;
  isIbc: boolean;
  isFactory: boolean;
  baseDenom?: string;
  tracePath?: string;
  counterpartyChain?: string;
}

export interface NftClassMeta {
  id: string;
  name: string;
  symbol?: string;
  description?: string;
  uri?: string;
  data?: Record<string, any> | null;
}

interface PaginatedResponse<T> {
  items: T[];
  nextKey?: string;
}

const paramsSerializer = (params: Record<string, any>) => {
  const search = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => search.append(key, entry));
    } else {
      search.append(key, value);
    }
  });
  return search.toString();
};

function formatWithExponent(amount: string, exponent: number, symbol: string) {
  const value = Number(amount) / Math.pow(10, exponent);
  if (!Number.isFinite(value)) {
    return `${amount} ${symbol}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}`;
}

export function useAssets() {
  const api = useApi();
  const bankTokens = ref<BankToken[]>([]);
  const ibcTokens = ref<BankToken[]>([]);
  const nftClasses = ref<NftClassMeta[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPaginated = async <T>(path: string, dataKey: string, limit = 200): Promise<PaginatedResponse<T>> => {
    const items: T[] = [];
    let nextKey: string | undefined;

    do {
      const res = await api.get(path, {
        params: {
          "pagination.limit": String(limit),
          ...(nextKey ? { "pagination.key": nextKey } : {})
        },
        paramsSerializer
      });
      const chunk: T[] = res.data?.[dataKey] ?? [];
      items.push(...chunk);
      nextKey = res.data?.pagination?.next_key || undefined;
    } while (nextKey);

    return { items };
  };

  const fetchDenomTrace = async (hash: string) => {
    try {
      const res = await api.get(`/ibc/apps/transfer/v1/denom_traces/${hash}`);
      return res.data?.denom_trace;
    } catch (traceErr) {
      console.warn(`Failed to fetch denom trace for ${hash}`, traceErr);
      return null;
    }
  };

  const fetchAssets = async () => {
    loading.value = true;
    error.value = null;
    bankTokens.value = [];
    ibcTokens.value = [];
    nftClasses.value = [];

    try {
      const [supplyRes, metadataRes] = await Promise.all([
        fetchPaginated<any>("/cosmos/bank/v1beta1/supply", "supply"),
        fetchPaginated<any>("/cosmos/bank/v1beta1/denoms_metadata", "metadatas")
      ]);

      const metadataMap = new Map<string, any>();
      metadataRes.items.forEach((meta) => {
        if (meta?.base) {
          metadataMap.set(String(meta.base).toLowerCase(), meta);
        }
      });

      const allTokens: BankToken[] = [];
      const ibcDenoms: string[] = [];

      supplyRes.items.forEach((entry: any) => {
        const denom = String(entry?.denom || "");
        if (!denom) return;
        const amount = String(entry?.amount ?? "0");
        const meta = metadataMap.get(denom.toLowerCase());
        const displayDenom = meta?.display || denom.toUpperCase();
        const displayUnit = meta?.denom_units?.find((unit: any) => unit.denom === meta?.display) || meta?.denom_units?.slice(-1)?.[0];
        const exponent = Number(displayUnit?.exponent ?? 6);
        const displayAmount = formatWithExponent(amount, exponent, displayDenom);
        const tokenMeta = getTokenMeta(denom);
        const isIbc = denom.startsWith("ibc/");
        const isFactory = denom.startsWith("factory/");

        const token: BankToken = {
          denom,
          amount,
          displayAmount,
          displayDenom,
          decimals: exponent,
          metadata: meta,
          tokenMeta,
          isIbc,
          isFactory
        };

        allTokens.push(token);
        if (isIbc) {
          ibcDenoms.push(denom.split("/")[1] || "");
        }
      });

      bankTokens.value = allTokens.filter((token) => !token.isIbc);

      if (ibcDenoms.length) {
        const uniqueHashes = Array.from(new Set(ibcDenoms.filter(Boolean).map((h) => h.toLowerCase())));
        const traceResults = await Promise.all(uniqueHashes.map((hash) => fetchDenomTrace(hash)));
        const traceMap = new Map<string, any>();
        uniqueHashes.forEach((hash, idx) => {
          const trace = traceResults[idx];
          if (trace) {
            traceMap.set(hash, trace);
          }
        });

        ibcTokens.value = allTokens
          .filter((token) => token.isIbc)
          .map((token) => {
            const hash = token.denom.split("/")[1]?.toLowerCase() ?? "";
            const trace = traceMap.get(hash);
            return {
              ...token,
              baseDenom: trace?.base_denom || trace?.baseDenom,
              tracePath: trace?.path,
              counterpartyChain: trace?.path?.split("/")?.[1] || undefined
            };
          });
      } else {
        ibcTokens.value = [];
      }

      try {
        const nftRes = await fetchPaginated<any>("/cosmos/nft/v1beta1/classes", "classes");
        nftClasses.value = nftRes.items.map((cls: any) => ({
          id: cls?.id || cls?.class_id || "?",
          name: cls?.name || cls?.description || cls?.id || "Untitled",
          symbol: cls?.symbol,
          description: cls?.description,
          uri: cls?.uri,
          data: cls?.data ?? null
        }));
      } catch (nftErr) {
        console.warn("NFT module not available", nftErr);
        nftClasses.value = [];
      }
    } catch (e: any) {
      console.error("Failed to load asset data", e);
      error.value = e?.message ?? String(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    bankTokens,
    ibcTokens,
    nftClasses,
    loading,
    error,
    fetchAssets
  };
}
