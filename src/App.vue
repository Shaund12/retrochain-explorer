<script setup lang="ts">
import { RouterView } from "vue-router";
import RcHeader from "@/components/RcHeader.vue";
import { useNetwork } from "@/composables/useNetwork";
import { useChainInfo } from "@/composables/useChainInfo";
import { computed, onMounted } from "vue";

const { current: network, restBase, rpcBase } = useNetwork();
const { info, refresh } = useChainInfo();

const isOnline = computed(() => !!info.value.latestBlockHeight);
const displayRpc = computed(() => rpcBase.value || import.meta.env.VITE_RPC_URL || '/rpc');
const displayRest = computed(() => restBase.value || import.meta.env.VITE_REST_API_URL || '/api');

onMounted(() => {
  refresh();
});
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <RcHeader />
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
                <img src="@/assets/RCICOIMAGE.png" alt="RetroChain" class="w-full h-full object-cover" />
              </div>
              <div>
                <div class="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  RetroChain
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
            </ul>
          </div>

          <!-- Community -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Community</h3>
            <ul class="space-y-2 text-sm mb-4">
              <li>
                <a href="https://discord.gg/cosmosnetwork" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Discord
                </a>
              </li>
              <li>
                <a href="https://twitter.com/cosmos" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Twitter
                </a>
              </li>
              <li>
                <a href="https://github.com/cosmos" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> GitHub
                </a>
              </li>
              <li>
                <a href="https://forum.cosmos.network" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Forum
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
