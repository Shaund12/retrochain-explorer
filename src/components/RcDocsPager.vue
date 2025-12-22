<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DOCS_NAV } from "@/constants/docsNav";

const router = useRouter();
const route = useRoute();

const idx = computed(() => DOCS_NAV.findIndex((x) => x.name === route.name));
const prev = computed(() => (idx.value > 0 ? DOCS_NAV[idx.value - 1] : null));
const next = computed(() => (idx.value >= 0 && idx.value < DOCS_NAV.length - 1 ? DOCS_NAV[idx.value + 1] : null));

const go = (name: string) => router.push({ name });
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <button
      v-if="prev"
      type="button"
      class="card-soft text-left border border-white/5 bg-slate-900/60 hover:border-emerald-400/40 transition"
      @click="go(prev.name)"
    >
      <div class="text-[11px] text-slate-500">Previous</div>
      <div class="text-sm font-semibold text-white mt-1">? {{ prev.title }}</div>
    </button>
    <div v-else></div>

    <button
      v-if="next"
      type="button"
      class="card-soft text-left border border-white/5 bg-slate-900/60 hover:border-emerald-400/40 transition"
      @click="go(next.name)"
    >
      <div class="text-[11px] text-slate-500">Next</div>
      <div class="text-sm font-semibold text-white mt-1">{{ next.title }} ?</div>
    </button>
  </div>
</template>
