<script setup lang="ts">
import { onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const channels = ref<any[]>([]);
const connections = ref<any[]>([]);
const paginationNextKey = ref<string | null>(null);

const loadHeight = async () => {
  const res = await api.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
  height.value = res?.data?.block?.header?.height ?? null;
};

const loadChannels = async () => {
  const res = await api.get("/ibc/core/channel/v1/channels", {
    params: {
      "pagination.limit": "50"
    }
  });
  channels.value = Array.isArray(res.data?.channels) ? res.data.channels : [];
  paginationNextKey.value = res.data?.pagination?.next_key ?? null;
};

const loadConnections = async () => {
  const res = await api.get("/ibc/core/connection/v1/connections", {
    params: {
      "pagination.limit": "50"
    }
  });
  connections.value = Array.isArray(res.data?.connections) ? res.data.connections : [];
};

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([loadHeight(), loadChannels(), loadConnections()]);
  } catch (e: any) {
    error.value = e?.message ?? String(e);
    channels.value = [];
    connections.value = [];
    paginationNextKey.value = null;
  } finally {
    loading.value = false;
  }
};

const formatState = (state?: string) => {
  const s = (state || "").toString().replace("STATE_", "");
  return s || "—";
};

const formatOrder = (order?: string) => {
  const s = (order || "").toString().replace("ORDER_", "");
  return s || "—";
};

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">IBC Channels & Routing</h1>
      <p class="text-sm text-slate-400 mt-1">
        How IBC clients/connections/channels fit together and how to verify active routes on a live RetroChain node.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading IBC channels…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load IBC channels: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Quick model">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li><strong>Client</strong>: verifies the other chain’s consensus state.</li>
        <li><strong>Connection</strong>: binds 2 clients together (handshake + proof verification).</li>
        <li><strong>Channel</strong>: app-level lane on top of a connection (e.g., ICS-20 transfer).</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-100">Channels (live)</h2>
            <p class="text-[11px] text-slate-500">REST: <code>/ibc/core/channel/v1/channels</code></p>
          </div>
          <button class="btn text-xs" @click="load" :disabled="loading">Refresh</button>
        </div>

        <div v-if="channels.length === 0" class="text-sm text-slate-400 mt-3">No channels returned.</div>

        <div v-else class="overflow-x-auto mt-3">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Channel</th>
                <th>Port</th>
                <th>Connection</th>
                <th>State</th>
                <th>Order</th>
                <th>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in channels" :key="`${c.port_id}-${c.channel_id}`" class="hover:bg-white/5">
                <td class="font-mono text-xs text-slate-200">{{ c.channel_id }}</td>
                <td class="font-mono text-xs text-slate-400">{{ c.port_id }}</td>
                <td class="font-mono text-xs text-slate-400">{{ c.connection_hops?.[0] ?? '—' }}</td>
                <td class="text-xs text-slate-200">{{ formatState(c.state) }}</td>
                <td class="text-xs text-slate-200">{{ formatOrder(c.ordering) }}</td>
                <td class="text-xs text-slate-300">
                  <div class="font-mono">{{ c.counterparty?.channel_id ?? '—' }}</div>
                  <div class="font-mono text-[10px] text-slate-500">port {{ c.counterparty?.port_id ?? '—' }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="paginationNextKey" class="mt-2 text-[11px] text-slate-500">
          Pagination: more channels available (next_key present). This docs view currently fetches the first page.
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-100">Connections (live)</h2>
            <p class="text-[11px] text-slate-500">REST: <code>/ibc/core/connection/v1/connections</code></p>
          </div>
        </div>

        <div v-if="connections.length === 0" class="text-sm text-slate-400 mt-3">No connections returned.</div>

        <div v-else class="overflow-x-auto mt-3">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>ID</th>
                <th>Client</th>
                <th>State</th>
                <th>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="conn in connections" :key="conn.id" class="hover:bg-white/5">
                <td class="font-mono text-xs text-slate-200">{{ conn.id }}</td>
                <td class="font-mono text-xs text-slate-400">{{ conn.client_id ?? '—' }}</td>
                <td class="text-xs text-slate-200">{{ formatState(conn.state) }}</td>
                <td class="text-xs text-slate-300">
                  <div class="font-mono">{{ conn.counterparty?.connection_id ?? '—' }}</div>
                  <div class="font-mono text-[10px] text-slate-500">client {{ conn.counterparty?.client_id ?? '—' }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Explorer notes</h2>
      <ul class="list-disc list-inside text-sm text-slate-300 space-y-1">
        <li>“Active IBC” usually means at least one <code>transfer</code> port channel is <code>OPEN</code>.</li>
        <li>For token traces, use <code>/ibc/apps/transfer/v1/denom_traces/&lt;hash&gt;</code> (see IBC & Denom Traces doc).</li>
        <li>For pending packets/acks timeouts, use the packet query endpoints by channel/port where supported.</li>
      </ul>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query ibc channel channels
retrochaind query ibc connection connections
retrochaind query ibc channel client-state &lt;client-id&gt;</code></pre>
    </div>
  </div>
</template>
