<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const props = withDefaults(
  defineProps<{
    label?: string;
    fallbackTo?: { name: string };
  }>(),
  {
    label: "Back to Docs",
    fallbackTo: () => ({ name: "docs" })
  }
);

const router = useRouter();
const route = useRoute();

const canGoBack = computed(() => {
  if (typeof window === "undefined") return false;
  // If user refreshed on a docs page, history might still exist but be irrelevant.
  // Keep it simple: require at least 2 entries.
  return window.history.length > 1;
});

const back = async () => {
  if (canGoBack.value) {
    router.back();
    return;
  }
  await router.push(props.fallbackTo);
};

const ariaLabel = computed(() => props.label || `Back from ${String(route.name || "page")}`);
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white transition"
    @click="back"
    :aria-label="ariaLabel"
  >
    <span class="font-mono">?</span>
    <span>{{ label }}</span>
  </button>
</template>
