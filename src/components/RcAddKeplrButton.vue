<script setup lang="ts">
import { useToast } from "@/composables/useToast";

declare global {
  interface Window {
    keplr?: any;
    leap?: any;
    cosmostation?: {
      providers?: {
        keplr?: any;
      };
    };
  }
}

const toast = useToast();

const buildChainConfig = () => {
  const origin = window.location.origin;
  const rpc = import.meta.env.VITE_RPC_URL || `${origin}/rpc`;
  const rest = import.meta.env.VITE_REST_API_URL || `${origin}/api`;
  const chainId = import.meta.env.VITE_CHAIN_ID || "retrochain-mainnet";
  const chainName = import.meta.env.VITE_CHAIN_NAME || "RetroChain Mainnet";
  const icon = `${origin}/RCIcon.svg`;

  return {
    chainId,
    chainName,
    rpc,
    rest,
    bip44: { coinType: 118 },
    bech32Config: {
      bech32PrefixAccAddr: "cosmos",
      bech32PrefixAccPub: "cosmospub",
      bech32PrefixValAddr: "cosmosvaloper",
      bech32PrefixValPub: "cosmosvaloperpub",
      bech32PrefixConsAddr: "cosmosvalcons",
      bech32PrefixConsPub: "cosmosvalconspub"
    },
    stakeCurrency: {
      coinDenom: "RETRO",
      coinMinimalDenom: "uretro",
      coinDecimals: 6,
      coinGeckoId: "retrochain",
      coinImageUrl: icon
    },
    currencies: [
      {
        coinDenom: "RETRO",
        coinMinimalDenom: "uretro",
        coinDecimals: 6,
        coinGeckoId: "retrochain",
        coinImageUrl: icon
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "RETRO",
        coinMinimalDenom: "uretro",
        coinDecimals: 6,
        coinGeckoId: "retrochain",
        coinImageUrl: icon,
        gasPriceStep: { low: 0.001, average: 0.0025, high: 0.004 }
      }
    ],
    features: ["ibc-transfer", "ibc-go"],
    chainSymbolImageUrl: icon
  };
};

const walletProviders = [
  {
    name: "Keplr",
    get: () => window.keplr
  },
  {
    name: "Leap",
    get: () => window.leap
  },
  {
    name: "Cosmostation",
    get: () => window.cosmostation?.providers?.keplr
  }
];

const suggestToWallet = async (wallet: any, cfg: any) => {
  if (!wallet) throw new Error("Wallet not available");
  if (typeof wallet.experimentalSuggestChain === "function") {
    await wallet.experimentalSuggestChain(cfg);
  } else if (typeof wallet.suggestChain === "function") {
    await wallet.suggestChain(cfg);
  } else {
    throw new Error("Wallet does not support chain suggestion");
  }

  if (typeof wallet.enable === "function") {
    await wallet.enable(cfg.chainId);
  } else if (wallet.keplr && typeof wallet.keplr.enable === "function") {
    await wallet.keplr.enable(cfg.chainId);
  }
};

const suggest = async () => {
  const cfg = buildChainConfig();
  const available = walletProviders
    .map((entry) => ({ ...entry, instance: entry.get() }))
    .filter((entry) => !!entry.instance);

  if (!available.length) {
    toast.showError("Install Keplr, Leap, or Cosmostation to add RetroChain.");
    return;
  }

  const successes: string[] = [];
  const failures: string[] = [];

  for (const wallet of available) {
    try {
      await suggestToWallet(wallet.instance, cfg);
      successes.push(wallet.name);
    } catch (err: any) {
      failures.push(`${wallet.name}: ${err?.message || err}`);
    }
  }

  if (successes.length) {
    toast.showSuccess(`RetroChain ready in ${successes.join(", ")}.`);
  }

  if (failures.length && successes.length === 0) {
    toast.showTxError(failures.join(" | "));
  } else if (failures.length) {
    toast.showWarning(`Some wallets failed: ${failures.join(" | ")}`);
  }
};
</script>

<template>
  <button class="btn text-[10px]" @click="suggest">
    Add RetroChain to Wallet
  </button>
</template>
