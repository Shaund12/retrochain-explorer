// src/composables/useKeplr.ts
import { ref } from "vue";
import { useNetwork } from "./useNetwork";

declare global {
  interface Window {
    keplr?: any;
    getOfflineSigner?: (chainId: string) => any;
    getOfflineSignerAuto?: (chainId: string) => Promise<any>;
  }
}

const isAvailable = ref(false);
const address = ref<string | null>(null);
const connecting = ref(false);
const error = ref<string | null>(null);

// ==== RetroChain chain info for Keplr ====
// Dynamic mainnet/testnet configuration
const { current: net, restBase, rpcBase } = useNetwork();

function getChainId() {
  if (net.value === "mainnet") {
    return (import.meta as any).env?.VITE_CHAIN_ID_MAINNET || "retrochain-1";
  }
  return (import.meta as any).env?.VITE_CHAIN_ID_TESTNET || "retrochain-devnet-1";
}

function getChainName() {
  return net.value === "mainnet" ? "RetroChain" : "RetroChain Devnet";
}

function getCurrencies() {
  if (net.value === "mainnet") {
    return {
      stake: { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 },
      list: [
        { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 }
      ],
      fees: [{
        coinDenom: "RETRO",
        coinMinimalDenom: "uretro",
        coinDecimals: 6,
        gasPriceStep: { low: 0.001, average: 0.0025, high: 0.004 }
      }]
    };
  }
  return {
    stake: { coinDenom: "DRETRO", coinMinimalDenom: "udretro", coinDecimals: 6 },
    list: [
      { coinDenom: "DRETRO", coinMinimalDenom: "udretro", coinDecimals: 6 }
    ],
    fees: [{ coinDenom: "DRETRO", coinMinimalDenom: "udretro", coinDecimals: 6 }]
  };
}

function buildChainInfo() {
  const currencies = getCurrencies();
  const pfx = (() => {
    if (net.value === "mainnet") {
      return (import.meta as any).env?.VITE_BECH32_PREFIX_MAINNET || "retro";
    }
    return (import.meta as any).env?.VITE_BECH32_PREFIX_TESTNET || "retro";
  })();
  return {
    chainId: getChainId(),
    chainName: getChainName(),
    rpc: rpcBase.value || "/rpc",
    rest: restBase.value || "/api",
    bip44: { coinType: 118 },
    bech32Config: {
      bech32PrefixAccAddr: pfx,
      bech32PrefixAccPub: `${pfx}pub`,
      bech32PrefixValAddr: `${pfx}valoper`,
      bech32PrefixValPub: `${pfx}valoperpub`,
      bech32PrefixConsAddr: `${pfx}valcons`,
      bech32PrefixConsPub: `${pfx}valconspub`
    },
    currencies: currencies.list,
    feeCurrencies: currencies.fees,
    stakeCurrency: currencies.stake,
    features: ["ibc-transfer", "cosmwasm"]
  } as any;
}

export function useKeplr() {
const checkAvailability = () => {
  if (typeof window === "undefined") {
    isAvailable.value = false;
    return;
  }
  // Check both window.keplr and if it's not disabled
  isAvailable.value = !!window.keplr && typeof window.keplr.enable === "function";
};

  const suggestChain = async () => {
    if (!window.keplr) {
      throw new Error("Keplr extension not found.");
    }

    // Some versions gate this under experimentalSuggestChain
    if (!window.keplr.experimentalSuggestChain) {
      throw new Error("Keplr does not support experimentalSuggestChain.");
    }

    await window.keplr.experimentalSuggestChain(buildChainInfo());
  };

  const connect = async () => {
    try {
      connecting.value = true;
      error.value = null;
      checkAvailability();

      if (!isAvailable.value) {
        throw new Error("Keplr extension not detected. Install it and reload.");
      }

      // Add chain to Keplr, then enable it
      await suggestChain();
      await window.keplr.enable(getChainId());

      const chainId = getChainId();
      const offlineSigner =
        (await window.getOfflineSignerAuto?.(chainId)) ||
        window.getOfflineSigner?.(chainId);

      if (!offlineSigner) {
        throw new Error("Unable to get offline signer from Keplr.");
      }

      const accounts = await offlineSigner.getAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts available in Keplr.");
      }

      address.value = accounts[0].address;
      return accounts[0].address;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      error.value = msg;
      throw e;
    } finally {
      connecting.value = false;
    }
  };

  const disconnect = () => {
    // Keplr doesn't have a "disconnect", we just clear local state
    address.value = null;
  };

  // run once on import
  checkAvailability();

  // Also check again after a short delay (Keplr might load after page)
  if (typeof window !== "undefined") {
    setTimeout(() => {
      checkAvailability();
    }, 1000);
  }

  return {
    isAvailable,
    address,
    connecting,
    error,
    connect,
    disconnect,
    checkAvailability
  };
}
