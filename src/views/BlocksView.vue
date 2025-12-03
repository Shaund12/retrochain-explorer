<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { useBlocks } from "@/composables/useBlocks";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useRouter } from "vue-router";
import { useNetwork } from "@/composables/useNetwork";
import dayjs from "dayjs";

const copy = async (text: string) => {
  try { await navigator.clipboard?.writeText?.(text); } catch {}
};

const router = useRouter();
const { blocks, loading, error, fetchLatest } = useBlocks();
const displayLimit = ref(50);

const refreshBlocks = async () => {
  await fetchLatest(displayLimit.value);
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

const loadMore = () => {
  displayLimit.value += 50;
  refreshBlocks();
};

const { current: network } = useNetwork();
const REST_DISPLAY = import.meta.env.VITE_REST_API_URL || "/api";
</script>

<template>
  <div class="space-y-3">
    <div class="card flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Blocks</h1>
        <p class="text-sm text-slate-400 mt-2">
          Latest RetroChain blocks — {{ network === 'mainnet' ? 'mainnet' : 'testnet' }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div
          v-if="latestHeight"
          class="badge text-xs border-emerald-400/60 text-emerald-200"
        >
          Latest: <span class="font-mono ml-1">#{{ latestHeight }}</span>
        </div>
        <button
          class="btn text-xs"
          :class="autoRefreshEnabled ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
          @click="toggleAutoRefresh"
        >
          {{ autoRefreshEnabled ? `Auto (${countdown}s)` : "Paused" }}
        </button>
        <button class="btn text-xs" @click="refreshBlocks" :disabled="loading">
          {{ loading ? "Loading..." : "Refresh" }}
        </button>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && blocks.length === 0" class="card">
      <p class="text-sm text-slate-400">Loading blocks...</p>
    </div>

    <div v-if="!loading && !error && blocks.length === 0" class="card">
      <p class="text-sm text-slate-400">
        No blocks found yet.
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
            <col style="width: 120px" />
            <col />
            <col style="width: 90px" />
            <col style="width: 220px" />
          </colgroup>
          <thead>
            <tr class="text-xs text-slate-300">
              <th>Height</th>
              <th>Block Hash</th>
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
              <td class="font-mono text-[12px] text-slate-300 py-2">
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <span class="truncate max-w-[240px] inline-block align-middle">{{ b.hash ? b.hash.slice(0, 32) : "-" }}</span>
                  <button v-if="b.hash" class="btn text-[10px]" @click.stop="copy(b.hash)">Copy</button>
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
                <span v-if="b.time">{{ dayjs(b.time).format('YYYY-MM-DD HH:mm:ss') }}</span>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="mt-4 text-center">
        <button class="btn text-xs" @click="loadMore" :disabled="loading">
          Load More Blocks
        </button>
      </div>
    </div>
  </div>
</template>
