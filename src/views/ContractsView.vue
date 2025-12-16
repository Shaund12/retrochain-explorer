<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useContracts } from "@/composables/useContracts";

const { contracts, codes, loading, error, fetchContracts } = useContracts();

const search = ref("");
const codeFilter = ref("all");
const adminOnly = ref(false);

const copy = async (value: string) => {
  try {
    await navigator.clipboard?.writeText?.(value);
  } catch {}
};

const stats = computed(() => {
  const totalContracts = contracts.value.length;
  const totalCodes = codes.value.length;
  const managed = contracts.value.filter((c) => !!c.admin).length;
  const heights = contracts.value
    .map((c) => Number(c.createdHeight))
    .filter((n) => Number.isFinite(n) && n > 0);
  const latestHeight = heights.length ? Math.max(...heights) : null;

  return {
    totalContracts,
    totalCodes,
    managed,
    latestHeight
  };
});

const codeOptions = computed(() => {
  const unique = new Set<string>();
  contracts.value.forEach((c) => unique.add(c.codeId));
  return Array.from(unique).sort((a, b) => Number(b) - Number(a));
});

const filteredContracts = computed(() => {
  const term = search.value.trim().toLowerCase();
  let list = [...contracts.value];

  if (codeFilter.value !== "all") {
    list = list.filter((c) => c.codeId === codeFilter.value);
  }

  if (adminOnly.value) {
    list = list.filter((c) => c.admin);
  }

  if (term) {
    list = list.filter((c) => {
      return (
        c.label.toLowerCase().includes(term) ||
        c.address.toLowerCase().includes(term) ||
        c.creator.toLowerCase().includes(term)
      );
    });
  }

  return list.sort((a, b) => {
    const heightA = Number(a.createdHeight) || 0;
    const heightB = Number(b.createdHeight) || 0;
    if (heightA !== heightB) return heightB - heightA;
    return Number(b.codeId) - Number(a.codeId);
  });
});

const refresh = async () => {
  await fetchContracts();
};

const formatHeight = (value?: string) => {
  if (!value) return "";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toLocaleString();
};

onMounted(async () => {
  await fetchContracts();
});
</script>

<template>
  <div class="space-y-4">
    <header class="space-y-2">
      <p class="text-xs uppercase tracking-[0.35em] text-indigo-300">Contracts</p>
      <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        Smart Contracts Registry
      </h1>
      <p class="text-sm text-slate-400">
        Browse CosmWasm code IDs deployed on RetroChain and inspect the contracts that instantiate them.
      </p>
    </header>

    <RcDisclaimer type="info" title="Live CosmWasm deployments">
      <p>
        This view queries the chain's <code class="text-xs">/cosmwasm/wasm/v1</code> endpoints in real-time. Only the most recent code IDs
        and their first few contracts are shown to keep requests efficient. Use filters below to zero in on a specific label, address, or
        code ID.
      </p>
    </RcDisclaimer>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="card-soft border border-emerald-500/30 bg-emerald-500/5">
        <div class="text-[11px] uppercase tracking-wider text-emerald-200">Tracked Contracts</div>
        <div class="text-3xl font-semibold text-white">{{ stats.totalContracts }}</div>
        <p class="text-xs text-slate-400">Limited to the most recent records</p>
      </article>
      <article class="card-soft border border-indigo-500/30 bg-indigo-500/5">
        <div class="text-[11px] uppercase tracking-wider text-indigo-200">Code IDs Indexed</div>
        <div class="text-3xl font-semibold text-white">{{ stats.totalCodes }}</div>
        <p class="text-xs text-slate-400">Sorted by most recently uploaded</p>
      </article>
      <article class="card-soft border border-cyan-500/30 bg-cyan-500/5">
        <div class="text-[11px] uppercase tracking-wider text-cyan-200">Managed Contracts</div>
        <div class="text-3xl font-semibold text-white">{{ stats.managed }}</div>
        <p class="text-xs text-slate-400">Have on-chain admin privileges</p>
      </article>
      <article class="card-soft border border-amber-500/30 bg-amber-500/5">
        <div class="text-[11px] uppercase tracking-wider text-amber-200">Latest Height</div>
        <div class="text-3xl font-semibold text-white">{{ stats.latestHeight ? stats.latestHeight.toLocaleString() : "" }}</div>
        <p class="text-xs text-slate-400">Block height of newest instantiation</p>
      </article>
    </div>

    <section class="card">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 class="text-base font-semibold text-slate-100">Deployed Contracts</h2>
          <p class="text-xs text-slate-500">Filter by label, address, admin, or code ID</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn text-xs" :disabled="loading" @click="refresh">
            {{ loading ? "Refreshing" : "Refresh" }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 mb-4">
        <input
          v-model="search"
          type="text"
          placeholder="Search label, address, or creator"
          class="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          v-model="codeFilter"
          class="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="all">All code IDs</option>
          <option v-for="code in codeOptions" :key="code" :value="code">Code {{ code }}</option>
        </select>
        <label class="inline-flex items-center gap-2 text-xs text-slate-300">
          <input
            v-model="adminOnly"
            type="checkbox"
            class="w-4 h-4 rounded border-slate-600 bg-slate-900/80 text-emerald-400 focus:ring-emerald-400"
          />
          Only contracts with admin
        </label>
      </div>

      <div v-if="error" class="mb-3 text-xs text-rose-300">
        {{ error }}
      </div>

      <div v-if="loading" class="text-xs text-slate-400">Loading contracts</div>
      <div v-else-if="filteredContracts.length === 0" class="text-xs text-slate-400">
        No contracts match the current filters.
      </div>
      <div v-else class="overflow-auto">
        <table class="table min-w-full">
          <thead>
            <tr class="text-slate-300 text-xs">
              <th class="text-left">Label &amp; Address</th>
              <th class="text-left">Code ID</th>
              <th class="text-left">Creator</th>
              <th class="text-left">Admin</th>
              <th class="text-left">Block</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="contract in filteredContracts" :key="contract.address" class="text-xs text-slate-200">
              <td class="py-3">
                <div class="font-semibold text-sm text-white">{{ contract.label }}</div>
                <div class="font-mono text-[11px] text-slate-400 flex items-center gap-2">
                  <span class="truncate max-w-[220px] md:max-w-[320px]">{{ contract.address }}</span>
                  <button class="btn text-[10px]" @click="copy(contract.address)">Copy</button>
                </div>
              </td>
              <td class="py-3">
                <span class="badge border-indigo-400/60 text-indigo-200">{{ contract.codeId }}</span>
              </td>
              <td class="py-3">
                <div class="font-mono text-[11px] text-slate-300 flex items-center gap-2">
                  <span class="truncate max-w-[200px] md:max-w-[280px]">{{ contract.creator }}</span>
                  <button class="btn text-[10px]" @click="copy(contract.creator)">Copy</button>
                </div>
              </td>
              <td class="py-3">
                <div v-if="contract.admin" class="font-mono text-[11px] text-slate-300 flex items-center gap-2">
                  <span class="truncate max-w-[200px] md:max-w-[260px]">{{ contract.admin }}</span>
                  <button class="btn text-[10px]" @click="copy(contract.admin)">Copy</button>
                </div>
                <span v-else class="text-slate-500"></span>
              </td>
              <td class="py-3">
                <div class="text-slate-100">{{ formatHeight(contract.createdHeight) }}</div>
                <div v-if="contract.createdTxIndex" class="text-[10px] text-slate-500">tx #{{ contract.createdTxIndex }}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
