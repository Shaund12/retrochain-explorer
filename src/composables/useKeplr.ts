// src/composables/useKeplr.ts
import { ref } from "vue";
import { useNetwork } from "./useNetwork";

declare global {
  interface Window {
    keplr?: {
      enable: (chainId: string) => Promise<void>;
      experimentalSuggestChain: (chainInfo: any) => Promise<void>;
      getOfflineSigner: (chainId: string) => any;
      getOfflineSignerAuto: (chainId: string) => Promise<any>;
      signAmino: (chainId: string, signer: string, signDoc: any) => Promise<any>;
      signDirect: (chainId: string, signer: string, signDoc: any) => Promise<any>;
      signAndBroadcast: (chainId: string, signer: string, msgs: any[], fee: any, memo?: string) => Promise<any>;
      getKey: (chainId: string) => Promise<any>;
    };
    getOfflineSigner?: (chainId: string) => any;
    getOfflineSignerAuto?: (chainId: string) => Promise<any>;
  }
}

const isAvailable = ref(false);
const address = ref<string | null>(null);
const connecting = ref(false);
const error = ref<string | null>(null);

const { restBase, rpcBase } = useNetwork();

const CHAIN_ID = "retrochain-mainnet";
const CHAIN_NAME = "RetroChain Mainnet";

function buildChainInfo() {
  return {
    chainId: CHAIN_ID,
    chainName: CHAIN_NAME,
    rpc: rpcBase.value || "/rpc",
    rest: restBase.value || "/api",
    bip44: { coinType: 118 },
    bech32Config: {
      bech32PrefixAccAddr: "cosmos",
      bech32PrefixAccPub: "cosmospub",
      bech32PrefixValAddr: "cosmosvaloper",
      bech32PrefixValPub: "cosmosvaloperpub",
      bech32PrefixConsAddr: "cosmosvalcons",
      bech32PrefixConsPub: "cosmosvalconspub"
    },
    currencies: [
      { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 }
    ],
    feeCurrencies: [{
      coinDenom: "RETRO",
      coinMinimalDenom: "uretro",
      coinDecimals: 6,
      gasPriceStep: { low: 0.001, average: 0.0025, high: 0.004 }
    }],
    stakeCurrency: { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 },
    features: ["ibc-transfer", "cosmwasm"]
  } as any;
}

export function useKeplr() {
  const checkAvailability = () => {
    if (typeof window === "undefined") {
      isAvailable.value = false;
      return;
    }
    isAvailable.value = !!window.keplr && typeof window.keplr.enable === "function";
  };

  const suggestChain = async () => {
    if (!window.keplr) {
      throw new Error("Keplr extension not found.");
    }

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

      await suggestChain();
      await window.keplr.enable(CHAIN_ID);

      const offlineSigner =
        (await window.getOfflineSignerAuto?.(CHAIN_ID)) ||
        window.getOfflineSigner?.(CHAIN_ID);

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
    address.value = null;
  };

  const signAndBroadcast = async (chainId: string, msgs: any[], fee: any, memo = "") => {
    if (!window.keplr) throw new Error("Keplr not available");
    if (!address.value) throw new Error("Not connected to Keplr");

    try {
      const offlineSigner = window.keplr.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();

      const { SigningStargateClient } = await import("@cosmjs/stargate");
      // cosmjs SigningStargateClient expects an HTTP(S) RPC endpoint, not ws/wss
      const rpcEndpoint = rpcBase.value || "/rpc";
      const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, offlineSigner);

      const result = await client.signAndBroadcast(
        accounts[0].address,
        msgs,
        fee,
        memo
      );

      return result;
    } catch (e: any) {
      console.error("Transaction failed:", e);
      throw e;
    }
  };

  if (typeof window !== "undefined" && window.keplr && !window.keplr.signAndBroadcast) {
    window.keplr.signAndBroadcast = async (chainId: string, signer: string, msgs: any[], fee: any, memo = "") => {
      return signAndBroadcast(chainId, msgs, fee, memo);
    };
  }

  checkAvailability();

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
    checkAvailability,
    signAndBroadcast
  };
}
