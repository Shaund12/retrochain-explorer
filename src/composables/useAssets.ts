import { ref } from "vue";
import { useApi } from "./useApi";
import { getTokenMeta, type TokenMeta } from "@/constants/tokens";
import { smartQueryContract as smartQueryGet } from "@/utils/wasmSmartQuery";
import { isIgnorableSmartQueryError } from "@/utils/isIgnorableSmartQueryError";

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

export interface Cw20Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply: string;
  codeId: string;
  minter?: string | null;
  marketing?: {
    project?: string | null;
    description?: string | null;
    logo?: { url?: string | null } | null;
  } | null;
}

export interface NftClassMeta {
  id: string;
  name: string;
  symbol?: string;
  description?: string;
  uri?: string;
  data?: Record<string, any> | null;
  source?: "nft-module" | "ics721" | "cw721" | string;
}

interface PaginatedResponse<T> {
  items: T[];
  nextKey?: string;
}

let denomTraceEndpointSupported = true;
const BLOCKED_CW20_CONTRACTS = new Set([
  "cosmos1yyca08xqdgvjz0psg56z67ejh9xms6l436u8y58m82npdqqhmmtq8xrd4s",
  "cosmos14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s4hmalr"
]);

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
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  })} ${symbol}`;
}

export function useAssets() {
  const api = useApi();
  const bankTokens = ref<BankToken[]>([]);
  const ibcTokens = ref<BankToken[]>([]);
  const cw20Tokens = ref<Cw20Token[]>([]);
  const nftClasses = ref<NftClassMeta[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Smart-query base64 encoding/decoding is centralized in `src/utils/wasmSmartQuery.ts`.

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

const fetchCodeInfos = async () => {
  try {
    const { items } = await fetchPaginated<any>("/cosmwasm/wasm/v1/code", "code_infos", 100);
    return items;
  } catch (err) {
    console.warn("Failed to fetch code infos", err);
    return [];
  }
};

const fetchContractsForCode = async (codeId: string, limit = 50) => {
  try {
    const res = await api.get(`/cosmwasm/wasm/v1/code/${codeId}/contracts`, {
      params: {
        "pagination.limit": String(limit),
        "pagination.reverse": "true"
      },
      paramsSerializer
    });
    return Array.isArray(res.data?.contracts) ? (res.data.contracts as string[]) : [];
  } catch (err) {
    console.warn(`Failed to fetch contracts for code ${codeId}`, err);
    return [];
  }
};

  const fetchDenomTrace = async (hash: string) => {
    if (!denomTraceEndpointSupported) return null;
    try {
      const res = await api.get(`/ibc/apps/transfer/v1/denom_traces/${hash}`);
      return res.data?.denom_trace ?? null;
    } catch (traceErr) {
      const status = (traceErr as any)?.response?.status;
      if (status === 404 || status === 501) {
        denomTraceEndpointSupported = false;
      }
      console.warn(`Failed to fetch denom trace for ${hash}`, traceErr);
      return null;
    }
  };

  const queryContractSmart = async (address: string, payload: Record<string, any>) => {
    try {
      return await smartQueryGet(api as any, address, payload);
    } catch (err: any) {
      if (isIgnorableSmartQueryError(err)) {
        return null;
      }
      console.warn(`Smart query failed for ${address}`, err);
      return null;
    }
  };

  const fetchCw20Tokens = async (): Promise<Cw20Token[]> => {
    const cw20List: Cw20Token[] = [];
    const seenContracts = new Set<string>();
    try {
      const codeInfos = await fetchCodeInfos();
      if (!codeInfos.length) {
        return [];
      }
      for (const info of codeInfos) {
        if (cw20List.length >= 40) break;
        const codeId = String(info?.code_id ?? info?.id ?? "");
        if (!codeId) continue;

        const contracts = await fetchContractsForCode(codeId, 50);
        if (!contracts.length) continue;

        const contractQueries = contracts.slice(0, 50).map(async (address: string) => {
          const normalizedAddress = address?.toLowerCase?.() ?? "";
          if (!normalizedAddress || seenContracts.has(normalizedAddress) || BLOCKED_CW20_CONTRACTS.has(normalizedAddress) || cw20List.length >= 40) return;
          seenContracts.add(normalizedAddress);
          try {
            const tokenInfo = await queryContractSmart(address, { token_info: {} });
            if (!tokenInfo || typeof tokenInfo !== "object" || !tokenInfo.symbol) return;
            const decimals = Number(tokenInfo.decimals ?? 6);
            let minterData: any = null;
            try {
              minterData = await queryContractSmart(address, { minter: {} });
            } catch {}
            let marketingData: any = null;
            try {
              marketingData = await queryContractSmart(address, { marketing_info: {} });
            } catch {}

            cw20List.push({
              address,
              symbol: tokenInfo.symbol,
              name: tokenInfo.name || tokenInfo.symbol,
              decimals: Number.isFinite(decimals) ? decimals : 6,
              totalSupply: String(tokenInfo.total_supply ?? tokenInfo.totalSupply ?? "0"),
              codeId,
              minter: minterData?.minter ?? null,
              marketing: marketingData ?? null
            });
          } catch (err) {
            // not a CW20 or query failed; ignore
          }
        });

        await Promise.all(contractQueries);
        if (cw20List.length >= 40) break;
      }
    } catch (err) {
      console.warn("CW20 discovery failed", err);
    }
    return cw20List;
  };

  const fetchNftModuleClasses = async (): Promise<NftClassMeta[]> => {
    try {
      const nftRes = await fetchPaginated<any>("/cosmos/nft/v1beta1/classes", "classes");
      return nftRes.items.map((cls: any) => ({
        id: cls?.id || cls?.class_id || "?",
        name: cls?.name || cls?.description || cls?.id || "Untitled",
        symbol: cls?.symbol,
        description: cls?.description,
        uri: cls?.uri,
        data: cls?.data ?? null,
        source: "nft-module"
      }));
    } catch (nftErr) {
      console.warn("NFT module not available", nftErr);
      return [];
    }
  };

  const fetchIcs721Classes = async (): Promise<NftClassMeta[]> => {
    try {
      const traceRes = await fetchPaginated<any>("/ibc/apps/nft_transfer/v1/class_traces", "class_traces");
      return traceRes.items.map((trace: any) => ({
        id: trace?.class_id || trace?.hash || trace?.base_class_id || "?",
        name: trace?.base_class_id || trace?.class_id || "IBC NFT Class",
        description: trace?.path ? `IBC path: ${trace.path}` : undefined,
        data: trace ?? null,
        source: "ics721"
      }));
    } catch (icsErr) {
      console.warn("ICS721 class traces not available", icsErr);
      return [];
    }
  };

  const fetchCw721Collections = async (): Promise<NftClassMeta[]> => {
    const collections: NftClassMeta[] = [];
    const seenContracts = new Set<string>();

    try {
      const codeInfos = await fetchCodeInfos();
      if (!codeInfos.length) {
        return [];
      }

      for (const info of codeInfos) {
        if (collections.length >= 80) break;
        const codeId = String(info?.code_id ?? info?.id ?? "");
        if (!codeId) continue;

        const contracts = await fetchContractsForCode(codeId, 50);
        if (!contracts.length) continue;

        const contractQueries = contracts.slice(0, 50).map(async (address: string) => {
          const normalizedAddress = address?.toLowerCase?.() ?? "";
          if (!normalizedAddress || seenContracts.has(normalizedAddress) || collections.length >= 80) return;
          seenContracts.add(normalizedAddress);

          try {
            const contractInfo =
              (await queryContractSmart(address, { contract_info: {} })) ||
              (await queryContractSmart(address, { collection_info: {} }));
            if (!contractInfo || typeof contractInfo !== "object" || !contractInfo.name) return;

            let numTokens: string | undefined;
            try {
              const numTokensResp = await queryContractSmart(address, { num_tokens: {} });
              if (typeof numTokensResp === "string") {
                numTokens = numTokensResp;
              } else if (typeof numTokensResp?.count === "string") {
                numTokens = numTokensResp.count;
              } else if (typeof numTokensResp?.num_tokens === "string") {
                numTokens = numTokensResp.num_tokens;
              }
            } catch {}

            let minter: string | undefined;
            try {
              const minterResp = await queryContractSmart(address, { minter: {} });
              if (minterResp?.minter) {
                minter = minterResp.minter;
              }
            } catch {}

            collections.push({
              id: address,
              name: contractInfo.name || address,
              symbol: contractInfo.symbol,
              description: contractInfo.description || (numTokens ? `${numTokens} tokens minted` : undefined),
              uri: contractInfo.base_token_uri || contractInfo.uri,
              data: { ...contractInfo, numTokens, minter, codeId },
              source: "cw721"
            });
          } catch (err) {
            // not a CW721 or query failed; ignore
          }
        });

        await Promise.all(contractQueries);
        if (collections.length >= 80) break;
      }
    } catch (err) {
      console.warn("CW721 discovery failed", err);
    }

    return collections;
  };

  const fetchAssets = async () => {
    loading.value = true;
    error.value = null;
    bankTokens.value = [];
    ibcTokens.value = [];
    cw20Tokens.value = [];
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
        const tokenMeta = getTokenMeta(denom);
        const displayUnit = meta?.denom_units?.find((unit: any) => unit.denom === meta?.display) || meta?.denom_units?.slice(-1)?.[0];
        const curatedDecimals = typeof tokenMeta.decimals === "number" ? tokenMeta.decimals : undefined;
        const exponent = curatedDecimals ?? (typeof displayUnit?.exponent === "number" ? displayUnit.exponent : 6);
        const displayDenom = tokenMeta.symbol || meta?.display || denom.toUpperCase();
        const displayAmount = formatWithExponent(amount, exponent, displayDenom);
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

      const nftModuleClasses = await fetchNftModuleClasses();
      const ics721Classes = await fetchIcs721Classes();
      const cw721Collections = await fetchCw721Collections();

      const combined = [...nftModuleClasses, ...ics721Classes, ...cw721Collections];
      const mergedMap = new Map<string, NftClassMeta>();
      combined.forEach((cls) => {
        const key = String(cls?.id || "").toLowerCase();
        if (!key) return;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, cls);
        }
      });

      nftClasses.value = Array.from(mergedMap.values());

      try {
        cw20Tokens.value = await fetchCw20Tokens();
      } catch (cw20Err) {
        console.warn("Failed to load CW20 tokens", cw20Err);
        cw20Tokens.value = [];
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
    cw20Tokens,
    nftClasses,
    loading,
    error,
    fetchAssets
  };
}
