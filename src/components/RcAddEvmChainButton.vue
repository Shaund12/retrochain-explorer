<script setup lang="ts">
import { computed } from "vue";
import { useToast } from "@/composables/useToast";

const toast = useToast();

const chainInfo = {
  chainId: "retrochainevm_2026011501-1",
  chainName: "RetroChain EVM",
  rpc: "https://retrochain-evm.ddns.net/cosmos-rpc",
  rest: "https://retrochain-evm.ddns.net/cosmos-rest",
  bip44: { coinType: 60 },
  bech32Config: {
    bech32PrefixAccAddr: "ethm",
    bech32PrefixAccPub: "ethmpub",
    bech32PrefixValAddr: "ethmvaloper",
    bech32PrefixValPub: "ethmvaloperpub",
    bech32PrefixConsAddr: "ethmvalcons",
    bech32PrefixConsPub: "ethmvalconspub"
  },
  currencies: [
    { coinDenom: "RETRO", coinMinimalDenom: "aretro", coinDecimals: 18 }
  ],
  feeCurrencies: [
    { coinDenom: "RETRO", coinMinimalDenom: "aretro", coinDecimals: 18 }
  ],
  stakeCurrency: { coinDenom: "RETRO", coinMinimalDenom: "aretro", coinDecimals: 18 },
  features: ["eth-address-gen", "eth-key-sign"]
};

const isKeplrAvailable = computed(() => typeof window !== "undefined" && !!window.keplr);

const addChain = async () => {
  if (!window.keplr) {
    toast.showError("Install the Keplr extension first.");
    return;
  }

  try {
    await window.keplr.experimentalSuggestChain(chainInfo);
    await window.keplr.enable(chainInfo.chainId);
    toast.showSuccess("RetroChain EVM added! Open Keplr ? select RetroChain EVM (Cosmos).");
  } catch (err: any) {
    toast.showError(err?.message || "Failed to add chain");
  }
};
</script>

<template>
  <button
    type="button"
    @click="addChain"
    :disabled="!isKeplrAvailable"
    class="inline-flex items-center gap-2 rounded-2xl border border-purple-400/40 bg-gradient-to-r from-purple-600/80 to-indigo-600/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:from-purple-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span class="text-lg">?</span>
    <div class="text-left">
      <div class="text-xs uppercase tracking-wider text-white/80">Add to Keplr</div>
      <div class="text-[11px] text-white/60">RetroChain EVM</div>
    </div>
  </button>
</template>
