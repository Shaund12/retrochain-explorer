// src/composables/useTxs.ts
import { ref } from "vue";
import { sha256 } from "@cosmjs/crypto";
import { useApi } from "./useApi";

export interface TxSummary {
  hash: string;
  height: number;
  codespace?: string;
  code?: number;
  gasWanted?: string;
  gasUsed?: string;
  timestamp?: string;
  messageTypes?: string[];
}

const extractMessageTypes = (txResponse: any): string[] => {
  const messages: any[] | undefined = txResponse?.tx?.body?.messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .map((msg) => msg?.["@type"] || msg?.type || "")
    .filter((type: string) => typeof type === "string" && type.length > 0);
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

const hashBytes = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", bytes);
    return new Uint8Array(digest);
  }
  return sha256(bytes);
};

const hashFromBase64 = async (b64: string) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const digest = await hashBytes(bytes);
  return bytesToHex(digest);
};

const buildSummaryFromResponse = (resp: any, fallback: { hash: string; height: number; timestamp?: string }): TxSummary => ({
  hash: resp?.txhash || fallback.hash,
  height: parseInt(resp?.height ?? String(fallback.height), 10),
  codespace: resp?.codespace,
  code: resp?.code,
  gasWanted: resp?.gas_wanted,
  gasUsed: resp?.gas_used,
  timestamp: resp?.timestamp || fallback.timestamp,
  messageTypes: extractMessageTypes(resp)
});

const txContainsAddress = (txResponse: any, address: string) => {
  const addrLower = address.toLowerCase();
  const inspect = (value: any) => {
    if (value === null || value === undefined) return false;
    try {
      return JSON.stringify(value).toLowerCase().includes(addrLower);
    } catch {
      return false;
    }
  };

  return (
    inspect(txResponse?.tx?.body?.messages) ||
    inspect(txResponse?.logs) ||
    inspect(txResponse?.tx?.auth_info?.signer_infos)
  );
};

const MAX_BLOCK_SCAN_MULTIPLIER = 8; // scan up to limit * multiplier blocks before giving up

export function useTxs() {
  const api = useApi();
  const txs = ref<TxSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

          matches.push(
            buildSummaryFromResponse(resp, {
              hash,
              height,
              timestamp: blockTime
            })
          );
        } catch (txErr) {
          console.warn(`Failed to inspect tx ${hash}`, txErr);
        }
      }
    }

    return matches;
  };

  // NOTE: pagination.limit is the correct param for this endpoint.
  const searchRecent = async (limit = 20) => {
    loading.value = true;
    error.value = null;
    txs.value = []; // Clear previous data
    
    try {
      const base = api.defaults.baseURL || "";
      const proxyAvailable = !base || base.startsWith("/");

      if (proxyAvailable) {
        // Try fast aggregator first
        const fast = await api.get(`/recent-txs`, { params: { limit } });
        if (Array.isArray(fast.data?.txs) && fast.data.txs.length) {
          txs.value = fast.data.txs.map((t: any) => ({
            hash: t.hash,
            height: t.height,
            timestamp: t.timestamp,
            messageTypes: Array.isArray(t.messageTypes) ? t.messageTypes : []
          }));
          return;
        }
        throw new Error("fallback-scan");
      }

      throw new Error("skip-proxy");
    } catch (e: any) {
      if (e?.message !== "fallback-scan" && e?.message !== "skip-proxy") {
        console.error("Failed to fetch transactions:", e);
      }

      // Fallback #1: use gRPC-gateway /cosmos/tx endpoint with pagination
      try {
        const collected: TxSummary[] = [];
        let nextKey: string | undefined;

        while (collected.length < limit) {
          const pageLimit = Math.min(50, limit - collected.length);
          const params: Record<string, string> = {
            events: "tx.height>0",
            order_by: "ORDER_BY_DESC",
            "pagination.limit": String(pageLimit)
          };
          if (nextKey) params["pagination.key"] = nextKey;

          const res = await api.get(`/cosmos/tx/v1beta1/txs`, { params });
          const responses: any[] = res.data?.tx_responses ?? [];
          if (!responses.length) break;

          for (const resp of responses) {
            collected.push({
              hash: resp.txhash,
              height: parseInt(resp.height ?? "0", 10),
              codespace: resp.codespace,
              code: resp.code,
              gasWanted: resp.gas_wanted,
              gasUsed: resp.gas_used,
              timestamp: resp.timestamp,
              messageTypes: extractMessageTypes(resp)
            });

            if (collected.length >= limit) {
              break;
            }
          }

          nextKey = res.data?.pagination?.next_key || undefined;
          if (!nextKey) break;
        }

        if (collected.length) {
          txs.value = collected;
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
                    messageTypes: extractMessageTypes(r)
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

  const searchByAddress = async (address: string, limit = 20) => {
    loading.value = true;
    error.value = null;
    try {
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
              "pagination.limit": limit
            }
          });

          const responses: any[] = res.data?.tx_responses ?? [];
          for (const resp of responses) {
            const hash = resp.txhash;
            if (!hash || seen.has(hash)) continue;
            seen.add(hash);
            collected.push({
              hash,
              height: parseInt(resp.height ?? "0", 10),
              codespace: resp.codespace,
              code: resp.code,
              gasWanted: resp.gas_wanted,
              gasUsed: resp.gas_used,
              timestamp: resp.timestamp,
              messageTypes: extractMessageTypes(resp)
            });
          }
        } catch (filterErr) {
          console.warn(`Tx search failed for filter ${filter}`, filterErr);
        }
      }

      collected.sort((a, b) => b.height - a.height);
      txs.value = collected.slice(0, limit);
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      txs.value = [];
    } finally {
      loading.value = false;
    }
  };

  return { txs, loading, error, searchRecent, getTx, searchByAddress };
}
