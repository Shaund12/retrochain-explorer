<script setup lang="ts">
import { computed } from "vue";

export interface NetworkStat {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: string;
}

const props = defineProps<{
  stats: NetworkStat[];
}>();
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div
      v-for="stat in stats"
      :key="stat.label"
      class="card hover:border-cyan-400/50 transition-all animate-fade-in"
    >
      <div class="flex items-start justify-between mb-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">
          {{ stat.label }}
        </div>
        <div v-if="stat.icon" class="text-xl">{{ stat.icon }}</div>
      </div>
      <div class="text-2xl font-bold text-slate-50 mb-1">
        {{ stat.value }}
      </div>
      <div v-if="stat.trend" class="flex items-center gap-1 text-xs">
        <span
          :class="{
            'text-emerald-400': stat.trend === 'up',
            'text-rose-400': stat.trend === 'down',
            'text-slate-400': stat.trend === 'neutral'
          }"
        >
          {{ stat.trend === "up" ? "?" : stat.trend === "down" ? "?" : "?" }}
          {{ stat.trendValue || "" }}
        </span>
      </div>
    </div>
  </div>
</template>
