<script setup lang="ts">
import { computed } from "vue";
import { useNetwork } from "@/composables/useNetwork";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { DEFAULT_WBTC_DENOM_ON_COSMOS, DEFAULT_WBTC_IBC_DENOM_ON_RETRO } from "@/constants/tokens";

const { current: network } = useNetwork();

const isMainnet = computed(() => network.value === "mainnet");
const retroDenom = computed(() => (isMainnet.value ? "uretro" : "udretro"));
const retroSymbol = computed(() => (isMainnet.value ? "RETRO" : "DRETRO"));

// Channels (env-configured)
const retroToCosmosChannel = import.meta.env.VITE_IBC_CHANNEL_RETRO_COSMOS || "channel-0";
const cosmosToRetroChannel = import.meta.env.VITE_IBC_CHANNEL_COSMOS_RETRO || "channel-1638";
const retroToOsmosisChannel = import.meta.env.VITE_IBC_CHANNEL_RETRO_OSMOSIS || "channel-1";
const osmosisToRetroChannel = import.meta.env.VITE_IBC_CHANNEL_OSMOSIS_RETRO || "channel-108593";
const nobleToOsmosisChannel = import.meta.env.VITE_IBC_CHANNEL_NOBLE_OSMOSIS || "channel-750";
const osmosisToNobleChannel = import.meta.env.VITE_IBC_CHANNEL_OSMOSIS_NOBLE || "";

// Denoms (common / known)
const ATOM_IBC_DENOM_ON_RETRO = "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2";
const OSMO_IBC_DENOM_ON_RETRO = "ibc/FE42E434C713D0A118E3CE46FC6A4B55A5C2B330A2A880C4D7A1B7935DA1E5A0";
const USDC_IBC_DENOM_ON_RETRO = "ibc/1EC890E294140C5562003AF676C013A2C75136F32A323274D91CEB9245FA593F";

const WBTC_IBC_DENOM_ON_RETRO = import.meta.env.VITE_IBC_DENOM_WBTC_ON_RETRO || DEFAULT_WBTC_IBC_DENOM_ON_RETRO;
const WBTC_DENOM_ON_COSMOS =
  import.meta.env.VITE_DENOM_WBTC_ON_COSMOS ||
  import.meta.env.VITE_IBC_DENOM_WBTC_ON_COSMOS ||
  DEFAULT_WBTC_DENOM_ON_COSMOS;

const copy = async (text: string) => {
  try {
    await navigator.clipboard?.writeText?.(text);
  } catch {}
};

const channels = computed(() => [
  { label: "Retro ↔ Cosmos Hub", outbound: retroToCosmosChannel, inbound: cosmosToRetroChannel },
  { label: "Retro ↔ Osmosis", outbound: retroToOsmosisChannel, inbound: osmosisToRetroChannel },
  { label: "Noble ↔ Osmosis", outbound: nobleToOsmosisChannel, inbound: osmosisToNobleChannel || "(set VITE_IBC_CHANNEL_OSMOSIS_NOBLE)" }
]);

const denoms = computed(() => [
  { symbol: retroSymbol.value, denom: retroDenom.value },
  { symbol: "ATOM (on Retro)", denom: ATOM_IBC_DENOM_ON_RETRO },
  { symbol: "OSMO (on Retro)", denom: OSMO_IBC_DENOM_ON_RETRO },
  { symbol: "USDC (on Retro)", denom: USDC_IBC_DENOM_ON_RETRO },
  { symbol: "WBTC (on Retro)", denom: WBTC_IBC_DENOM_ON_RETRO },
  { symbol: "WBTC (source denom on Cosmos)", denom: WBTC_DENOM_ON_COSMOS }
]);
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-white">IBC Info</h1>
      <p class="text-slate-300 mt-2">
        Informational only. Use your wallet’s <span class="font-semibold">Advanced IBC Transfer</span> for transfers.
      </p>
    </div>

    <RcDisclaimer class="mb-6" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card">
        <h2 class="text-lg font-semibold text-white mb-3">Channels</h2>
        <div class="space-y-3">
          <div v-for="c in channels" :key="c.label" class="border border-white/10 rounded-xl p-4 bg-white/5">
            <div class="text-sm font-semibold text-white">{{ c.label }}</div>
            <div class="mt-2 text-xs text-slate-200 font-mono break-all">Outbound: {{ c.outbound }}</div>
            <div class="mt-1 text-xs text-slate-200 font-mono break-all">Inbound: {{ c.inbound }}</div>
            <div class="mt-3 flex gap-2">
              <button class="btn btn-xs" @click="copy(String(c.outbound))">Copy outbound</button>
              <button class="btn btn-xs" @click="copy(String(c.inbound))">Copy inbound</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="text-lg font-semibold text-white mb-3">Denoms</h2>
        <div class="space-y-3">
          <div v-for="d in denoms" :key="d.symbol" class="border border-white/10 rounded-xl p-4 bg-white/5">
            <div class="text-sm font-semibold text-white">{{ d.symbol }}</div>
            <div class="mt-2 text-xs text-slate-200 font-mono break-all">{{ d.denom }}</div>
            <div class="mt-3">
              <button class="btn btn-xs" @click="copy(d.denom)">Copy denom</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

