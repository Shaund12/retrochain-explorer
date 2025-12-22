<script setup lang="ts">
import { RouterView } from "vue-router";
import RcHeader from "@/components/RcHeader.vue";
import RcMaintenanceBanner from "@/components/RcMaintenanceBanner.vue";
import { useNetwork } from "@/composables/useNetwork";
import { useChainInfo } from "@/composables/useChainInfo";
import { computed, onMounted, ref } from "vue";

const { current: network, restBase, rpcBase } = useNetwork();
const { info, refresh } = useChainInfo();
const festiveMode = ref(false);

const isOnline = computed(() => !!info.value.latestBlockHeight);
const displayRpc = computed(() => rpcBase.value || import.meta.env.VITE_RPC_URL || '/rpc');
const displayRest = computed(() => restBase.value || import.meta.env.VITE_REST_API_URL || '/api');

const toggleFestive = () => {
  festiveMode.value = !festiveMode.value;
};

onMounted(() => {
  refresh();
});
</script>

<template>
<div class="min-h-screen flex flex-col" :class="{ 'festive-bg': festiveMode }">
  <div v-if="festiveMode" class="festive-snow" aria-hidden="true"></div>
  <div v-if="festiveMode" class="festive-lights" aria-hidden="true">
    <span v-for="n in 32" :key="n" class="bulb" :style="{ '--i': n }"></span>
  </div>
  <div v-if="festiveMode" class="festive-ornaments" aria-hidden="true">
    <span v-for="n in 12" :key="`orn-${n}`" class="ornament" :style="{ '--i': n }"></span>
  </div>
  <button
    class="fixed top-4 right-4 z-50 btn text-xs shadow-lg backdrop-blur"
    :class="festiveMode ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-indigo-400/60'"
    @click="toggleFestive"
  >
    {{ festiveMode ? '🎄 Festive On' : '🎄 Festive Off' }}
  </button>
  <RcMaintenanceBanner />
  <RcHeader />
  <RcMaintenanceBanner />
  <RcHeader :festive-mode="festiveMode" @toggle-festive="toggleFestive" />
  <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">
    <RouterView />
  </main>
    <footer class="border-t border-indigo-500/20 relative z-10 backdrop-blur-sm bg-[rgba(10,14,39,0.6)]">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <!-- Main Footer Content -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <!-- Brand Section -->
          <div class="col-span-1">
            <div class="flex items-center gap-3 mb-4">
              <div class="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
                <img src="@/assets/RCIcon.svg" alt="RetroChain" class="w-full h-full object-cover" />
              </div>
              <div>
                <div class="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                  <span v-if="festiveMode">🎀</span>
                  <span>RetroChain</span>
                  <span v-if="festiveMode">🎀</span>
                </div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider">
                  Arcade Explorer
                </div>
              </div>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              The most beautiful blockchain explorer for RetroChain. Built with Vue 3, TypeScript, and love for the Cosmos ecosystem.
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Explorer</h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a href="/" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Dashboard
                </a>
              </li>
              <li>
                <a href="/blocks" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Blocks
                </a>
              </li>
              <li>
                <a href="/txs" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Transactions
                </a>
              </li>
              <li>
                <a href="/validators" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Validators
                </a>
              </li>
              <li>
                <a href="/governance" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Governance
                </a>
              </li>
            </ul>
          </div>

          <!-- Resources -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Resources</h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a href="https://docs.cosmos.network" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Cosmos Docs
                </a>
              </li>
              <li>
                <a href="https://github.com/cosmos/cosmos-sdk" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Cosmos SDK
                </a>
              </li>
              <li>
                <a href="https://github.com/ignite/cli" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Ignite CLI
                </a>
              </li>
              <li>
                <a href="/api-test" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> API Test
                </a>
              </li>
              <li>
                <a href="/changelog" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Changelog
                </a>
              </li>
              <li>
                <a href="/legal" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>

          <!-- Community -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Community</h3>
            <ul class="space-y-2 text-sm mb-4">
              <li>
                <a href="https://discord.gg/h89FnjjnrD" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>💬</span> Discord
                </a>
              </li>
              <li>
                <a href="https://github.com/Shaund12/RetroChain" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>💻</span> GitHub
                </a>
              </li>
              <li>
                <a href="https://x.com/RetroChainInfo" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>🐦</span> Twitter / X
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/retrochaininfo/" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>📸</span> Instagram
                </a>
              </li>
              <li>
                <a href="mailto:retrochaininfo@gmail.com" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>✉️</span> Contact
                </a>
              </li>
            </ul>
            
            <!-- Network Status -->
            <div class="p-3 rounded-lg bg-gradient-to-br border" :class="isOnline ? 'from-emerald-500/10 to-cyan-500/10 border-emerald-500/20' : 'from-rose-500/10 to-orange-500/10 border-rose-500/20'">
              <div class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 rounded-full" :class="isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
                <span class="font-medium" :class="isOnline ? 'text-emerald-300' : 'text-rose-300'">
                  {{ isOnline ? 'Network Online' : 'Network Offline' }}
                </span>
              </div>
              <div class="text-[10px] text-slate-400 mt-1 space-y-0.5">
                <div>REST: {{ displayRest }}</div>
                <div>RPC: {{ displayRpc }}</div>
                <div v-if="isOnline" class="text-emerald-400">Block #{{ info.latestBlockHeight }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="pt-6 border-t border-indigo-500/20">
          <div class="flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="text-xs text-slate-500 text-center md:text-left">
              <div class="mb-1">
                Built with ❤️ for the Cosmos ecosystem
              </div>
              <div>
                (c) 2024 RetroChain Explorer - 
                <a href="https://github.com/cosmos/cosmos-sdk/blob/main/LICENSE" target="_blank" class="hover:text-indigo-400 transition-colors">
                  Apache 2.0 License
                </a>
                · <a href="mailto:retrochaininfo@gmail.com" class="hover:text-indigo-400 transition-colors">retrochaininfo@gmail.com</a>
              </div>
            </div>
            
            <!-- Tech Stack Badges -->
            <div class="flex items-center gap-2 flex-wrap justify-center">
              <span class="badge text-[10px]">Vue 3</span>
              <span class="badge text-[10px]">TypeScript</span>
              <span class="badge text-[10px]">Vite</span>
              <span class="badge text-[10px]">Cosmos SDK</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.festive-bg {
  background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.08), transparent 35%),
              radial-gradient(circle at 80% 10%, rgba(236, 72, 153, 0.08), transparent 35%),
              radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.08), transparent 40%),
              #060818;
}

.festive-snow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(2px 2px at 20% 30%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(2px 2px at 40% 70%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(3px 3px at 80% 40%, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(2px 2px at 60% 20%, rgba(255, 255, 255, 0.6), transparent);
  animation: snow 10s linear infinite;
  z-index: 5;
}

@keyframes snow {
  0% { transform: translateY(-10px); }
  100% { transform: translateY(20px); }
}

.festive-lights {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(32, 1fr);
  gap: 8px;
  padding: 6px 12px;
  z-index: 6;
  pointer-events: none;
}

.bulb {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f87171, #fcd34d, #34d399, #60a5fa);
  animation: twinkle 1.6s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.05s);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

@keyframes twinkle {
  0%, 100% { opacity: 0.6; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-1px); }
}

.festive-ornaments {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.ornament {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.7), transparent 45%),
              radial-gradient(circle at 70% 70%, rgba(0,0,0,0.15), transparent 55%),
              var(--color, #fbbf24);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
  animation: float 6s ease-in-out infinite;
  top: calc((var(--i) * 7%) + 4%);
  left: calc((var(--i) * 8%) % 90%);
  --color: hsl(calc(var(--i) * 30), 80%, 60%);
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
  50% { transform: translateY(-10px) scale(1.08); opacity: 1; }
}
</style>
