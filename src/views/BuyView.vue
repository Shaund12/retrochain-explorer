<script setup lang="ts">
import { ref, computed } from "vue";
import { useNetwork } from "@/composables/useNetwork";
import { useKeplr } from "@/composables/useKeplr";

const { current: network } = useNetwork();
const { address, connect, isAvailable } = useKeplr();

const selectedMethod = ref<'dex' | 'cex' | 'bridge' | 'fiat'>('dex');

const dexOptions = [
  {
    name: "Osmosis",
    icon: "??",
    url: "https://app.osmosis.zone",
    description: "Swap IBC assets for RETRO on Osmosis DEX"
  },
  {
    name: "Crescent",
    icon: "??",
    url: "https://app.crescent.network",
    description: "Trade RETRO on Crescent Network"
  }
];

const cexOptions = [
  {
    name: "Coming Soon",
    icon: "??",
    url: "#",
    description: "RETRO will be listed on CEXes soon"
  }
];

const bridgeOptions = [
  {
    name: "IBC Transfer",
    icon: "??",
    description: "Transfer tokens via IBC from other Cosmos chains",
    action: "Open IBC"
  }
];

const fiatOptions = [
  {
    name: "Transak",
    icon: "??",
    url: "https://global.transak.com",
    description: "Buy crypto with credit card or bank transfer"
  },
  {
    name: "Kado",
    icon: "??",
    url: "https://app.kado.money",
    description: "On/off ramp for 40+ countries"
  }
];

const tokenInfo = computed(() => ({
  symbol: network.value === 'mainnet' ? 'RETRO' : 'DRETRO',
  denom: network.value === 'mainnet' ? 'uretro' : 'udretro',
  decimals: 6,
  chainId: network.value === 'mainnet' ? 'retrochain-1' : 'retrochain-devnet-1'
}));

const copyAddress = async () => {
  if (address.value) {
    await navigator.clipboard?.writeText(address.value);
  }
};
</script>

<template>
  <div class="space-y-4">
    <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Buy {{ tokenInfo.symbol }}
        </h1>
        <p class="text-sm text-slate-300 mb-4">
          Multiple ways to acquire RetroChain tokens on {{ network === 'mainnet' ? 'mainnet' : 'testnet' }}
        </p>

        <!-- Connect Wallet -->
        <div v-if="!address" class="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div class="flex items-center gap-3">
            <div class="text-3xl">??</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-slate-100 mb-1">Connect Your Wallet</div>
              <div class="text-xs text-slate-400">Connect Keplr to receive tokens and start staking</div>
            </div>
            <button v-if="isAvailable" class="btn btn-primary text-xs" @click="connect">
              Connect Keplr
            </button>
            <a v-else href="https://www.keplr.app/download" target="_blank" class="btn text-xs">
              Install Keplr
            </a>
          </div>
        </div>

        <!-- Wallet Connected -->
        <div v-else class="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
          <div class="flex items-center gap-3">
            <div class="text-3xl">?</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-slate-100 mb-1">Wallet Connected</div>
              <div class="flex items-center gap-2">
                <code class="text-xs text-slate-300">{{ address.slice(0, 20) }}...</code>
                <button class="btn text-[10px]" @click="copyAddress">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Method Selection -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'dex' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'dex'"
      >
        <div class="text-2xl mb-2">??</div>
        <div class="text-sm font-semibold text-slate-100">DEX</div>
        <div class="text-xs text-slate-400">Decentralized</div>
      </button>

      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'cex' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'cex'"
      >
        <div class="text-2xl mb-2">??</div>
        <div class="text-sm font-semibold text-slate-100">CEX</div>
        <div class="text-xs text-slate-400">Exchanges</div>
      </button>

      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'bridge' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'bridge'"
      >
        <div class="text-2xl mb-2">??</div>
        <div class="text-sm font-semibold text-slate-100">Bridge</div>
        <div class="text-xs text-slate-400">IBC Transfer</div>
      </button>

      <button
        class="p-4 rounded-lg border transition-all"
        :class="selectedMethod === 'fiat' ? 'border-indigo-400/70 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'"
        @click="selectedMethod = 'fiat'"
      >
        <div class="text-2xl mb-2">??</div>
        <div class="text-sm font-semibold text-slate-100">Fiat</div>
        <div class="text-xs text-slate-400">Card/Bank</div>
      </button>
    </div>

    <!-- DEX Options -->
    <div v-if="selectedMethod === 'dex'" class="space-y-3">
      <div
        v-for="dex in dexOptions"
        :key="dex.name"
        class="card hover:border-indigo-500/50 transition-all cursor-pointer"
      >
        <a :href="dex.url" target="_blank" class="flex items-center gap-4">
          <div class="text-4xl">{{ dex.icon }}</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">{{ dex.name }}</div>
            <div class="text-sm text-slate-400">{{ dex.description }}</div>
          </div>
          <div class="text-slate-400">?</div>
        </a>
      </div>
    </div>

    <!-- CEX Options -->
    <div v-if="selectedMethod === 'cex'" class="space-y-3">
      <div
        v-for="cex in cexOptions"
        :key="cex.name"
        class="card"
      >
        <div class="flex items-center gap-4">
          <div class="text-4xl">{{ cex.icon }}</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">{{ cex.name }}</div>
            <div class="text-sm text-slate-400">{{ cex.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bridge Options -->
    <div v-if="selectedMethod === 'bridge'" class="space-y-3">
      <div
        v-for="bridge in bridgeOptions"
        :key="bridge.name"
        class="card"
      >
        <div class="flex items-center gap-4">
          <div class="text-4xl">{{ bridge.icon }}</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">{{ bridge.name }}</div>
            <div class="text-sm text-slate-400 mb-3">{{ bridge.description }}</div>
            <div class="text-xs text-slate-500 space-y-1">
              <div>1. Send tokens from another Cosmos chain to your {{ tokenInfo.symbol }} address</div>
              <div>2. Use Keplr's IBC transfer feature</div>
              <div>3. Tokens will arrive in ~60 seconds</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fiat Options -->
    <div v-if="selectedMethod === 'fiat'" class="space-y-3">
      <div
        v-for="fiat in fiatOptions"
        :key="fiat.name"
        class="card hover:border-indigo-500/50 transition-all cursor-pointer"
      >
        <a :href="fiat.url" target="_blank" class="flex items-center gap-4">
          <div class="text-4xl">{{ fiat.icon }}</div>
          <div class="flex-1">
            <div class="text-base font-semibold text-slate-100 mb-1">{{ fiat.name }}</div>
            <div class="text-sm text-slate-400">{{ fiat.description }}</div>
          </div>
          <div class="text-slate-400">?</div>
        </a>
      </div>
    </div>

    <!-- Token Info -->
    <div class="card">
      <h3 class="text-sm font-semibold text-slate-100 mb-3">Token Information</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div class="text-slate-400 mb-1">Symbol</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.symbol }}</div>
        </div>
        <div>
          <div class="text-slate-400 mb-1">Denomination</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.denom }}</div>
        </div>
        <div>
          <div class="text-slate-400 mb-1">Decimals</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.decimals }}</div>
        </div>
        <div>
          <div class="text-slate-400 mb-1">Chain ID</div>
          <div class="text-slate-200 font-mono">{{ tokenInfo.chainId }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
