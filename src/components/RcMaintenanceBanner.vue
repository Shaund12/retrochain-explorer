<script setup lang="ts">
import { useMaintenance } from '@/composables/useMaintenance';

const { isMaintenanceMode, message, details, eta, features } = useMaintenance();
</script>

<template>
  <div 
    v-if="isMaintenanceMode" 
    class="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-xl"
  >
    <div class="max-w-7xl mx-auto px-4 py-4">
      <div class="flex items-start gap-4">
        <!-- Icon -->
        <div class="text-3xl animate-pulse">⚠️</div>
        
        <!-- Content -->
        <div class="flex-1">
          <div class="text-lg font-bold mb-1">{{ message }}</div>
          <div class="text-sm opacity-90 mb-2">{{ details }}</div>
          <div v-if="features.length" class="text-xs text-white/90 bg-white/10 rounded-lg p-3 mb-2 border border-white/20">
            <div class="uppercase text-[10px] tracking-[0.3em] text-white/70 mb-1">Upgrade Includes</div>
            <ul class="space-y-1 list-disc list-inside">
              <li v-for="item in features" :key="item">{{ item }}</li>
            </ul>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <span class="px-2 py-1 rounded bg-white/20 font-mono">{{ eta }}</span>
            <span class="opacity-75">• Some features may be temporarily unavailable</span>
          </div>
        </div>

        <!-- Pulse Animation -->
        <div class="hidden sm:flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-white animate-pulse"></div>
          <div class="w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0.2s"></div>
          <div class="w-2 h-2 rounded-full bg-white animate-pulse" style="animation-delay: 0.4s"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Spacer to push content down when banner is visible -->
  <div v-if="isMaintenanceMode" class="h-24"></div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
