<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

interface LaunchWithComputed {
  launch?: any;
  computed?: any;
}

const api = useApi();
const router = useRouter();
const route = useRoute();

const launches = ref<LaunchWithComputed[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const nextKey = ref<string | null>(null);
const prevStack = ref<string[]>([]);

const pageSize = 20;

const formatRetro = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  try {
    const raw = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(value);
    const whole = raw / 1_000_000n;
    const frac = raw % 1_000_000n;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (frac === 0n) return `${wholeStr} RETRO`;
    let fracStr = frac.toString().padStart(6, "0");
    fracStr = fracStr.replace(/0+$/, "");
    return `${wholeStr}.${fracStr} RETRO`;
  } catch {
    return "—";
  }
};

const formatPercent = (value?: number | string | null) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(1)}%`;
};

const shortAddr = (addr?: string, size = 12) => {
  if (!addr) return "—";
  if (addr.length <= size) return addr;
  const half = Math.max(3, Math.floor((size - 3) / 2));
  return `${addr.slice(0, half)}...${addr.slice(-half)}`;
};

const spotPrice = (entry: LaunchWithComputed) => formatRetro(entry.computed?.spot_price_uretro_per_token);
const progress = (entry: LaunchWithComputed) => formatPercent(entry.computed?.graduation_progress);

const fetchLaunches = async (key?: string | null) => {
  loading.value = true;
  error.value = null;
  try {
    const params: Record<string, any> = { "pagination.limit": pageSize };
    if (key) params["pagination.key"] = key;
    const res = await api.get(`/retrochain/launcher/v1/launches`, { params });
    const list = res.data?.launches || res.data?.launches_with_computed || [];
    launches.value = Array.isArray(list) ? list : [];
    const next = res.data?.pagination?.next_key || null;
    nextKey.value = next;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 501) {
      error.value = "Launcher module not available on this node (HTTP 501).";
    } else {
      error.value = err?.message || "Failed to load launches";
    }
    launches.value = [];
    nextKey.value = null;
  } finally {
    loading.value = false;
  }
};

const goNext = async () => {
  if (!nextKey.value) return;
  prevStack.value.push(nextKey.value);
  await fetchLaunches(nextKey.value);
};

const goPrev = async () => {
  if (!prevStack.value.length) return;
  prevStack.value.pop();
  const prior = prevStack.value.length ? prevStack.value[prevStack.value.length - 1] : null;
  await fetchLaunches(prior);
};

onMounted(() => {
  fetchLaunches(route.query.start_key as string | null | undefined);
});

const gotoDetail = (denom?: string) => {
  if (!denom) return;
  router.push({ name: "launcher-detail", params: { denom } });
};
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-sky-600/15 to-purple-600/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-emerald-200">Launcher</p>
            <h1 class="text-3xl font-bold text-white mt-1">Pump-style Launches</h1>
            <p class="text-sm text-slate-300 mt-2 max-w-3xl">
              Browse RetroChain token launches (x/launcher). Newest first, live prices from on-chain reserves.
            </p>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-slate-400">
            <button class="btn text-xs" @click="router.push({ name: 'launcher-create' })">Create Launch</button>
            <span>Powered by /retrochain/launcher/v1/launches</span>
          </div>
        </div>
      </div>
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Launcher data unavailable">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Syncing launcher list…" />
    </div>

    <template v-else>
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">Launches</h2>
          <div class="flex items-center gap-2 text-xs">
            <button class="btn text-xs" :disabled="!prevStack.length" @click="goPrev">Prev</button>
            <button class="btn text-xs" :disabled="!nextKey" @click="goNext">Next</button>
          </div>
        </div>
        <div v-if="!launches.length" class="text-sm text-slate-400">No launches found.</div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Denom</th>
                <th>Creator</th>
                <th>Spot Price</th>
                <th>Progress</th>
                <th>Graduated</th>
                <th>DEX Pool</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in launches" :key="entry.launch?.denom" class="text-sm">
                <td class="font-mono text-xs text-emerald-200 break-all">{{ entry.launch?.denom || '—' }}</td>
                <td class="font-mono text-xs text-slate-300 break-all">
                  <RouterLink v-if="entry.launch?.creator" :to="{ name: 'account', params: { address: entry.launch.creator } }" class="hover:underline">
                    {{ shortAddr(entry.launch.creator) }}
                  </RouterLink>
                  <span v-else>—</span>
                </td>
                <td class="text-slate-100">{{ spotPrice(entry) }}</td>
                <td class="text-slate-100">{{ progress(entry) }}</td>
                <td>
                  <span class="badge text-[11px]" :class="entry.launch?.graduated ? 'border-emerald-400/60 text-emerald-200' : 'border-slate-500/60 text-slate-200'">
                    {{ entry.launch?.graduated ? 'Yes' : 'No' }}
                  </span>
                </td>
                <td class="text-xs text-slate-300">{{ entry.launch?.dex_pool_id || '—' }}</td>
                <td>
                  <button class="btn text-xs" @click="gotoDetail(entry.launch?.denom)">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
