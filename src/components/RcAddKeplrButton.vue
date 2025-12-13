<script setup lang="ts">
const suggest = async () => {
  if (!window.keplr) {
    alert("Install Keplr first.");
    return;
  }

  const cfg = {
    chainId: "retrochain-mainnet",
    chainName: "RetroChain Mainnet",
    rpc: "/rpc",
    rest: "/api",
    stakeCurrency: { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 },
    bip44: { coinType: 118 },
    bech32Config: {
      bech32PrefixAccAddr: "cosmos",
      bech32PrefixAccPub: "cosmospub",
      bech32PrefixValAddr: "cosmosvaloper",
      bech32PrefixValPub: "cosmosvaloperpub",
      bech32PrefixConsAddr: "cosmosvalcons",
      bech32PrefixConsPub: "cosmosvalconspub"
    },
    currencies: [{ coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 }],
    feeCurrencies: [{
      coinDenom: "RETRO",
      coinMinimalDenom: "uretro",
      coinDecimals: 6,
      gasPriceStep: { low: 0.001, average: 0.0025, high: 0.004 }
    }],
    features: ["ibc-transfer"]
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
    Add Retrochain
  </button>
</template>
