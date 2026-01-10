<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useDex, type Pool, type SwapRoute } from "@/composables/useDex";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import { formatAmount, formatAtomicToDisplay, getDenomMeta } from "@/utils/format";

const { address } = useKeplr();
const toast = useToast();
const {
  pools,
  userLiquidity,
  lpPositions,
  userBalances,
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
const lastEditedSide = ref<"A" | "B" | null>(null);

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
  const atomic = displayToAtomic(amountIn.value || "0", tokenIn.value);
  if (!atomic || BigInt(atomic) <= 0n) {
    simulation.value = null;
    swapLoading.value = false;
    return;
  }
  simulation.value = await simulateSwap(tokenIn.value, tokenOut.value, atomic);
  swapLoading.value = false;
};

const fmtAmount = (amount: string | number | null | undefined, denom: string) => {
  if (amount === null || amount === undefined) return "-";
  return formatAmount(String(amount), denom, { minDecimals: 0, maxDecimals: 6, showZerosForIntegers: false });
};

const getDecimals = (denom: string) => getDenomMeta(denom).decimals;

const displayToAtomic = (val: string, denom: string) => {
  const decimals = getDecimals(denom);
  if (!val || !Number.isFinite(Number(val))) return null;
  const str = String(val).trim();
  const neg = str.startsWith("-");
  const abs = neg ? str.slice(1) : str;
  const parts = abs.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
  if (!/^[0-9]+$/.test(whole) || !/^[0-9]*$/.test(parts[1] || "")) return null;
  const combined = (neg ? "-" : "") + whole + frac;
  return combined.replace(/^0+(\d)/, "$1");
};

const atomicToDisplay = (val: string | undefined, denom: string) => {
  if (!val) return "0";
  return formatAtomicToDisplay(val, denom, { minDecimals: 0, maxDecimals: 6, showZerosForIntegers: false });
};

const poolChartsOpen = ref<Record<string, boolean>>({});
const togglePoolChart = (id: string) => {
  poolChartsOpen.value = { ...poolChartsOpen.value, [id]: !poolChartsOpen.value[id] };
};

const calcSwapOut = (amountIn: bigint, reserveIn: bigint, reserveOut: bigint) => {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  // Simple constant-product, no fee
  return (reserveOut * amountIn) / (reserveIn + amountIn);
};

const poolComposition = (pool: Pool) => {
  const a = parseFloat(pool.reserve_a || "0");
  const b = parseFloat(pool.reserve_b || "0");
  const total = a + b;
  if (total === 0) return { aPct: 0, bPct: 0 };
  return { aPct: Math.round((a / total) * 100), bPct: Math.round((b / total) * 100) };
};

const poolImpactPreview = (pool: Pool) => {
  const reserveA = parseBig(pool.reserve_a || "0") || 0n;
  const reserveB = parseBig(pool.reserve_b || "0") || 0n;
  if (reserveA === 0n || reserveB === 0n) return null;
  const inAmt = reserveA / 100n || 1n; // 1% of reserveA or minimum 1 atomic
  const outAmt = calcSwapOut(inAmt, reserveA, reserveB);
  return {
    in: atomicToDisplay(inAmt.toString(), pool.denom_a),
    out: atomicToDisplay(outAmt.toString(), pool.denom_b)
  };
};

const burnEstimate = computed(() => {
  const pool = selectedPool.value;
  if (!pool) return null;
  const total = parseBig(pool.total_shares || "0") || 0n;
  if (total === 0n) return null;
  const shAtomicStr = displayToAtomic(removeShares.value || "0", pool.lp_denom || `dex/${pool.id}`);
  if (!shAtomicStr) return null;
  const sh = parseBig(shAtomicStr);
  if (!sh || sh <= 0n) return null;
  const reserveA = parseBig(pool.reserve_a || "0") || 0n;
  const reserveB = parseBig(pool.reserve_b || "0") || 0n;
  if (reserveA === 0n || reserveB === 0n) return null;
  const amtA = ((reserveA * sh) / total).toString();
  const amtB = ((reserveB * sh) / total).toString();
  return {
    a: atomicToDisplay(amtA, pool.denom_a),
    b: atomicToDisplay(amtB, pool.denom_b)
  };
});

const syncAddLiquidityRatio = () => {
  const pool = selectedPool.value;
  if (!pool) return;
  const reserveA = BigInt(pool.reserve_a || "0");
  const reserveB = BigInt(pool.reserve_b || "0");
  const totalShares = BigInt(pool.total_shares || "0");
  if (reserveA === 0n || reserveB === 0n || totalShares === 0n) return; // first LP can be arbitrary

  try {
    if (lastEditedSide.value === "A") {
      const aAtomic = displayToAtomic(addAmountA.value || "0", pool.denom_a);
      if (!aAtomic) return;
      const a = BigInt(aAtomic);
      const b = (a * reserveB) / reserveA;
      addAmountB.value = atomicToDisplay(b.toString(), pool.denom_b);
    } else if (lastEditedSide.value === "B") {
      const bAtomic = displayToAtomic(addAmountB.value || "0", pool.denom_b);
      if (!bAtomic) return;
      const b = BigInt(bAtomic);
      const a = (b * reserveA) / reserveB;
      addAmountA.value = atomicToDisplay(a.toString(), pool.denom_a);
    }
  } catch (e) {
    console.warn("syncAddLiquidityRatio failed", e);
  }
};

const parseBig = (val: string) => {
  try {
    return BigInt(val);
  } catch {
    return null;
  }
};

const validateAddLiquidityAmounts = (pool: Pool | null) => {
  if (!pool) return false;
  const aAtomic = displayToAtomic(addAmountA.value || "0", pool.denom_a);
  const bAtomic = displayToAtomic(addAmountB.value || "0", pool.denom_b);
  const a = aAtomic ? parseBig(aAtomic) : null;
  const b = bAtomic ? parseBig(bAtomic) : null;
  if (a === null || b === null || a <= 0n || b <= 0n) {
    toast.showError("Enter positive integer amounts for both tokens.");
    return false;
  }
  const totalShares = parseBig(pool.total_shares || "0") || 0n;
  const reserveA = parseBig(pool.reserve_a || "0") || 0n;
  const reserveB = parseBig(pool.reserve_b || "0") || 0n;
  if (totalShares === 0n || reserveA === 0n || reserveB === 0n) return true; // first liquidity can be arbitrary

  const expectedB = (a * reserveB) / reserveA;
  const tolerance = (expectedB * BigInt(Math.max(0, slippageBps.value || 0))) / 10000n;
  const diff = expectedB > b ? expectedB - b : b - expectedB;
  if (diff > tolerance) {
    toast.showError(
      `Pool ratio locked. For ${a} ${pool.denom_a}, provide ~${expectedB} ${pool.denom_b} (±${slippageBps.value} bps).`
    );
    return false;
  }
  return true;
};

const submitSwap = async () => {
  if (!selectedPool.value) return;
  try {
    const atomic = displayToAtomic(amountIn.value || "0", tokenIn.value);
    if (!atomic) {
      toast.showError("Enter a valid amount.");
      return;
    }
    await swapExactIn(selectedPool.value.id, tokenIn.value, atomic, tokenOut.value, slippageBps.value);
    toast.showSuccess("Swap submitted");
    runSimulation();
  } catch (e: any) {
    toast.showError(e?.message || "Swap failed");
  }
};

const submitAdd = async () => {
  if (!selectedPool.value) return;
  try {
    if (!validateAddLiquidityAmounts(selectedPool.value)) return;
    const amtA = displayToAtomic(addAmountA.value || "0", selectedPool.value.denom_a);
    const amtB = displayToAtomic(addAmountB.value || "0", selectedPool.value.denom_b);
    if (!amtA || !amtB) {
      toast.showError("Enter valid amounts for both tokens.");
      return;
    }
    await addLiquidity(selectedPool.value, amtA, amtB, slippageBps.value);
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
    const sharesAtomic = displayToAtomic(removeShares.value || "0", selectedPool.value.lp_denom || `dex/${selectedPool.value.id}`);
    if (!sharesAtomic) {
      toast.showError("Enter valid LP shares amount.");
      return;
    }
    await removeLiquidity(selectedPool.value, sharesAtomic, slippageBps.value);
    toast.showSuccess("Remove liquidity submitted");
    fetchPools();
    if (address.value) fetchUserLiquidity(address.value);
  } catch (e: any) {
    toast.showError(e?.message || "Remove liquidity failed");
  }
};

const selectedPool = computed(() => pools.value.find((p) => p.id === selectedPoolId.value) || null);

const tokenInBalance = computed(() => atomicToDisplay(userBalances[tokenIn.value], tokenIn.value));
const tokenOutBalance = computed(() => atomicToDisplay(userBalances[tokenOut.value], tokenOut.value));

const selectedLpDenom = computed(() => selectedPool.value?.lp_denom || (selectedPool.value ? `dex/${selectedPool.value.id}` : ""));
const selectedLpBalanceAtomic = computed(() => (selectedLpDenom.value ? userBalances[selectedLpDenom.value] || "0" : "0"));
const selectedLpBalanceDisplay = computed(() =>
  selectedLpDenom.value ? atomicToDisplay(selectedLpBalanceAtomic.value, selectedLpDenom.value) : "0"
);

const selectedUnderlying = computed(() => {
  const pool = selectedPool.value;
  if (!pool) return { a: "0", b: "0" };
  const shares = BigInt(selectedLpBalanceAtomic.value || "0");
  const total = BigInt(pool.total_shares || "0");
  if (total === 0n || shares === 0n) return { a: "0", b: "0" };
  const reserveA = BigInt(pool.reserve_a || "0");
  const reserveB = BigInt(pool.reserve_b || "0");
  const amtA = ((reserveA * shares) / total).toString();
  const amtB = ((reserveB * shares) / total).toString();
  return { a: atomicToDisplay(amtA, pool.denom_a), b: atomicToDisplay(amtB, pool.denom_b) };
});

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

watch([amountIn, tokenIn, tokenOut], () => {
  if (!tokenIn.value || !tokenOut.value || tokenIn.value === tokenOut.value) {
    simulation.value = null;
    return;
  }
  runSimulation();
});

watch(lpPositions, (positions) => {
  if (!positions?.length) return;
  // Prefer selecting a pool the user has LP for
  const first = positions[0];
  if (first?.pool?.id) {
    selectedPoolId.value = first.pool.id;
  }
});
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6 overflow-hidden">
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
        <div class="card bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-800/60 border border-white/10 shadow-xl shadow-emerald-500/10">
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
              <label class="text-xs text-slate-400">Amount In</label>
              <div class="flex items-center gap-2">
                <input v-model="amountIn" type="number" min="0" step="0.000001" class="input w-full" />
                <div class="flex gap-1">
                  <button class="btn-secondary px-3" type="button" @click="amountIn = ((Number(tokenInBalance) || 0) * 0.25).toString()">25%</button>
                  <button class="btn-secondary px-3" type="button" @click="amountIn = ((Number(tokenInBalance) || 0) * 0.5).toString()">50%</button>
                  <button class="btn-secondary px-3" type="button" @click="amountIn = tokenInBalance || '0'">Max</button>
                </div>
              </div>
              <div class="text-[11px] text-slate-400">Balance: {{ tokenInBalance }}</div>
            </div>
            <div class="md:col-span-2 flex items-center gap-3">
              <button class="btn" :disabled="swapLoading || loading" @click="runSimulation">Quote</button>
              <button class="btn btn-primary" :disabled="swapLoading || loading || tokenIn === tokenOut" @click="submitSwap">Swap</button>
              <span class="text-xs text-slate-400" v-if="tokenIn === tokenOut">Choose different tokens.</span>
            </div>
          </div>

          <div v-if="simulation" class="mt-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <div class="flex items-center justify-between text-sm text-slate-200">
              <span>{{ fmtAmount(simulation.amount_in, simulation.token_in) }} → {{ fmtAmount(simulation.amount_out, simulation.token_out) }}</span>
              <span class="text-emerald-300 text-xs">Swap fee {{ params?.swap_fee_bps ?? '—' }} bps</span>
            </div>
            <div class="mt-2 text-xs text-slate-400">Route: {{ simulation.route.join(" → ") }}</div>
            <div class="mt-1 text-xs text-amber-200">
              Min out @ slippage {{ slippageBps }} bps ≈
              {{ simulation.amount_out ? fmtAmount(Math.floor(Number(simulation.amount_out) * (1 - slippageBps / 10000)), simulation.token_out) : '-' }}
            </div>
          </div>
        </div>

        <div class="card grid gap-4 md:grid-cols-2 bg-gradient-to-br from-slate-900/60 via-slate-900/30 to-slate-800/50 border border-white/10 shadow-2xl shadow-emerald-500/10">
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
              <input
                v-model="addAmountA"
                class="input"
                placeholder="amount_a"
                @input="lastEditedSide = 'A'; syncAddLiquidityRatio()"
              />
              <div class="text-[11px] text-slate-400">Balance: {{ atomicToDisplay(userBalances[selectedPool?.denom_a || ''], selectedPool?.denom_a || '') }}</div>
            </div>
            <div class="space-y-2">
              <label class="text-[11px] text-slate-400">Amount {{ selectedPool?.denom_b || 'denom_b' }}</label>
              <input
                v-model="addAmountB"
                class="input"
                placeholder="amount_b"
                @input="lastEditedSide = 'B'; syncAddLiquidityRatio()"
              />
              <div class="text-[11px] text-slate-400">Balance: {{ atomicToDisplay(userBalances[selectedPool?.denom_b || ''], selectedPool?.denom_b || '') }}</div>
            </div>
            <button class="btn btn-primary w-full" :disabled="!selectedPool" @click="submitAdd">Add liquidity</button>
            <div class="text-[11px] text-slate-400">You own: {{ selectedLpBalanceDisplay }} LP</div>
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
              <div class="text-[11px] text-slate-400">Balance: {{ atomicToDisplay(userBalances[selectedPool?.lp_denom || `dex/${selectedPool?.id}`], selectedPool?.lp_denom || `dex/${selectedPool?.id}`) }}</div>
              <div class="text-[11px] text-slate-400" v-if="burnEstimate">Est. out (for this burn): {{ burnEstimate.a }} / {{ burnEstimate.b }}</div>
              <div class="text-[11px] text-slate-400">Underlying est: {{ selectedUnderlying.a }} / {{ selectedUnderlying.b }}</div>
            </div>
            <button class="btn w-full" :disabled="!selectedPool" @click="submitRemove">Remove liquidity</button>
            <div class="text-[11px] text-slate-400">Slippage protection: {{ slippageBps }} bps</div>
          </div>
        </div>
      </div>
      <div class="card bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-800/60 border border-white/10 shadow-xl shadow-cyan-500/10">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-white">Your liquidity</h2>
          <span class="text-xs text-slate-500">{{ address ? address : "Not connected" }}</span>
        </div>
        <div v-if="!address" class="text-sm text-slate-400">Connect wallet to view positions.</div>
        <div v-else-if="!lpPositions.length" class="text-sm text-slate-400">No LP balances found.</div>
        <div v-else class="space-y-3">
          <div v-for="pos in lpPositions" :key="pos.lp_denom" class="p-3 rounded-lg bg-white/5 border border-white/10">
            <div class="text-sm text-white font-semibold">Pool #{{ pos.pool.id }} — {{ pos.pool.denom_a }} / {{ pos.pool.denom_b }}</div>
            <div class="text-xs text-slate-400 mt-1">Shares: {{ atomicToDisplay(pos.shares, pos.lp_denom) }}</div>
            <div class="text-xs text-emerald-300 mt-1">~{{ pos.percent.toFixed(4) }}% of pool</div>
            <div class="text-[11px] text-slate-500">LP denom: {{ pos.lp_denom }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card overflow-hidden">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-lg font-semibold text-white">Liquidity pools</h2>
        <span class="text-xs text-slate-500" v-if="loading">Loading…</span>
      </div>
      <div v-if="!pools.length" class="text-sm text-slate-400">No pools reported by the DEX module yet.</div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div v-for="pool in pools" :key="pool.id" class="p-4 rounded-xl bg-white/5 border border-white/10 break-words">
          <div class="flex items-center justify-between text-sm text-white gap-2">
            <span class="font-semibold">Pool #{{ pool.id }}</span>
            <div class="flex items-center gap-2">
              <button class="text-xs text-emerald-300" @click="togglePoolChart(pool.id)">
                {{ poolChartsOpen[pool.id] ? 'Hide charts' : 'Show charts' }}
              </button>
              <span class="text-xs text-emerald-300 truncate" :title="pool.lp_denom || `dex/${pool.id}`">LP: {{ pool.lp_denom || `dex/${pool.id}` }}</span>
            </div>
          </div>
          <div class="mt-2 text-xs text-slate-300 break-words">{{ pool.denom_a }} / {{ pool.denom_b }}</div>
          <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
            <div>
              <div class="text-slate-500">Reserve A</div>
              <div class="font-mono text-slate-200">{{ fmtAmount(pool.reserve_a, pool.denom_a) }}</div>
            </div>
            <div>
              <div class="text-slate-500">Reserve B</div>
              <div class="font-mono text-slate-200">{{ fmtAmount(pool.reserve_b, pool.denom_b) }}</div>
            </div>
          </div>
          <div class="mt-3 text-xs text-emerald-300">Price: 1 {{ pool.denom_a }} ≈ {{ calculatePoolPrice(pool) }} {{ pool.denom_b }}</div>

          <div v-if="poolChartsOpen[pool.id]" class="mt-4 space-y-3 border-t border-white/10 pt-3">
            <div class="text-[11px] uppercase tracking-[0.15em] text-slate-400">Composition</div>
            <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div class="bg-emerald-400/70" :style="{ width: poolComposition(pool).aPct + '%' }"></div>
              <div class="bg-cyan-400/70" :style="{ width: poolComposition(pool).bPct + '%' }"></div>
            </div>
            <div class="flex justify-between text-[11px] text-slate-400">
              <span>{{ poolComposition(pool).aPct }}% {{ pool.denom_a }}</span>
              <span>{{ poolComposition(pool).bPct }}% {{ pool.denom_b }}</span>
            </div>

            <div class="text-[11px] uppercase tracking-[0.15em] text-slate-400">Impact preview (1% in {{ pool.denom_a }})</div>
            <div class="text-xs text-slate-200" v-if="poolImpactPreview(pool)">
              ~{{ poolImpactPreview(pool)?.in }} → {{ poolImpactPreview(pool)?.out }}
            </div>
            <div class="text-xs text-slate-500" v-else>Not enough depth to preview.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

