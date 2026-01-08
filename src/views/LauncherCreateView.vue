<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import { useKeplr } from "@/composables/useKeplr";
import { useApi } from "@/composables/useApi";
import { useToast } from "@/composables/useToast";
import { useNetwork } from "@/composables/useNetwork";

const router = useRouter();
const { address, connect, signAndBroadcast } = useKeplr();
const api = useApi();
const toast = useToast();
const { current: network } = useNetwork();

const chainId = computed(() => (network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"));

const subdenom = ref("");
const maxSupply = ref("");
const graduationReserve = ref("");
const tokenSymbol = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const params = ref<any | null>(null);

const formatRetro = (value?: string | number | null) => {
  if (value === undefined || value === null || value === "") return "—";
  try {
    const raw = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(value);
    const whole = raw / 1_000_000n;
    const frac = raw % 1_000_000n;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (frac === 0n) return `${wholeStr} RETRO`;
    let fracStr = frac.toString().padStart(6, "0");
    fracStr = fracStr.replace(/0+$/, "");
    return `${wholeStr}.${fracStr} RETRO`;
  } catch {
    return "—";
  }
};

const loadParams = async () => {
  try {
    const res = await api.get(`/retrochain/launcher/v1/params`);
    params.value = res.data?.params ?? res.data ?? null;
  } catch (err: any) {
    params.value = null;
  }
};

loadParams();

const createFeeDisplay = computed(() => formatRetro(params.value?.create_launch_fee));
const tradingFeeBps = computed(() => params.value?.fee_bps ?? params.value?.trading_fee_bps ?? "—");
const feeRecipient = computed(() => params.value?.fee_recipient || "—");
const resultingDenom = computed(() => {
  const base = subdenom.value.trim() || "…";
  const owner = address.value || "<your-address>";
  return `factory/${owner}/${base}`;
});

const submit = async () => {
  if (!subdenom.value.trim()) {
    toast.showError("Subdenom is required");
    return;
  }
  try {
    loading.value = true;
    error.value = null;
    if (!address.value) {
      await connect();
      if (!address.value) throw new Error("Connect your wallet to continue");
    }

    const msg = {
      typeUrl: "/retrochain.launcher.v1.MsgCreateLaunch",
      value: {
        creator: address.value,
        subdenom: subdenom.value.trim(),
        ...(maxSupply.value.trim() ? { maxSupply: maxSupply.value.trim() } : {}),
        ...(graduationReserve.value.trim() ? { graduationReserveUretro: graduationReserve.value.trim() } : {})
      }
    };

    const fee = {
      amount: [{ denom: "uretro", amount: "8000" }],
      gas: "250000"
    };

    const res = await signAndBroadcast(chainId.value, [msg], fee, "");
    if (res?.code) {
      throw new Error(res?.rawLog || res?.raw_log || `Broadcast failed with code ${res.code}`);
    }
    toast.showSuccess("Launch created! Redirecting…");
    router.push({ name: "launcher" });
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 501) {
      error.value = "Launcher module not available on this node (HTTP 501).";
    } else if (typeof err?.message === "string" && err.message.includes("Unexpected token '<'")) {
      error.value = "Launcher RPC responded with HTML (module disabled or proxy misconfigured).";
    } else {
      error.value = err?.message || "Failed to create launch";
    }
    toast.showError(error.value);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-purple-600/20 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-2">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <button class="text-emerald-200 hover:underline" @click="router.push({ name: 'launcher' })">Launcher</button>
          <span class="text-slate-500">/</span>
          <span>Create Launch</span>
        </div>
        <h1 class="text-3xl font-bold text-white">Create a Launch</h1>
        <p class="text-sm text-slate-300">Submit MsgCreateLaunch to x/launcher. Fees are shown from on-chain params.</p>
      </div>
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Launch failed">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div class="card space-y-3">
      <div class="grid md:grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] uppercase tracking-wider text-slate-400">Subdenom</label>
          <input v-model="subdenom" class="input mt-1" placeholder="MYCOIN" />
          <p class="text-[11px] text-slate-500 mt-1">Resulting denom: factory/&lt;you&gt;/{{ subdenom || '...' }}</p>
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wider text-slate-400">Max supply (optional)</label>
          <input v-model="maxSupply" class="input mt-1" placeholder="(empty uses module default)" />
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-wider text-slate-400">Graduation reserve uretro (optional)</label>
          <input v-model="graduationReserve" class="input mt-1" placeholder="(empty uses module default)" />
        </div>
        <div class="rounded-lg bg-white/5 border border-white/10 p-3 text-sm text-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-[11px] uppercase tracking-wider text-slate-400">Create launch fee</span>
            <span class="font-semibold">{{ createFeeDisplay }}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-1">Plus network gas fee in uretro.</div>
          <div class="text-[11px] text-slate-500 mt-1">Trading fee: {{ tradingFeeBps }} bps · Recipient: {{ feeRecipient }}</div>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button class="btn" :disabled="loading" @click="submit">{{ loading ? 'Submitting…' : 'Create Launch' }}</button>
        <button class="btn-secondary" :disabled="loading" @click="router.push({ name: 'launcher' })">Cancel</button>
      </div>
      <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-400">
        <RcLoadingSpinner size="sm" />
        <span>Broadcasting transaction…</span>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="card border border-emerald-400/40 bg-emerald-500/5">
        <h2 class="text-sm font-semibold text-white mb-1">Launch Checklist</h2>
        <ul class="text-sm text-slate-200 space-y-1 list-disc list-inside">
          <li>Pick a short subdenom (e.g., MYCOIN).</li>
          <li>Optional: set max supply and graduation reserve in uretro.</li>
          <li>Fees shown above come from on-chain params.</li>
          <li>Wallet signs <code class="font-mono">MsgCreateLaunch</code> on {{ chainId }}.</li>
        </ul>
      </div>
      <div class="card border border-cyan-400/40 bg-cyan-500/5">
        <h2 class="text-sm font-semibold text-white mb-1">Pump-style Tips</h2>
        <ul class="text-sm text-slate-200 space-y-1 list-disc list-inside">
          <li>Share your denom immediately so traders can find it.</li>
          <li>Track spot price and progress on the Launches list.</li>
          <li>Graduation requires reserves + sold supply to hit targets.</li>
          <li>Keep some RETRO ready for fees and liquidity.</li>
        </ul>
      </div>
    </div>
  </div>
</template>
