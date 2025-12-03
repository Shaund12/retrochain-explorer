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
      // Fallback: scan recent blocks and query txs by height
      try {
        const latestRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/latest`);
        const latest = parseInt(latestRes.data?.block?.header?.height ?? "0", 10);
        const heights: number[] = [];
        for (let h = latest; h > 0 && heights.length < Math.max(limit, 10); h--) heights.push(h);

        const results = await Promise.allSettled(
          heights.map((h) =>
            api.get(`/cosmos/tx/v1beta1/txs`, {
              params: { events: `tx.height='${h}'`, order_by: "ORDER_BY_DESC", "pagination.limit": 50 }
            })
          )
        );

        const collected: TxSummary[] = [];
        for (const r of results) {
          if (r.status === "fulfilled") {
            const list = r.value.data?.tx_responses ?? [];
            for (const t of list) {
              collected.push({
                hash: t.txhash,
                height: parseInt(t.height ?? "0", 10),
                codespace: t.codespace,
                code: t.code,
                gasWanted: t.gas_wanted,
                gasUsed: t.gas_used,
                timestamp: t.timestamp
              });
              if (collected.length >= limit) break;
            }
            if (collected.length >= limit) break;
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
