import { ref } from "vue";
import { useApi } from "./useApi";

export interface IbcChannel {
  channelId: string;
  portId: string;
  state?: string;
  ordering?: string;
  version?: string;
  counterpartyChannelId?: string;
  counterpartyPortId?: string;
  connectionHops: string[];
  nextSequenceSend?: number;
  nextSequenceRecv?: number;
}

export interface DenomTrace {
  baseDenom: string;
  path: string;
}

export function useIbc() {
  const api = useApi();
  const channels = ref<IbcChannel[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const resolving = ref(false);
  const resolvedTrace = ref<DenomTrace | null>(null);
  const resolveError = ref<string | null>(null);

  const fetchChannels = async (limit = 200) => {
    loading.value = true;
    error.value = null;
    channels.value = [];

    try {
      const collected: any[] = [];
      let nextKey: string | undefined;

      while (collected.length < limit) {
        const pageLimit = Math.min(100, limit - collected.length);
        const res = await api.get(`/ibc/core/channel/v1beta1/channels`, {
          params: {
            "pagination.limit": String(pageLimit),
            ...(nextKey ? { "pagination.key": nextKey } : {})
          }
        });

        const list: any[] = res.data?.channels ?? [];
        if (!list.length) break;
        collected.push(...list);

        nextKey = res.data?.pagination?.next_key || undefined;
        if (!nextKey) break;
      }

      const limited = collected.slice(0, limit);

      const seqResults = await Promise.all(
        limited.map(async (c) => {
          const channelId = c?.channel_id;
          const portId = c?.port_id;
          if (!channelId || !portId) {
            return { send: undefined, recv: undefined };
          }
          try {
            const [sendRes, recvRes] = await Promise.all([
              api.get(`/ibc/core/channel/v1beta1/channels/${channelId}/ports/${portId}/next_sequence_send`),
              api.get(`/ibc/core/channel/v1beta1/channels/${channelId}/ports/${portId}/next_sequence_recv`)
            ]);
            return {
              send: Number(sendRes.data?.next_sequence_send ?? NaN),
              recv: Number(recvRes.data?.next_sequence_recv ?? NaN)
            };
          } catch {
            return { send: undefined, recv: undefined };
          }
        })
      );

      channels.value = limited.map((c, idx) => ({
        channelId: c?.channel_id,
        portId: c?.port_id,
        state: c?.state,
        ordering: c?.ordering,
        version: c?.version,
        counterpartyChannelId: c?.counterparty?.channel_id,
        counterpartyPortId: c?.counterparty?.port_id,
        connectionHops: Array.isArray(c?.connection_hops) ? c.connection_hops : [],
        nextSequenceSend: seqResults[idx]?.send,
        nextSequenceRecv: seqResults[idx]?.recv
      }));
    } catch (e: any) {
      error.value = e?.message || "Failed to load IBC channels";
      channels.value = [];
    } finally {
      loading.value = false;
    }
  };

  const resolveDenomTrace = async (hash: string) => {
    resolving.value = true;
    resolveError.value = null;
    resolvedTrace.value = null;
    const cleaned = (hash || "").replace(/^ibc\//i, "");

    try {
      if (!cleaned) throw new Error("Provide an IBC denom hash");
      const res = await api.get(`/ibc/apps/transfer/v1/denom_traces/${cleaned}`);
      const trace = res.data?.denom_trace;
      if (!trace) throw new Error("Denom trace not found");
      resolvedTrace.value = {
        baseDenom: trace.base_denom,
        path: trace.path
      };
    } catch (e: any) {
      resolveError.value = e?.response?.data?.message || e?.message || "Failed to resolve denom";
    } finally {
      resolving.value = false;
    }
  };

  return {
    channels,
    loading,
    error,
    fetchChannels,
    resolving,
    resolvedTrace,
    resolveError,
    resolveDenomTrace
  };
}
