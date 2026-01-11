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
const running = ref<Record<string, boolean>>({});
const copied = ref<Record<string, string>>({});

const formatDuration = (ms: number) => `${ms.toFixed(0)} ms`;
const formatTime = (ts: number) => new Date(ts).toLocaleTimeString();
const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
const formatInt = (val: any) => {
  const n = Number(val);
  return Number.isFinite(n) ? n.toLocaleString() : String(val ?? "");
};
const formatPct = (val: any) => {
  const n = Number(val);
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : String(val ?? "");
};
const responseSize = (data: any) => {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
};
const previewKeys = (data: any) => {
  if (!data || typeof data !== "object") return "";
  const keys = Array.isArray(data) ? Object.keys(data[0] || {}) : Object.keys(data);
  return keys.slice(0, 5).join(", ");
};
const quickFacts = (epName: string, data: any): string[] => {
  if (!data) return [];
  const facts: string[] = [];
  switch (epName) {
    case "Node Info": {
      const info = data.default_node_info || {};
      if (info.network) facts.push(`Network ${info.network}`);
      if (info.version) facts.push(`Version ${info.version}`);
      if (info?.other?.tx_index) facts.push(`Tx index: ${info.other.tx_index}`);
      break;
    }
    case "Latest Block": {
      const header = data.block?.header;
      const txs = data.block?.data?.txs?.length ?? 0;
      if (header?.height) facts.push(`Height #${formatInt(header.height)}`);
      if (header?.time) facts.push(new Date(header.time).toLocaleString());
      facts.push(`${txs} txs`);
      break;
    }
    case "Validators (bonded)": {
      const list = data.validators || data.validator || [];
      facts.push(`${formatInt(list.length)} validators`);
      const first = list[0];
      if (first?.tokens) facts.push(`Top tokens: ${formatInt(first.tokens)}`);
      break;
    }
    case "Governance Proposals": {
      const list = data.proposals || [];
      facts.push(`${formatInt(list.length)} proposals`);
      const voting = list.filter((p: any) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD").length;
      if (voting) facts.push(`${voting} in voting`);
      break;
    }
    case "Recent Transactions": {
      const list = data.tx_responses || [];
      facts.push(`${formatInt(list.length)} txs`);
      const height = list[0]?.height;
      if (height) facts.push(`Latest height #${formatInt(height)}`);
      break;
    }
    case "Bank Supply (top)": {
      const list = data.supply || [];
      facts.push(`${formatInt(list.length)} denoms`);
      const first = list[0];
      if (first?.denom && first?.amount) facts.push(`${first.denom}: ${formatInt(first.amount)}`);
      break;
    }
    case "Staking Params": {
      const p = data.params || {};
      if (p.bond_denom) facts.push(`Bond denom: ${p.bond_denom}`);
      if (p.unbonding_time) facts.push(`Unbonding: ${p.unbonding_time}`);
      break;
    }
    case "Mint Inflation": {
      if (data.inflation) facts.push(`Inflation: ${formatPct(data.inflation)}`);
      break;
    }
    case "Distribution Params": {
      const p = data.params || {};
      if (p.community_tax) facts.push(`Community tax: ${formatPct(p.community_tax)}`);
      if (p.base_proposer_reward) facts.push(`Base reward: ${formatPct(p.base_proposer_reward)}`);
      break;
    }
    default: {
      const keys = previewKeys(data);
      if (keys) facts.push(`Keys: ${keys}`);
    }
  }
  return facts.filter(Boolean).slice(0, 4);
};
const copyJson = async (key: string, payload: any) => {
  if (!payload || typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    copied.value = { ...copied.value, [key]: "copied" };
  } catch (e) {
    copied.value = { ...copied.value, [key]: "failed" };
  }
  setTimeout(() => {
    copied.value = { ...copied.value, [key]: "" };
  }, 1200);
};

const summary = computed(() => {
  const values = Object.values(testResults.value);
  const success = values.filter((v) => v.status === "success").length;
  const failed = values.filter((v) => v.status === "failed").length;
  const avgMs = values.length ? values.reduce((acc, v) => acc + v.durationMs, 0) / values.length : 0;
  const successRate = values.length ? Math.round((success / values.length) * 100) : 0;
  return { success, failed, total: values.length, avgMs, successRate };
});

const testEndpoint = async (name: string, url: string) => {
  const started = performance.now();
  const timestamp = Date.now();
  running.value = { ...running.value, [name]: true };
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
  running.value = { ...running.value, [name]: false };
};

const rerunEndpoint = async (ep: Endpoint) => {
  await testEndpoint(ep.name, ep.url);
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
            <span class="px-2 py-1 rounded-full bg-slate-500/10 border border-white/10 text-slate-200">Avg: {{ formatDuration(summary.avgMs) }}</span>
            <span class="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/40 text-indigo-100">Pass rate: {{ summary.successRate }}%</span>
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
            <span class="text-[11px] text-slate-400" v-if="running[ep.name]">Running…</span>
            <span class="text-[11px] text-slate-400" v-if="testResults[ep.name].data">{{ formatBytes(responseSize(testResults[ep.name].data)) }}</span>
            <span class="text-[11px] text-slate-400" v-if="testResults[ep.name].data">Keys: {{ previewKeys(testResults[ep.name].data) }}</span>
          </div>

          <div v-if="quickFacts(ep.name, testResults[ep.name].data).length" class="flex flex-wrap gap-2 text-[11px]">
            <span
              v-for="fact in quickFacts(ep.name, testResults[ep.name].data)"
              :key="fact"
              class="px-2 py-1 rounded-full bg-slate-700/50 text-slate-100 border border-white/10"
            >
              {{ fact }}
            </span>
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
