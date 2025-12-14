<script setup lang="ts">
import { computed } from "vue";

interface Props {
  type?: "info" | "warning" | "danger";
  title?: string;
  dismissible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: "warning",
  title: "Important Notice",
  dismissible: false
});

const emit = defineEmits<{
  dismiss: [];
}>();

const colorClasses = computed(() => {
  switch (props.type) {
    case "info":
      return {
        container: "from-blue-500/10 to-indigo-500/10 border-blue-500/30",
        icon: "ℹ️",
        title: "text-blue-300",
        text: "text-blue-200/80"
      };
    case "danger":
      return {
        container: "from-rose-500/10 to-red-500/10 border-rose-500/30",
        icon: "🚨",
        title: "text-rose-300",
        text: "text-rose-200/80"
      };
    default: // warning
      return {
        container: "from-amber-500/10 to-orange-500/10 border-amber-500/30",
        icon: "⚠️",
        title: "text-amber-300",
        text: "text-amber-200/80"
      };
  }
});
</script>

<template>
  <div 
    class="p-4 rounded-lg border backdrop-blur-sm relative overflow-hidden animate-fade-in"
    :class="`bg-gradient-to-br ${colorClasses.container}`"
  >
    <!-- Animated background pattern -->
    <div class="absolute inset-0 opacity-5">
      <div class="absolute w-32 h-32 -top-4 -left-4 rounded-full blur-2xl animate-pulse" 
           :class="type === 'danger' ? 'bg-rose-500' : type === 'info' ? 'bg-blue-500' : 'bg-amber-500'">
      </div>
      <div class="absolute w-32 h-32 -bottom-4 -right-4 rounded-full blur-2xl animate-pulse" 
           style="animation-delay: 1s"
           :class="type === 'danger' ? 'bg-red-500' : type === 'info' ? 'bg-indigo-500' : 'bg-orange-500'">
      </div>
    </div>

    <div class="relative flex items-start gap-3">
      <div class="text-3xl flex-shrink-0 animate-pulse">{{ colorClasses.icon }}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-semibold" :class="colorClasses.title">{{ title }}</h3>
          <button 
            v-if="dismissible"
            @click="emit('dismiss')"
            class="text-slate-400 hover:text-slate-200 transition-colors ml-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="text-xs leading-relaxed space-y-2" :class="colorClasses.text">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
</style>
