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
  transfers?: Array<{
    amount: number;
    denom: string;
    direction: "in" | "out" | "self";
  }>;
}

const extractMessageTypes = (txResponse: any): string[] => {
  const messages: any[] | undefined = txResponse?.tx?.body?.messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .map((msg) => msg?.["@type"] || msg?.type || "")
    .filter((type: string) => typeof type === "string" && type.length > 0);
};

const parseTransfers = (logs: any[], address: string): TxSummary["transfers"] => {
  if (!Array.isArray(logs)) return [];
  const addr = address.toLowerCase();
  const transfers: TxSummary["transfers"] = [];

  logs.forEach((log) => {
    const events: any[] = log?.events || [];
    events.forEach((evt) => {
      if (evt?.type !== "transfer") return;
      const attrs: any[] = evt.attributes || [];
      const senders: string[] = [];
      const recipients: string[] = [];
      const amounts: string[] = [];

      attrs.forEach((a) => {
        const key = String(a?.key || "").toLowerCase();
        const value = String(a?.value || "");
        if (key === "sender") senders.push(value);
        if (key === "recipient") recipients.push(value);
        if (key === "amount") amounts.push(value);
      });

      const maxLen = Math.max(senders.length, recipients.length, amounts.length);
      for (let i = 0; i < maxLen; i++) {
        const sender = (senders[i] || "").toLowerCase();
        const recipient = (recipients[i] || "").toLowerCase();
        const rawAmount = amounts[i] || amounts[amounts.length - 1] || "";
        if (!rawAmount) continue;

        const parts = rawAmount.split(",").map((p) => p.trim()).filter(Boolean);
        parts.forEach((p) => {
          const match = p.match(/^(\d+)([a-zA-Z/]+)$/);
          if (!match) return;
          const amt = Number(match[1]);
          const denom = match[2];
          const involvedSender = sender === addr;
          const involvedRecipient = recipient === addr;
          if (!involvedSender && !involvedRecipient) return;
          const direction: "in" | "out" | "self" = involvedSender && involvedRecipient
            ? "self"
            : involvedRecipient
              ? "in"
              : "out";
          transfers.push({ amount: amt, denom, direction });
        });
      }
    });
  });

  return transfers;
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
  messageTypes: extractMessageTypes(resp),
  transfers: []
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

      // Fallback #1: use gRPC-gateway /cosmos/tx endpoint with pagination via POST body
      try {
        const collected: TxSummary[] = [];
        let nextKey: string | undefined;

        while (collected.length < limit) {
          const pageLimit = Math.min(50, limit - collected.length);

          const res = await api.get(`/cosmos/tx/v1beta1/txs`, {
            params: {
              events: "tx.height>0",
              order_by: "ORDER_BY_DESC",
              "pagination.limit": String(pageLimit),
              ...(nextKey ? { "pagination.key": nextKey } : {})
            },
            paramsSerializer: (params) => {
              const search = new URLSearchParams();
              Object.keys(params).forEach((key) => {
                const value = (params as any)[key];
                if (value === undefined || value === null) return;
                if (Array.isArray(value)) {
                  value.forEach((entry) => search.append(key, entry));
                } else {
                  search.append(key, value);
                }
              });
              return search.toString();
            }
          });
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
              "pagination.limit": String(limit)
            },
            paramsSerializer: (params) => {
              const search = new URLSearchParams();
              Object.keys(params).forEach((key) => {
                const value = (params as any)[key];
                if (value === undefined || value === null) return;
                if (Array.isArray(value)) {
                  value.forEach((entry) => search.append(key, entry));
                } else {
                  search.append(key, value);
                }
              });
              return search.toString();
            }
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
              transfers: parseTransfers(resp?.logs, address)
            };
            collected.push(summary);
          }
        } catch (filterErr) {
          const message = filterErr?.response?.data?.message || filterErr?.message || "";
          if (typeof message === "string" && message.toLowerCase().includes("index")) {
            indexerDisabled = true;
          }
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
