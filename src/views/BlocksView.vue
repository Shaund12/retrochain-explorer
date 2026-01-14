<script setup lang="ts">
import { onMounted, computed, ref, watch } from "vue";
import { useBlocks } from "@/composables/useBlocks";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useRouter } from "vue-router";
import { useNetwork } from "@/composables/useNetwork";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import RcIconButton from "@/components/RcIconButton.vue";
import { Copy, Pause, Play, RefreshCw, ChevronLeft, ChevronRight } from "lucide-vue-next";

dayjs.extend(relativeTime);

const copy = async (text: string) => {
  try { await navigator.clipboard?.writeText?.(text); } catch {}
};

const router = useRouter();
const { blocks, loading, error, fetchLatest } = useBlocks();
const pageSize = ref(50);
const page = ref(1);
const tipHeight = ref<number | null>(null);

const refreshBlocks = async () => {
  const start = tipHeight.value && page.value > 1
    ? Math.max(1, tipHeight.value - (page.value - 1) * pageSize.value)
    : undefined;
  await fetchLatest(pageSize.value, start);
  if (blocks.value.length) {
    if (!tipHeight.value || page.value === 1) {
      tipHeight.value = blocks.value[0].height;
    }
  }
};

const { enabled: autoRefreshEnabled, countdown, toggle: toggleAutoRefresh } = useAutoRefresh(
  refreshBlocks,
  10000
);

onMounted(async () => {
  await refreshBlocks();
});

const latestHeight = computed(() =>
  blocks.value.length ? blocks.value[0].height : null
);
const showingRange = computed(() => {
  if (!blocks.value.length) return "–";
  const high = blocks.value[0].height;
  const low = blocks.value[blocks.value.length - 1].height;
  return `#${high} – #${low}`;
});

const pageCountDisplay = computed(() => {
  if (!tipHeight.value) return "–";
  return Math.ceil(tipHeight.value / pageSize.value);
});

const canPrev = computed(() => page.value > 1);
const canNext = computed(() => {
  if (!tipHeight.value) return false;
  const nextStart = tipHeight.value - page.value * pageSize.value;
  return nextStart > 0;
});

const goPage = async (dir: "prev" | "next") => {
  if (dir === "prev" && !canPrev.value) return;
  if (dir === "next" && !canNext.value) return;
  page.value = dir === "prev" ? Math.max(1, page.value - 1) : page.value + 1;
  await refreshBlocks();
};

watch(pageSize, async () => {
  page.value = 1;
  await refreshBlocks();
});

const { current: network } = useNetwork();
const REST_DISPLAY = import.meta.env.VITE_REST_API_URL || "/api";

const blockTimes = computed(() =>
  blocks.value
    .map((b) => (b.time ? new Date(b.time).getTime() : null))
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t))
);

const blockTimeDeltas = computed(() => {
  const arr: number[] = [];
  for (let i = 1; i < blockTimes.value.length; i++) {
    const delta = Math.abs((blockTimes.value[i - 1] - blockTimes.value[i]) / 1000);
    if (Number.isFinite(delta) && delta > 0) arr.push(delta);
  }
  return arr;
});

const avgBlockTimeSeconds = computed(() => {
  if (!blockTimeDeltas.value.length) return null;
  return blockTimeDeltas.value.reduce((a, b) => a + b, 0) / blockTimeDeltas.value.length;
});

const avgBlockTimeDisplay = computed(() => {
  if (avgBlockTimeSeconds.value === null) return "—";
  return `${avgBlockTimeSeconds.value.toFixed(2)}s`;
});

const avgTxPerBlock = computed(() => {
  if (!blocks.value.length) return null;
  const total = blocks.value.reduce((sum, b) => sum + (b.txs || 0), 0);
  return total / blocks.value.length;
});

const avgTxPerBlockDisplay = computed(() => {
  if (avgTxPerBlock.value === null) return "—";
  return avgTxPerBlock.value < 1 ? avgTxPerBlock.value.toFixed(2) : avgTxPerBlock.value.toFixed(1);
});

const avgGasUtilization = computed(() => {
  const vals = blocks.value
    .map((b) => (typeof b.gasUtilization === "number" ? b.gasUtilization : null))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  if (!vals.length) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg;
});

const avgGasUtilizationDisplay = computed(() => {
  if (avgGasUtilization.value === null) return "—";
  return `${(avgGasUtilization.value * 100).toFixed(1)}%`;
});

const sampleWindowDisplay = computed(() => `${blocks.value.length || 0} block sample`);

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
};

const formatPercent = (value?: number | null, digits = 1) => {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
};
</script>

<template>
  <div class="space-y-3">
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="card-soft border border-emerald-500/30 bg-emerald-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Latest Height</div>
        <div class="text-2xl font-bold text-white mt-1">{{ latestHeight ?? '—' }}</div>
        <div class="text-[11px] text-slate-500">Network: {{ network === 'mainnet' ? 'Mainnet' : 'Testnet' }}</div>
      </div>
      <div class="card-soft border border-indigo-500/30 bg-indigo-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-indigo-300">Avg Block Time</div>
        <div class="text-2xl font-bold text-white mt-1">{{ avgBlockTimeDisplay }}</div>
        <div class="text-[11px] text-slate-500">{{ sampleWindowDisplay }}</div>
      </div>
      <div class="card-soft border border-cyan-500/30 bg-cyan-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-cyan-300">Avg Tx / Block</div>
        <div class="text-2xl font-bold text-white mt-1">{{ avgTxPerBlockDisplay }}</div>
        <div class="text-[11px] text-slate-500">Based on loaded blocks</div>
      </div>
      <div class="card-soft border border-amber-500/30 bg-amber-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-amber-300">Avg Gas Utilization</div>
        <div class="text-2xl font-bold text-white mt-1">{{ avgGasUtilizationDisplay }}</div>
        <div class="text-[11px] text-slate-500">Across sample</div>
      </div>
    </div>

    <div class="card flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Blocks</h1>
        <p class="text-sm text-slate-400 mt-2">
          Latest RetroChain blocks  {{ network === 'mainnet' ? 'mainnet' : 'testnet' }}
        </p>
        <div class="text-[11px] text-slate-500 mt-1">Showing {{ showingRange }} • Page {{ page }} / {{ pageCountDisplay }}</div>
      </div>
      <div class="flex items-center gap-2">
        <label class="text-[11px] text-slate-400 flex items-center gap-2">
          Page size
          <select v-model.number="pageSize" class="input text-[11px] w-24">
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>
        <div
          v-if="latestHeight"
          class="badge text-xs border-emerald-400/60 text-emerald-200"
        >
          Latest: <span class="font-mono ml-1">#{{ latestHeight }}</span>
        </div>
        <RcIconButton
          :variant="autoRefreshEnabled ? 'primary' : 'ghost'"
          size="sm"
          :title="autoRefreshEnabled ? `Auto-refresh (${countdown}s)` : 'Auto-refresh paused'"
          @click="toggleAutoRefresh"
        >
          <component :is="autoRefreshEnabled ? Pause : Play" class="h-4 w-4" />
        </RcIconButton>

        <RcIconButton
          variant="ghost"
          size="sm"
          title="Refresh"
          :disabled="loading"
          @click="refreshBlocks"
        >
          <RefreshCw class="h-4 w-4" />
        </RcIconButton>
        <RcIconButton
          variant="ghost"
          size="sm"
          title="Prev page"
          :disabled="loading || !canPrev"
          @click="goPage('prev')"
        >
          <ChevronLeft class="h-4 w-4" />
        </RcIconButton>
        <RcIconButton
          variant="ghost"
          size="sm"
          title="Next page"
          :disabled="loading || !canNext"
          @click="goPage('next')"
        >
          <ChevronRight class="h-4 w-4" />
        </RcIconButton>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && blocks.length === 0" class="card">
      <p class="text-sm text-slate-400">Loading blocks...</p>
    </div>

    <div v-if="!loading && !error && blocks.length === 0" class="card text-center border border-dashed border-slate-800">
      <div class="text-3xl mb-2">🔍</div>
      <p class="text-sm text-slate-300">No blocks found yet.</p>
      <p class="text-xs text-slate-500 mt-1">
        <span v-if="network !== 'mainnet'">
          Ensure your node is running and REST API is reachable at
          <code class="text-emerald-400">{{ REST_DISPLAY }}</code>.
        </span>
        <span v-else>
          The node may be starting or syncing. Please try again shortly.
        </span>
      </p>
    </div>

    <div v-if="blocks.length" class="card">
      <div class="overflow-x-auto">
        <table class="table">
          <colgroup>
            <col style="width: 90px" />
            <col style="width: 240px" />
            <col />
            <col style="width: 200px" />
            <col style="width: 110px" />
            <col style="width: 200px" />
          </colgroup>
          <thead>
            <tr class="text-xs text-slate-300">
              <th>Height</th>
              <th>Proposer</th>
              <th>Block Hash</th>
              <th>Gas</th>
              <th>Transactions</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in blocks"
              :key="b.height"
              class="cursor-pointer hover:bg-white/5 transition-colors animate-fade-in"
              @click="
                router.push({
                  name: 'block-detail',
                  params: { height: b.height }
                })
              "
            >
              <td class="font-mono text-[12px] font-semibold text-emerald-300 py-2">
                #{{ b.height }}
              </td>
              <td class="py-2">
                <div class="flex items-center gap-3">
                  <span v-if="b.proposerLabel?.icon" class="text-xl leading-none">{{ b.proposerLabel.icon }}</span>
                  <div class="flex flex-col text-left">
                    <span class="text-sm font-semibold text-white">
                      {{ b.proposerLabel?.label || b.proposerMoniker || "Unknown proposer" }}
                    </span>
                    <span v-if="b.proposerOperator" class="text-[11px] text-slate-500 font-mono">
                      {{ b.proposerOperator.slice(0, 14) }}...
                    </span>
                  </div>
                </div>
              </td>
              <td class="font-mono text-[12px] text-slate-300 py-2">
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <span class="truncate max-w-[220px] inline-block align-middle">{{ b.hash ? b.hash.slice(0, 32) : "-" }}</span>
                  <RcIconButton
                    v-if="b.hash"
                    variant="ghost"
                    size="xs"
                    title="Copy hash"
                    @click.stop="copy(b.hash)"
                  >
                    <Copy class="h-3.5 w-3.5" />
                  </RcIconButton>
                </div>
              </td>
              <td class="text-xs text-slate-300 py-2">
                <div class="flex items-center justify-between text-[11px]">
                  <span>{{ formatNumber(b.gasUsed) }}</span>
                  <span>{{ formatNumber(b.gasWanted) }}</span>
                </div>
                <div class="h-2 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    v-if="b.gasUtilization !== null && b.gasUtilization !== undefined"
                    class="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    :style="{ width: `${Math.min(100, b.gasUtilization * 100).toFixed(1)}%` }"
                  ></div>
                </div>
                <div class="text-[10px] text-slate-500 mt-1">
                  {{ b.gasUtilization !== null && b.gasUtilization !== undefined ? formatPercent(b.gasUtilization) : "—" }}
                </div>
              </td>
              <td class="text-center py-2">
                <span
                  class="badge"
                  :class="b.txs > 0 ? 'border-cyan-400/60 text-cyan-200' : ''"
                >
                  {{ b.txs }}
                </span>
              </td>
              <td class="text-xs text-slate-300 py-2 whitespace-nowrap">
                <div v-if="b.time" class="space-y-0.5">
                  <div>{{ dayjs(b.time).format('YYYY-MM-DD HH:mm:ss') }}</div>
                  <div class="text-[10px] text-slate-500">{{ dayjs(b.time).fromNow() }}</div>
                </div>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
