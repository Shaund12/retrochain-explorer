<script setup lang="ts">
import { computed, type StyleValue } from "vue";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const props = defineProps<{ id: string }>();

const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
  id: props.id
});

const style = computed<StyleValue>(() => ({
  transform: transform ? CSS.Transform.toString(transform) : undefined,
  transition: transition ?? undefined,
  opacity: isDragging ? 0.6 : 1
}));
</script>

<template>
  <div ref="setNodeRef" :style="style" v-bind="attributes">
    <slot :listeners="listeners" />
  </div>
</template>
