import { ref } from "vue";
import { useApi } from "./useApi";

export interface NftClassDetail {
  id: string;
  name?: string;
  symbol?: string;
  description?: string;
  uri?: string;
  data?: Record<string, any> | null;
  source?: "nft-module" | "ics721" | "cw721" | string;
}

export interface NftTokenMeta {
  id: string;
  name?: string;
  description?: string;
  uri?: string;
  image?: string;
  data?: Record<string, any> | null;
}

interface PaginatedResponse<T> {
  items: T[];
  nextKey?: string;
}

const decodeBase64 = (value: string) => {
  try {
    if (typeof atob === "function") return atob(value);
    const buf = (globalThis as any)?.Buffer?.from(value, "base64");
    return buf ? buf.toString("utf-8") : value;
  } catch {
    return value;
  }
};

const parseJsonMetadata = async (uri: string): Promise<Record<string, any> | null> => {
  if (!uri) return null;
  try {
    const lower = uri.toLowerCase();
    if (lower.startsWith("data:application/json;base64,")) {
      const b64 = uri.split(",", 2)[1] || "";
      const json = decodeBase64(b64);
      return JSON.parse(json);
    }
    if (lower.startsWith("data:application/json;utf8,")) {
      const encoded = uri.split(",", 2)[1] || "";
      return JSON.parse(decodeURIComponent(encoded));
    }
    if (lower.startsWith("data:application/json,")) {
      const encoded = uri.split(",", 2)[1] || "";
      return JSON.parse(decodeURIComponent(encoded));
    }

    const res = await fetch(uri);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

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
  const bytes = typeof atob === "function" ? Uint8Array.from(atob(value), (c) => c.charCodeAt(0)) : null;
  if (bytes && typeof TextDecoder !== "undefined") {
    const decoder = new TextDecoder();
    try {
      return JSON.parse(decoder.decode(bytes));
    } catch {
      return decoder.decode(bytes);
    }
  }
  try {
    const parsed = JSON.parse(value);
    return parsed;
  } catch {
    return value;
  }
};

export function useNfts() {
  const api = useApi();

  const classDetail = ref<NftClassDetail | null>(null);
  const tokens = ref<NftTokenMeta[]>([]);
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

  const queryContractSmart = async (address: string, payload: Record<string, any>) => {
    const encoded = encodeJsonToBase64(payload);
    const encodedPath = encodeURIComponent(encoded);
    try {
      const res = await api.get(`/cosmwasm/wasm/v1/contract/${address}/smart/${encodedPath}`);
      const data = res.data?.data ?? res.data?.smart_response?.data;
      return data !== undefined ? decodeBase64Json(data) : null;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string | undefined = err?.response?.data?.message || err?.message;
      if (status === 400 || status === 422) return null;
      if (typeof msg === "string") {
        const lowered = msg.toLowerCase();
        if (lowered.includes("unknown variant") || lowered.includes("unknown field") || lowered.includes("error parsing")) {
          return null;
        }
      }
      throw err;
    }
  };

  const fetchClassFromNftModule = async (classId: string): Promise<NftClassDetail | null> => {
    try {
      const res = await api.get(`/cosmos/nft/v1beta1/classes/${encodeURIComponent(classId)}`);
      const cls = res.data?.class;
      if (!cls) return null;
      return {
        id: cls?.id || cls?.class_id || classId,
        name: cls?.name || cls?.description || cls?.id || classId,
        symbol: cls?.symbol,
        description: cls?.description,
        uri: cls?.uri,
        data: cls?.data ?? null,
        source: "nft-module"
      };
    } catch (err: any) {
      // If the backend supports the cosmos nft module but this class doesn't exist,
      // just return null so callers can fall back to CW721 smart queries.
      const msg = err?.response?.data?.message || err?.message;
      if (typeof msg === "string" && msg.toLowerCase().includes("class does not exist")) {
        return null;
      }
      return null;
    }
  };

  const fetchClassFromCw721 = async (contract: string): Promise<NftClassDetail | null> => {
    try {
      const contractInfo =
        (await queryContractSmart(contract, { contract_info: {} })) ||
        (await queryContractSmart(contract, { collection_info: {} })) ||
        (await queryContractSmart(contract, { cw721_metadata_contract_info: {} }));
      if (!contractInfo) return null;
      return {
        id: contract,
        name: contractInfo.name || contract,
        symbol: contractInfo.symbol,
        description: contractInfo.description,
        uri: contractInfo.base_token_uri || contractInfo.uri,
        data: contractInfo,
        source: "cw721"
      };
    } catch {
      return null;
    }
  };

  const fetchTokensFromNftModule = async (classId: string): Promise<NftTokenMeta[]> => {
    try {
      const res = await fetchPaginated<any>(`/cosmos/nft/v1beta1/nfts/${encodeURIComponent(classId)}`, "nfts", 100);
      return res.items.map((nft: any) => ({
        id: nft?.id || nft?.token_id || "",
        name: nft?.name || nft?.id || nft?.token_id,
        description: nft?.description,
        uri: nft?.uri,
        image: (nft?.data && (nft.data.image || nft.data.image_url)) || nft?.uri,
        data: nft?.data ?? null
      }));
    } catch {
      return [];
    }
  };

  const fetchTokensFromCw721 = async (contract: string): Promise<NftTokenMeta[]> => {
    const tokens: NftTokenMeta[] = [];
    try {
      let tokenIds: string[] | null = null;
      try {
        const resp = await queryContractSmart(contract, { all_tokens: { limit: 50 } });
        if (Array.isArray(resp)) tokenIds = resp as string[];
        else if (Array.isArray(resp?.tokens)) tokenIds = resp.tokens;
      } catch {}

      if (!tokenIds) {
        try {
          const resp = await queryContractSmart(contract, { tokens: { limit: 50 } });
          if (Array.isArray(resp)) tokenIds = resp as string[];
          else if (Array.isArray(resp?.tokens)) tokenIds = resp.tokens;
        } catch {}
      }

      if (!tokenIds || !tokenIds.length) return tokens;

      const tokenInfos = await Promise.all(
        tokenIds.slice(0, 50).map(async (tokenId) => {
          try {
            const info = await queryContractSmart(contract, { nft_info: { token_id: tokenId } });
            const extension = info?.extension ?? {};
            let image = extension.image || extension.image_url || extension.mediaUri;
            let name = extension.name || tokenId;
            let description = extension.description;

            // If no inline metadata provides image, attempt to fetch/parse the token_uri JSON
            if (!image && typeof info?.token_uri === "string") {
              const meta = await parseJsonMetadata(info.token_uri);
              if (meta) {
                image = meta.image || image;
                name = meta.name || name;
                description = meta.description || description;
              }
            }

            // Final fallback: only use token_uri as image if it actually looks like an image URI.
            if (!image && typeof info?.token_uri === "string") {
              const uri = info.token_uri;
              const lower = uri.toLowerCase();
              if (lower.startsWith("data:image/") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp") || lower.endsWith(".svg")) {
                image = uri;
              }
            }
            return {
              id: tokenId,
              name,
              description,
              uri: info?.token_uri,
              image,
              data: info ?? null
            } as NftTokenMeta;
          } catch {
            return {
              id: tokenId,
              name: tokenId,
              data: null
            } as NftTokenMeta;
          }
        })
      );

      tokens.push(...tokenInfos.filter(Boolean));
    } catch (err) {
      console.warn("CW721 token fetch failed", err);
    }

    return tokens;
  };

  const fetchDetail = async (classId: string) => {
    loading.value = true;
    error.value = null;
    classDetail.value = null;
    tokens.value = [];

    try {
      const asString = String(classId || "");
      let detail: NftClassDetail | null = null;

      const looksLikeAddress = asString.startsWith("cosmos1") || asString.startsWith("osmo1");

      // If this looks like a CW721 contract address, don't hit x/nft module first
      // (it will often return "class does not exist").
      if (!looksLikeAddress) {
        detail = await fetchClassFromNftModule(asString);
      }

      if (!detail && looksLikeAddress) {
        detail = await fetchClassFromCw721(asString);
      }

      // If still null, try ICS trace path minimal
      if (!detail) {
        detail = {
          id: asString,
          name: asString,
          source: undefined
        };
      }

      classDetail.value = detail;

      // Fetch tokens based on source hints
      let tokenList: NftTokenMeta[] = [];
      if (detail.source === "cw721" || looksLikeAddress) {
        tokenList = await fetchTokensFromCw721(asString);
      } else {
        tokenList = await fetchTokensFromNftModule(asString);
      }

      tokens.value = tokenList;
    } catch (err: any) {
      error.value = err?.message || "Failed to load NFT collection";
    } finally {
      loading.value = false;
    }
  };

  return {
    classDetail,
    tokens,
    loading,
    error,
    fetchDetail
  };
}
