// src/composables/useTxs.ts
import { ref } from "vue";
import { useApi } from "./useApi";

export interface TxSummary {
  hash: string;
  height: number;
  codespace?: string;
  code?: number;
  gasWanted?: string;
  gasUsed?: string;
  timestamp?: string;
}

export function useTxs() {
  const api = useApi();
  const txs = ref<TxSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // NOTE: pagination.limit is the correct param for this endpoint.
  const searchRecent = async (limit = 20) => {
    loading.value = true;
    error.value = null;
    txs.value = []; // Clear previous data
    
    try {
      const res = await api.get(
        `/cosmos/tx/v1beta1/txs?order_by=ORDER_BY_DESC&pagination.limit=${limit}`
      );
      
      console.log("Transactions API Response:", res.data);
      
      const raw = res.data?.tx_responses ?? [];
      
      if (raw.length === 0) {
        // This is OK - chain might not have transactions yet
        txs.value = [];
        return;
      }
      
      txs.value = raw.map((r: any) => ({
        hash: r.txhash,
        height: parseInt(r.height ?? "0", 10),
        codespace: r.codespace,
        code: r.code,
        gasWanted: r.gas_wanted,
        gasUsed: r.gas_used,
        timestamp: r.timestamp
      }));
    } catch (e: any) {
      console.error("Failed to fetch transactions:", e);
      // Fallback: scan recent blocks, parse base64 txs, compute hash and optionally enrich via /txs/{hash}
      try {
        const latestRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/latest`);
        const latestBlock = latestRes.data?.block;
        const latest = parseInt(latestBlock?.header?.height ?? "0", 10);
        const collected: TxSummary[] = [];

        // helper: compute SHA-256 hash (uppercase hex) from base64 tx bytes
        const hashFromBase64 = async (b64: string) => {
          const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
          const digest = await crypto.subtle.digest("SHA-256", bytes);
          return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        };

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
              let summary: TxSummary = { hash, height: h, timestamp: time };
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
                    timestamp: r.timestamp || time
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
      const events = [
        `message.sender='${address}'`,
        `transfer.recipient='${address}'`,
        `transfer.sender='${address}'`
      ].join(" OR ");
      
      const res = await api.get(`/cosmos/tx/v1beta1/txs`, {
        params: {
          events,
          "order_by": "ORDER_BY_DESC",
          "pagination.limit": limit
        }
      });
      
      const raw = res.data?.tx_responses ?? [];
      txs.value = raw.map((r: any) => ({
        hash: r.txhash,
        height: parseInt(r.height ?? "0", 10),
        codespace: r.codespace,
        code: r.code,
        gasWanted: r.gas_wanted,
        gasUsed: r.gas_used,
        timestamp: r.timestamp
      }));
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      txs.value = [];
    } finally {
      loading.value = false;
    }
  };

  return { txs, loading, error, searchRecent, getTx, searchByAddress };
}
