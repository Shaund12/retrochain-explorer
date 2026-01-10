<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useDex, type Pool, type SwapRoute } from "@/composables/useDex";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";

const { address } = useKeplr();
const toast = useToast();
const {
  pools,
  userLiquidity,
  lpPositions,
  loading,
  params,
  fetchPools,
  fetchParams,
  fetchUserLiquidity,
  simulateSwap,
  calculatePoolPrice,
  calculateUserShare,
  isModuleAvailable,
  swapExactIn,
  addLiquidity,
  removeLiquidity
} = useDex();

const tokenIn = ref("");
const tokenOut = ref("");
const amountIn = ref("1");
const simulation = ref<SwapRoute | null>(null);
const swapLoading = ref(false);
const selectedPoolId = ref<string>("");
const slippageBps = ref(50); // 0.50%

const addAmountA = ref("0");
const addAmountB = ref("0");
const removeShares = ref("0");

const tokenOptions = computed(() => {
  const set = new Set<string>();
  pools.value.forEach((p) => {
    set.add(p.denom_a);
    set.add(p.denom_b);
  });
  return Array.from(set).sort();
});

const setDefaultsFromPools = (ps: Pool[]) => {
  if (!ps.length) return;
  const tokens = tokenOptions.value;
  if (!selectedPoolId.value) selectedPoolId.value = ps[0].id;
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

const submitSwap = async () => {
  if (!selectedPool.value) return;
  try {
    await swapExactIn(selectedPool.value.id, tokenIn.value, amountIn.value || "0", tokenOut.value, slippageBps.value);
    toast.showSuccess("Swap submitted");
    runSimulation();
  } catch (e: any) {
    toast.showError(e?.message || "Swap failed");
  }
};

const submitAdd = async () => {
  if (!selectedPool.value) return;
  try {
    await addLiquidity(selectedPool.value, addAmountA.value || "0", addAmountB.value || "0", slippageBps.value);
    toast.showSuccess("Add liquidity submitted");
    fetchPools();
    if (address.value) fetchUserLiquidity(address.value);
  } catch (e: any) {
    toast.showError(e?.message || "Add liquidity failed");
  }
};

const submitRemove = async () => {
  if (!selectedPool.value) return;
  try {
    await removeLiquidity(selectedPool.value, removeShares.value || "0", slippageBps.value);
    toast.showSuccess("Remove liquidity submitted");
    fetchPools();
    if (address.value) fetchUserLiquidity(address.value);
  } catch (e: any) {
    toast.showError(e?.message || "Remove liquidity failed");
  }
};

const selectedPool = computed(() => pools.value.find((p) => p.id === selectedPoolId.value) || null);

watch(selectedPool, (p) => {
  if (p) {
    tokenIn.value = p.denom_a;
    tokenOut.value = p.denom_b;
  }
});

onMounted(async () => {
  await Promise.all([fetchPools(), fetchParams()]);
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
      <p class="text-slate-300">Swap, add/remove liquidity, and inspect pools backed by the on-chain x/dex module.</p>
    </div>

    <RcDisclaimer />

    <div v-if="!isModuleAvailable" class="card border-amber-400/50 text-amber-100 bg-amber-500/10">
      DEX module is not available on this network yet. When enabled, pools and swap will appear here.
    </div>

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card-soft border border-emerald-400/30 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-[0.2em] text-emerald-200">Swap fee</div>
        <div class="text-2xl font-bold text-white">{{ params?.swap_fee_bps ?? '—' }} bps</div>
        <div class="text-[11px] text-emerald-100">Taken from input amount</div>
      </div>
      <div class="card-soft border border-cyan-400/30 bg-cyan-500/10">
        <div class="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Pools</div>
        <div class="text-2xl font-bold text-white">{{ pools.length }}</div>
        <div class="text-[11px] text-cyan-100">Constant-product AMMs</div>
      </div>
      <div class="card-soft border border-indigo-400/30 bg-indigo-500/10">
        <div class="text-[11px] uppercase tracking-[0.2em] text-indigo-200">Module</div>
        <div class="text-2xl font-bold text-white">{{ params?.enabled ? 'Enabled' : 'Unknown' }}</div>
        <div class="text-[11px] text-indigo-100">Gates stateful txs</div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 space-y-4">
        <div class="card">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 class="text-lg font-semibold text-white">Swap (exact-in)</h2>
              <p class="text-xs text-slate-400">Quote then broadcast MsgSwapExactIn</p>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-300">
              <label class="text-slate-400">Pool</label>
              <select v-model="selectedPoolId" class="input text-xs w-40">
                <option v-for="p in pools" :key="p.id" :value="p.id">Pool #{{ p.id }} — {{ p.denom_a }} / {{ p.denom_b }}</option>
              </select>
              <label class="text-slate-400">Slippage (bps)</label>
              <input v-model.number="slippageBps" type="number" min="1" max="3000" class="input w-20" />
            </div>
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
              <label class="text-xs text-slate-400">Amount In (base units)</label>
              <input v-model="amountIn" type="number" min="0" step="0.000001" class="input w-full" />
            </div>
            <div class="md:col-span-2 flex items-center gap-3">
              <button class="btn" :disabled="swapLoading || loading" @click="runSimulation">Quote</button>
              <button class="btn btn-primary" :disabled="swapLoading || loading || tokenIn === tokenOut" @click="submitSwap">Swap</button>
              <span class="text-xs text-slate-400" v-if="tokenIn === tokenOut">Choose different tokens.</span>
            </div>
          </div>

          <div v-if="simulation" class="mt-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <div class="flex items-center justify-between text-sm text-slate-200">
              <span>{{ simulation.amount_in }} {{ simulation.token_in }} → {{ simulation.amount_out }} {{ simulation.token_out }}</span>
              <span class="text-emerald-300 text-xs">Swap fee {{ params?.swap_fee_bps ?? '—' }} bps</span>
            </div>
            <div class="mt-2 text-xs text-slate-400">Route: {{ simulation.route.join(" → ") }}</div>
            <div class="mt-1 text-xs text-amber-200">Min out @ slippage {{ slippageBps }} bps ≈ {{ simulation.amount_out ? Math.floor(Number(simulation.amount_out) * (1 - slippageBps / 10000)) : 0 }}</div>
          </div>
        </div>

        <div class="card grid gap-4 md:grid-cols-2">
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-white">Add Liquidity</h3>
                <p class="text-[11px] text-slate-400">Uses pool canonical order (denom_a / denom_b)</p>
              </div>
              <span class="badge text-[11px] border-emerald-400/50 text-emerald-200">Pool #{{ selectedPool?.id || '—' }}</span>
            </div>
            <div class="space-y-2">
              <label class="text-[11px] text-slate-400">Amount {{ selectedPool?.denom_a || 'denom_a' }}</label>
              <input v-model="addAmountA" class="input" placeholder="amount_a (base units)" />
            </div>
            <div class="space-y-2">
              <label class="text-[11px] text-slate-400">Amount {{ selectedPool?.denom_b || 'denom_b' }}</label>
              <input v-model="addAmountB" class="input" placeholder="amount_b (base units)" />
            </div>
            <button class="btn btn-primary w-full" :disabled="!selectedPool" @click="submitAdd">Add liquidity</button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-white">Remove Liquidity</h3>
                <p class="text-[11px] text-slate-400">Outputs match pool order (denom_a / denom_b)</p>
              </div>
              <span class="badge text-[11px] border-rose-400/50 text-rose-200">LP: {{ selectedPool?.lp_denom || 'dex/<id>' }}</span>
            </div>
            <div class="space-y-2">
              <label class="text-[11px] text-slate-400">Shares (LP)</label>
              <input v-model="removeShares" class="input" placeholder="LP shares" />
            </div>
            <button class="btn w-full" :disabled="!selectedPool" @click="submitRemove">Remove liquidity</button>
            <div class="text-[11px] text-slate-400">Slippage protection: {{ slippageBps }} bps</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Your liquidity</h2>
          <span class="text-xs text-slate-500">{{ address ? address : "Not connected" }}</span>
        </div>
        <div v-if="!address" class="text-sm text-slate-400">Connect wallet to view positions.</div>
        <div v-else-if="!lpPositions.length" class="text-sm text-slate-400">No LP balances found.</div>
        <div v-else class="space-y-3">
          <div v-for="pos in lpPositions" :key="pos.lp_denom" class="p-3 rounded-lg bg-white/5 border border-white/10">
            <div class="text-sm text-white font-semibold">Pool #{{ pos.pool.id }} — {{ pos.pool.denom_a }} / {{ pos.pool.denom_b }}</div>
            <div class="text-xs text-slate-400 mt-1">Shares: {{ pos.shares }}</div>
            <div class="text-xs text-emerald-300 mt-1">~{{ pos.percent.toFixed(4) }}% of pool</div>
            <div class="text-[11px] text-slate-500">LP denom: {{ pos.lp_denom }}</div>
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
            <span class="text-xs text-emerald-300">LP: {{ pool.lp_denom || `dex/${pool.id}` }}</span>
          </div>
          <div class="mt-2 text-xs text-slate-300">{{ pool.denom_a }} / {{ pool.denom_b }}</div>
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
          <div class="mt-3 text-xs text-emerald-300">Price: 1 {{ pool.denom_a }} ≈ {{ calculatePoolPrice(pool) }} {{ pool.denom_b }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

