<script setup lang="ts">
type Props = {
  label?: string;
};

defineProps<Props>();
</script>

<template>
  <div class="sticky top-0 z-10 bg-slate-950/70 backdrop-blur border-b border-slate-800">
    <div class="flex items-center justify-between px-3 py-2">
      <div class="text-[11px] uppercase tracking-[0.2em] text-slate-400">
        {{ label || "" }}
      </div>
      <div class="flex items-center gap-2">
        <slot />
      </div>
    </div>
  </div>
</template>
