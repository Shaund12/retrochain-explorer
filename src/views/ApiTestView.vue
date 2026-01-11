<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useApi } from "@/composables/useApi";

type Endpoint = { name: string; url: string; description?: string };
type TestResult = {
  status: "success" | "failed";
  statusCode?: number;
  durationMs: number;
  timestamp: number;
  data: any;
  error: any;
};

const api = useApi();
const endpoints: Endpoint[] = [
  { name: "Node Info", url: "/cosmos/base/tendermint/v1beta1/node_info", description: "Node identity, network, versions" },
  { name: "Latest Block", url: "/cosmos/base/tendermint/v1beta1/blocks/latest", description: "Head block with txs" },
  { name: "Validators (bonded)", url: "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED", description: "Active validators" },
  { name: "Governance Proposals", url: "/cosmos/gov/v1beta1/proposals", description: "Gov proposals list" },
  { name: "Recent Transactions", url: "/cosmos/tx/v1beta1/txs?pagination.limit=5", description: "Sample of latest txs" },
  { name: "Bank Supply (top)", url: "/cosmos/bank/v1beta1/supply?pagination.limit=5", description: "Total supply (first 5)" },
  { name: "Staking Params", url: "/cosmos/staking/v1beta1/params", description: "Staking module params" },
  { name: "Mint Inflation", url: "/cosmos/mint/v1beta1/inflation", description: "Current inflation" },
  { name: "Distribution Params", url: "/cosmos/distribution/v1beta1/params", description: "Distribution module params" }
];

const testResults = ref<Record<string, TestResult>>({});
const testing = ref(false);
const lastRun = ref<number | null>(null);

const formatDuration = (ms: number) => `${ms.toFixed(0)} ms`;
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();

const summary = computed(() => {
  const values = Object.values(testResults.value);
  const success = values.filter((v) => v.status === "success").length;
  const failed = values.filter((v) => v.status === "failed").length;
  return { success, failed, total: values.length };
});

const testEndpoint = async (name: string, url: string) => {
  const started = performance.now();
  const timestamp = Date.now();
  try {
    const res = await api.get(url);
    const durationMs = performance.now() - started;
    testResults.value = {
      ...testResults.value,
      [name]: {
        status: "success",
        statusCode: res.status,
        durationMs,
        timestamp,
        data: res.data,
        error: null
      }
    };
  } catch (e: any) {
    const durationMs = performance.now() - started;
    testResults.value = {
      ...testResults.value,
      [name]: {
        status: "failed",
        statusCode: e?.response?.status,
        durationMs,
        timestamp,
        data: null,
        error: e?.response?.data || e?.message || String(e)
      }
    };
  }
};

const runTests = async () => {
  testing.value = true;
  testResults.value = {};
  lastRun.value = Date.now();

  for (const ep of endpoints) {
    await testEndpoint(ep.name, ep.url);
  }

  testing.value = false;
};

onMounted(() => {
  runTests();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card bg-gradient-to-br from-slate-900/60 via-slate-900/30 to-slate-800/50 border border-white/10">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-50 mb-1">API Endpoint Test</h1>
          <p class="text-sm text-slate-400">Cosmos SDK REST quick healthcheck</p>
          <p class="text-[11px] text-slate-500" v-if="lastRun">Last run: {{ formatTime(lastRun) }}</p>
        </div>
        <div class="flex flex-col gap-2 items-end">
          <button class="btn btn-primary text-sm" @click="runTests" :disabled="testing">
            {{ testing ? "Testing..." : "Run Tests" }}
          </button>
          <div class="flex gap-2 text-[11px] text-slate-300">
            <span class="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/40 text-emerald-200">Success: {{ summary.success }}</span>
            <span class="px-2 py-1 rounded-full bg-rose-500/10 border border-rose-400/40 text-rose-200">Failed: {{ summary.failed }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid md:grid-cols-2 gap-3">
      <div v-for="ep in endpoints" :key="ep.name" class="card bg-white/5 border border-white/10">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <h2 class="text-sm font-semibold text-slate-100">{{ ep.name }}</h2>
            <p class="text-[11px] text-slate-500">{{ ep.description }}</p>
            <p class="text-[11px] text-slate-500 break-all">{{ ep.url }}</p>
          </div>
          <div class="text-right text-[11px] text-slate-400">
            <div v-if="testResults[ep.name]">{{ formatTime(testResults[ep.name].timestamp) }}</div>
            <div v-if="testResults[ep.name]">{{ formatDuration(testResults[ep.name].durationMs) }}</div>
          </div>
        </div>

        <div v-if="testing && !testResults[ep.name]" class="text-xs text-slate-400">Running…</div>

        <div v-else-if="testResults[ep.name]" class="space-y-2">
          <div class="flex items-center gap-2">
            <span
              class="px-2 py-1 rounded-full text-[11px] border"
              :class="testResults[ep.name].status === 'success'
                ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
                : 'bg-rose-500/10 border-rose-400/40 text-rose-200'"
            >
              {{ testResults[ep.name].status === 'success' ? 'Success' : 'Failed' }}
            </span>
            <span class="text-[11px] text-slate-400" v-if="testResults[ep.name].statusCode">HTTP {{ testResults[ep.name].statusCode }}</span>
          </div>

          <div v-if="testResults[ep.name].error" class="text-xs text-rose-200 break-words">
            <strong>Error:</strong> {{ JSON.stringify(testResults[ep.name].error, null, 2) }}
          </div>

          <div v-if="testResults[ep.name].data" class="text-xs">
            <details>
              <summary class="cursor-pointer text-cyan-400 hover:text-cyan-300">View Response Data</summary>
              <pre class="mt-2 p-2 rounded bg-slate-900/80 overflow-x-auto max-h-96 text-[10px]">{{ JSON.stringify(testResults[ep.name].data, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
