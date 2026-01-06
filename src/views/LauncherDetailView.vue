<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

interface LaunchWithComputed {
  launch?: any;
  computed?: any;
}

const route = useRoute();
const router = useRouter();
const api = useApi();

const denom = computed(() => route.params.denom as string | undefined);
const launch = ref<LaunchWithComputed | null>(null);
const params = ref<any | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

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

const formatInt = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
};

const formatPercent = (value?: number | string | null) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(2)}%`;
};

const shortAddr = (addr?: string, size = 14) => {
  if (!addr) return "—";
  if (addr.length <= size) return addr;
  const half = Math.max(3, Math.floor((size - 3) / 2));
  return `${addr.slice(0, half)}...${addr.slice(-half)}`;
};

const spotPrice = computed(() => formatRetro(launch.value?.computed?.spot_price_uretro_per_token));
const progress = computed(() => formatPercent(launch.value?.computed?.graduation_progress));

const fetchDetail = async () => {
  if (!denom.value) return;
  loading.value = true;
  error.value = null;
  try {
    const [launchRes, paramsRes] = await Promise.all([
      api.get(`/retrochain/launcher/v1/launch/${denom.value}`),
      api.get(`/retrochain/launcher/v1/params`).catch(() => null)
    ]);
    launch.value = launchRes.data?.launch || launchRes.data?.launch_with_computed || launchRes.data || null;
    params.value = paramsRes ? paramsRes.data?.params ?? paramsRes.data ?? null : null;
  } catch (err: any) {
    error.value = err?.message || "Failed to load launch";
    launch.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(fetchDetail);
watch(() => route.params.denom, fetchDetail);

const tokensSold = computed(() => formatInt(launch.value?.computed?.tokens_sold));
const tokensRemaining = computed(() => formatInt(launch.value?.computed?.tokens_remaining));
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-indigo-600/15 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-2">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <button class="text-emerald-200 hover:underline" @click="router.push({ name: 'launcher' })">Launcher</button>
          <span class="text-slate-500">/</span>
          <span class="font-mono text-xs text-emerald-200 break-all">{{ denom }}</span>
        </div>
        <h1 class="text-3xl font-bold text-white flex items-center gap-3">
          <span>Launch Detail</span>
          <span class="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 font-mono">{{ denom }}</span>
        </h1>
        <p class="text-sm text-slate-300">On-chain data from /retrochain/launcher/v1/launch/{denom}</p>
      </div>
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Launch not available">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading launch…" />
    </div>

    <template v-else-if="launch">
      <div class="grid gap-3 md:grid-cols-3">
        <div class="card border border-emerald-400/40 bg-emerald-500/5">
          <p class="text-[11px] uppercase tracking-wider text-emerald-200">Spot Price</p>
          <p class="text-2xl font-bold text-white">{{ spotPrice }}</p>
          <p class="text-[11px] text-emerald-200/70">RETRO per token</p>
        </div>
        <div class="card border border-cyan-400/40 bg-cyan-500/5">
          <p class="text-[11px] uppercase tracking-wider text-cyan-200">Progress</p>
          <p class="text-2xl font-bold text-white">{{ progress }}</p>
          <p class="text-[11px] text-cyan-200/70">Graduation progress</p>
        </div>
        <div class="card border border-amber-400/40 bg-amber-500/5">
          <p class="text-[11px] uppercase tracking-wider text-amber-200">Graduated</p>
          <p class="text-2xl font-bold text-white">{{ launch.launch?.graduated ? 'Yes' : 'No' }}</p>
          <p class="text-[11px] text-amber-200/70">DEX Pool: {{ launch.launch?.dex_pool_id || '—' }}</p>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Launch</h2>
          <span class="text-[11px] text-slate-400">ID: {{ launch.launch?.id ?? '—' }}</span>
        </div>
        <div class="grid gap-2 md:grid-cols-2 text-sm text-slate-200">
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Denom</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ launch.launch?.denom || '—' }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Creator</div>
            <RouterLink v-if="launch.launch?.creator" :to="{ name: 'account', params: { address: launch.launch.creator } }" class="font-mono text-xs text-emerald-200 break-all hover:underline">
              {{ shortAddr(launch.launch?.creator) }}
            </RouterLink>
            <div v-else class="font-mono text-xs text-emerald-200">—</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Max Supply</div>
            <div class="font-semibold">{{ formatInt(launch.launch?.max_supply) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Tokens Sold / Remaining</div>
            <div class="font-semibold">{{ tokensSold }} / {{ tokensRemaining }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Reserve (real)</div>
            <div class="font-semibold">{{ formatRetro(launch.launch?.reserve_real_uretro) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Reserve (virtual)</div>
            <div class="font-semibold">{{ formatRetro(launch.launch?.virtual_reserve_uretro) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Graduation Reserve</div>
            <div class="font-semibold">{{ formatRetro(launch.launch?.graduation_reserve_uretro) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">DEX LP Denom</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ launch.launch?.dex_lp_denom || '—' }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Fees & Params</h2>
          <span class="text-[11px] text-slate-400">/retrochain/launcher/v1/params</span>
        </div>
        <div v-if="!params" class="text-sm text-slate-400">Params unavailable.</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-200">
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Trading Fee</div>
            <div class="font-semibold">{{ params.fee_bps ?? '—' }} bps</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Create Launch Fee</div>
            <div class="font-semibold">{{ formatRetro(params.create_launch_fee) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Fee Recipient</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ params.fee_recipient || '—' }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
