<script setup lang="ts">
import { computed, useAttrs } from "vue";

type Props = {
  variant?: "default" | "primary";
  size?: "xs" | "sm";
};

const props = withDefaults(defineProps<Props>(), {
  variant: "default",
  size: "xs"
});

const attrs = useAttrs();

const className = computed(() => {
  const base = "btn inline-flex items-center justify-center";
  const size = props.size === "sm" ? "text-xs" : "text-[10px]";
  const variant = props.variant === "primary" ? "btn-primary" : "";
  const extra = typeof attrs.class === "string" ? attrs.class : "";
  return [base, size, variant, extra].filter(Boolean).join(" ");
});
</script>

<template>
  <button v-bind="$attrs" :class="className" type="button">
    <span class="inline-flex items-center gap-1">
      <slot />
    </span>
  </button>
</template>
