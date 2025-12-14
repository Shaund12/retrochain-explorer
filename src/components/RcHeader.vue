<template>
  <header class="border-b border-white/5 backdrop-blur-xl bg-[rgba(10,14,39,0.95)] sticky top-0 z-50 shadow-lg shadow-black/20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Logo -->
      <button
        class="flex items-center gap-3 group transition-all"
        @click="router.push({ name: 'home' })"
      >
        <img
          src="/RCICOIMAGE.png"
          alt="RetroChain"
          class="h-10 w-10 rounded-lg shadow-lg shadow-indigo-500/40 group-hover:shadow-indigo-500/70 group-hover:scale-105 transition-all object-contain"
        />
        <div class="flex items-center gap-2">
          <div class="font-bold text-base bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            RetroChain
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-400/60 text-emerald-300 bg-emerald-500/10">
            MAINNET
          </span>
        </div>
      </button>

      <!-- Navigation -->
      <nav class="hidden lg:flex items-center">
        <a
          v-for="item in navItems"
          :key="item.label"
          @click.prevent="router.push(item.to)"
          class="px-4 h-16 flex items-center text-sm font-medium transition-colors cursor-pointer relative"
          :class="
            isActive(item.to).value
              ? 'text-white'
              : 'text-slate-400 hover:text-white'
          "
        >
          {{ item.label }}
          <div
            v-if="isActive(item.to).value"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          ></div>
        </a>
      </nav>

      <!-- Wallet Connection -->
      <div class="flex items-center gap-3">
        <button
          v-if="!address"
          class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all"
          :disabled="!isAvailable || connecting"
          @click="connect"
        >
          <span v-if="connecting">Connecting...</span>
          <span v-else-if="isAvailable">Connect Wallet</span>
          <span v-else>Install Keplr</span>
        </button>

        <button
          v-else
          class="flex items-center gap-3 px-3 sm:px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-white/10 hover:border-emerald-300/40 hover:from-emerald-500/20 hover:to-cyan-500/20 text-white transition-all shadow-lg shadow-emerald-500/10"
          @click="disconnect"
        >
          <div class="hidden sm:flex flex-col text-left">
            <span class="text-[10px] uppercase tracking-[0.25em] text-emerald-200/80">RETRO Balance</span>
            <span class="text-sm font-semibold text-white">
              <span v-if="accountLoading">Syncing…</span>
              <span v-else>{{ walletBalance }}</span>
            </span>
          </div>
          <div class="sm:hidden text-[11px] font-semibold text-emerald-200">
            <span v-if="accountLoading">Syncing…</span>
            <span v-else>{{ walletBalance }}</span>
          </div>
          <div class="hidden sm:block h-8 w-px bg-white/10"></div>
          <div class="text-left">
            <p class="font-mono text-xs">{{ shortAddress }}</p>
            <p class="text-[10px] text-emerald-300 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Disconnect
            </p>
          </div>
        </button>

        <!-- Mobile menu button -->
        <button
          class="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div
      v-if="mobileMenuOpen"
      class="lg:hidden border-t border-white/5 bg-[rgba(10,14,39,0.98)]"
    >
      <nav class="max-w-7xl mx-auto px-4 py-3 flex flex-col">
        <a
          v-for="item in navItems"
          :key="item.label"
          @click.prevent="router.push(item.to); mobileMenuOpen = false"
          class="px-4 py-3 text-sm font-medium transition-all cursor-pointer rounded-lg"
          :class="
            isActive(item.to).value
              ? 'text-white bg-white/5'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          "
        >
          {{ item.label }}
        </a>
        <div class="mt-3 px-4">
          <RcAddKeplrButton class="w-full inline-flex justify-center" />
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useAccount } from "@/composables/useAccount";
import { useNetwork } from "@/composables/useNetwork";
import { formatAmount } from "@/utils/format";
import RcAddKeplrButton from "@/components/RcAddKeplrButton.vue";

const route = useRoute();
const router = useRouter();
const { isAvailable, address, connecting, connect, disconnect } = useKeplr();
const mobileMenuOpen = ref(false);
const { balances, loading: accountLoading, load } = useAccount();
const { current: network } = useNetwork();

watch(
  address,
  (addr) => {
    if (addr) {
      load(addr);
    } else {
      balances.value = [];
    }
  },
  { immediate: true }
);

const walletDenom = computed(() => (network.value === "mainnet" ? "uretro" : "udretro"));

const walletBalance = computed(() => {
  const denom = walletDenom.value;
  const entry = balances.value.find((b) => b.denom === denom);
  if (!entry) return "0.00 RETRO";
  return formatAmount(entry.amount, denom, { minDecimals: 2, maxDecimals: 2, showZerosForIntegers: false });
});

const navItems = [
  { label: "Overview", to: { name: "home" } },
  { label: "Blocks", to: { name: "blocks" } },
  { label: "Transactions", to: { name: "txs" } },
  { label: "Accounts", to: { name: "accounts" } },
  { label: "Validators", to: { name: "validators" } },
  { label: "Staking", to: { name: "staking" } },
  { label: "DEX", to: { name: "dex" } },
  { label: "Tokenomics", to: { name: "tokenomics" } },
  { label: "Buy", to: { name: "buy" } },
  { label: "Governance", to: { name: "governance" } },
  { label: "Account", to: { name: "account" } }
];

const isActive = (to: any) =>
  computed(() => route.name === to.name);

const shortAddress = computed(() => {
  if (!address.value) return "";
  return `${address.value.slice(0, 8)}...${address.value.slice(-4)}`;
});
</script>
