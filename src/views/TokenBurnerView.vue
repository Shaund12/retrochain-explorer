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

const { address, connect, signAndBroadcast } = useKeplr();
const { current: network } = useNetwork();
const { balances, load, loading: accountLoading } = useAccount();
const { cw20Tokens, fetchAssets, loading: assetsLoading } = useAssets();
const api = useApi();
const toast = useToast();

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

const refreshHoldings = async () => {
  try {
    refreshing.value = true;
    cw20Holdings.value = [];
    if (!address.value) await connect();
    if (!address.value) throw new Error("Connect wallet to continue");

    await load(address.value);
    await fetchAssets();

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
  <div class="space-y-4">
    <div class="card">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Token Burner</h1>
          <p class="text-sm text-slate-400">Detects your factory and CW20 tokens (you minted) and lets you burn your balance.</p>
        </div>
        <button class="btn" @click="refreshHoldings" :disabled="refreshing || accountLoading || assetsLoading">
          {{ address ? 'Refresh' : 'Connect' }}
        </button>
      </div>
      <div class="text-xs text-slate-500 mt-2">Wallet: {{ address || 'Not connected' }}</div>
    </div>

    <RcDisclaimer type="warning" title="Irreversible">
      <p>Burning destroys tokens permanently. Ensure you are burning the correct denoms/contracts.</p>
    </RcDisclaimer>

    <div class="card" v-if="accountLoading || assetsLoading || refreshing">
      <RcLoadingSpinner size="md" text="Loading balances and tokens…" />
    </div>

    <div class="card" v-else>
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
