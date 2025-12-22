<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useTxs } from "@/composables/useTxs";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { formatCoins } from "@/utils/format";

const { txs, loading, error, searchRecent } = useTxs();
const router = useRouter();

const statusFilter = ref<"all" | "success" | "failed">("all");
const messageFilter = ref<string>("all");
const limit = ref(20);

const totalTxs = computed(() => txs.value.length);
const successCount = computed(() => txs.value.filter((t) => (t.code ?? 0) === 0).length);
const failedCount = computed(() => totalTxs.value - successCount.value);
const successRate = computed(() => (totalTxs.value ? (successCount.value / totalTxs.value) * 100 : null));
const avgGasUsed = computed(() => {
  const nums = txs.value.map((t) => Number(t.gasUsed)).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
});
const avgFeeDisplay = computed(() => {
  const fees = txs.value.flatMap((t) => (Array.isArray(t.fees) ? t.fees : [])).filter((f) => f?.amount && f?.denom);
  if (!fees.length) return "—";
  return formatCoins(fees.slice(0, 3), { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
});
const topMessageQuickFilters = computed(() => availableMessageTypes.value.slice(0, 4));

const availableMessageTypes = computed(() => {
  const counts = new Map<string, number>();
  txs.value.forEach((tx) => {
    (tx.messageTypes || []).forEach((type) => {
      if (!type) return;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);
});

const filteredTxs = computed(() =>
  txs.value.filter((t) => {
    const code = t.code ?? 0;
    if (statusFilter.value === "success" && code !== 0) return false;
    if (statusFilter.value === "failed" && code === 0) return false;
    if (messageFilter.value !== "all") {
      const msgs = t.messageTypes || [];
      if (!msgs.includes(messageFilter.value)) return false;
    }
    return true;
  })
);

const copy = async (text: string) => { try { await navigator.clipboard?.writeText?.(text); } catch {} };

const prettyMessageType = (type: string) => {
  if (!type) return "Unknown";
  const segment = type.split(".").pop() || type;
  return segment.replace(/Msg/g, "Msg ").replace(/  +/g, " ").trim();
};

const formatGas = (value?: string | number | null) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
};

const formatFee = (fees?: { amount: string; denom: string }[]) => {
  if (!Array.isArray(fees) || !fees.length) return "—";
  return formatCoins(fees, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
};

const relativeTime = (value?: string | null) => (value ? dayjs(value).fromNow() : "—");

const loadMore = async () => {
  limit.value += 20;
  await searchRecent(limit.value);
};

onMounted(async () => {
  await searchRecent(limit.value);
});
</script>

<template>
  <div class="card">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-xs">
      <div class="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
        <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Total</div>
        <div class="text-lg font-semibold text-slate-100">{{ totalTxs }}</div>
      </div>
      <div class="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-emerald-300">Success</div>
        <div class="text-lg font-semibold text-emerald-200">{{ successCount }}<span v-if="successRate !== null" class="text-[11px] text-emerald-300 ml-2">({{ successRate.toFixed(1) }}%)</span></div>
      </div>
      <div class="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-rose-300">Failed</div>
        <div class="text-lg font-semibold text-rose-200">{{ failedCount }}</div>
      </div>
      <div class="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
        <div class="text-[11px] uppercase tracking-[0.2em] text-indigo-300">Avg Gas Used</div>
        <div class="text-lg font-semibold text-indigo-100">{{ avgGasUsed ? avgGasUsed.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—' }}</div>
        <div class="text-[10px] text-slate-400">Avg fee: {{ avgFeeDisplay }}</div>
      </div>
    </div>

    <div class="flex items-center justify-between mb-3">
      <div>
        <h1 class="text-sm font-semibold text-slate-100">Transactions</h1>
      <div class="flex items-center gap-2 mt-1">
          <button class="btn text-[10px]" :class="statusFilter==='all' ? 'border-indigo-400/70 bg-indigo-500/10' : ''" @click="statusFilter='all'">All</button>
          <button class="btn text-[10px]" :class="statusFilter==='success' ? 'border-emerald-400/70 bg-emerald-500/10' : ''" @click="statusFilter='success'">Success</button>
          <button class="btn text-[10px]" :class="statusFilter==='failed' ? 'border-rose-400/70 bg-rose-500/10' : ''" @click="statusFilter='failed'">Failed</button>
        </div>
        <div class="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">
          <span class="uppercase tracking-[0.2em]">Message Type</span>
          <select
            v-model="messageFilter"
            class="bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            :disabled="availableMessageTypes.length === 0"
          >
            <option value="all">All messages</option>
            <option v-for="type in availableMessageTypes" :key="type" :value="type">
              {{ prettyMessageType(type) }}
            </option>
          </select>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="type in topMessageQuickFilters"
              :key="type"
              class="btn text-[10px]"
              :class="messageFilter === type ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700'"
              @click="messageFilter = type"
            >
              {{ prettyMessageType(type) }}
            </button>
          </div>
        </div>
      </div>
      <div class="flex gap-2">
        <button class="btn text-xs" @click="searchRecent(limit)" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
        <button 
          v-if="txs.length >= limit" 
          class="btn text-xs" 
          @click="loadMore"
          :disabled="loading"
        >
          Load More
        </button>
      </div>
    </div>

    <div v-if="loading && txs.length === 0" class="flex items-center justify-center py-12">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mb-4"></div>
        <div class="text-sm text-slate-400">Loading recent transactions...</div>
        <div class="text-xs text-slate-500 mt-1">Scanning latest blocks</div>
      </div>
    </div>
    <div v-if="error" class="text-xs text-rose-300 mb-2">
      {{ error }}
    </div>

    <table class="table">
      <thead>
        <tr class="text-xs text-slate-300">
          <th>Hash &amp; Status</th>
          <th>Height</th>
          <th>Messages</th>
          <th>Gas / Fee</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in filteredTxs"
          :key="t.hash"
          class="cursor-pointer"
          @click="router.push({ name: 'tx-detail', params: { hash: t.hash } })"
        >
          <td class="font-mono text-[11px]">
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span>{{ t.hash.slice(0, 18) }}...</span>
                <button class="btn text-[10px]" @click.stop="copy(t.hash)">Copy</button>
              </div>
              <span
                class="badge text-[10px]"
                :class="(t.code ?? 0) === 0 ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'"
              >
                {{ (t.code ?? 0) === 0 ? 'Success' : `Failed · code ${(t.code ?? 0)}` }}
              </span>
            </div>
          </td>
          <td class="font-mono text-[11px]">{{ t.height }}</td>
          <td class="text-xs text-slate-300">
            <div v-if="t.messageTypes?.length" class="flex flex-wrap gap-1">
              <span
                v-for="(msg, idx) in t.messageTypes.slice(0, 3)"
                :key="`${msg}-${idx}`"
                class="badge text-[10px] border-indigo-400/40 text-indigo-100"
              >
                {{ prettyMessageType(msg) }}
              </span>
              <span v-if="t.messageTypes.length > 3" class="text-[10px] text-slate-500">
                +{{ t.messageTypes.length - 3 }} more
              </span>
            </div>
            <span v-else class="text-[11px] text-slate-500">—</span>
          </td>
          <td class="text-[11px] text-slate-300">
            {{ formatGas(t.gasUsed) }} / {{ formatGas(t.gasWanted) }}
            <div class="text-[10px] text-slate-500 mt-0.5">{{ formatFee(t.fees as any) }}</div>
          </td>
          <td class="text-[11px] text-slate-300">
            <span v-if="t.timestamp" class="flex flex-col">
              <span>{{ dayjs(t.timestamp).format('YYYY-MM-DD HH:mm:ss') }}</span>
              <span class="text-[10px] text-slate-500">{{ relativeTime(t.timestamp) }}</span>
            </span>
            <span v-else>-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
