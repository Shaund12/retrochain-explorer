<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useTxs } from "@/composables/useTxs";
import { useRouter } from "vue-router";
import dayjs from "dayjs";

const { txs, loading, error, searchRecent } = useTxs();
const router = useRouter();

const filter = ref<'all' | 'success' | 'failed'>('all');
const limit = ref(20); // Reduced from 50 to 20
const filteredTxs = computed(() => {
  if (filter.value === 'success') return txs.value.filter(t => (t.code ?? 0) === 0);
  if (filter.value === 'failed') return txs.value.filter(t => (t.code ?? 0) !== 0);
  return txs.value;
});

const copy = async (text: string) => { try { await navigator.clipboard?.writeText?.(text); } catch {} };

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
    <div class="flex items-center justify-between mb-3">
      <div>
        <h1 class="text-sm font-semibold text-slate-100">Transactions</h1>
      <div class="flex items-center gap-2 mt-1">
          <button class="btn text-[10px]" :class="filter==='all' ? 'border-indigo-400/70 bg-indigo-500/10' : ''" @click="filter='all'">All</button>
          <button class="btn text-[10px]" :class="filter==='success' ? 'border-emerald-400/70 bg-emerald-500/10' : ''" @click="filter='success'">Success</button>
          <button class="btn text-[10px]" :class="filter==='failed' ? 'border-rose-400/70 bg-rose-500/10' : ''" @click="filter='failed'">Failed</button>
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
          <th>Hash</th>
          <th>Height</th>
          <th>Code</th>
          <th>Gas</th>
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
            <div class="flex items-center gap-2">
              <span>{{ t.hash.slice(0, 18) }}...</span>
              <button class="btn text-[10px]" @click.stop="copy(t.hash)">Copy</button>
            </div>
          </td>
          <td class="font-mono text-[11px]">{{ t.height }}</td>
          <td class="text-xs">
            <span
              class="badge"
              :class="t.code === 0 ? 'border-emerald-400/60' : 'border-rose-400/60 text-rose-200'"
            >
              {{ t.code ?? 0 }}
            </span>
          </td>
          <td class="text-[11px] text-slate-300">
            {{ (t.gasUsed || '-').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') }} / {{ (t.gasWanted || '-').toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') }}
          </td>
          <td class="text-[11px] text-slate-300">
            <span v-if="t.timestamp">{{ dayjs(t.timestamp).format('YYYY-MM-DD HH:mm:ss') }}</span>
            <span v-else>-</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
