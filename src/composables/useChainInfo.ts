import { ref } from "vue";
import { useApi } from "./useApi";
import dayjs from "dayjs";

export interface ChainInfo {
  latestBlockHeight: number | null;
  latestBlockTime: string | null;
  chainId: string | null;
  totalTxs: number | null;
}

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

      if (block) {
        const header = block.header ?? {};
        const height = header.height ? parseInt(header.height, 10) : NaN;
        const time = header.time;
        const totalTxs = header.total_txs ? parseInt(header.total_txs, 10) : NaN;
        info.value.latestBlockHeight = height;
        info.value.latestBlockTime = time
          ? dayjs(time).format("YYYY-MM-DD HH:mm:ss")
          : null;
        info.value.totalTxs = Number.isFinite(totalTxs) ? totalTxs : info.value.totalTxs;
      }
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
