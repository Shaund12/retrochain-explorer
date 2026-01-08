<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import { useNetwork } from "@/composables/useNetwork";
import { useAccount } from "@/composables/useAccount";
import { useAssets } from "@/composables/useAssets";
import { smartQueryContract } from "@/utils/wasmSmartQuery";
import { stringToBase64 } from "@/utils/encoding";
import { useApi } from "@/composables/useApi";
import { useTxs } from "@/composables/useTxs";

const { address, connect, signAndBroadcast } = useKeplr();
const { current: network } = useNetwork();
const { balances, load, loading: accountLoading } = useAccount();
const { cw20Tokens, fetchAssets, loading: assetsLoading } = useAssets();
const api = useApi();
const toast = useToast();
const { txs: addressTxs, loading: burnLoading, searchByAddress } = useTxs();


const chainId = computed(() => (network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"));
const refreshing = ref(false);
const cw20Holdings = ref<Array<{ contract: string; symbol: string; name: string; decimals: number; balance: string }>>([]);

const factoryHoldings = computed(() => {
  if (!address.value) return [] as Array<{ denom: string; amount: string }>;
  const prefix = `factory/${address.value}/`;
  return balances.value
    .filter((b) => b.denom?.startsWith(prefix) && BigInt(b.amount || "0") > 0n)
    .map((b) => ({ denom: b.denom, amount: b.amount }));
});

const nativeBalanceUretro = computed(() => balances.value.find((b) => b.denom === "uretro")?.amount || "0");
const nativeBalanceDisplay = computed(() => `${formatAmount(nativeBalanceUretro.value, 6)} RETRO`);
const nativeBurnAmount = ref("0");

const burnHistory = computed(() => {
  const list = Array.isArray(addressTxs.value) ? addressTxs.value : [];
  const burns = list.flatMap((tx) =>
    (tx.burns || []).map((b: any) => ({
      hash: tx.hash,
      height: tx.height,
      timestamp: tx.timestamp,
      amount: b.amount,
      denom: b.denom
    }))
  );
  burns.sort((a, b) => (b.height || 0) - (a.height || 0));
  return burns.slice(0, 10);
});

const shortHash = (hash?: string) => {
  if (!hash) return "";
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
};

// Native RETRO burn now uses tokenfactory MsgBurnNative (no sink address transfer).

const formatAmount = (amount: string, decimals = 6) => {
  try {
    const raw = BigInt(amount || "0");
    const base = 10n ** BigInt(Math.max(0, decimals));
    const whole = raw / base;
    const frac = raw % base;
    const wholeStr = whole.toString();
    if (frac === 0n) return wholeStr;
    let fracStr = frac.toString().padStart(Math.max(0, decimals), "0");
    fracStr = fracStr.replace(/0+$/, "");
    return `${wholeStr}.${fracStr}`;
  } catch {
    return amount;
  }
};

const parseRetroToUretro = (input: string | number | null | undefined): string | null => {
  if (input === null || input === undefined) return null;
  const trimmed = input.toString().trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d{0,6})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  try {
    const value = BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded);
    return value.toString();
  } catch {
    return null;
  }
};

const refreshHoldings = async () => {
  try {
    refreshing.value = true;
    cw20Holdings.value = [];
    if (!address.value) await connect();
    if (!address.value) throw new Error("Connect wallet to continue");

    await load(address.value);
    await fetchAssets();
    await refreshBurnHistory();

    const myAddrLower = address.value.toLowerCase();
    const mine = cw20Tokens.value.filter((t) => (t.minter || "").toLowerCase() === myAddrLower);

    for (const token of mine) {
      try {
        const res = await smartQueryContract(api as any, token.address, { balance: { address: address.value } });
        const bal = String(res?.balance ?? res?.amount ?? "0");
        if (BigInt(bal || "0") > 0n) {
          cw20Holdings.value.push({
            contract: token.address,
            symbol: token.symbol,
            name: token.name,
            decimals: token.decimals ?? 6,
            balance: bal
          });
        }
      } catch (err) {
        console.warn("CW20 balance query failed", err);
      }
    }
  } catch (err: any) {
    toast.showError(err?.message || "Failed to load holdings");
  } finally {
    refreshing.value = false;
  }
};

onMounted(() => {
  refreshHoldings();
});

const refreshBurnHistory = async () => {
  if (!address.value) return;
  try {
    await searchByAddress(address.value, 25, 0);
  } catch (err) {
    console.warn("Burn history fetch failed", err);
  }
};

const factoryTypeUrls = [
  "/retrochain.tokenfactory.v1beta1.MsgBurn",
  "/retrochain.tokenfactory.v1.MsgBurn",
  "/retrochain.tokenfactory.MsgBurn",
  "/osmosis.tokenfactory.v1beta1.MsgBurn",
  "/osmosis.tokenfactory.v1.MsgBurn",
  "/osmosis.tokenfactory.MsgBurn"
];

const burnFactory = async (denom: string, amount: string) => {
  if (!address.value) {
    await connect();
    if (!address.value) return;
  }
  const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "220000" };

  // Many tokenfactory modules expect amount as a single "<amt><denom>" string.
  const msgBase = {
    sender: address.value,
    // send as string amount+denom which this chain expects for tokenfactory burn
    amount: `${amount}${denom}`,
    burn_from_address: address.value
  };

  for (const typeUrl of factoryTypeUrls) {
    try {
      await signAndBroadcast(chainId.value, [{ typeUrl, value: msgBase }], fee, "Burn factory token");
      toast.showSuccess("Burn submitted");
      await refreshHoldings();
      return;
    } catch (err: any) {
      console.warn(`Burn attempt failed for ${typeUrl}`, err);
    }
  }
  toast.showError("Burn failed. Tokenfactory message type may differ on this chain.");
};

const burnNative = async () => {
  if (!address.value) {
    await connect();
    if (!address.value) return;
  }

  const micro = parseRetroToUretro(nativeBurnAmount.value);
  if (!micro || micro === "0") {
    toast.showError("Enter a valid RETRO amount (max 6 decimals).");
    return;
  }

  if (BigInt(micro) > BigInt(nativeBalanceUretro.value || "0")) {
    toast.showError("Amount exceeds wallet balance.");
    return;
  }

  const fee = { amount: [{ denom: "uretro", amount: "12000" }], gas: "160000" };
  const msgBase = {
    sender: address.value,
    amount: `${micro}uretro`,
    burn_from_address: address.value
  };

  const typeUrls = [
    "/retrochain.tokenfactory.v1.MsgBurnNative",
    "/retrochain.tokenfactory.v1beta1.MsgBurnNative"
  ];

  try {
    for (const typeUrl of typeUrls) {
      try {
        await signAndBroadcast(chainId.value, [{ typeUrl, value: msgBase }], fee, "Burn native RETRO");
        toast.showSuccess("Native burn submitted");
        nativeBurnAmount.value = "0";
        await refreshHoldings();
        return;
      } catch (err) {
        console.warn(`Native burn attempt failed for ${typeUrl}`, err);
      }
    }
    toast.showError("Native burn failed. MsgBurnNative not accepted on this chain.");
  } catch (err: any) {
    toast.showError(err?.message || "Native burn failed");
  }
};

const burnCw20 = async (holding: { contract: string; balance: string }) => {
  if (!address.value) {
    await connect();
    if (!address.value) return;
  }
  try {
    const fee = { amount: [{ denom: "uretro", amount: "9000" }], gas: "260000" };
    const msg = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: {
        sender: address.value,
        contract: holding.contract,
        msg: stringToBase64(JSON.stringify({ burn: { amount: holding.balance } })),
        funds: []
      }
    };
    await signAndBroadcast(chainId.value, [msg], fee, "Burn CW20");
    toast.showSuccess("CW20 burn submitted");
    await refreshHoldings();
  } catch (err: any) {
    toast.showError(err?.message || "CW20 burn failed");
  }
};
</script>

<template>
  <div class="space-y-5">
    <div class="card bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-emerald-500/10 border-white/10 shadow-lg shadow-rose-500/20">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-[11px] text-rose-200 uppercase tracking-[0.18em]">
            <span class="px-2 py-1 rounded-full border border-rose-300/50 bg-rose-500/10">Secure Burn</span>
            <span class="px-2 py-1 rounded-full border border-amber-300/40 bg-amber-500/10">Irreversible</span>
          </div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-2">Token Burner <span class="text-sm text-emerald-200">Mainnet-safe</span></h1>
          <p class="text-sm text-slate-300 max-w-3xl">Burn native RETRO, factory denoms you minted, or your own CW20s. Gas and fees normalized; messages are signed client-side with Keplr.</p>
          <div class="flex flex-wrap gap-2 text-[11px] text-slate-200">
            <span class="badge border-emerald-400/60 text-emerald-200 bg-emerald-500/10">Chain: {{ chainId }}</span>
            <span class="badge border-cyan-400/60 text-cyan-200 bg-cyan-500/10">Wallet: {{ address || 'Not connected' }}</span>
            <span class="badge border-amber-400/60 text-amber-200 bg-amber-500/10">Holdings: {{ factoryHoldings.length }} factory • {{ cw20Holdings.length }} CW20</span>
          </div>
        </div>
        <div class="flex gap-2 items-center">
          <button class="btn" @click="refreshHoldings" :disabled="refreshing || accountLoading || assetsLoading">
            {{ address ? 'Refresh' : 'Connect' }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="card border-white/10 bg-slate-900/60 shadow-inner">
        <div class="text-[11px] uppercase tracking-wider text-slate-400">Native RETRO</div>
        <div class="text-xl font-semibold text-white flex items-center gap-2">
          <span>🔥</span> <span>{{ nativeBalanceDisplay }}</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-1">Balance available to burn</div>
      </div>
      <div class="card border-white/10 bg-slate-900/60 shadow-inner">
        <div class="text-[11px] uppercase tracking-wider text-slate-400">Factory denoms</div>
        <div class="text-xl font-semibold text-white flex items-center gap-2">
          <span>🏭</span> <span>{{ factoryHoldings.length }}</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-1">Minted by your wallet</div>
      </div>
      <div class="card border-white/10 bg-slate-900/60 shadow-inner">
        <div class="text-[11px] uppercase tracking-wider text-slate-400">CW20 tokens</div>
        <div class="text-xl font-semibold text-white flex items-center gap-2">
          <span>🧩</span> <span>{{ cw20Holdings.length }}</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-1">You are the minter</div>
      </div>
    </div>

    <RcDisclaimer type="warning" title="Irreversible">
      <p>Burning destroys tokens permanently. Ensure you are burning the correct denoms/contracts.</p>
    </RcDisclaimer>

    <div class="card" v-if="accountLoading || assetsLoading || refreshing">
      <RcLoadingSpinner size="md" text="Loading balances and tokens…" />
    </div>

    <div class="card border-emerald-400/30 bg-emerald-500/5 shadow-lg shadow-emerald-500/20">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">🔥</span>
          <div>
            <h2 class="text-base font-semibold text-white">Native RETRO burn</h2>
            <p class="text-[11px] text-emerald-200">Uses MsgBurnNative (tokenfactory)</p>
          </div>
        </div>
        <span class="text-[11px] text-slate-300">Balance: {{ nativeBalanceDisplay }}</span>
      </div>
      <div class="space-y-2 text-sm text-slate-300">
        <div class="p-2 rounded-lg border border-emerald-400/30 bg-emerald-500/5 text-[11px] text-emerald-100">
          Burns RETRO directly on-chain. Denom is fixed to uretro; burn_from_address is locked to your wallet.
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="nativeBurnAmount"
            class="input flex-1"
            type="number"
            min="0"
            step="0.000001"
            placeholder="Amount in RETRO"
          />
          <div class="flex gap-2">
            <button class="btn text-xs" @click="nativeBurnAmount = formatAmount(nativeBalanceUretro.value, 6)">Max</button>
            <button class="btn btn-primary text-xs" @click="burnNative">Burn</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card border-white/10 bg-slate-900/60 shadow-inner">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">🧾</span>
          <div>
            <h2 class="text-base font-semibold text-white">Your burn history</h2>
            <p class="text-[11px] text-slate-400">Recent burns linked to this wallet</p>
          </div>
        </div>
        <span class="text-[11px] text-slate-400">{{ burnHistory.length || 0 }} shown</span>
      </div>
      <div v-if="burnLoading" class="text-sm text-slate-400 flex items-center gap-2">
        <RcLoadingSpinner size="sm" text="Loading burn history…" />
      </div>
      <div v-else-if="!burnHistory.length" class="text-sm text-slate-500">No burns found for this wallet.</div>
      <div v-else class="space-y-2">
        <div v-for="(burn, idx) in burnHistory" :key="burn.hash + idx" class="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between">
          <div class="space-y-1">
            <div class="text-sm text-white font-semibold">{{ burn.amount }} {{ burn.denom }}</div>
            <div class="text-[11px] text-slate-400 flex gap-3">
              <span>Block {{ burn.height }}</span>
              <span v-if="burn.timestamp">{{ burn.timestamp }}</span>
            </div>
          </div>
          <div class="text-[11px] text-emerald-300">{{ shortHash(burn.hash) }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-white">Factory tokens you own (minted by this wallet)</h2>
        <span class="text-[11px] text-slate-400">factory/{{ address }}/*</span>
      </div>
      <div v-if="!factoryHoldings.length" class="text-sm text-slate-400">No factory balances detected for this wallet.</div>
      <div v-else class="space-y-3">
        <div v-for="token in factoryHoldings" :key="token.denom" class="p-3 rounded-xl border border-rose-400/40 bg-rose-500/5 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-white">{{ token.denom }}</div>
            <div class="text-xs text-slate-400">Balance: {{ token.amount }}</div>
          </div>
          <button class="btn" @click="burnFactory(token.denom, token.amount)">Burn all</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-white">CW20 tokens you minted (with balance)</h2>
        <span class="text-[11px] text-slate-400">Minter = your wallet</span>
      </div>
      <div v-if="!cw20Holdings.length" class="text-sm text-slate-400">No CW20 balances found where you are the minter.</div>
      <div v-else class="space-y-3">
        <div v-for="token in cw20Holdings" :key="token.contract" class="p-3 rounded-xl border border-amber-400/40 bg-amber-500/5 flex items-center justify-between">
          <div>
            <div class="text-sm font-semibold text-white">{{ token.symbol }} • {{ token.name }}</div>
            <div class="text-xs text-slate-400">{{ token.contract }}</div>
            <div class="text-xs text-slate-500">Balance: {{ formatAmount(token.balance, token.decimals) }}</div>
          </div>
          <button class="btn" @click="burnCw20(token)">Burn all</button>
        </div>
      </div>
    </div>
  </div>
</template>
