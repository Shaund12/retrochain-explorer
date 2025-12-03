<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useValidators } from "@/composables/useValidators";

const router = useRouter();
const { validators, loading, error, fetchValidators } = useValidators();

onMounted(() => {
  fetchValidators();
});

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
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-50">Validators</h1>
        <p class="text-sm text-slate-400 mt-1">
          Active validators securing the RetroChain network
        </p>
      </div>
      <button class="btn text-xs" @click="fetchValidators" :disabled="loading">
        {{ loading ? "Loading..." : "Refresh" }}
      </button>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && validators.length === 0" class="card">
      <p class="text-sm text-slate-400">Loading validators...</p>
    </div>

    <div v-else-if="validators.length > 0" class="card">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-sm font-semibold text-slate-100">
          {{ validators.length }} Active Validators
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <colgroup>
            <col style="width: 60px" />
            <col />
            <col style="width: 120px" />
            <col style="width: 180px" />
            <col style="width: 140px" />
            <col style="width: 100px" />
          </colgroup>
          <thead>
            <tr class="text-slate-300 text-xs">
              <th class="text-center">#</th>
              <th>Moniker</th>
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
            >
              <td class="text-center text-slate-400 font-mono text-xs py-2">
                {{ idx + 1 }}
              </td>
              <td class="py-2">
                <div class="flex flex-col">
                  <span class="font-medium text-slate-100 text-sm">
                    {{ v.description?.moniker || "Validator" }}
                  </span>
                  <div class="flex items-center gap-2 whitespace-nowrap">
                    <code class="text-[10px] text-slate-500 truncate max-w-[200px] inline-block">
                      {{ v.operatorAddress }}
                    </code>
                    <button class="btn text-[10px]" @click.stop="copy(v.operatorAddress)">Copy</button>
                  </div>
                </div>
              </td>
              <td class="py-2">
                <span
                  class="badge text-xs"
                  :class="getStatusBadge(v.status, v.jailed).class"
                >
                  {{ getStatusBadge(v.status, v.jailed).text }}
                </span>
              </td>
              <td class="text-right font-mono text-sm text-slate-200 py-2">
                {{ formatTokens(v.tokens) }}
              </td>
              <td class="text-right py-2">
                <div class="flex items-center justify-end gap-2">
                  <div class="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
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
              <td class="text-right text-sm text-slate-300 py-2">
                {{ (parseFloat(v.commission.commission_rates.rate) * 100).toFixed(1) }}%
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
