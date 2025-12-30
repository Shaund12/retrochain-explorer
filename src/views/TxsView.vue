<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useTxs } from "@/composables/useTxs";
import { useBlocks } from "@/composables/useBlocks";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { formatCoins } from "@/utils/format";
import { getTokenMeta } from "@/constants/tokens";
import { useToast } from "@/composables/useToast";
import RcTableToolbar from "@/components/RcTableToolbar.vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnDef,
  type PaginationState
} from "@tanstack/vue-table";

const { txs, loading, error, searchRecent } = useTxs();
const { blocks, loading: blocksLoading, fetchLatest } = useBlocks();
const router = useRouter();
const { copyToClipboard, shareLink } = useToast();

const STORAGE_KEY = "retrochain.txsView";

const safeRead = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
};

const safeWrite = (value: unknown) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const stored = (() => {
  const raw = safeRead();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { status?: string; msg?: string; limit?: number; q?: string };
  } catch {
    return null;
  }
})();

const statusFilter = ref<"all" | "success" | "failed">(
  stored?.status === "success" || stored?.status === "failed" ? (stored.status as any) : "all"
);
const messageFilter = ref<string>(typeof stored?.msg === "string" ? stored!.msg : "all");
const limit = ref(typeof stored?.limit === "number" && stored.limit > 0 ? stored.limit : 20);
const hashQuery = ref<string>(typeof stored?.q === "string" ? stored!.q : "");

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
const avgFeeUsd = computed(() => {
  const usdVals = txs.value
    .map((t) => feeUsdValue(t.fees as any))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!usdVals.length) return null;
  const avg = usdVals.reduce((a, b) => a + b, 0) / usdVals.length;
  return avg;
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

const hashFilteredTxs = computed(() => {
  const q = hashQuery.value.trim().toLowerCase();
  if (!q) return filteredTxs.value;
  return filteredTxs.value.filter((t: any) => String(t?.hash || "").toLowerCase().includes(q));
});

type TxRow = (typeof filteredTxs.value)[number];

const sorting = ref<SortingState>([{ id: "timestamp", desc: true }]);
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 20 });

const columns = computed<ColumnDef<TxRow>[]>(() => [
  {
    id: "hash",
    header: "Hash",
    accessorFn: (row) => (row as any)?.hash ?? "",
    cell: (info) => String(info.getValue() ?? "")
  },
  {
    id: "timestamp",
    header: "Time",
    accessorFn: (row) => (row as any)?.timestamp ?? (row as any)?.time ?? "",
    cell: (info) => String(info.getValue() ?? "")
  },
  {
    id: "height",
    header: "Height",
    accessorFn: (row) => (row as any)?.height ?? "",
    cell: (info) => String(info.getValue() ?? "")
  },
  {
    id: "code",
    header: "Code",
    accessorFn: (row) => (row as any)?.code ?? 0,
    cell: (info) => String(info.getValue() ?? "")
  }
]);

const table = useVueTable({
  get data() {
    return hashFilteredTxs.value as TxRow[];
  },
  get columns() {
    return columns.value;
  },
  state: {
    get sorting() {
      return sorting.value;
    },
    get pagination() {
      return pagination.value;
    }
  },
  onSortingChange: (updater) => {
    sorting.value = typeof updater === "function" ? updater(sorting.value) : updater;
  },
  onPaginationChange: (updater) => {
    pagination.value = typeof updater === "function" ? updater(pagination.value) : updater;
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel()
});

watch([statusFilter, messageFilter, hashQuery], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 };
  page.value = 0;
});

const rowCountDisplay = computed(() => {
  const total = table.getFilteredRowModel().rows.length;
  const shown = table.getPaginationRowModel().rows.length;
  return { total, shown };
});

const nextPageSmart = async () => {
  if (table.getCanNextPage()) {
    table.nextPage();
    return;
  }
  if (loading.value) return;
  // We've reached the end of the currently loaded dataset.
  // Fetch additional pages from the chain and then advance if possible.
  await loadMore();
  if (table.getCanNextPage()) table.nextPage();
};

const copy = async (text: string) => copyToClipboard(text, "Copied");
const sharePage = async () => shareLink();

const refresh = async () => {
  page.value = 0;
  pagination.value = { ...pagination.value, pageIndex: 0 };
  await searchRecent(limit.value, page.value);
};

watch([statusFilter, messageFilter, limit, hashQuery], () => {
  safeWrite({ status: statusFilter.value, msg: messageFilter.value, limit: limit.value, q: hashQuery.value });
});

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

const formatUsd = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const USD_PRICE_HINTS: Record<string, number | undefined> = {
  USDC: 1,
  OSMO: Number(import.meta.env.VITE_PRICE_OSMO_USD ?? "0") || 0.6,
  ATOM: Number(import.meta.env.VITE_PRICE_ATOM_USD ?? "0") || 10,
  RETRO: Number(import.meta.env.VITE_PRICE_RETRO_USD ?? "0") || 0
};

const getUsdEstimate = (rawAmount: string | undefined | null, denom: string | undefined | null): number | null => {
  if (!rawAmount || !denom) return null;
  const meta = getTokenMeta(denom);
  const symbol = meta.symbol?.toUpperCase();
  const hint = symbol ? USD_PRICE_HINTS[symbol] : undefined;
  if (hint === undefined || hint === null) return null;
  if (hint < 0) return null;
  const decimals = typeof meta.decimals === "number" ? meta.decimals : 6;
  const num = Number(rawAmount) / Math.pow(10, decimals);
  if (!Number.isFinite(num)) return null;
  return num * hint;
};

const feeUsdValue = (fees?: { amount: string; denom: string }[]) => {
  if (!Array.isArray(fees) || !fees.length) return null;
  const totals = fees
    .map((f) => getUsdEstimate(f.amount, f.denom))
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!totals.length) return null;
  return totals.reduce((a, b) => a + b, 0);
};

const transferValueDisplay = (valueTransfers?: { amount: string; denom: string }[]) => {
  if (!Array.isArray(valueTransfers) || !valueTransfers.length) return null;
  return formatCoins(valueTransfers, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
};

const transferUsdValue = (valueTransfers?: { amount: string; denom: string }[]) => {
  if (!Array.isArray(valueTransfers) || !valueTransfers.length) return null;
  const totals = valueTransfers
    .map((v) => getUsdEstimate(v.amount, v.denom))
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  if (!totals.length) return null;
  return totals.reduce((a, b) => a + b, 0);
};

const burnValueDisplay = (burns?: { amount: string; denom: string }[]) => {
  if (!Array.isArray(burns) || !burns.length) return null;
  return formatCoins(burns, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
};

const burnedTotalsDisplay = computed(() => {
  const totals = new Map<string, bigint>();
  txs.value.forEach((t) => {
    const burns = Array.isArray(t.burns) ? t.burns : [];
    burns.forEach((b) => {
      if (!b?.amount || !b?.denom) return;
      try {
        const amt = BigInt(b.amount);
        totals.set(b.denom, (totals.get(b.denom) ?? 0n) + amt);
      } catch {}
    });
  });
  if (!totals.size) return "—";
  const list = Array.from(totals.entries()).map(([denom, amount]) => ({ denom, amount: amount.toString() }));
  return formatCoins(list, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
});

const gasPriceDisplay = (fees?: { amount: string; denom: string }[], gasUsed?: string | number | null) => {
  const primary = Array.isArray(fees) && fees.length ? fees[0] : null;
  const used = Number(gasUsed);
  if (!primary || !Number.isFinite(used) || used <= 0) return null;
  const price = Number(primary.amount) / used;
  if (!Number.isFinite(price)) return null;
  const precision = price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
  return `${price.toFixed(precision)} ${primary.denom}/gas`;
};

const hasResults = computed(() => filteredTxs.value.length > 0);

const isIbcTx = (tx: any) => {
  const types: string[] = Array.isArray(tx?.messageTypes) ? tx.messageTypes : [];
  return types.some((t) => typeof t === "string" && t.toLowerCase().includes("ibc"));
};

const page = ref(0);

const loadMore = async () => {
  page.value += 1;
  await searchRecent(limit.value, page.value);
};

onMounted(async () => {
  fetchLatest(8);
  page.value = 0;
  await searchRecent(limit.value, page.value);
});
</script>

<template>
  <div class="card">
    <div class="mb-3">
      <div class="flex items-center justify-between mb-2">
        <div class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Latest blocks</div>
        <button class="btn text-[10px]" @click="fetchLatest(8)" :disabled="blocksLoading">{{ blocksLoading ? '…' : 'Refresh' }}</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="b in blocks.slice(0, 8)"
          :key="b.height"
          class="px-2 py-1 rounded-md border border-slate-800 bg-slate-900/60 hover:bg-slate-900/90 transition text-[11px] text-slate-200"
          @click="router.push({ name: 'block-detail', params: { height: b.height } })"
        >
          <span class="font-mono">#{{ b.height }}</span>
          <span class="text-slate-500 ml-2">{{ dayjs(b.time).fromNow() }}</span>
          <span class="text-slate-400 ml-2">·</span>
          <span class="text-slate-300 ml-2">{{ (b.txs ?? 0) }} tx</span>
        </button>
      </div>
    </div>

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
        <div class="text-[10px] text-emerald-300" v-if="avgFeeUsd !== null">≈ {{ formatUsd(avgFeeUsd) }}</div>
      </div>
      <div class="p-3 rounded-lg border border-rose-500/40 bg-gradient-to-br from-rose-500/10 via-orange-500/10 to-amber-400/10 shadow-inner shadow-rose-500/20">
        <div class="flex items-center justify-between">
          <div class="text-[11px] uppercase tracking-[0.2em] text-rose-200">Burned</div>
          <div class="text-lg">🔥✨🔥</div>
        </div>
        <div class="text-xl font-extrabold text-rose-100 flex items-center gap-2 mt-1">
          <span class="animate-pulse">🔥</span>
          <span>{{ burnedTotalsDisplay }}</span>
        </div>
        <div class="text-[10px] text-rose-200/80">Celebrating every RETRO burned across listed transactions</div>
      </div>
    </div>

    <div class="flex items-center justify-between mb-3">
      <div>
        <h1 class="text-sm font-semibold text-slate-100">Transactions</h1>
      <div class="flex items-center gap-2 mt-1">
          <button class="btn text-[10px]" :class="statusFilter==='all' ? 'border-indigo-400/70 bg-indigo-500/10' : ''" @click="statusFilter='all'">All</button>
          <button class="btn text-[10px]" :class="statusFilter==='success' ? 'border-emerald-400/70 bg-emerald-500/10' : ''" @click="statusFilter='success'">Success</button>
          <button class="btn text-[10px]" :class="statusFilter==='failed' ? 'border-rose-400/70 bg-rose-500/10' : ''" @click="statusFilter='failed'">Failed</button>
          <span class="badge text-[10px] border-slate-700 text-slate-300 ml-1">
            Showing {{ rowCountDisplay.shown }} / {{ rowCountDisplay.total }}
          </span>
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
        <button class="btn text-xs" @click="refresh()" :disabled="loading">
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
        <button class="btn text-xs" @click="nextPageSmart()" :disabled="loading">
          {{ loading ? 'Loading...' : 'Next' }}
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
    <div v-else-if="!loading && !hasResults" class="text-xs text-slate-400 py-10 text-center border border-dashed border-slate-800 rounded-lg">
      <div class="text-3xl mb-2">🛰️</div>
      <div>No transactions match your filters</div>
      <div class="text-[11px] text-slate-500 mt-1">Try widening status/message filters or refresh</div>
    </div>
    <div v-if="error" class="text-xs text-rose-300 mb-2">
      {{ error }}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <div class="text-[11px] text-slate-400">
        Page {{ table.getState().pagination.pageIndex + 1 }} / {{ table.getPageCount() || 1 }}
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model="hashQuery"
          placeholder="Search hash…"
          class="bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 w-44 sm:w-56"
        />
        <select
          class="bg-slate-900/60 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
          :value="table.getState().pagination.pageSize"
          @change="table.setPageSize(Number(($event.target as HTMLSelectElement).value))"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
        <button class="btn text-xs" @click="table.previousPage()" :disabled="!table.getCanPreviousPage()">Prev</button>
        <button class="btn text-xs" @click="nextPageSmart()" :disabled="loading">Next</button>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th colspan="5" class="p-0">
            <RcTableToolbar label="Tx feed">
              <button class="btn text-[10px]" @click.stop="sharePage()">Share</button>
              <button class="btn text-[10px]" @click.stop="refresh()" :disabled="loading">
                {{ loading ? 'Loading…' : 'Refresh' }}
              </button>
              <button class="btn text-[10px]" @click.stop="nextPageSmart()" :disabled="loading">Next</button>
            </RcTableToolbar>
          </th>
        </tr>
        <tr class="text-xs text-slate-300">
          <th>Hash &amp; Status</th>
           <th>
             <button
               class="inline-flex items-center gap-1 hover:text-slate-100"
               @click.stop="table.getColumn('height')?.toggleSorting()"
               type="button"
             >
               Height
               <span class="text-[10px] text-slate-500">
                 {{ table.getColumn('height')?.getIsSorted() === 'asc' ? '↑' : table.getColumn('height')?.getIsSorted() === 'desc' ? '↓' : '' }}
               </span>
             </button>
           </th>
          <th>Messages</th>
          <th>Gas / Fee / Assets</th>
           <th>
             <button
               class="inline-flex items-center gap-1 hover:text-slate-100"
               @click.stop="table.getColumn('timestamp')?.toggleSorting()"
               type="button"
             >
               Time
               <span class="text-[10px] text-slate-500">
                 {{ table.getColumn('timestamp')?.getIsSorted() === 'asc' ? '↑' : table.getColumn('timestamp')?.getIsSorted() === 'desc' ? '↓' : '' }}
               </span>
             </button>
           </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="t in table.getPaginationRowModel().rows.map(r => r.original as any)"
          :key="t.hash"
          class="cursor-pointer hover:bg-white/5 transition-colors"
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
              <span v-if="isIbcTx(t)" class="badge text-[10px] border-emerald-400/60 text-emerald-200">IBC</span>
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
            <div v-if="feeUsdValue(t.fees as any) !== null" class="text-[10px] text-emerald-300">≈ {{ formatUsd(feeUsdValue(t.fees as any)) }}</div>
            <div v-if="gasPriceDisplay(t.fees as any, t.gasUsed)" class="text-[10px] text-cyan-300">Gas price: {{ gasPriceDisplay(t.fees as any, t.gasUsed) }}</div>
            <div v-if="transferValueDisplay(t.valueTransfers as any)" class="text-[10px] text-slate-400 mt-1">Moved: {{ transferValueDisplay(t.valueTransfers as any) }}</div>
            <div v-if="transferUsdValue(t.valueTransfers as any) !== null" class="text-[10px] text-emerald-300">≈ {{ formatUsd(transferUsdValue(t.valueTransfers as any)) }}</div>
            <div v-if="burnValueDisplay(t.burns as any)" class="text-[10px] text-rose-300 mt-1">Burned: {{ burnValueDisplay(t.burns as any) }}</div>
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
