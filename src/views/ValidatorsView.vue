<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useValidators } from "@/composables/useValidators";

const router = useRouter();
const { validators, loading, error, fetchValidators } = useValidators();

onMounted(() => {
  fetchValidators();
});

const totalVotingPower = computed(() =>
  validators.value.reduce((sum, v) => sum + (v.votingPower || 0), 0)
);

const totalVotingPowerDisplay = computed(() => {
  const retro = totalVotingPower.value / 1_000_000;
  if (!Number.isFinite(retro)) return "0 RETRO";
  return `${retro.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RETRO`;
});

const averageCommission = computed(() => {
  if (!validators.value.length) return 0;
  const total = validators.value.reduce((sum, v) => {
    const rate = parseFloat(v.commission?.commissionRates?.rate || "0");
    return sum + (Number.isFinite(rate) ? rate : 0);
  }, 0);
  return (total / validators.value.length) * 100;
});

const highestSelfDelegation = computed(() => {
  if (!validators.value.length) return 0;
  const max = Math.max(
    ...validators.value.map((v) => parseInt(v.minSelfDelegation || "0", 10) || 0)
  );
  return max / 1_000_000;
});

const topValidators = computed(() => validators.value.slice(0, 3));

const guardianBadges = [
  { icon: "🥇", title: "Guardian of Blocks" },
  { icon: "🥈", title: "Sentinel" },
  { icon: "🥉", title: "Protector" }
];

const formatPercent = (value: number, digits = 2) =>
  `${value.toFixed(digits)}%`;

const formatTokens = (tokens: string) => {
  const val = parseInt(tokens, 10);
  const retro = val / 1_000_000;
  return `${retro.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RETRO`;
};

const copy = async (text: string) => {
  try { await navigator.clipboard?.writeText?.(text); } catch {}
};

const getStatusBadge = (status: string, jailed: boolean) => {
  if (jailed) return { text: "Jailed", class: "border-rose-400/60 text-rose-200" };
  if (status === "BOND_STATUS_BONDED") return { text: "Active", class: "border-emerald-400/60 text-emerald-200" };
  if (status === "BOND_STATUS_UNBONDING") return { text: "Unbonding", class: "border-amber-400/60 text-amber-200" };
  return { text: "Inactive", class: "border-slate-400/60 text-slate-300" };
};

const shortAddress = (addr: string, size = 10) =>
  `${addr?.slice(0, size)}...${addr?.slice(-6)}`;
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-emerald-200">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Network Guardians
          </div>
          <h1 class="text-3xl font-bold text-slate-50 mt-2">
            Validators securing RetroChain
          </h1>
          <p class="text-sm text-slate-300 mt-2 max-w-2xl">
            These validators keep RetroChain unstoppable. Delegate to your favorites and help steer the network.
          </p>
        </div>
        <div class="flex flex-col items-end gap-2">
          <div class="text-right">
            <p class="text-[11px] uppercase tracking-widest text-slate-400">Active Validators</p>
            <p class="text-3xl font-black text-emerald-400">{{ validators.length || "0" }}</p>
          </div>
          <button class="btn text-xs" @click="fetchValidators" :disabled="loading">
            {{ loading ? "Refreshing..." : "Refresh List" }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="card border-emerald-500/20 bg-emerald-500/5">
        <p class="text-[11px] uppercase tracking-wider text-emerald-200">Total Staked</p>
        <p class="text-2xl font-bold text-emerald-300">{{ totalVotingPowerDisplay }}</p>
        <p class="text-xs text-emerald-100/70">Combined voting power securing the chain</p>
      </div>
      <div class="card border-indigo-500/20 bg-indigo-500/5">
        <p class="text-[11px] uppercase tracking-wider text-indigo-200">Average Commission</p>
        <p class="text-2xl font-bold text-indigo-300">{{ formatPercent(averageCommission || 0, 1) }}</p>
        <p class="text-xs text-indigo-100/70">Chain-wide validator fee</p>
      </div>
      <div class="card border-amber-500/20 bg-amber-500/5">
        <p class="text-[11px] uppercase tracking-wider text-amber-200">Highest Self Delegation</p>
        <p class="text-2xl font-bold text-amber-300">{{ highestSelfDelegation.toLocaleString(undefined, { maximumFractionDigits: 2 }) }} RETRO</p>
        <p class="text-xs text-amber-100/70">Skin-in-the-game from top validator</p>
      </div>
    </div>

    <div v-if="topValidators.length" class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-100">Top Guardians</h2>
        <span class="text-xs text-slate-400">Most voting power</span>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <div
          v-for="(validator, idx) in topValidators"
          :key="validator.operatorAddress"
          class="rounded-2xl border border-white/5 bg-gradient-to-br from-white/5 to-transparent p-4 shadow-lg"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="text-3xl">{{ guardianBadges[idx]?.icon }}</div>
            <span class="badge text-xs border-white/30 text-white/80">
              {{ getStatusBadge(validator.status, validator.jailed).text }}
            </span>
          </div>
          <h3 class="text-lg font-semibold text-slate-50">
            {{ validator.description?.moniker || "Validator" }}
          </h3>
          <p class="text-xs text-slate-400 line-clamp-2 min-h-[2.5rem]">
            {{ validator.description?.details || "Guardian of RetroChain." }}
          </p>
          <div class="mt-3 text-xs text-slate-300 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Voting Power</span>
              <span class="font-mono">{{ formatTokens(validator.tokens) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Share</span>
              <span>{{ validator.votingPowerPercent.toFixed(2) }}%</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Commission</span>
              <span>{{ (parseFloat(validator.commission?.commissionRates?.rate || "0") * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && validators.length === 0" class="card">
      <p class="text-sm text-slate-400">Loading validators...</p>
    </div>

    <div v-else-if="validators.length > 0" class="card">
      <div class="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-xs text-slate-400">{{ validators.length }} validators secured in this epoch</p>
          <h2 class="text-lg font-semibold text-slate-100">Validator Roster</h2>
        </div>
        <div class="text-xs text-slate-400">Tap any row for details</div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <colgroup>
            <col style="width: 70px" />
            <col />
            <col style="width: 120px" />
            <col style="width: 160px" />
            <col style="width: 140px" />
            <col style="width: 110px" />
          </colgroup>
          <thead>
            <tr class="text-slate-300 text-xs">
              <th class="text-left">Rank</th>
              <th>Validator</th>
              <th>Status</th>
              <th class="text-right">Voting Power</th>
              <th class="text-right">Share</th>
              <th class="text-right">Commission</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(v, idx) in validators"
              :key="v.operatorAddress"
              class="cursor-pointer hover:bg-white/5 transition-colors"
              @click="router.push({ name: 'account', params: { address: v.operatorAddress } })"
            >
              <td class="text-left text-slate-400 font-mono text-xs py-3">
                <div class="flex items-center gap-2">
                  <span>{{ idx + 1 }}</span>
                  <span v-if="idx < 3" class="text-base">{{ guardianBadges[idx]?.icon }}</span>
                </div>
              </td>
              <td class="py-3">
                <div class="flex flex-col gap-1">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-slate-100 text-sm">{{ v.description?.moniker || "Validator" }}</span>
                    <button class="btn text-[10px]" @click.stop="copy(v.operatorAddress)">Copy</button>
                  </div>
                  <div class="text-[11px] text-slate-500 font-mono">{{ shortAddress(v.operatorAddress) }}</div>
                  <div v-if="v.description?.website" class="text-[11px] text-cyan-300 truncate">
                    <a :href="v.description.website" target="_blank" rel="noopener" @click.stop>
                      {{ v.description.website }}
                    </a>
                  </div>
                </div>
              </td>
              <td class="py-3">
                <span
                  class="badge text-xs"
                  :class="getStatusBadge(v.status, v.jailed).class"
                >
                  {{ getStatusBadge(v.status, v.jailed).text }}
                </span>
              </td>
              <td class="text-right font-mono text-sm text-slate-200 py-3">
                {{ formatTokens(v.tokens) }}
              </td>
              <td class="text-right py-3">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
                      :style="{ width: `${Math.min(v.votingPowerPercent, 100)}%` }"
                    ></div>
                  </div>
                  <span class="text-slate-300 text-xs">
                    {{ v.votingPowerPercent.toFixed(2) }}%
                  </span>
                </div>
              </td>
              <td class="text-right text-sm text-slate-300 py-3">
                {{ (parseFloat(v.commission?.commissionRates?.rate || "0") * 100).toFixed(1) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-else class="card">
      <p class="text-sm text-slate-400">No validators found</p>
    </div>
  </div>
</template>
