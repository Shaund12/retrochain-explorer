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
      // Don't show error for empty transactions - it's normal for new chains
      if (e?.response?.status === 500) {
        error.value = null; // Ignore 500 errors for now
        txs.value = [];
      } else {
        error.value = e?.message ?? String(e);
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
