<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
const tokenImage = ref("");
const loading = ref(false);
const error = ref<string | null>(null);
const params = ref<any | null>(null);
const defaultsApplied = ref(false);
const userSetGraduationReserve = ref(false);

const DECIMALS = 6n;
const SCALE = 10n ** DECIMALS;

const toMicro = (val: string): bigint | null => {
  const s = (val || "").trim().replace(/,/g, "");
  if (!s) return null;
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  const sign = s.startsWith("-") ? -1n : 1n;
  const clean = s.replace(/^[+-]/, "");
  const [w, f = ""] = clean.split(".");
  const whole = BigInt(w || "0");
  const frac = BigInt((f + "000000").slice(0, 6));
  return sign * (whole * SCALE + frac);
};

const formatMicroAmount = (raw: bigint | null, unit: string) => {
  if (raw === null || raw === undefined) return "—";
  const num = Number(raw) / Number(SCALE);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} ${unit}`;
};

const microToDisplay = (raw: bigint | null) => {
  if (raw === null || raw === undefined) return "";
  const sign = raw < 0n ? "-" : "";
  const val = raw < 0n ? -raw : raw;
  const whole = val / SCALE;
  const frac = val % SCALE;
  const fracStr = frac.toString().padStart(6, "0");
  return `${sign}${whole.toString()}.${fracStr}`;
};

const formatMicroAsDecimal = (raw: bigint | null, suffix = "") => {
  if (raw === null || raw === undefined) return "—";
  const sign = raw < 0n ? "-" : "";
  const val = raw < 0n ? -raw : raw;
  const whole = val / SCALE;
  const frac = val % SCALE;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  const numStr = sign + whole.toString() + (fracStr ? `.${fracStr}` : "");
  return suffix ? `${numStr}${suffix}` : numStr;
};

const formatRawAmount = (raw: bigint | null, unit: string) => {
  if (raw === null || raw === undefined) return "—";
  return `${raw.toString()} ${unit}`;
};

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
    if (!defaultsApplied.value && params.value) {
      const defMax = params.value?.default_max_supply;
      if (!maxSupply.value.trim() && defMax !== null && defMax !== undefined) {
        maxSupply.value = microToDisplay(BigInt(defMax));
      }
      defaultsApplied.value = true;
    }
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

const maxSupplyRawInput = computed(() => toMicro(maxSupply.value));
const graduationReserveRawInput = computed(() => toMicro(graduationReserve.value));

const suggestedGraduationReserveRaw = computed(() => {
  const defGrad = params.value?.default_graduation_reserve_uretro;
  const defMax = params.value?.default_max_supply;
  if (defGrad === null || defGrad === undefined) return null;
  const maxRaw = maxSupplyRawInput.value ?? (defMax !== null && defMax !== undefined ? BigInt(defMax) : null);
  if (maxRaw === null || defMax === null || defMax === undefined) return BigInt(defGrad);
  const baseDefMax = BigInt(defMax);
  if (baseDefMax === 0n) return BigInt(defGrad);
  return (BigInt(defGrad) * maxRaw) / baseDefMax;
});

const effectiveMaxSupplyRaw = computed(() => {
  if (maxSupply.value.trim()) return maxSupplyRawInput.value;
  const def = params.value?.default_max_supply;
  return def !== null && def !== undefined ? BigInt(def) : null;
});

const effectiveGraduationReserveRaw = computed(() => {
  if (graduationReserve.value.trim()) return graduationReserveRawInput.value;
  const def = params.value?.default_graduation_reserve_uretro;
  return def !== null && def !== undefined ? BigInt(def) : null;
});

const virtualReserveRaw = computed(() => {
  const v = params.value?.default_virtual_reserve_uretro;
  return v !== null && v !== undefined ? BigInt(v) : null;
});

const estimatedInitialSpotPriceScaled = computed(() => {
  const maxRaw = effectiveMaxSupplyRaw.value;
  const virtRaw = virtualReserveRaw.value;
  if (maxRaw === null || virtRaw === null || maxRaw === 0n) return null;
  // price scaled by 1e6 to preserve precision (RETRO per token)
  return (virtRaw * SCALE) / maxRaw;
});

const formatRetPerToken = (scaled?: bigint | null) => formatMicroAsDecimal(scaled ?? null);

const maxSupplyDisplay = computed(() => formatMicroAmount(effectiveMaxSupplyRaw.value, "tokens"));
const maxSupplyRawDisplay = computed(() => formatRawAmount(effectiveMaxSupplyRaw.value, "micro (raw)"));
const graduationReserveDisplay = computed(() => formatMicroAmount(effectiveGraduationReserveRaw.value, "RETRO"));
const graduationReserveRawDisplay = computed(() => formatRawAmount(effectiveGraduationReserveRaw.value, "uretro (raw)"));
const virtualReserveDisplay = computed(() => formatMicroAmount(virtualReserveRaw.value, "RETRO"));
const virtualReserveRawDisplay = computed(() => formatRawAmount(virtualReserveRaw.value, "uretro (raw)"));
const tokensForSaleDisplay = computed(() => formatMicroAmount(effectiveMaxSupplyRaw.value, "tokens"));
const tokensForSaleRawDisplay = computed(() => formatRawAmount(effectiveMaxSupplyRaw.value, "micro (raw)"));
const estimatedInitialSpotPriceDisplay = computed(() => formatRetPerToken(estimatedInitialSpotPriceScaled.value));
const suggestedGraduationReserveDisplay = computed(() => formatMicroAmount(suggestedGraduationReserveRaw.value, "RETRO"));
const suggestedGraduationReserveRawDisplay = computed(() => formatRawAmount(suggestedGraduationReserveRaw.value, "uretro (raw)"));

watch(
  [maxSupplyRawInput, () => params.value?.default_max_supply, () => params.value?.default_graduation_reserve_uretro],
  () => {
    if (userSetGraduationReserve.value) return;
    if (suggestedGraduationReserveRaw.value !== null) {
      const nextVal = microToDisplay(suggestedGraduationReserveRaw.value);
      graduationReserve.value = nextVal;
    }
  },
  { immediate: true }
);

watch(
  graduationReserve,
  (val, old) => {
    if (val === old) return;
    // If user types something custom, stop auto-updating.
    if (val.trim()) {
      userSetGraduationReserve.value = true;
    } else {
      userSetGraduationReserve.value = false;
    }
  }
);

const submit = async () => {
  if (!subdenom.value.trim()) {
    toast.showError("Subdenom is required");
    return;
  }

  const maxRaw = maxSupplyRawInput.value;
  const gradRaw = graduationReserveRawInput.value;

  if (maxSupply.value.trim() && maxRaw === null) {
    toast.showError("Max supply must be a number (tokens, up to 6 decimals).");
    return;
  }
  if (graduationReserve.value.trim() && gradRaw === null) {
    toast.showError("Graduation reserve must be a number (RETRO, up to 6 decimals).");
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
        ...(maxRaw !== null ? { maxSupply: maxRaw.toString() } : {}),
        ...(gradRaw !== null ? { graduationReserveUretro: gradRaw.toString() } : {})
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
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/30 via-purple-700/25 to-cyan-500/30 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <button class="text-emerald-200 hover:underline" @click="router.push({ name: 'launcher' })">Launcher</button>
          <span class="text-slate-500">/</span>
          <span>Create Launch</span>
        </div>
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div class="space-y-2">
            <h1 class="text-3xl font-bold text-white flex items-center gap-2">
              <span>🚀 Create a Launch</span>
              <span class="text-sm text-emerald-200">x/launcher</span>
            </h1>
            <p class="text-sm text-slate-300 max-w-3xl">Set your subdenom, optional caps, and preview your resulting factory denom before broadcasting MsgCreateLaunch.</p>
            <div class="flex flex-wrap gap-2 text-[11px] text-slate-200">
              <span class="px-2 py-1 rounded-full border border-white/10 bg-white/5">Resulting: {{ resultingDenom }}</span>
              <span class="px-2 py-1 rounded-full border border-emerald-400/40 text-emerald-100">Create fee: {{ createFeeDisplay }}</span>
              <span class="px-2 py-1 rounded-full border border-cyan-400/40 text-cyan-100">Trading fee: {{ tradingFeeBps }} bps</span>
              <span class="px-2 py-1 rounded-full border border-amber-400/40 text-amber-100">Recipient: {{ feeRecipient }}</span>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 shadow-inner">
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Display symbol (UI only)</div>
            <input v-model="tokenSymbol" class="input mt-2" placeholder="RETRO" />
            <div class="text-[11px] text-slate-500 mt-1">For your dashboards; not written on-chain.</div>
          </div>
        </div>
      </div>
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Launch failed">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div class="card space-y-4">
      <div class="grid md:grid-cols-3 gap-3">
        <div class="p-4 rounded-xl border border-emerald-400/50 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-900/60 shadow-[0_10px_40px_-30px_rgba(16,185,129,0.8)] space-y-3">
          <div class="text-[11px] uppercase tracking-wider text-emerald-200">Token identity</div>
          <div class="space-y-2">
            <label class="text-[11px] text-slate-400">Subdenom</label>
            <input v-model="subdenom" class="input bg-slate-900/70 border-emerald-400/40 text-white" placeholder="MYCOIN" />
            <p class="text-[11px] text-slate-500">Factory denom: {{ resultingDenom }}</p>
          </div>
          <div class="space-y-2">
            <label class="text-[11px] text-slate-400">Display symbol (UI only)</label>
            <input v-model="tokenSymbol" class="input bg-slate-900/70 border-emerald-400/40 text-white" placeholder="RETRO" />
            <p class="text-[11px] text-slate-500">Not on-chain; for your dashboards.</p>
          </div>
          <div class="space-y-2">
            <label class="text-[11px] text-slate-400">Token image URL (UI only)</label>
            <input v-model="tokenImage" class="input bg-slate-900/70 border-emerald-400/40 text-white" placeholder="https://...png" />
            <div class="flex items-center gap-3">
              <div class="w-14 h-14 rounded-lg border border-emerald-400/30 bg-slate-900/70 overflow-hidden flex items-center justify-center text-[11px] text-slate-500">
                <img v-if="tokenImage" :src="tokenImage" alt="token" class="w-full h-full object-cover" />
                <span v-else>Preview</span>
              </div>
              <p class="text-[11px] text-slate-500">Optional image shown in your UI; not stored on-chain.</p>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-xl border border-amber-400/50 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-900/60 shadow-[0_10px_40px_-30px_rgba(245,158,11,0.8)] space-y-3">
          <div class="text-[11px] uppercase tracking-wider text-amber-200">Supply & Reserve</div>
          <div class="space-y-2">
            <label class="text-[11px] text-slate-400">Max supply (tokens, e.g. 4200.000000)</label>
            <input v-model="maxSupply" class="input bg-slate-900/70 border-amber-400/40 text-white" placeholder="(module default)" />
          </div>
          <div class="space-y-2">
            <label class="text-[11px] text-slate-400">Graduation reserve (RETRO, e.g. 10.000000)</label>
            <input v-model="graduationReserve" class="input bg-slate-900/70 border-amber-400/40 text-white" placeholder="(module default)" />
            <div class="flex flex-wrap gap-2 text-[11px]">
              <button class="btn-secondary px-2 py-1" @click="graduationReserve = '1'">1</button>
              <button class="btn-secondary px-2 py-1" @click="graduationReserve = '10'">10</button>
              <button class="btn-secondary px-2 py-1" @click="graduationReserve = '100'">100</button>
            </div>
            <p class="text-[11px] text-slate-500">Reserve backing at graduation.</p>
          </div>
        </div>

        <div class="p-4 rounded-xl border border-cyan-400/50 bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-slate-900/60 shadow-[0_10px_40px_-30px_rgba(6,182,212,0.8)] space-y-3">
          <div class="text-[11px] uppercase tracking-wider text-cyan-200">Fees & Params</div>
          <div class="flex items-center justify-between text-sm text-slate-200">
            <span>Create launch fee</span>
            <span class="font-semibold">{{ createFeeDisplay }}</span>
          </div>
          <div class="flex items-center justify-between text-sm text-slate-200">
            <span>Trading fee</span>
            <span class="font-semibold">{{ tradingFeeBps }} bps</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-300">
            <span>Fee recipient</span>
            <span class="font-mono text-emerald-200">{{ feeRecipient }}</span>
          </div>
          <div class="text-[11px] text-slate-500">Plus network gas in uretro when broadcasting.</div>
        </div>
      </div>

      <div class="p-4 rounded-xl border border-white/10 bg-slate-900/60 space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">On-chain preview</h3>
          <span class="text-[11px] text-slate-400">Shows raw micro values and human-readable amounts</span>
        </div>
        <div class="grid md:grid-cols-2 gap-2 text-sm text-slate-200">
          <div class="flex items-center justify-between">
            <span>Max supply (tokens)</span>
            <span class="font-semibold">{{ maxSupplyDisplay }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>Max supply raw (micro tokens)</span>
            <span class="font-mono text-emerald-200">{{ maxSupplyRawDisplay }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span>Graduation reserve (RETRO)</span>
            <span class="font-semibold">{{ graduationReserveDisplay }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>Graduation reserve raw (uretro)</span>
            <span class="font-mono text-emerald-200">{{ graduationReserveRawDisplay }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span>Suggested graduation reserve (scaled)</span>
            <span class="font-semibold">{{ suggestedGraduationReserveDisplay }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>Suggested raw (uretro)</span>
            <span class="font-mono text-emerald-200">{{ suggestedGraduationReserveRawDisplay }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span>Virtual reserve (RETRO)</span>
            <span class="font-semibold">{{ virtualReserveDisplay }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>Virtual reserve raw (uretro)</span>
            <span class="font-mono text-emerald-200">{{ virtualReserveRawDisplay }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span>Tokens for sale at launch</span>
            <span class="font-semibold">{{ tokensForSaleDisplay }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>Tokens for sale raw (micro tokens)</span>
            <span class="font-mono text-emerald-200">{{ tokensForSaleRawDisplay }}</span>
          </div>

          <div class="flex items-center justify-between">
            <span>Estimated initial spot price</span>
            <span class="font-semibold">{{ estimatedInitialSpotPriceDisplay }} RETRO / token</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <button class="btn" :disabled="loading" @click="submit">{{ loading ? 'Submitting…' : 'Create Launch' }}</button>
        <button class="btn-secondary" :disabled="loading" @click="router.push({ name: 'launcher' })">Cancel</button>
        <span v-if="loading" class="flex items-center gap-2 text-sm text-slate-400">
          <RcLoadingSpinner size="sm" />
          <span>Broadcasting transaction…</span>
        </span>
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
