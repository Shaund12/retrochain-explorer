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

  const bytesToBase64 = (bytes: Uint8Array) => {
    if (typeof btoa === "function") {
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      return btoa(binary);
    }
    const nodeBuffer = (globalThis as any)?.Buffer;
    if (nodeBuffer) {
      return nodeBuffer.from(bytes).toString("base64");
    }
    throw new Error("Base64 encoding not supported in this environment.");
  };

  const base64ToBytes = (value: string) => {
    if (typeof atob === "function") {
      const binary = atob(value);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    const nodeBuffer = (globalThis as any)?.Buffer;
    if (nodeBuffer) {
      const buf = nodeBuffer.from(value, "base64");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    throw new Error("Base64 decoding not supported in this environment.");
  };

  const encodeJsonToBase64 = (payload: Record<string, any>) => {
    const json = JSON.stringify(payload);
    if (typeof TextEncoder !== "undefined") {
      const encoder = new TextEncoder();
      return bytesToBase64(encoder.encode(json));
    }
    const nodeBuffer = (globalThis as any)?.Buffer;
    if (nodeBuffer) {
      return nodeBuffer.from(json, "utf-8").toString("base64");
    }
    throw new Error("TextEncoder is unavailable in this environment.");
  };


  const decodeBase64Json = (value?: any) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") {
      return value;
    }
    const bytes = base64ToBytes(value);
    if (typeof TextDecoder !== "undefined") {
      const decoder = new TextDecoder();
      const asString = decoder.decode(bytes);
      try {
        return JSON.parse(asString);
      } catch {
        return asString;
      }
    }
    try {
      const asString = Array.from(bytes)
        .map((b) => String.fromCharCode(b))
        .join("");
      return JSON.parse(asString);
    } catch {
      return null;
    }
  };

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

  const isIgnorableContractError = (err: any) => {
    const status = err?.response?.status;
    if (status === 400 || status === 422) return true;
    const msg: string | undefined = err?.response?.data?.message || err?.message;
    if (typeof msg === "string") {
      const lowered = msg.toLowerCase();
      return lowered.includes("unknown variant") || lowered.includes("unknown field") || lowered.includes("error parsing");
    }
    return false;
  };

  const queryContractSmart = async (address: string, payload: Record<string, any>) => {
    const encoded = encodeJsonToBase64(payload);
    const encodedPath = encodeURIComponent(encoded);
    try {
      const res = await api.get(`/cosmwasm/wasm/v1/contract/${address}/smart/${encodedPath}`);
      const data = res.data?.data ?? res.data?.smart_response?.data;
      return data !== undefined ? decodeBase64Json(data) : null;
    } catch (err: any) {
      if (isIgnorableContractError(err)) {
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
