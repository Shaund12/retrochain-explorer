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

const CHAIN_ID = "retrochain-1";
const CHAIN_NAME = "RetroChain Mainnet";

function buildChainInfo() {
  // Build absolute URLs - Keplr requires full URIs
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const rpcUrl = rpcBase.value ? (rpcBase.value.startsWith('http') ? rpcBase.value : `${origin}${rpcBase.value}`) : `${origin}/rpc`;
  const restUrl = restBase.value ? (restBase.value.startsWith('http') ? restBase.value : `${origin}${restBase.value}`) : `${origin}/api`;
  
  return {
    chainId: CHAIN_ID,
    chainName: CHAIN_NAME,
    rpc: rpcUrl,
    rest: restUrl,
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
      
      // Build absolute HTTP(S) RPC endpoint for CosmJS
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
      let rpcEndpoint = rpcBase.value || "/rpc";
      
      // Convert to absolute URL if relative
      if (!rpcEndpoint.startsWith('http')) {
        rpcEndpoint = `${origin}${rpcEndpoint.startsWith('/') ? '' : '/'}${rpcEndpoint}`;
      }
      
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

  // REST-based signing alternative (workaround for RPC protobuf issues)
  const signAndBroadcastWithREST = async (chainId: string, msgs: any[], fee: any, memo = "") => {
    if (!window.keplr) throw new Error("Keplr not available");
    if (!address.value) throw new Error("Not connected to Keplr");

    try {
      // Import required utilities
      const { useApi } = await import("./useApi");
      const api = useApi();
      
      // Get account info from REST API (this works fine!)
      const accountRes = await api.get(`/cosmos/auth/v1beta1/accounts/${address.value}`);
      const account = accountRes.data?.account;
      
      if (!account) {
        throw new Error("Account not found. Make sure your account is funded.");
      }

      // Extract account number and sequence - handle both account types
      let accountNumber: string;
      let sequence: string;
      
      if (account["@type"] === "/cosmos.auth.v1beta1.BaseAccount") {
        accountNumber = account.account_number;
        sequence = account.sequence || "0";
      } else if (account.base_account) {
        accountNumber = account.base_account.account_number;
        sequence = account.base_account.sequence || "0";
      } else {
        throw new Error("Unknown account type");
      }

      console.log("Account info:", { accountNumber, sequence });

      // Convert Protobuf messages to Amino format for Keplr
      const aminoMsgs = msgs.map(msg => {
        // Map protobuf type URLs to amino types
        let type = msg.typeUrl;
        if (type === "/cosmos.staking.v1beta1.MsgDelegate") {
          type = "cosmos-sdk/MsgDelegate";
        } else if (type === "/cosmos.staking.v1beta1.MsgUndelegate") {
          type = "cosmos-sdk/MsgUndelegate";
        } else if (type === "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward") {
          type = "cosmos-sdk/MsgWithdrawDelegatorReward";
        }
        
        return {
          type,
          value: msg.value
        };
      });

      // Create Amino sign doc
      const signDoc = {
        chain_id: chainId,
        account_number: accountNumber,
        sequence: sequence,
        fee: {
          amount: fee.amount,
          gas: fee.gas
        },
        msgs: aminoMsgs,
        memo: memo || ""
      };

      console.log("Signing with Keplr:", signDoc);

      // Sign with Keplr using Amino
      const signResponse = await window.keplr!.signAmino(chainId, address.value, signDoc);
      
      console.log("Signature received:", signResponse.signature);

      // Now encode to protobuf and broadcast
      const { makeSignDoc } = await import("@cosmjs/amino");
      const { makeStdTx } = await import("@cosmjs/amino");
      
      const stdTx = makeStdTx(signDoc, signResponse.signature);
      
      // Broadcast using REST
      const broadcastRes = await api.post("/cosmos/tx/v1beta1/txs", {
        tx: stdTx,
        mode: "BROADCAST_MODE_SYNC"
      });

      console.log("Broadcast response:", broadcastRes.data);

      if (broadcastRes.data?.tx_response?.code !== 0) {
        throw new Error(broadcastRes.data?.tx_response?.raw_log || "Transaction failed");
      }

      return broadcastRes.data?.tx_response;
    } catch (e: any) {
      console.error("REST transaction failed:", e);
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
    signAndBroadcast,
    signAndBroadcastWithREST
  };
}
