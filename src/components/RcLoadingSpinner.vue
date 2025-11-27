<script setup lang="ts">
defineProps<{
  size?: "sm" | "md" | "lg";
  text?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 py-8">
    <div
      class="spinner"
      :class="{
        'spinner-sm': size === 'sm',
        'spinner-md': !size || size === 'md',
        'spinner-lg': size === 'lg'
      }"
    >
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
      <div class="spinner-ring"></div>
    </div>
    <p v-if="text" class="text-sm text-slate-400">{{ text }}</p>
  </div>
</template>

<style scoped>
.spinner {
  position: relative;
  display: inline-block;
}

.spinner-sm {
  width: 24px;
  height: 24px;
}

.spinner-md {
  width: 40px;
  height: 40px;
}

.spinner-lg {
  width: 60px;
  height: 60px;
}

.spinner-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: #22c55e;
  animation: spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.spinner-sm .spinner-ring {
  width: 24px;
  height: 24px;
}

.spinner-md .spinner-ring {
  width: 40px;
  height: 40px;
}

.spinner-lg .spinner-ring {
  width: 60px;
  height: 60px;
}

.spinner-ring:nth-child(1) {
  animation-delay: -0.45s;
  border-top-color: #22c55e;
}

.spinner-ring:nth-child(2) {
  animation-delay: -0.3s;
  border-top-color: #06b6d4;
}

.spinner-ring:nth-child(3) {
  animation-delay: -0.15s;
  border-top-color: #6366f1;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>

