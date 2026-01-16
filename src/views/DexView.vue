<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useDexV3, type DexV3Pool } from "@/composables/useDexV3";
import { useKeplr } from "@/composables/useKeplr";
import { formatAmount, getDenomMeta } from "@/utils/format";

const { address } = useKeplr();
const route = useRoute();
const router = useRouter();
const {
  pools,
  params,
  positions,
  poolDetail,
  loading,
  fetchPools,
  fetchParams,
  fetchPositions,
  fetchPoolDetail
} = useDexV3();

const selectedPoolId = ref<string>("");
const activeTab = ref<"pools" | "positions">("pools");

const displayDenom = (denom?: string) => (denom ? getDenomMeta(denom).display : "—");

const fmtAmount = (amount: string | number | null | undefined, denom: string) => {
  if (amount === null || amount === undefined) return "-";
  return formatAmount(String(amount), denom, { minDecimals: 0, maxDecimals: 6, showZerosForIntegers: false });
};

const pickFirstPool = (ps: DexV3Pool[]) => {
  if (ps.length && !selectedPoolId.value) {
    selectedPoolId.value = ps[0].id;
  }
};

const selectedPool = computed(() => poolDetail.value || pools.value.find((p) => p.id === selectedPoolId.value) || null);

const selectPool = async (id: string) => {
  selectedPoolId.value = id;
  await fetchPoolDetail(id);
};

// honor ?pool=<id> in query
const syncPoolFromRoute = () => {
  const qp = route.query.pool as string | undefined;
  if (qp) {
    selectedPoolId.value = qp;
    fetchPoolDetail(qp);
  }
};

onMounted(async () => {
  await Promise.all([fetchPools(), fetchParams()]);
  pickFirstPool(pools.value);
  syncPoolFromRoute();
  if (selectedPoolId.value) await fetchPoolDetail(selectedPoolId.value);
  if (address.value) await fetchPositions(address.value);
});

watch(address, async (addr) => {
  if (addr) {
    await fetchPositions(addr);
  }
});

watch(pools, (ps) => {
  pickFirstPool(ps);
  if (selectedPoolId.value) fetchPoolDetail(selectedPoolId.value);
});

</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl sm:text-3xl font-bold text-white">Retro DEX v3</h1>
      <p class="text-slate-300">Powered by on-chain x/dexv3 module. View pools and your concentrated positions.</p>
    </div>

    <RcDisclaimer />

    <div class="grid gap-3 sm:grid-cols-3">
      <div class="card-soft border border-emerald-400/30 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-[0.2em] text-emerald-200">Pools</div>
        <div class="text-2xl font-bold text-white">{{ pools.length }}</div>
        <div class="text-[11px] text-emerald-100">dexv3 pools</div>
      </div>
      <div class="card-soft border border-indigo-400/30 bg-indigo-500/10">
        <div class="text-[11px] uppercase tracking-[0.2em] text-indigo-200">Module</div>
        <div class="text-2xl font-bold text-white">{{ params ? 'Enabled' : 'Unknown' }}</div>
        <div class="text-[11px] text-indigo-100">Query /retrochain/dexv3/v1</div>
      </div>
      <div class="card-soft border border-cyan-400/30 bg-cyan-500/10">
        <div class="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Fee param</div>
        <div class="text-2xl font-bold text-white">{{ params?.swap_fee_bps ?? params?.fee_bps ?? '—' }} bps</div>
        <div class="text-[11px] text-cyan-100">From params</div>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button
        class="btn-secondary px-3 py-2"
        :class="activeTab === 'pools' ? 'ring-2 ring-emerald-400/60 text-emerald-200' : ''"
        @click="activeTab = 'pools'"
      >
        Pools
      </button>
      <button
        class="btn-secondary px-3 py-2"
        :class="activeTab === 'positions' ? 'ring-2 ring-indigo-400/60 text-indigo-200' : ''"
        @click="activeTab = 'positions'"
      >
        My positions
      </button>
    </div>

    <div v-if="activeTab === 'pools'" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 card bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-800/60 border border-white/10">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-lg font-semibold text-white">Pools</h2>
            <p class="text-xs text-slate-400">Tick-based liquidity pools from dexv3</p>
          </div>
          <span class="text-xs text-slate-500" v-if="loading">Loading…</span>
        </div>
        <div v-if="!pools.length" class="text-sm text-slate-400">No pools yet.</div>
        <div v-else class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <button
            v-for="p in pools"
            :key="p.id"
            class="p-3 rounded-xl border border-white/10 bg-white/5 text-left hover:border-emerald-400/40 transition"
            :class="p.id === selectedPoolId ? 'border-emerald-400/60' : ''"
            @click="selectPool(p.id)">
            <div class="text-sm font-semibold text-white">Pool #{{ p.id }}</div>
            <div class="text-xs text-slate-400">{{ displayDenom(p.denom0) }} / {{ displayDenom(p.denom1) }}</div>
            <div class="text-[11px] text-slate-300 mt-2">Fee: {{ p.fee_bps }} bps</div>
            <div class="text-[11px] text-slate-300">Tick spacing: {{ p.tick_spacing }}</div>
            <div class="text-[11px] text-slate-500">Current tick: {{ p.current_tick ?? '—' }}</div>
          </button>
        </div>
      </div>

      <div class="card bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-800/60 border border-white/10" v-if="selectedPool">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold text-white">Pool #{{ selectedPool.id }}</h3>
          <span class="badge text-[11px]">{{ displayDenom(selectedPool.denom0) }} / {{ displayDenom(selectedPool.denom1) }}</span>
        </div>
        <div class="space-y-2 text-sm text-slate-200">
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Fee</span>
            <span class="text-slate-200">{{ selectedPool.fee_bps }} bps</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Tick spacing</span>
            <span class="text-slate-200">{{ selectedPool.tick_spacing }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Current tick</span>
            <span class="text-slate-200">{{ selectedPool.current_tick ?? '—' }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Reserve {{ displayDenom(selectedPool.denom0) }}</span>
            <span class="text-slate-200">{{ fmtAmount(selectedPool.reserve0 || '0', selectedPool.denom0) }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Reserve {{ displayDenom(selectedPool.denom1) }}</span>
            <span class="text-slate-200">{{ fmtAmount(selectedPool.reserve1 || '0', selectedPool.denom1) }}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Liquidity</span>
            <span class="text-slate-200">{{ selectedPool.liquidity || '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-800/60 border border-white/10">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h2 class="text-lg font-semibold text-white">My positions</h2>
          <p class="text-xs text-slate-400">Positions filtered by owner via dexv3</p>
        </div>
        <span class="text-[11px] text-slate-500">{{ address || 'Not connected' }}</span>
      </div>
      <div v-if="!address" class="text-sm text-slate-400">Connect wallet to load positions.</div>
      <div v-else-if="!positions.length" class="text-sm text-slate-400">No positions found.</div>
      <div v-else class="space-y-2">
        <div v-for="pos in positions" :key="pos.id" class="p-3 rounded-lg bg-white/5 border border-white/10">
          <div class="flex items-center justify-between text-sm text-white">
            <div>Position #{{ pos.id }}</div>
            <div class="text-xs text-slate-400">Pool #{{ pos.pool_id }}</div>
          </div>
          <div class="text-[11px] text-slate-400 mt-1">Range: {{ pos.lower_tick }} → {{ pos.upper_tick }}</div>
          <div class="text-[11px] text-slate-400">Liquidity: {{ pos.liquidity }}</div>
          <div class="text-[11px] text-slate-400">Fees owed: {{ pos.fees_owed0 }} / {{ pos.fees_owed1 }}</div>
          <div class="text-[11px] text-slate-400">NFT: {{ pos.nft_class_id }} / {{ pos.nft_id }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

