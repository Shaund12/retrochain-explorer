<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useDex, type Pool, type SwapRoute } from "@/composables/useDex";
import { useKeplr } from "@/composables/useKeplr";

const { address } = useKeplr();
const {
  pools,
  userLiquidity,
  loading,
  fetchPools,
  fetchUserLiquidity,
  simulateSwap,
  calculatePoolPrice,
  calculateUserShare,
  isModuleAvailable
} = useDex();

const tokenIn = ref("");
const tokenOut = ref("");
const amountIn = ref("1");
const simulation = ref<SwapRoute | null>(null);
const swapLoading = ref(false);

const tokenOptions = computed(() => {
  const set = new Set<string>();
  pools.value.forEach((p) => {
    set.add(p.token_a);
    set.add(p.token_b);
  });
  return Array.from(set).sort();
});

const setDefaultsFromPools = (ps: Pool[]) => {
  if (!ps.length) return;
  const tokens = tokenOptions.value;
  if (!tokenIn.value && tokens[0]) tokenIn.value = tokens[0];
  if (!tokenOut.value && tokens[1]) tokenOut.value = tokens[1];
  if (tokenIn.value === tokenOut.value && tokens.length > 1) {
    tokenOut.value = tokens.find((t) => t !== tokenIn.value) || tokenOut.value;
  }
};

const runSimulation = async () => {
  if (!tokenIn.value || !tokenOut.value || tokenIn.value === tokenOut.value) return;
  swapLoading.value = true;
  simulation.value = await simulateSwap(tokenIn.value, tokenOut.value, amountIn.value || "0");
  swapLoading.value = false;
};

onMounted(async () => {
  await fetchPools();
  setDefaultsFromPools(pools.value);
  if (address.value) {
    fetchUserLiquidity(address.value);
  }
});

watch(address, (addr) => {
  if (addr) {
    fetchUserLiquidity(addr);
  }
});

watch(pools, (ps) => setDefaultsFromPools(ps));
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl sm:text-3xl font-bold text-white">Retro DEX</h1>
      <p class="text-slate-300">
        Swap simulation and liquidity visibility backed by the on-chain DEX module.
      </p>
    </div>

    <RcDisclaimer />

    <div v-if="!isModuleAvailable" class="card border-amber-400/50 text-amber-100 bg-amber-500/10">
      DEX module is not available on this network yet. When enabled, pools and swap simulation will appear here.
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Swap simulator</h2>
          <span class="text-xs text-slate-500" v-if="loading">Loading…</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="space-y-2">
            <label class="text-xs text-slate-400">Token In</label>
            <select v-model="tokenIn" class="input w-full">
              <option v-for="t in tokenOptions" :key="`in-${t}`" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="space-y-2">
            <label class="text-xs text-slate-400">Token Out</label>
            <select v-model="tokenOut" class="input w-full">
              <option v-for="t in tokenOptions" :key="`out-${t}`" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="space-y-2 md:col-span-2">
            <label class="text-xs text-slate-400">Amount In</label>
            <input v-model="amountIn" type="number" min="0" step="0.000001" class="input w-full" />
          </div>
          <div class="md:col-span-2 flex items-center gap-3">
            <button class="btn" :disabled="swapLoading || loading" @click="runSimulation">Simulate</button>
            <span class="text-xs text-slate-400" v-if="tokenIn === tokenOut">Choose different tokens.</span>
          </div>
        </div>

        <div v-if="simulation" class="mt-4 p-4 rounded-xl border border-white/10 bg-white/5">
          <div class="flex items-center justify-between text-sm text-slate-200">
            <span>{{ simulation.amount_in }} {{ simulation.token_in }} → {{ simulation.amount_out }} {{ simulation.token_out }}</span>
            <span class="text-emerald-300 text-xs">Price impact: {{ simulation.price_impact }}</span>
          </div>
          <div class="mt-2 text-xs text-slate-400">Route: {{ simulation.route.join(" → ") }}</div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Your liquidity</h2>
          <span class="text-xs text-slate-500">{{ address ? address : "Not connected" }}</span>
        </div>
        <div v-if="!address" class="text-sm text-slate-400">Connect wallet to view positions.</div>
        <div v-else-if="!userLiquidity.length" class="text-sm text-slate-400">No positions found.</div>
        <div v-else class="space-y-3">
          <div v-for="pos in userLiquidity" :key="pos.pool_id" class="p-3 rounded-lg bg-white/5 border border-white/10">
            <div class="text-sm text-white font-semibold">Pool #{{ pos.pool_id }}</div>
            <div class="text-xs text-slate-400 mt-1">Shares: {{ pos.shares }}</div>
            <div class="text-xs text-emerald-300 mt-1" v-if="pools.length">
              ~{{ calculateUserShare(pools.find((p) => p.id === pos.pool_id) as Pool, pos.shares).toFixed(4) }}% of pool
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-white">Liquidity pools</h2>
        <span class="text-xs text-slate-500" v-if="loading">Loading…</span>
      </div>
      <div v-if="!pools.length" class="text-sm text-slate-400">No pools reported by the DEX module yet.</div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="pool in pools" :key="pool.id" class="p-4 rounded-xl bg-white/5 border border-white/10">
          <div class="flex items-center justify-between text-sm text-white">
            <span class="font-semibold">Pool #{{ pool.id }}</span>
            <span class="text-xs text-emerald-300">Fee {{ pool.fee_rate }}</span>
          </div>
          <div class="mt-2 text-xs text-slate-300">{{ pool.token_a }} / {{ pool.token_b }}</div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>
              <div class="text-slate-500">Reserve A</div>
              <div class="font-mono text-slate-200">{{ pool.reserve_a }}</div>
            </div>
            <div>
              <div class="text-slate-500">Reserve B</div>
              <div class="font-mono text-slate-200">{{ pool.reserve_b }}</div>
            </div>
          </div>
          <div class="mt-3 text-xs text-emerald-300">Price: 1 {{ pool.token_a }} ≈ {{ calculatePoolPrice(pool) }} {{ pool.token_b }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

