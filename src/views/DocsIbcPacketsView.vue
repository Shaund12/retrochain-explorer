<script setup lang="ts">
import { onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const channelId = ref<string>("channel-0");
const portId = ref<string>("transfer");
const showLimit = ref<number>(20);

const packetCommitments = ref<any[]>([]);
const packetAcks = ref<any[]>([]);
const packetReceipts = ref<any[]>([]);

const safeList = (value: any) => (Array.isArray(value) ? value : []);

const loadHeight = async () => {
  const res = await api.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
  height.value = res?.data?.block?.header?.height ?? null;
};

const loadCommitments = async () => {
  const res = await api.get(
    `/ibc/core/channel/v1/channels/${channelId.value}/ports/${portId.value}/packet_commitments`,
    { params: { "pagination.limit": String(showLimit.value) } }
  );
  packetCommitments.value = safeList(res.data?.commitments);
};

const loadAcks = async () => {
  const res = await api.get(
    `/ibc/core/channel/v1/channels/${channelId.value}/ports/${portId.value}/packet_acknowledgements`,
    { params: { "pagination.limit": String(showLimit.value) } }
  );
  packetAcks.value = safeList(res.data?.acknowledgements);
};

const loadReceipts = async () => {
  const res = await api.get(
    `/ibc/core/channel/v1/channels/${channelId.value}/ports/${portId.value}/packet_receipts`,
    { params: { "pagination.limit": String(showLimit.value) } }
  );
  packetReceipts.value = safeList(res.data?.receipts);
};

const loadAll = async () => {
  loading.value = true;
  error.value = null;

  try {
    await Promise.all([loadHeight(), loadCommitments(), loadAcks(), loadReceipts()]);
  } catch (e: any) {
    error.value = e?.message ?? String(e);
    packetCommitments.value = [];
    packetAcks.value = [];
    packetReceipts.value = [];
  } finally {
    loading.value = false;
  }
};

const fmtSeq = (seq: any) => {
  const n = Number(seq);
  return Number.isFinite(n) ? n.toLocaleString() : String(seq ?? "—");
};

onMounted(() => {
  loadAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">IBC Packets & Timeouts</h1>
      <p class="text-sm text-slate-400 mt-1">
        How to identify pending IBC transfers, acknowledgements, and timeouts. Useful for explorer “pending” states and relayer troubleshooting.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading IBC packet state…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load IBC packet state: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Mental model">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>A source chain writes a <strong>packet commitment</strong> when it sends.</li>
        <li>The destination chain writes a <strong>packet receipt</strong> when it receives (for ordered/unordered semantics).</li>
        <li>The destination chain writes an <strong>acknowledgement</strong>; the source clears commitment after seeing the ack.</li>
        <li>If the timeout triggers before ack, the source can process a <strong>timeout</strong>.</li>
      </ul>
    </RcDisclaimer>

    <div class="card" v-if="!loading">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Query a route</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
        <label class="text-xs text-slate-400">
          Port
          <input v-model="portId" type="text" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono" />
        </label>
        <label class="text-xs text-slate-400">
          Channel
          <input v-model="channelId" type="text" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono" />
        </label>
        <label class="text-xs text-slate-400">
          Limit
          <input v-model.number="showLimit" type="number" min="1" max="200" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono" />
        </label>
        <div class="flex items-end">
          <button class="btn btn-primary w-full" @click="loadAll">Refresh</button>
        </div>
      </div>
      <div class="mt-2 text-[11px] text-slate-500">
        Commitments: <code>/ibc/core/channel/v1/channels/&lt;channel&gt;/ports/&lt;port&gt;/packet_commitments</code> ·
        Acks: <code>/packet_acknowledgements</code> ·
        Receipts: <code>/packet_receipts</code>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3" v-if="!loading">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Packet commitments (source-side)</div>
        <p class="text-[11px] text-slate-500 mt-1">Pending on source until ack/timeout clears.</p>
        <div v-if="packetCommitments.length" class="mt-3 space-y-1">
          <div v-for="c in packetCommitments" :key="c.sequence" class="flex items-center justify-between gap-3">
            <span class="font-mono text-xs text-slate-200">seq {{ fmtSeq(c.sequence) }}</span>
            <span class="text-[10px] text-slate-500 truncate">{{ (c?.data ?? '').slice?.(0, 24) ?? '' }}</span>
          </div>
        </div>
        <p v-else class="mt-3 text-sm text-slate-400">None returned.</p>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Acknowledgements (dest-side)</div>
        <p class="text-[11px] text-slate-500 mt-1">Once relayed back, source clears commitment.</p>
        <div v-if="packetAcks.length" class="mt-3 space-y-1">
          <div v-for="a in packetAcks" :key="a.sequence" class="flex items-center justify-between gap-3">
            <span class="font-mono text-xs text-slate-200">seq {{ fmtSeq(a.sequence) }}</span>
            <span class="text-[10px] text-slate-500 truncate">{{ (a?.data ?? '').slice?.(0, 24) ?? '' }}</span>
          </div>
        </div>
        <p v-else class="mt-3 text-sm text-slate-400">None returned.</p>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Receipts (dest-side)</div>
        <p class="text-[11px] text-slate-500 mt-1">Not all packet types expose receipts consistently.</p>
        <div v-if="packetReceipts.length" class="mt-3 space-y-1">
          <div v-for="r in packetReceipts" :key="r.sequence" class="flex items-center justify-between gap-3">
            <span class="font-mono text-xs text-slate-200">seq {{ fmtSeq(r.sequence) }}</span>
            <span class="text-[10px] text-slate-500">received</span>
          </div>
        </div>
        <p v-else class="mt-3 text-sm text-slate-400">None returned.</p>
      </div>
    </div>

    <div class="card" v-if="!loading">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Relayer troubleshooting checklist</h2>
      <ul class="list-disc list-inside text-sm text-slate-300 space-y-1">
        <li>Confirm the channel is <code>OPEN</code> (see IBC Channels & Routing doc).</li>
        <li>If commitment exists but no ack: relayer may be down or blocked, or dest chain rejected packet.</li>
        <li>If timeout height/time passed: source can submit a timeout to recover funds (depends on app semantics).</li>
        <li>Indexers can show “pending” even when funds arrived; confirm on-chain receipts/events.</li>
      </ul>
    </div>

    <div class="card" v-if="!loading">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query ibc channel packet-commitments transfer &lt;channel-id&gt;
retrochaind query ibc channel packet-acks transfer &lt;channel-id&gt;
retrochaind query ibc channel packet-receipts transfer &lt;channel-id&gt;</code></pre>
    </div>
  </div>
</template>
