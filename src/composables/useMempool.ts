import { ref } from "vue";
import { useApi } from "./useApi";

export interface MempoolSnapshot {
  count: number;
  totalBytes: number;
}

export function useMempool() {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const snapshot = ref<MempoolSnapshot>({ count: 0, totalBytes: 0 });

  const refresh = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res = await api.get(`/unconfirmed_txs`, { params: { limit: 200 } });
      const txs: string[] = res.data?.txs ?? [];
      const count = res.data?.n_txs ?? txs.length ?? 0;
      const totalBytes = res.data?.total_bytes ?? 0;
      snapshot.value = {
        count: Number(count) || 0,
        totalBytes: Number(totalBytes) || 0
      };
    } catch (e: any) {
      error.value = e?.message || "Failed to load mempool";
      snapshot.value = { count: 0, totalBytes: 0 };
    } finally {
      loading.value = false;
    }
  };

  return { snapshot, loading, error, refresh };
}
