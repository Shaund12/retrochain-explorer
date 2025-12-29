<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useContracts } from "@/composables/useContracts";

const router = useRouter();
const { address } = useKeplr();
const { smartQueryContract } = useContracts();

const contractAddress = ref<string>(import.meta.env.VITE_BATTLEPOINTS_CONTRACT || "");
const cw20Address = ref<string>(import.meta.env.VITE_BATTLEPOINTS_CW20 || "");
const cw721Address = ref<string>(import.meta.env.VITE_BATTLEPOINTS_CW721 || "");

const loading = ref(false);
const error = ref<string | null>(null);
const points = ref<number | null>(null);

const hasWallet = computed(() => Boolean(address.value));

const hasContract = computed(() => Boolean(contractAddress.value.trim()));

const load = async () => {
  error.value = null;
  points.value = null;

  const addr = contractAddress.value.trim();
  if (!addr) {
    error.value = "BattlePoints contract address is not configured. Set VITE_BATTLEPOINTS_CONTRACT.";
    return;
  }

  if (!address.value) {
    return;
  }

  loading.value = true;
  try {
    const res: any = await smartQueryContract(addr, { points: { player: address.value } });
    // support either { points: <u64> } or { total: <u64> }
    const val = (res?.points ?? res?.total ?? res?.value) as any;
    const n = Number(val);
    points.value = Number.isFinite(n) ? n : 0;
  } catch (e: any) {
    error.value = e?.message || "Failed to query battle points.";
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="text-sm uppercase tracking-[0.2em] text-indigo-200">Battle Points</div>
        <h1 class="text-2xl font-bold text-white mt-1">Points + NFT Store</h1>
        <p class="text-sm text-slate-300 mt-1">View your points and browse store items.</p>
      </div>
      <div class="flex gap-2 flex-wrap justify-end">
        <button class="btn text-xs" @click="router.push({ name: 'arcade' })">← Back to Arcade</button>
        <button class="btn btn-primary text-xs" :disabled="loading" @click="load">{{ loading ? 'Loading…' : 'Refresh' }}</button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="card border border-emerald-500/40 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">My Battle Points</div>
        <div class="text-3xl font-extrabold text-white mt-1">
          <span v-if="!hasWallet" class="text-slate-400">Connect Keplr</span>
          <span v-else-if="loading" class="text-slate-300">…</span>
          <span v-else>{{ (points ?? 0).toLocaleString() }}</span>
        </div>
        <div class="text-xs text-slate-400 mt-1" v-if="contractAddress">
          Contract: <code class="font-mono">{{ contractAddress }}</code>
        </div>
      </div>

      <div class="card border border-indigo-500/40 bg-indigo-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Store</div>
        <div class="text-sm text-slate-200 mt-1">Coming soon: browse items and buy NFTs with points.</div>
        <div class="text-xs text-slate-400 mt-2">
          This page will query <code class="font-mono">ShopItems</code> and call <code class="font-mono">BuyNft</code> once the contract is deployed.
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-slate-100">Contracts</h2>
        <span class="text-[11px] text-slate-400">Configured via env vars</span>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">BattlePoints</div>
          <input
            v-model="contractAddress"
            type="text"
            class="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-xs font-mono"
            placeholder="VITE_BATTLEPOINTS_CONTRACT"
          />
          <div class="mt-2 text-[11px]" :class="hasContract ? 'text-emerald-200' : 'text-amber-200'">
            {{ hasContract ? 'Ready' : 'Missing address' }}
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">CW20 Battle Points</div>
          <input
            v-model="cw20Address"
            type="text"
            class="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-xs font-mono"
            placeholder="VITE_BATTLEPOINTS_CW20"
          />
          <div class="mt-2 text-[11px] text-slate-500">Minter: BattlePoints contract</div>
        </div>

        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">CW721 Collection</div>
          <input
            v-model="cw721Address"
            type="text"
            class="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-xs font-mono"
            placeholder="VITE_BATTLEPOINTS_CW721"
          />
          <div class="mt-2 text-[11px] text-slate-500">Minter: BattlePoints contract</div>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border border-rose-500/30 bg-rose-500/5 text-rose-200 text-sm">{{ error }}</div>
  </div>
</template>
