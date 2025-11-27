<script setup lang="ts">
interface Props {
  label: string;
  value?: string | number;
  hint?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

defineProps<Props>();
</script>

<template>
  <div class="group card hover:scale-[1.02] transition-all duration-300 cursor-default">
    <div class="flex items-start justify-between mb-3">
      <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {{ label }}
      </div>
      <div v-if="icon" class="text-2xl opacity-50 group-hover:opacity-100 transition-opacity">
        {{ icon }}
      </div>
    </div>
    <div class="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
      <span v-if="value !== undefined">{{ value }}</span>
      <span v-else class="opacity-60 text-xl">—</span>
    </div>
    <div class="flex items-center gap-2 text-xs">
      <div v-if="hint" class="text-slate-500">{{ hint }}</div>
      <div v-if="trend" 
           :class="{
             'text-emerald-400': trend === 'up',
             'text-rose-400': trend === 'down',
             'text-slate-400': trend === 'neutral'
           }"
           class="flex items-center gap-1 font-medium">
        <span>{{ trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→' }}</span>
        <span v-if="trendValue">{{ trendValue }}</span>
      </div>
    </div>
  </div>
</template>
