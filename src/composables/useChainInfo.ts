import { ref } from "vue";
import { useApi } from "./useApi";
import dayjs from "dayjs";
import { defaultParamsSerializer } from "@/utils/pagination";

export interface ChainInfo {
  latestBlockHeight: number | null;
  latestBlockTime: string | null;
  chainId: string | null;
  totalTxs: number | null;
}

let totalTxCountSupported = true;

export function useChainInfo() {
  const api = useApi();
  const info = ref<ChainInfo>({
    latestBlockHeight: null,
    latestBlockTime: null,
    chainId: null,
    totalTxs: null
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  const refresh = async () => {
    loading.value = true;
    error.value = null;
    try {
      const [nodeRes, blockRes] = await Promise.all([
        api.get("/cosmos/base/tendermint/v1beta1/node_info"),
        api.get("/cosmos/base/tendermint/v1beta1/blocks/latest")
      ]);

      const nodeInfo = nodeRes.data?.default_node_info;
      const block = blockRes.data?.block;

      info.value.chainId = nodeInfo?.network ?? null;

      let headerTotalTxs: number | null = null;

      if (block) {
        const header = block.header ?? {};
        const height = header.height ? parseInt(header.height, 10) : NaN;
        const time = header.time;
        const totalTxsRaw = (header as any).total_txs ?? (header as any).totalTxs ?? (block as any)?.block?.header?.total_txs;
        const totalTxs = totalTxsRaw ? parseInt(String(totalTxsRaw), 10) : NaN;
        info.value.latestBlockHeight = height;
        info.value.latestBlockTime = time
          ? dayjs(time).format("YYYY-MM-DD HH:mm:ss")
          : null;
        headerTotalTxs = Number.isFinite(totalTxs) ? totalTxs : null;
      }

      if (headerTotalTxs === null && totalTxCountSupported) {
        try {
          const res = await api.get("/cosmos/tx/v1beta1/txs", {
            params: {
              order_by: "ORDER_BY_DESC",
              "pagination.limit": "1",
              "pagination.count_total": "true",
              events: ["tm.event='Tx'"]
            },
            paramsSerializer: defaultParamsSerializer
          });
          const total = res.data?.pagination?.total;
          const parsed = typeof total === "string" ? parseInt(total, 10) : Number(total);
          if (Number.isFinite(parsed) && parsed >= 0) {
            headerTotalTxs = parsed;
          }
        } catch (totalErr) {
          const status = (totalErr as any)?.response?.status;
          if (status && status >= 400) {
            totalTxCountSupported = false;
          }
          console.warn("Failed to fetch total transaction count", totalErr);
        }
      }

      info.value.totalTxs = headerTotalTxs;
    } catch (e: any) {
      error.value = e?.message ?? String(e);
    } finally {
      loading.value = false;
    }
  };

  return {
    info,
    loading,
    error,
    refresh
  };
}
