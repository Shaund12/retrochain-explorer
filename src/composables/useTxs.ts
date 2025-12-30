// src/composables/useTxs.ts
import { ref } from "vue";
import { useApi } from "./useApi";
import { base64ToBytes, bytesToHex } from "@/utils/encoding";
import { sha256Bytes } from "@/utils/crypto";
import { defaultParamsSerializer } from "@/utils/pagination";
import {
  aggregateBurnTotals,
  aggregateTransferTotals,
  buildSummaryFromResponse as buildSummaryFromResponseBase,
  extractMessageTypes,
  parseTransfers,
  txContainsAddress
} from "@/utils/txParsing";

export interface TxSummary {
  hash: string;
  height: number;
  codespace?: string;
  code?: number;
  gasWanted?: string;
  gasUsed?: string;
  timestamp?: string;
  messageTypes?: string[];
  transfers?: Array<{
    amount: number;
    denom: string;
    direction: "in" | "out" | "self";
  }>;
  valueTransfers?: Array<{ amount: string; denom: string }>;
  fees?: Array<{ amount: string; denom: string }>;
  burns?: Array<{ amount: string; denom: string }>;
}

// Tx parsing/aggregation helpers are centralized in `src/utils/txParsing.ts`.

const hashFromBase64 = async (b64: string) => {
  const bytes = base64ToBytes(b64);
  const digest = await sha256Bytes(bytes);
  return bytesToHex(digest);
};

const buildSummaryFromResponse = (resp: any, fallback: { hash: string; height: number; timestamp?: string }): TxSummary =>
  buildSummaryFromResponseBase<TxSummary>(resp, fallback, (base) => ({
    ...base,
    transfers: []
  }));

const MAX_BLOCK_SCAN_MULTIPLIER = 8; // scan up to limit * multiplier blocks before giving up

export function useTxs() {
  const api = useApi();
  const txs = ref<TxSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Cursor paging for the recent tx feed. Offset paging is not reliably supported across nodes.
  let recentNextKey: string | null = null;

  const scanBlocksForAddress = async (address: string, limit: number): Promise<TxSummary[]> => {
    const latestRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/latest`);
    const latestBlock = latestRes.data?.block;
    const latest = parseInt(latestBlock?.header?.height ?? "0", 10);
    if (!latest || Number.isNaN(latest)) {
      return [];
    }

    const matches: TxSummary[] = [];
    const maxBlocks = Math.max(limit * MAX_BLOCK_SCAN_MULTIPLIER, 50);
    let scanned = 0;

    for (let height = latest; height > 0 && matches.length < limit && scanned < maxBlocks; height -= 1, scanned += 1) {
      let blockData: any;
      try {
        const bRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/${height}`);
        blockData = bRes.data?.block;
      } catch (err) {
        console.warn(`Failed to fetch block ${height}`, err);
        continue;
      }

      const txList: string[] = blockData?.data?.txs || [];
      if (!txList.length) continue;
      const blockTime = blockData?.header?.time as string | undefined;

      for (const raw of txList) {
        if (matches.length >= limit) break;
        let hash: string;
        try {
          hash = await hashFromBase64(raw);
        } catch (hashErr) {
          console.warn("Failed to hash transaction", hashErr);
          continue;
        }

        try {
          const detail = await api.get(`/cosmos/tx/v1beta1/txs/${hash}`);
            const resp = detail.data?.tx_response;
            if (!resp) continue;
            if (!txContainsAddress(resp, address)) continue;

            const summary = buildSummaryFromResponse(resp, {
              hash,
              height,
              timestamp: blockTime
            });
            summary.transfers = parseTransfers(resp?.logs, address);
            matches.push(summary);
        } catch (txErr) {
          console.warn(`Failed to inspect tx ${hash}`, txErr);
        }
      }
    }

    return matches;
  };

  // NOTE: pagination.limit is the correct param for this endpoint.
const hydrateFastTxs = async (list: any[], limit: number, address?: string): Promise<TxSummary[]> => {
    if (!Array.isArray(list) || !list.length) return [];
    const trimmed = list.filter(Boolean).slice(0, limit);

    const enriched = await Promise.all(
      trimmed.map(async (raw) => {
        const hash = raw?.hash || raw?.txhash || raw?.txHash;
        if (!hash || typeof hash !== "string") {
          return null;
        }

        const fallbackSummary: TxSummary = {
          hash,
          height: Number(raw?.height ?? 0) || 0,
          timestamp: raw?.timestamp,
          messageTypes: Array.isArray(raw?.messageTypes) ? raw.messageTypes : [],
          gasUsed: raw?.gasUsed ?? raw?.gas_used,
          gasWanted: raw?.gasWanted ?? raw?.gas_wanted,
          code: typeof raw?.code === "number" ? raw.code : undefined
        };

        try {
          const detail = await api.get(`/cosmos/tx/v1beta1/txs/${hash}`);
          const resp = detail.data?.tx_response;
          if (resp) {
            const summary = buildSummaryFromResponse(resp, {
              hash,
              height: fallbackSummary.height,
              timestamp: fallbackSummary.timestamp
            });
            if (address) {
              summary.transfers = parseTransfers(resp?.logs, address);
            }
            return summary;
          }
        } catch (err) {
          console.warn(`Failed to hydrate tx ${hash}`, err);
        }

        return fallbackSummary;
      })
    );

    return enriched.filter(Boolean) as TxSummary[];
  };

  const searchRecent = async (limit = 20, page = 0) => {
    loading.value = true;
    error.value = null;
    if (page === 0) {
      txs.value = []; // Clear only on first page
      recentNextKey = null;
    }
    
    try {
      const base = api.defaults.baseURL || "";
      const proxyAvailable = !base || base.startsWith("/");

      if (proxyAvailable && page === 0) {
        // Try fast aggregator first only for first page
        const fast = await api.get(`/recent-txs`, { params: { limit } });
        const hydrated = await hydrateFastTxs(fast.data?.txs ?? [], limit);
        if (hydrated.length) {
          txs.value = hydrated;
          return;
        }
        throw new Error("fallback-scan");
      }

      throw new Error("skip-proxy");
    } catch (e: any) {
      if (e?.message !== "fallback-scan" && e?.message !== "skip-proxy") {
        console.error("Failed to fetch transactions:", e);
      }

      // Fallback #1: use gRPC-gateway /cosmos/tx endpoint with pagination.
      // Important: pagination via "offset" is unreliable on many Cosmos REST endpoints.
      // Use cursor paging (next_key) to fetch additional pages.
      try {
        const collected: TxSummary[] = [];
        const batchSize = Math.min(100, Math.max(1, limit));
        const key = page === 0 ? undefined : recentNextKey || undefined;
        const res = await api.get(`/cosmos/tx/v1beta1/txs`, {
          params: {
            events: "tx.height>0",
            order_by: "ORDER_BY_DESC",
            "pagination.limit": String(batchSize),
            ...(key ? { "pagination.key": key } : {})
          },
          paramsSerializer: defaultParamsSerializer
        });
          const responses: any[] = res.data?.tx_responses ?? [];
        recentNextKey = res.data?.pagination?.next_key || null;
        if (responses.length) {
          for (const resp of responses) {
            collected.push({
              hash: resp.txhash,
              height: parseInt(resp.height ?? "0", 10),
              codespace: resp.codespace,
              code: resp.code,
              gasWanted: resp.gas_wanted,
              gasUsed: resp.gas_used,
              timestamp: resp.timestamp,
              messageTypes: extractMessageTypes(resp),
              valueTransfers: aggregateTransferTotals(resp?.logs),
              fees: resp?.tx?.auth_info?.fee?.amount || [],
              burns: aggregateBurnTotals(resp)
            });
          }
        }

        if (collected.length) {
           if (page === 0) {
             txs.value = collected;
           } else {
             const existing = Array.isArray(txs.value) ? txs.value : [];
             const seen = new Set(existing.map((t) => t.hash));
             const merged = existing.concat(collected.filter((t) => !seen.has(t.hash)));
             txs.value = merged;
           }
          error.value = null;
          return;
        }
      } catch (txErr) {
        console.warn("/cosmos/tx fallback failed, scanning blocks", txErr);
      }

      // Fallback: scan recent blocks, parse base64 txs, compute hash and optionally enrich via /txs/{hash}
      try {
        const latestRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/latest`);
        const latestBlock = latestRes.data?.block;
        const latest = parseInt(latestBlock?.header?.height ?? "0", 10);
        const collected: TxSummary[] = [];

        for (let h = latest; h > 0 && collected.length < limit; h--) {
          const bRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/${h}`);
          const blk = bRes.data?.block;
          const header = blk?.header;
          const time = header?.time as string | undefined;
          const txList: string[] = blk?.data?.txs || [];
          if (!txList.length) continue;

          for (const raw of txList) {
            try {
              const hash = await hashFromBase64(raw);
              let summary: TxSummary = { hash, height: h, timestamp: time, messageTypes: [] };
              // Enrich from /txs/{hash} if available
              try {
                const d = await api.get(`/cosmos/tx/v1beta1/txs/${hash}`);
                const r = d.data?.tx_response;
                if (r) {
                  summary = {
                    hash: r.txhash || hash,
                    height: parseInt(r.height ?? String(h), 10),
                    codespace: r.codespace,
                    code: r.code,
                    gasWanted: r.gas_wanted,
                    gasUsed: r.gas_used,
                    timestamp: r.timestamp || time,
                    messageTypes: extractMessageTypes(r),
                    valueTransfers: aggregateTransferTotals(r?.logs),
                    fees: r?.tx?.auth_info?.fee?.amount || [],
                    burns: aggregateBurnTotals(r)
                  };
                }
              } catch {}
              collected.push(summary);
              if (collected.length >= limit) break;
            } catch {}
          }
        }

        txs.value = collected.slice(0, limit);
        error.value = null;
      } catch (fallbackErr: any) {
        // Give up gracefully
        error.value = fallbackErr?.message ?? e?.message ?? String(e);
        txs.value = [];
      }
    } finally {
      loading.value = false;
    }
  };

  const getTx = async (hash: string) => {
    const res = await api.get(`/cosmos/tx/v1beta1/txs/${hash}`);
    return res.data;
  };

  const searchByAddress = async (address: string, limit = 20, page = 0) => {
    loading.value = true;
    error.value = null;
    try {
      const pageSize = Math.max(1, limit);
      const pageIndex = Math.max(0, page);
      // fetch enough to cover current page window plus one extra for hasMore detection
      const fetchCount = pageSize * (pageIndex + 1) + 1;

      const filters = [
        `message.sender='${address}'`,
        `transfer.recipient='${address}'`,
        `transfer.sender='${address}'`
      ];

      const seen = new Set<string>();
      const collected: TxSummary[] = [];
      let indexerDisabled = false;

      for (const filter of filters) {
        try {
          const res = await api.get(`/cosmos/tx/v1beta1/txs`, {
            params: {
              events: filter,
              order_by: "ORDER_BY_DESC",
              "pagination.limit": String(fetchCount)
            },
            paramsSerializer: defaultParamsSerializer
          });

          const responses: any[] = res.data?.tx_responses ?? [];
          for (const resp of responses) {
            const hash = resp.txhash;
            if (!hash || seen.has(hash)) continue;
            seen.add(hash);
            const summary: TxSummary = {
              hash,
              height: parseInt(resp.height ?? "0", 10),
              codespace: resp.codespace,
              code: resp.code,
              gasWanted: resp.gas_wanted,
              gasUsed: resp.gas_used,
              timestamp: resp.timestamp,
              messageTypes: extractMessageTypes(resp),
              transfers: parseTransfers(resp?.logs, address),
              valueTransfers: aggregateTransferTotals(resp?.logs),
              fees: resp?.tx?.auth_info?.fee?.amount || [],
              burns: aggregateBurnTotals(resp)
            };
            collected.push(summary);
          }
        } catch (filterErr: unknown) {
          const err = filterErr as any;
          const message = (err && err.response && err.response.data && err.response.data.message) || (err && err.message) || "";
          if (typeof message === "string" && message.toLowerCase().includes("index")) {
            indexerDisabled = true;
          }
          console.warn(`Tx search failed for filter ${filter}`, filterErr);
        }
      }

      collected.sort((a, b) => b.height - a.height || b.timestamp?.localeCompare?.(a.timestamp || "") || 0);
      const start = pageIndex * pageSize;
      const end = start + pageSize + 1;
      txs.value = collected.slice(start, end);
    } catch (e: unknown) {
      const err: any = e as any;
      error.value = err?.message ?? String(e);
      txs.value = [];
    } finally {
      loading.value = false;
    }
  };

  return { txs, loading, error, searchRecent, getTx, searchByAddress };
}
