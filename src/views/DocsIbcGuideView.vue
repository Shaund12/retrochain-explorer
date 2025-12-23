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

const sampleHash = ref<string>("6b199312b29cf047bf8b1337450ef3aa0475fe0c312db94055f2d5b22cd1e71a");
const trace = ref<any | null>(null);

const fetchLatestHeight = async () => {
  const latest = await api.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
  height.value = latest?.data?.block?.header?.height ?? null;
};

const fetchTrace = async () => {
  trace.value = null;
  try {
    const res = await api.get(`/ibc/apps/transfer/v1/denom_traces/${sampleHash.value}`);
    trace.value = res.data?.denom_trace ?? null;
  } catch (e) {
    trace.value = null;
  }
};

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([fetchLatestHeight(), fetchTrace()]);
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />
    <div class="card">
      <RcBackLink />
      <h1 class="text-xl font-bold text-slate-50">IBC & Denom Traces</h1>
      <p class="text-sm text-slate-400 mt-1">
        How <code>ibc/&lt;hash&gt;</code> denoms work on Cosmos chains and how to resolve them on RetroChain.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading IBC docs" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load IBC docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Key concept">
      <p class="text-sm text-slate-300">
        When a fungible token is transferred over IBC (ICS-20), the receiving chain mints a voucher denom like
        <code>ibc/&lt;hash&gt;</code>. The hash maps to a denom trace describing the base denom + full hop path.
      </p>
    </RcDisclaimer>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Resolve an <code>ibc/&lt;hash&gt;</code> denom</h2>
      <div class="space-y-2">
        <div class="text-xs text-slate-400">Enter a hash (without the <code>ibc/</code> prefix):</div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="sampleHash"
            type="text"
            class="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono"
          />
          <button class="btn btn-primary" @click="fetchTrace">Resolve</button>
        </div>

        <div class="text-[11px] text-slate-500 mt-2">REST: <code>/ibc/apps/transfer/v1/denom_traces/&lt;hash&gt;</code></div>

        <div class="mt-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div v-if="trace" class="space-y-1 text-sm">
            <div>Base denom: <code class="text-xs">{{ trace.base_denom ?? trace.baseDenom ?? '' }}</code></div>
            <div>Path: <span class="font-mono text-xs text-slate-200">{{ trace.path ?? '' }}</span></div>
          </div>
          <div v-else class="text-sm text-slate-400">No trace found (endpoint unsupported or hash unknown).</div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Explorer recommendations</h2>
      <ul class="list-disc list-inside text-sm text-slate-300 space-y-1">
        <li>Always display both the base denom and the path so users can distinguish wrapped routes.</li>
        <li>Indexers can lag; use on-chain packet receipts/acks for ground truth of transfer completion.</li>
        <li>Some RPC/LCD providers may disable denom trace endpointshandle 404/501 gracefully.</li>
      </ul>
    </div>
  </div>
</template>
