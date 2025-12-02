<script setup lang="ts">
import { useNetwork } from "@/composables/useNetwork";

const { current } = useNetwork();

const suggest = async () => {
  if (!window.keplr) {
    alert("Install Keplr first.");
    return;
  }
  const isMainnet = current.value === "mainnet";
  const cfg = isMainnet
    ? {
        chainId: "retrochain-1",
        chainName: "Retrochain",
        rpc: import.meta.env.VITE_RPC_URL_MAINNET || "https://retrochain.ddns.net:26667",
        rest: import.meta.env.VITE_REST_API_URL_MAINNET || "https://retrochain.ddns.net:1318",
        stakeCurrency: { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 },
        bip44: { coinType: 118 },
        bech32Config: {
          bech32PrefixAccAddr: "retro",
          bech32PrefixAccPub: "retropub",
          bech32PrefixValAddr: "retrovaloper",
          bech32PrefixValPub: "retrovaloperpub",
          bech32PrefixConsAddr: "retrovalcons",
          bech32PrefixConsPub: "retrovalconspub"
        },
        currencies: [{ coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 }],
        feeCurrencies: [{
          coinDenom: "RETRO",
          coinMinimalDenom: "uretro",
          coinDecimals: 6,
          gasPriceStep: { low: 0.001, average: 0.0025, high: 0.004 }
        }],
        features: ["stargate", "ibc-transfer", "no-legacy-stdTx", "cosmwasm"]
      }
    : {
        chainId: "retrochain-devnet-1",
        chainName: "Retrochain Devnet",
        rpc: import.meta.env.VITE_RPC_URL_TESTNET || "https://retrochaindevnet.ddns.net:27657",
        rest: import.meta.env.VITE_REST_API_URL_TESTNET || "https://retrochaindevnet.ddns.net:2317",
        stakeCurrency: { coinDenom: "DRETRO", coinMinimalDenom: "udretro", coinDecimals: 6 },
        bip44: { coinType: 118 },
        bech32Config: {
          bech32PrefixAccAddr: "retro",
          bech32PrefixAccPub: "retropub",
          bech32PrefixValAddr: "retrovaloper",
          bech32PrefixValPub: "retrovaloperpub",
          bech32PrefixConsAddr: "retrovalcons",
          bech32PrefixConsPub: "retrovalconspub"
        },
        currencies: [{ coinDenom: "DRETRO", coinMinimalDenom: "udretro", coinDecimals: 6 }],
        feeCurrencies: [{ coinDenom: "DRETRO", coinMinimalDenom: "udretro", coinDecimals: 6 }],
        features: ["stargate", "ibc-transfer", "no-legacy-stdTx"]
      };

  try {
    await window.keplr.experimentalSuggestChain(cfg);
    await window.keplr.enable(cfg.chainId);
    alert(`Added ${cfg.chainName} to Keplr.`);
  } catch (e: any) {
    alert("Failed: " + (e.message || e));
  }
};
</script>

<template>
  <button class="btn text-[10px]" @click="suggest">
    Add {{ current === 'mainnet' ? 'Retrochain' : 'Devnet' }}
  </button>
</template>
