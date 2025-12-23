<script setup lang="ts">
import { onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import RcDocsPager from "@/components/RcDocsPager.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const channels = ref<any[]>([]);
const connections = ref<any[]>([]);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, chRes, connRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/ibc/core/channel/v1/channels", { params: { "pagination.limit": "200" } }).catch(() => null),
      api.get("/ibc/core/connection/v1/connections", { params: { "pagination.limit": "200" } }).catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    channels.value = Array.isArray(chRes?.data?.channels) ? chRes.data.channels : [];
    connections.value = Array.isArray(connRes?.data?.connections) ? connRes.data.connections : [];
  } catch (e: any) {
    error.value = e?.message ?? String(e);
    channels.value = [];
    connections.value = [];
  } finally {
    loading.value = false;
  }
};

const isOpen = (s?: string) => String(s || "").toUpperCase().includes("OPEN");
const isTransfer = (port?: string) => String(port || "") === "transfer";

const openTransferChannels = () => channels.value.filter((c) => isTransfer(c?.port_id) && isOpen(c?.state));

const formatState = (state?: string) => {
  const s = (state || "").toString().replace("STATE_", "");
  return s || "";
};

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">IBC Relayers</h1>
      <p class="text-sm text-slate-400 mt-1">
        Relayers move IBC packets between chains. This guide explains what to monitor and how explorers can surface relayer health.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading relayer context" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load relayer context: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="What a relayer does">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>Watches both chains for IBC packet events.</li>
        <li>Submits <strong>RecvPacket</strong> on the destination chain.</li>
        <li>Submits <strong>Acknowledgement</strong> back on the source chain.</li>
        <li>If no relay occurs before timeout, either side may need a <strong>Timeout</strong> transaction.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="card">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-100">Live IBC routes (sample)</h2>
            <p class="text-[11px] text-slate-500">Open transfer channels are the most critical for user-facing bridging.</p>
          </div>
          <button class="btn text-xs" @click="load">Refresh</button>
        </div>

        <div class="mt-3">
          <div class="text-xs text-slate-500">Open transfer channels</div>
          <div class="text-2xl font-bold text-white">{{ openTransferChannels().length }}</div>
          <div class="text-[11px] text-slate-500 mt-1">REST: <code>/ibc/core/channel/v1/channels</code></div>
        </div>

        <div class="mt-3 overflow-x-auto" v-if="openTransferChannels().length">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Channel</th>
                <th>Connection</th>
                <th>State</th>
                <th>Counterparty</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in openTransferChannels().slice(0, 12)" :key="`${c.port_id}-${c.channel_id}`" class="hover:bg-white/5">
                <td class="font-mono text-xs text-slate-200">{{ c.channel_id }}</td>
                <td class="font-mono text-xs text-slate-400">{{ c.connection_hops?.[0] ?? '' }}</td>
                <td class="text-xs text-slate-200">{{ formatState(c.state) }}</td>
                <td class="text-xs text-slate-300">
                  <div class="font-mono">{{ c.counterparty?.channel_id ?? '' }}</div>
                  <div class="font-mono text-[10px] text-slate-500">port {{ c.counterparty?.port_id ?? '' }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="mt-3 text-sm text-slate-400">No open transfer channels returned.</p>
      </div>

      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100">Monitoring & failure modes</h2>

        <div class="mt-2 space-y-3 text-sm text-slate-300">
          <div>
            <div class="text-xs uppercase tracking-wider text-slate-400">What to monitor</div>
            <ul class="list-disc list-inside space-y-1 mt-1">
              <li>Packet backlog: commitments growing without acks (see IBC Packets & Timeouts doc).</li>
              <li>Channel state: channels should remain <code>OPEN</code>.</li>
              <li>Tx failures on relayer address (out of gas, insufficient fees, sequence mismatch).</li>
              <li>RPC health: relayers rely on fast, consistent RPC endpoints.</li>
            </ul>
          </div>

          <div>
            <div class="text-xs uppercase tracking-wider text-slate-400">Common failure modes</div>
            <ul class="list-disc list-inside space-y-1 mt-1">
              <li>Relayer down (no submissions).</li>
              <li>Fee too low for provider min gas prices (tx rejected by mempool).</li>
              <li>Client expired / misbehaving (consensus proofs fail).</li>
              <li>Destination chain halted / RPC lag (timeouts).</li>
            </ul>
          </div>

          <div>
            <div class="text-xs uppercase tracking-wider text-slate-400">Explorer UX suggestion</div>
            <p class="text-slate-300 mt-1">
              For each IBC route, show a health badge based on: recent IBC transfers succeeded, outstanding commitments, and last known
              ack time.
            </p>
          </div>
        </div>

        <div class="mt-4 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs text-slate-500">Connections (count)</div>
          <div class="text-2xl font-bold text-white">{{ connections.length }}</div>
          <div class="text-[11px] text-slate-500 mt-1">REST: <code>/ibc/core/connection/v1/connections</code></div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query ibc channel channels
retrochaind query ibc connection connections
# check packet backlog for a transfer channel
retrochaind query ibc channel packet-commitments transfer &lt;channel-id&gt;</code></pre>
    </div>

    <RcDocsPager />
  </div>
</template>
