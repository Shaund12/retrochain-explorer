import { ref } from "vue";
import { useApi } from "./useApi";
import { smartQueryContract as smartQuery } from "@/utils/wasmSmartQuery";

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

const normalizeImageUri = (value?: string): string | undefined => {
  if (!value || typeof value !== "string") return undefined;
  const v = value.trim().replace(/\s+/g, " ");
  const lower = v.toLowerCase();

  // Never treat JSON data URIs as images.
  if (lower.startsWith("data:application/json")) return undefined;

  // If contract already provides base64 SVG data URI, keep as-is.
  if (lower.startsWith("data:image/svg+xml;base64,")) return v;

  // Some NFT metadata uses data:image/svg+xml,<svg ...> (NOT base64). This must be URL-encoded.
  if (lower.startsWith("data:image/svg+xml,")) {
    const raw = v.slice("data:image/svg+xml,".length);
    if (/%[0-9a-f]{2}/i.test(raw)) return v; // already encoded
    return `data:image/svg+xml,${encodeURIComponent(raw)}`;
  }

  return v;
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
    if (Array.isArray(value)) value.forEach((entry) => search.append(key, entry));
    else search.append(key, value);
  });
  return search.toString();
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

  // Shared canonical smart query (GET /smart/{base64}) via utils/wasmSmartQuery
  const queryContractSmart = async (address: string, payload: Record<string, any>) => {
    try {
      return await smartQuery(api, address, payload);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string | undefined = err?.response?.data?.message || err?.message;

      // Treat schema mismatch / bad query as "not supported" so we can fall back.
      if (status === 400 || status === 404 || status === 422) return null;
      if (typeof msg === "string") {
        const lowered = msg.toLowerCase();
        if (
          lowered.includes("unknown variant") ||
          lowered.includes("unknown field") ||
          lowered.includes("error parsing") ||
          lowered.includes("invalid request")
        ) {
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
      const msg = err?.response?.data?.message || err?.message;
      if (typeof msg === "string" && msg.toLowerCase().includes("class does not exist")) return null;
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
    const out: NftTokenMeta[] = [];
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

      if (!tokenIds || !tokenIds.length) return out;

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
                image = normalizeImageUri(meta.image) || image;
                name = meta.name || name;
                description = meta.description || description;
              }
            }

            // Final fallback: only use token_uri as image if it actually looks like an image URI.
            if (!image && typeof info?.token_uri === "string") {
              const uri = info.token_uri;
              const lower = uri.toLowerCase();
              if (
                lower.startsWith("data:image/") ||
                lower.endsWith(".png") ||
                lower.endsWith(".jpg") ||
                lower.endsWith(".jpeg") ||
                lower.endsWith(".gif") ||
                lower.endsWith(".webp") ||
                lower.endsWith(".svg")
              ) {
                image = normalizeImageUri(uri);
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
            return { id: tokenId, name: tokenId, data: null } as NftTokenMeta;
          }
        })
      );

      out.push(...tokenInfos.filter(Boolean));
    } catch (err) {
      console.warn("CW721 token fetch failed", err);
    }

    return out;
  };

  const fetchDetail = async (classId: string) => {
    loading.value = true;
    error.value = null;
    classDetail.value = null;
    tokens.value = [];

    try {
      const asString = String(classId || "");
      let detail: NftClassDetail | null = null;

      // Be a bit more permissive than just cosmos1/osmo1
      const looksLikeAddress =
        asString.startsWith("cosmos1") ||
        asString.startsWith("osmo1") ||
        asString.startsWith("retro1") ||
        /^[a-z0-9]{1,20}1[0-9a-z]{30,}$/i.test(asString);

      // If this looks like a CW721 contract address, don't hit x/nft module first
      if (!looksLikeAddress) {
        detail = await fetchClassFromNftModule(asString);
      }

      if (!detail && looksLikeAddress) {
        detail = await fetchClassFromCw721(asString);
      }

      if (!detail) {
        detail = { id: asString, name: asString, source: undefined };
      }

      classDetail.value = detail;

      let tokenList: NftTokenMeta[] = [];
      if (detail.source === "cw721" || looksLikeAddress) tokenList = await fetchTokensFromCw721(asString);
      else tokenList = await fetchTokensFromNftModule(asString);

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
``