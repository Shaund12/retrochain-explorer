// src/composables/useKeplr.ts
import { ref } from "vue";
import { SigningStargateClient, defaultRegistryTypes } from "@cosmjs/stargate";
import { Registry, encodePubkey, makeAuthInfoBytes, makeSignDoc as makeSignDocDirect, GeneratedType } from "@cosmjs/proto-signing";
import { encodeSecp256k1Pubkey } from "@cosmjs/amino";
import { TxRaw, AuthInfo, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { toBase64, fromBase64 } from "@cosmjs/encoding";
import { Int53 } from "@cosmjs/math";
import { useNetwork } from "./useNetwork";
import { useApi } from "./useApi";
import _m0 from "protobufjs/minimal";

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
    leap?: any;
    cosmostation?: {
      providers?: {
        keplr?: any;
      };
    };
  }
}

const isAvailable = ref(false);
const address = ref<string | null>(null);
const connecting = ref(false);
const error = ref<string | null>(null);
let keystoreListenerAttached = false;

const KEPLR_DEFAULT_OPTS = {
  sign: {
    preferNoSetFee: true,
    preferNoSetMemo: true
  }
};

const KEYSTORE_EVENTS = ["keplr_keystorechange", "leap_keystorechange", "cosmostation_keystorechange"];

const getWalletProvider = () => {
  if (typeof window === "undefined") return null;
  return window.keplr || window.leap || window.cosmostation?.providers?.keplr || null;
};

function configureKeplrDefaults() {
  const provider = getWalletProvider();
  if (!provider || !(provider as any).defaultOptions) return;
  const current = (provider as any).defaultOptions || {};
  if (
    current?.sign?.preferNoSetFee === KEPLR_DEFAULT_OPTS.sign.preferNoSetFee &&
    current?.sign?.preferNoSetMemo === KEPLR_DEFAULT_OPTS.sign.preferNoSetMemo
  ) {
    return;
  }
  (provider as any).defaultOptions = KEPLR_DEFAULT_OPTS;
}

if (typeof window !== "undefined" && getWalletProvider()) {
  configureKeplrDefaults();
}

const { restBase, rpcBase } = useNetwork();

const CHAIN_ID = "retrochain-mainnet";
const CHAIN_NAME = "RetroChain Mainnet";
const DEFAULT_FEE_DENOM = "uretro";
const DEFAULT_GAS_PRICE = 0.03; // uretro per gas unit
const DEFAULT_GAS_ADJUSTMENT = 1.3;
const DEFAULT_GAS_PER_MSG = 150000;
const MIN_GAS_LIMIT = 200000;
const MIN_TOTAL_FEE = 5000; // minimum fee in uretro to satisfy chain requirements
const COSMOS_CHAIN_ID = import.meta.env.VITE_COSMOS_CHAIN_ID || "cosmoshub-4";
const COSMOS_RPC_URL = (import.meta.env.VITE_COSMOS_RPC_URL || "").trim();

// --- Custom message types (btcstake) ---
interface MsgStake {
  creator: string;
  amount: string;
}

interface MsgUnstake {
  creator: string;
  amount: string;
}

interface MsgClaimRewards {
  creator: string;
}

const createMsgStake = (msg: MsgStake) => msg;
const createMsgUnstake = (msg: MsgUnstake) => msg;
const createMsgClaimRewards = (msg: MsgClaimRewards) => msg;

const MsgStakeType: GeneratedType = {
  encode(message: MsgStake, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creator) writer.uint32(10).string(message.creator);
    if (message.amount) writer.uint32(18).string(message.amount);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgStake {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgStake = { creator: "", amount: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.amount = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgStake>): MsgStake {
    return { creator: object.creator ?? "", amount: object.amount ?? "" };
  }
};

const MsgUnstakeType: GeneratedType = {
  encode(message: MsgUnstake, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creator) writer.uint32(10).string(message.creator);
    if (message.amount) writer.uint32(18).string(message.amount);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgUnstake {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgUnstake = { creator: "", amount: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.amount = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgUnstake>): MsgUnstake {
    return { creator: object.creator ?? "", amount: object.amount ?? "" };
  }
};

const MsgClaimRewardsType: GeneratedType = {
  encode(message: MsgClaimRewards, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creator) writer.uint32(10).string(message.creator);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgClaimRewards {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgClaimRewards = { creator: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgClaimRewards>): MsgClaimRewards {
    return { creator: object.creator ?? "" };
  }
};

const retroBtcStakeTypes: ReadonlyArray<[string, GeneratedType]> = [
  ["/retrochain.btcstake.v1.MsgStake", MsgStakeType],
  ["/retrochain.btcstake.v1.MsgUnstake", MsgUnstakeType],
  ["/retrochain.btcstake.v1.MsgClaimRewards", MsgClaimRewardsType]
];

// --- Custom message types (dex) ---
// NOTE: These minimal encoders are only used by the REST signing fallback.
// The RPC path uses chain-provided type registry from cosmjs-types where available.
interface DexCoin {
  denom: string;
  amount: string;
}

interface MsgCreatePool {
  creator: string;
  tokenA?: DexCoin;
  tokenB?: DexCoin;
  swapFee: string;
}

interface MsgAddLiquidity {
  sender: string;
  tokenA?: DexCoin;
  tokenB?: DexCoin;
}

interface MsgSwapExactAmountIn {
  sender: string;
  routes: Array<{ poolId: string; tokenOutDenom: string }>;
  tokenIn?: DexCoin;
  tokenOutMinAmount: string;
}

interface MsgPlaceLimitOrder {
  creator: string;
  orderType: string;
  tokenIn: string;
  tokenOut: string;
  amount: string;
  price: string;
}

const encodeDexCoin = (coin: DexCoin | undefined, fieldNo: number, writer: _m0.Writer) => {
  if (!coin) return;
  // Coin { string denom = 1; string amount = 2; }
  const w = _m0.Writer.create();
  if (coin.denom) w.uint32(10).string(coin.denom);
  if (coin.amount) w.uint32(18).string(coin.amount);
  writer.uint32((fieldNo << 3) | 2).bytes(w.finish());
};

const MsgCreatePoolType: GeneratedType = {
  encode(message: MsgCreatePool, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creator) writer.uint32(10).string(message.creator);
    encodeDexCoin(message.tokenA, 2, writer);
    encodeDexCoin(message.tokenB, 3, writer);
    if (message.swapFee) writer.uint32(34).string(message.swapFee);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgCreatePool {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgCreatePool = { creator: "", swapFee: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2: {
          const bytes = reader.bytes();
          const r = new _m0.Reader(bytes);
          const coin: DexCoin = { denom: "", amount: "" };
          while (r.pos < r.len) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1:
                coin.denom = r.string();
                break;
              case 2:
                coin.amount = r.string();
                break;
              default:
                r.skipType(t & 7);
                break;
            }
          }
          message.tokenA = coin;
          break;
        }
        case 3: {
          const bytes = reader.bytes();
          const r = new _m0.Reader(bytes);
          const coin: DexCoin = { denom: "", amount: "" };
          while (r.pos < r.len) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1:
                coin.denom = r.string();
                break;
              case 2:
                coin.amount = r.string();
                break;
              default:
                r.skipType(t & 7);
                break;
            }
          }
          message.tokenB = coin;
          break;
        }
        case 4:
          message.swapFee = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgCreatePool>): MsgCreatePool {
    return {
      creator: object.creator ?? "",
      tokenA: object.tokenA,
      tokenB: object.tokenB,
      swapFee: object.swapFee ?? ""
    };
  }
};

const MsgAddLiquidityType: GeneratedType = {
  encode(message: MsgAddLiquidity, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.sender) writer.uint32(10).string(message.sender);
    encodeDexCoin(message.tokenA, 2, writer);
    encodeDexCoin(message.tokenB, 3, writer);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgAddLiquidity {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgAddLiquidity = { sender: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sender = reader.string();
          break;
        case 2: {
          const bytes = reader.bytes();
          const r = new _m0.Reader(bytes);
          const coin: DexCoin = { denom: "", amount: "" };
          while (r.pos < r.len) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1:
                coin.denom = r.string();
                break;
              case 2:
                coin.amount = r.string();
                break;
              default:
                r.skipType(t & 7);
                break;
            }
          }
          message.tokenA = coin;
          break;
        }
        case 3: {
          const bytes = reader.bytes();
          const r = new _m0.Reader(bytes);
          const coin: DexCoin = { denom: "", amount: "" };
          while (r.pos < r.len) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1:
                coin.denom = r.string();
                break;
              case 2:
                coin.amount = r.string();
                break;
              default:
                r.skipType(t & 7);
                break;
            }
          }
          message.tokenB = coin;
          break;
        }
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgAddLiquidity>): MsgAddLiquidity {
    return { sender: object.sender ?? "", tokenA: object.tokenA, tokenB: object.tokenB };
  }
};

const MsgSwapExactAmountInType: GeneratedType = {
  encode(message: MsgSwapExactAmountIn, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.sender) writer.uint32(10).string(message.sender);
    // routes: repeated message Route { string poolId = 1; string tokenOutDenom = 2; }
    for (const route of message.routes || []) {
      const w = _m0.Writer.create();
      if (route.poolId) w.uint32(10).string(route.poolId);
      if (route.tokenOutDenom) w.uint32(18).string(route.tokenOutDenom);
      writer.uint32(18).bytes(w.finish());
    }
    encodeDexCoin(message.tokenIn, 3, writer);
    if (message.tokenOutMinAmount) writer.uint32(34).string(message.tokenOutMinAmount);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgSwapExactAmountIn {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgSwapExactAmountIn = { sender: "", routes: [], tokenOutMinAmount: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sender = reader.string();
          break;
        case 2: {
          const bytes = reader.bytes();
          const r = new _m0.Reader(bytes);
          const route = { poolId: "", tokenOutDenom: "" };
          while (r.pos < r.len) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1:
                route.poolId = r.string();
                break;
              case 2:
                route.tokenOutDenom = r.string();
                break;
              default:
                r.skipType(t & 7);
                break;
            }
          }
          message.routes.push(route);
          break;
        }
        case 3: {
          const bytes = reader.bytes();
          const r = new _m0.Reader(bytes);
          const coin: DexCoin = { denom: "", amount: "" };
          while (r.pos < r.len) {
            const t = r.uint32();
            switch (t >>> 3) {
              case 1:
                coin.denom = r.string();
                break;
              case 2:
                coin.amount = r.string();
                break;
              default:
                r.skipType(t & 7);
                break;
            }
          }
          message.tokenIn = coin;
          break;
        }
        case 4:
          message.tokenOutMinAmount = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgSwapExactAmountIn>): MsgSwapExactAmountIn {
    return {
      sender: object.sender ?? "",
      routes: object.routes ?? [],
      tokenIn: object.tokenIn,
      tokenOutMinAmount: object.tokenOutMinAmount ?? ""
    };
  }
};

const MsgPlaceLimitOrderType: GeneratedType = {
  encode(message: MsgPlaceLimitOrder, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creator) writer.uint32(10).string(message.creator);
    if (message.orderType) writer.uint32(18).string(message.orderType);
    if (message.tokenIn) writer.uint32(26).string(message.tokenIn);
    if (message.tokenOut) writer.uint32(34).string(message.tokenOut);
    if (message.amount) writer.uint32(42).string(message.amount);
    if (message.price) writer.uint32(50).string(message.price);
    return writer;
  },
  decode(input: Uint8Array | _m0.Reader, length?: number): MsgPlaceLimitOrder {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message: MsgPlaceLimitOrder = { creator: "", orderType: "", tokenIn: "", tokenOut: "", amount: "", price: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.orderType = reader.string();
          break;
        case 3:
          message.tokenIn = reader.string();
          break;
        case 4:
          message.tokenOut = reader.string();
          break;
        case 5:
          message.amount = reader.string();
          break;
        case 6:
          message.price = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(object: Partial<MsgPlaceLimitOrder>): MsgPlaceLimitOrder {
    return {
      creator: object.creator ?? "",
      orderType: object.orderType ?? "",
      tokenIn: object.tokenIn ?? "",
      tokenOut: object.tokenOut ?? "",
      amount: object.amount ?? "",
      price: object.price ?? ""
    };
  }
};

const retroDexTypes: ReadonlyArray<[string, GeneratedType]> = [
  ["/retrochain.dex.v1.MsgCreatePool", MsgCreatePoolType],
  ["/retrochain.dex.v1.MsgAddLiquidity", MsgAddLiquidityType],
  ["/retrochain.dex.v1.MsgSwapExactAmountIn", MsgSwapExactAmountInType],
  ["/retrochain.dex.v1.MsgPlaceLimitOrder", MsgPlaceLimitOrderType]
];

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
      { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 },
      { coinDenom: "stWBTC", coinMinimalDenom: "stwbtc", coinDecimals: 8 }
    ],
    feeCurrencies: [{
      coinDenom: "RETRO",
      coinMinimalDenom: "uretro",
      coinDecimals: 6,
      gasPriceStep: { low: 0.03, average: 0.035, high: 0.04 }
    }],
    stakeCurrency: { coinDenom: "RETRO", coinMinimalDenom: "uretro", coinDecimals: 6 },
    features: ["ibc-transfer", "cosmwasm"]
  } as any;
}

export function useKeplr() {
  const api = useApi();

  const refreshAddressFromWallet = async () => {
    const provider = getWalletProvider();
    if (!provider) return;
    try {
      await provider.enable(CHAIN_ID);
      const offlineSigner =
        (await provider.getOfflineSignerAuto?.(CHAIN_ID)) ||
        (await window.getOfflineSignerAuto?.(CHAIN_ID)) ||
        provider.getOfflineSigner?.(CHAIN_ID) ||
        window.getOfflineSigner?.(CHAIN_ID);
      const accounts = await offlineSigner?.getAccounts?.();
      address.value = accounts?.[0]?.address ?? null;
    } catch (err) {
      console.warn("Unable to refresh address from keystore change", err);
      address.value = null;
    }
  };

  const isUndefinedValueError = (err: unknown) =>
    typeof err === "object" && err !== null && "message" in err &&
    typeof (err as any).message === "string" && (err as any).message.includes("Value must not be undefined");
  const checkAvailability = () => {
    if (typeof window === "undefined") {
      isAvailable.value = false;
      return;
    }
    const provider = getWalletProvider();
    isAvailable.value = !!provider && typeof provider.enable === "function";
    if (isAvailable.value) configureKeplrDefaults();
    if (isAvailable.value && !keystoreListenerAttached) {
      KEYSTORE_EVENTS.forEach((evt) => window.addEventListener(evt, refreshAddressFromWallet));
      keystoreListenerAttached = true;
    }
  };

  const suggestChain = async () => {
    const provider = getWalletProvider();

    if (!provider) {
      throw new Error("Keplr-compatible wallet not found.");
    }

    if (!provider.experimentalSuggestChain) {
      throw new Error("Wallet does not support experimentalSuggestChain.");
    }

    await provider.experimentalSuggestChain(buildChainInfo());
  };

  const connect = async () => {
    try {
      connecting.value = true;
      error.value = null;
      checkAvailability();

      if (!isAvailable.value) {
        throw new Error("Keplr-compatible wallet not detected. Install one and reload.");
      }

      configureKeplrDefaults();
      await suggestChain();
      const provider = getWalletProvider();
      await provider!.enable(CHAIN_ID);

      const offlineSigner =
        (await provider?.getOfflineSignerAuto?.(CHAIN_ID)) ||
        (await window.getOfflineSignerAuto?.(CHAIN_ID)) ||
        provider?.getOfflineSigner?.(CHAIN_ID) ||
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

  // REST-based signing alternative (workaround for RPC protobuf issues)
  const signAndBroadcastWithREST = async (chainId: string, msgs: any[], fee?: any, memo = "") => {
    const provider = getWalletProvider();
    if (!provider) throw new Error("Keplr-compatible wallet not available");
    if (!address.value) throw new Error("Not connected to Keplr");

    try {
      const accountRes = await api.get(`/cosmos/auth/v1beta1/accounts/${address.value}`);
      const account = accountRes.data?.account;

      if (!account) {
        throw new Error("Account not found. Make sure your account is funded.");
      }

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

      const offlineSigner = provider.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();
      const signerAddress = accounts[0].address;
      const signerPubkey = accounts[0].pubkey;

      const registry = new Registry([...defaultRegistryTypes, ...retroBtcStakeTypes, ...retroDexTypes]);
      const anyMsgs = msgs.map((msg) => registry.encodeAsAny(msg));
      const txBody = TxBody.fromPartial({ messages: anyMsgs, memo: memo || "" });
      const txBodyBytes = TxBody.encode(txBody).finish();

      if (!signerPubkey || !(signerPubkey instanceof Uint8Array)) {
        throw new Error("Unable to load signer pubkey from Keplr");
      }

      const pubkey = encodePubkey(encodeSecp256k1Pubkey(signerPubkey));
      const sequenceNumber = Int53.fromString(sequence).toNumber();

      const buildAuthInfoBytes = (feeValue: any) =>
        makeAuthInfoBytes(
          [{ pubkey, sequence: sequenceNumber }],
          feeValue.amount,
          parseInt(feeValue.gas, 10),
          feeValue.granter,
          feeValue.payer
        );

      const buildUnsignedTxBytes = (feeValue: any) => {
        const authInfoBytes = buildAuthInfoBytes(feeValue);
        const txRaw = TxRaw.fromPartial({
          bodyBytes: txBodyBytes,
          authInfoBytes,
          signatures: [new Uint8Array()]
        });
        return toBase64(TxRaw.encode(txRaw).finish());
      };

      const signTx = async (feeValue: any, debugLabel?: string) => {
        const authInfoBytes = buildAuthInfoBytes(feeValue);

        const signDoc = makeSignDocDirect(
          txBodyBytes,
          authInfoBytes,
          chainId,
          Int53.fromString(accountNumber).toNumber()
        );

        const { signature, signed } = await offlineSigner.signDirect(
          signerAddress,
          signDoc,
          KEPLR_DEFAULT_OPTS as any
        );

        const txRaw = TxRaw.fromPartial({
          bodyBytes: signed.bodyBytes,
          authInfoBytes: signed.authInfoBytes,
          signatures: [fromBase64(signature.signature)]
        });

        const txBytes = TxRaw.encode(txRaw).finish();

        if (debugLabel) {
          const authInfo = AuthInfo.decode(txRaw.authInfoBytes);
          console.log(`${debugLabel} fee`, {
            amount: authInfo.fee?.amount?.map((c) => ({ denom: c.denom, amount: c.amount })),
            gasLimit: authInfo.fee?.gasLimit?.toString()
          });
        }

        return { txRaw, txBytesBase64: toBase64(txBytes) };
      };

      const baseGasLimit = Math.max(MIN_GAS_LIMIT, msgs.length * DEFAULT_GAS_PER_MSG);
      let feeToUse = fee ?? null;

      const readGasValue = (f: any) => Number(f?.gas ?? f?.gas_limit ?? f?.gasLimit ?? 0);
      const setGasValue = (f: any, gas: number | string) => ({ ...f, gas: String(gas), gas_limit: String(gas), gasLimit: String(gas) });

      // Arcade txs can need more headroom (ante ReadPerByte).
      // If caller passed a tight gas value, bump it and scale fee amount to keep the same gas price.
      const ARCADE_TX_GAS = 300000;
      const isArcadeTx = msgs.some((m) => typeof m?.typeUrl === "string" && m.typeUrl.startsWith("/retrochain.arcade.v1."));

      if (feeToUse && isArcadeTx) {
        const origGas = readGasValue(feeToUse);
        if (Number.isFinite(origGas) && origGas > 0 && origGas < ARCADE_TX_GAS) {
          const coin0 = feeToUse.amount?.[0];

          // If fee is a single uretro coin, scale it to keep the same gas price.
          if (coin0?.denom === DEFAULT_FEE_DENOM && coin0?.amount && /^\d+$/.test(String(coin0.amount))) {
            const origAmt = Number(coin0.amount);
            const scaledAmt = Math.ceil((origAmt * ARCADE_TX_GAS) / origGas);
            feeToUse = setGasValue(
              {
                ...feeToUse,
                amount: [{ ...coin0, amount: String(Math.max(origAmt, scaledAmt)) }]
              },
              ARCADE_TX_GAS
            );
          } else {
            // If fee shape is unknown, at least bump gas.
            feeToUse = setGasValue(feeToUse, ARCADE_TX_GAS);
          }
        }
      }

      if (!feeToUse) {
        const simulateFee = {
          amount: [{ denom: DEFAULT_FEE_DENOM, amount: "1" }],
          gas: baseGasLimit.toString()
        };

        try {
          const unsignedTxBytes = buildUnsignedTxBytes(simulateFee);
          const simulateRes = await api.post("/cosmos/tx/v1beta1/simulate", { tx_bytes: unsignedTxBytes });

          const gasUsed = Number(simulateRes.data?.gas_info?.gas_used ?? baseGasLimit);
          const adjustedGas = Math.ceil(gasUsed * DEFAULT_GAS_ADJUSTMENT);
          const feeAmount = Math.max(Math.ceil(adjustedGas * DEFAULT_GAS_PRICE), MIN_TOTAL_FEE).toString();

          feeToUse = {
            amount: [{ denom: DEFAULT_FEE_DENOM, amount: feeAmount }],
            gas: adjustedGas.toString()
          };
        } catch (simErr) {
          console.warn("Gas simulation failed, falling back to defaults:", simErr);
          const fallbackGas = baseGasLimit;
          feeToUse = {
            amount: [{
              denom: DEFAULT_FEE_DENOM,
              amount: Math.max(Math.ceil(fallbackGas * DEFAULT_GAS_PRICE), MIN_TOTAL_FEE).toString()
            }],
            gas: fallbackGas.toString()
          };
        }
      }

      const { txBytesBase64 } = await signTx(feeToUse, "broadcast");
      const broadcastRes = await api.post("/cosmos/tx/v1beta1/txs", {
        tx_bytes: txBytesBase64,
        mode: "BROADCAST_MODE_SYNC"
      });

      const txResponse = broadcastRes.data?.tx_response;
      if (txResponse?.code !== 0) {
        throw new Error(txResponse?.raw_log || txResponse?.log || "Transaction failed");
      }

      return txResponse;
    } catch (e: any) {
      console.error("Transaction failed:", e);
      throw e;
    }
  };

  const signAndBroadcast = async (chainId: string, msgs: any[], fee: any, memo = "") => {
    const provider = getWalletProvider();
    if (!provider) throw new Error("Keplr-compatible wallet not available");
    if (!address.value) throw new Error("Not connected to Keplr");

    const resolveRpcEndpoint = (targetChainId: string) => {
      if (targetChainId === CHAIN_ID) {
        let endpoint = rpcBase.value || "/rpc";
        if (typeof window !== "undefined" && !endpoint.startsWith("http")) {
          const origin = window.location.origin;
          endpoint = `${origin}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        }
        return endpoint;
      }
      if (targetChainId === COSMOS_CHAIN_ID && COSMOS_RPC_URL) {
        return COSMOS_RPC_URL;
      }
      return null;
    };

    const normalizeArcadeSubmitScoreFee = (originalFee: any) => {
      const ARCADE_TX_GAS = 300000;
      const isArcadeTx = msgs.some((m) => typeof m?.typeUrl === "string" && m.typeUrl.startsWith("/retrochain.arcade.v1."));
      let feeNormalized = originalFee;

      const readGasValue = (f: any) => Number(f?.gas ?? f?.gas_limit ?? f?.gasLimit ?? 0);
      const setGasValue = (f: any, gas: number | string) => ({ ...f, gas: String(gas), gas_limit: String(gas), gasLimit: String(gas) });

      if (originalFee && isArcadeTx) {
        const origGas = readGasValue(originalFee);
        if (Number.isFinite(origGas) && origGas > 0 && origGas < ARCADE_TX_GAS) {
          const coin0 = originalFee.amount?.[0];
          if (coin0?.denom === DEFAULT_FEE_DENOM && coin0?.amount && /^\d+$/.test(String(coin0.amount))) {
            const origAmt = Number(coin0.amount);
            const scaledAmt = Math.ceil((origAmt * ARCADE_TX_GAS) / origGas);
            feeNormalized = setGasValue(
              {
                ...originalFee,
                amount: [{ ...coin0, amount: String(Math.max(origAmt, scaledAmt)) }]
              },
              ARCADE_TX_GAS
            );
          } else {
            feeNormalized = setGasValue(originalFee, ARCADE_TX_GAS);
          }
        }
      }

      return feeNormalized;
    };

    const feeNormalized = normalizeArcadeSubmitScoreFee(fee);

    const rpcEndpoint = resolveRpcEndpoint(chainId);
    const attemptRpc = async () => {
      if (!rpcEndpoint) {
        throw new Error(`No RPC endpoint configured for ${chainId}. Set VITE_COSMOS_RPC_URL (or chain-specific RPC) to continue.`);
      }

      const offlineSigner = provider.getOfflineSigner(chainId);
      const accounts = await offlineSigner.getAccounts();

      const registry = new Registry([...defaultRegistryTypes, ...retroBtcStakeTypes, ...retroDexTypes]);
      const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, offlineSigner, { registry });
      return client.signAndBroadcast(accounts[0].address, msgs, feeNormalized, memo);
    };

    try {
      return await attemptRpc();
    } catch (e) {
      console.warn("RPC sign/broadcast failed, evaluating fallback…", e);
      if (chainId === CHAIN_ID && isUndefinedValueError(e)) {
        return signAndBroadcastWithREST(chainId, msgs, feeNormalized, memo);
      }
      throw e;
    }
  };

  if (typeof window !== "undefined" && window.keplr) {
    // Always route signAndBroadcast through our normalized path (handles arcade submit-score gas bump)
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
