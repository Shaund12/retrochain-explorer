<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import { useNetwork } from "@/composables/useNetwork";

interface LaunchWithComputed {
  launch?: any;
  computed?: any;
}

const route = useRoute();
const router = useRouter();
const api = useApi();
const toast = useToast();
const { address, connect, signAndBroadcast } = useKeplr();
const { rpcBase, current: network } = useNetwork();
const chainId = computed(() => (network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"));

const denom = computed(() => route.params.denom as string | undefined);
const launch = ref<LaunchWithComputed | null>(null);
const params = ref<any | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const buyAmountUretro = ref("1000000");
const sellAmountToken = ref("1");
const slippageBps = ref(100); // 1%
const buyQuote = ref<any | null>(null);
const sellQuote = ref<any | null>(null);
const quotingBuy = ref(false);
const quotingSell = ref(false);
const trades = ref<Array<{ side: "buy" | "sell"; price: number; amountIn: string; amountOut: string; time: string }>>([]);
let ws: WebSocket | null = null;

const formatRetro = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
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

const formatInt = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
};

const formatPercent = (value?: number | string | null) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(2)}%`;
};

const shortAddr = (addr?: string, size = 14) => {
  if (!addr) return "—";
  if (addr.length <= size) return addr;
  const half = Math.max(3, Math.floor((size - 3) / 2));
  return `${addr.slice(0, half)}...${addr.slice(-half)}`;
};

const copyText = async (text?: string, label = "") => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast.showSuccess(label ? `${label} copied` : "Copied to clipboard");
  } catch (err: any) {
    toast.showError(err?.message || "Copy failed");
  }
};

const spotPrice = computed(() => formatRetro(launch.value?.computed?.spot_price_uretro_per_token));
const progress = computed(() => formatPercent(launch.value?.computed?.graduation_progress));
const graduated = computed(() => Boolean(launch.value?.launch?.graduated));
const dexPoolId = computed(() => launch.value?.launch?.dex_pool_id || null);
const tokensSoldPercent = computed(() => {
  const sold = Number(launch.value?.computed?.tokens_sold ?? 0);
  const max = Number(launch.value?.launch?.max_supply ?? 0);
  if (!Number.isFinite(sold) || !Number.isFinite(max) || max <= 0) return "—";
  return `${Math.min(100, (sold / max) * 100).toFixed(2)}%`;
});
const tradingFeeBps = computed(() => (params.value?.fee_bps ?? params.value?.trading_fee_bps ?? null));

const fetchDetail = async () => {
  if (!denom.value) return;
  loading.value = true;
  error.value = null;
  try {
    const [launchRes, paramsRes] = await Promise.all([
      api.get(`/retrochain/launcher/v1/launch/${denom.value}`),
      api.get(`/retrochain/launcher/v1/params`).catch(() => null)
    ]);
    launch.value = launchRes.data?.launch || launchRes.data?.launch_with_computed || launchRes.data || null;
    params.value = paramsRes ? paramsRes.data?.params ?? paramsRes.data ?? null : null;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 501) {
      error.value = "Launcher module not available on this node (HTTP 501).";
    } else {
      error.value = err?.message || "Failed to load launch";
    }
    launch.value = null;
    params.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(fetchDetail);
watch(() => route.params.denom, fetchDetail);

const tokensSold = computed(() => formatInt(launch.value?.computed?.tokens_sold));
const tokensRemaining = computed(() => formatInt(launch.value?.computed?.tokens_remaining));

const fetchBuyQuote = async () => {
  if (!denom.value || !buyAmountUretro.value) return;
  quotingBuy.value = true;
  buyQuote.value = null;
  try {
    const res = await api.get(`/retrochain/launcher/v1/quote/buy`, {
      params: { denom: denom.value, amount_in_uretro: buyAmountUretro.value }
    });
    buyQuote.value = res.data;
  } catch (e) {
    buyQuote.value = null;
  } finally {
    quotingBuy.value = false;
  }
};

const fetchSellQuote = async () => {
  if (!denom.value || !sellAmountToken.value) return;
  quotingSell.value = true;
  sellQuote.value = null;
  try {
    const res = await api.get(`/retrochain/launcher/v1/quote/sell`, {
      params: { denom: denom.value, amount_in: sellAmountToken.value }
    });
    sellQuote.value = res.data;
  } catch (e) {
    sellQuote.value = null;
  } finally {
    quotingSell.value = false;
  }
};

watch([buyAmountUretro, denom], fetchBuyQuote, { immediate: true });
watch([sellAmountToken, denom], fetchSellQuote, { immediate: true });

const slippageMultiplier = computed(() => Math.max(0, 1 - (Number(slippageBps.value || 0) / 10000)));

const submitBuy = async () => {
  if (!denom.value) return;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error("Connect wallet to buy");
    if (!buyQuote.value) await fetchBuyQuote();
    const amtOut = BigInt(buyQuote.value?.amount_out || 0n);
    const minOut = amtOut > 0n ? BigInt(Math.floor(Number(amtOut) * slippageMultiplier.value)) : 0n;
    const msg = {
      typeUrl: "/retrochain.launcher.v1.MsgBuy",
      value: {
        buyer: address.value,
        denom: denom.value,
        amountInUretro: buyAmountUretro.value,
        minAmountOut: minOut.toString()
      }
    };
    const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "350000" };
    await signAndBroadcast(chainId.value, [msg], fee, "");
    toast.showSuccess("Buy submitted");
  } catch (e: any) {
    toast.showError(e?.message || "Buy failed");
  }
};

const submitSell = async () => {
  if (!denom.value) return;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error("Connect wallet to sell");
    if (!sellQuote.value) await fetchSellQuote();
    const amtOut = BigInt(sellQuote.value?.amount_out_uretro || 0n);
    const minOut = amtOut > 0n ? BigInt(Math.floor(Number(amtOut) * slippageMultiplier.value)) : 0n;
    const msg = {
      typeUrl: "/retrochain.launcher.v1.MsgSell",
      value: {
        seller: address.value,
        denom: denom.value,
        amountIn: sellAmountToken.value,
        minAmountOutUretro: minOut.toString()
      }
    };
    const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "350000" };
    await signAndBroadcast(chainId.value, [msg], fee, "");
    toast.showSuccess("Sell submitted");
  } catch (e: any) {
    toast.showError(e?.message || "Sell failed");
  }
};

const pricePoints = computed(() => trades.value.map((t) => t.price).filter((p) => Number.isFinite(p)));
const sparkPath = computed(() => {
  const pts = pricePoints.value;
  if (!pts.length) return "";
  const width = 220;
  const height = 60;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  return pts
    .map((p, idx) => {
      const x = (idx / Math.max(pts.length - 1, 1)) * width;
      const y = height - ((p - min) / span) * height;
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
});
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/25 via-indigo-700/20 to-cyan-500/25 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <button class="text-emerald-200 hover:underline" @click="router.push({ name: 'launcher' })">Launcher</button>
          <span class="text-slate-500">/</span>
          <span class="font-mono text-xs text-emerald-200 break-all">{{ denom }}</span>
        </div>
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div class="space-y-2">
            <h1 class="text-3xl font-bold text-white flex items-center gap-3">
              <span>🚀 Launch Detail</span>
              <span class="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/10 font-mono">{{ denom }}</span>
              <span class="text-[11px] px-2 py-1 rounded-full border" :class="graduated ? 'border-emerald-400/60 text-emerald-200 bg-emerald-500/10' : 'border-sky-400/60 text-sky-200 bg-sky-500/10'">
                {{ graduated ? 'Graduated' : 'Live' }}
              </span>
              <span v-if="dexPoolId" class="text-[11px] px-2 py-1 rounded-full border border-amber-400/60 text-amber-200 bg-amber-500/10">DEX Pool {{ dexPoolId }}</span>
            </h1>
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span class="px-2 py-1 rounded-full border border-white/10 bg-white/5">/retrochain/launcher/v1/launch/{denom}</span>
              <button class="btn text-[11px] px-2 py-1" @click="copyText(denom, 'Denom')">Copy denom</button>
              <button v-if="launch?.launch?.creator" class="btn text-[11px] px-2 py-1" @click="copyText(launch.launch.creator, 'Creator')">Copy creator</button>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div class="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/40 text-emerald-100">
              <div class="uppercase tracking-wider">Spot</div>
              <div class="text-sm font-semibold text-white">{{ spotPrice }}</div>
            </div>
            <div class="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/40 text-cyan-100">
              <div class="uppercase tracking-wider">Progress</div>
              <div class="text-sm font-semibold text-white">{{ progress }}</div>
            </div>
            <div class="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-100">
              <div class="uppercase tracking-wider">Status</div>
              <div class="text-sm font-semibold text-white">{{ graduated ? 'Graduated' : 'Live' }}</div>
            </div>
            <div class="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-400/40 text-indigo-100">
              <div class="uppercase tracking-wider">Creator</div>
              <div class="text-xs font-mono text-emerald-200 break-all">{{ shortAddr(launch?.launch?.creator) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template v-if="launch">
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">Launch snapshot</h2>
          <span class="text-[11px] text-slate-400">Key on-chain metrics</span>
        </div>
        <div class="grid gap-3 md:grid-cols-4">
          <div class="p-3 rounded-xl bg-emerald-500/5 border border-emerald-400/40">
            <div class="text-[11px] uppercase tracking-wider text-emerald-200">Spot Price</div>
            <div class="text-xl font-bold text-white">{{ spotPrice }}</div>
            <div class="text-[11px] text-emerald-100">RETRO per token</div>
          </div>
          <div class="p-3 rounded-xl bg-cyan-500/5 border border-cyan-400/40">
            <div class="text-[11px] uppercase tracking-wider text-cyan-200">Progress</div>
            <div class="text-xl font-bold text-white">{{ progress }}</div>
            <div class="text-[11px] text-cyan-100">Graduation progress</div>
          </div>
          <div class="p-3 rounded-xl bg-amber-500/5 border border-amber-400/40">
            <div class="text-[11px] uppercase tracking-wider text-amber-200">Status</div>
            <div class="text-xl font-bold text-white">{{ graduated ? 'Graduated' : 'Live' }}</div>
            <div class="text-[11px] text-amber-100">DEX Pool: {{ dexPoolId || '—' }}</div>
          </div>
          <div class="p-3 rounded-xl bg-indigo-500/5 border border-indigo-400/40">
            <div class="text-[11px] uppercase tracking-wider text-indigo-200">Creator</div>
            <div class="text-xs font-mono text-emerald-200 break-all">{{ shortAddr(launch.launch?.creator) }}</div>
            <div class="text-[11px] text-indigo-100 mt-1">Max supply: {{ formatInt(launch.launch?.max_supply) }}</div>
          </div>
        </div>
      </div>
    </template>

      <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 class="text-base font-semibold text-white">Trading Desk</h2>
            <p class="text-[11px] text-slate-400">Live quotes with on-chain MsgBuy / MsgSell.</p>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-slate-200 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
            <span class="text-slate-400">Slippage</span>
            <input v-model.number="slippageBps" type="number" min="0" max="5000" class="input w-20" />
            <span class="text-slate-400">bps</span>
          </div>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="p-4 rounded-xl border border-emerald-400/60 bg-gradient-to-br from-emerald-500/15 via-emerald-500/10 to-slate-900/60 shadow-[0_10px_50px_-30px_rgba(16,185,129,0.8)] space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[11px] uppercase tracking-wider text-emerald-200">Buy Tokens</div>
                <div class="text-xs text-slate-400">Pay in RETRO</div>
              </div>
              <div class="flex gap-2">
                <button class="btn text-xs" @click="fetchBuyQuote" :disabled="quotingBuy">Refresh</button>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-[11px] uppercase tracking-wider text-slate-400">Amount in uretro</label>
              <input v-model="buyAmountUretro" class="input bg-slate-900/70 border-emerald-400/40 text-white" placeholder="1000000" />
              <div class="flex flex-wrap gap-2 text-[11px]">
                <button class="btn-secondary px-2 py-1" @click="buyAmountUretro = '1000000'">1M</button>
                <button class="btn-secondary px-2 py-1" @click="buyAmountUretro = '5000000'">5M</button>
                <button class="btn-secondary px-2 py-1" @click="buyAmountUretro = '10000000'">10M</button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
              <div class="p-2 rounded-lg bg-white/5 border border-white/10">
                <div class="text-slate-400">Estimated out</div>
                <div class="font-semibold">{{ formatInt(buyQuote?.amount_out) || '—' }} tokens</div>
              </div>
              <div class="p-2 rounded-lg bg-white/5 border border-white/10">
                <div class="text-slate-400">Fee</div>
                <div class="font-semibold">{{ formatRetro(buyQuote?.fee_amount_uretro) }}</div>
              </div>
              <div class="p-2 rounded-lg bg-white/5 border border-white/10 col-span-2">
                <div class="text-slate-400">Spot</div>
                <div class="font-semibold">{{ formatRetro(buyQuote?.spot_price_uretro_per_token) }}</div>
              </div>
            </div>
            <button class="btn btn-primary w-full" :disabled="quotingBuy || !buyAmountUretro" @click="submitBuy">Buy</button>
          </div>

          <div class="p-4 rounded-xl border border-rose-400/60 bg-gradient-to-br from-rose-500/15 via-rose-500/10 to-slate-900/60 shadow-[0_10px_50px_-30px_rgba(244,63,94,0.8)] space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[11px] uppercase tracking-wider text-rose-200">Sell Tokens</div>
                <div class="text-xs text-slate-400">Receive RETRO</div>
              </div>
              <div class="flex gap-2">
                <button class="btn text-xs" @click="fetchSellQuote" :disabled="quotingSell">Refresh</button>
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-[11px] uppercase tracking-wider text-slate-400">Amount in tokens</label>
              <input v-model="sellAmountToken" class="input bg-slate-900/70 border-rose-400/40 text-white" placeholder="10" />
              <div class="flex flex-wrap gap-2 text-[11px]">
                <button class="btn-secondary px-2 py-1" @click="sellAmountToken = '10'">10</button>
                <button class="btn-secondary px-2 py-1" @click="sellAmountToken = '100'">100</button>
                <button class="btn-secondary px-2 py-1" @click="sellAmountToken = '1000'">1,000</button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
              <div class="p-2 rounded-lg bg-white/5 border border-white/10">
                <div class="text-slate-400">Estimated out</div>
                <div class="font-semibold">{{ formatRetro(sellQuote?.amount_out_uretro) }}</div>
              </div>
              <div class="p-2 rounded-lg bg-white/5 border border-white/10">
                <div class="text-slate-400">Fee</div>
                <div class="font-semibold">{{ formatRetro(sellQuote?.fee_amount_uretro) }}</div>
              </div>
              <div class="p-2 rounded-lg bg-white/5 border border-white/10 col-span-2">
                <div class="text-slate-400">Spot</div>
                <div class="font-semibold">{{ formatRetro(sellQuote?.spot_price_uretro_per_token) }}</div>
              </div>
            </div>
            <button class="btn w-full" :disabled="quotingSell || !sellAmountToken" @click="submitSell">Sell</button>
          </div>
        </div>
      </div>

    <RcDisclaimer v-if="error" type="warning" title="Launch not available">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading launch…" />
    </div>

    <template v-else-if="launch">
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Launch Pulse</h2>
          <span class="text-[11px] text-slate-400">Live KPIs</span>
        </div>
        <div class="grid gap-3 md:grid-cols-4">
          <div class="p-3 rounded-xl bg-white/5 border border-emerald-400/30">
            <div class="text-[11px] uppercase tracking-wider text-emerald-200">Tokens Sold</div>
            <div class="text-xl font-bold text-white">{{ tokensSold }}</div>
            <div class="text-[11px] text-emerald-100">{{ tokensSoldPercent }} of supply</div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-cyan-400/30">
            <div class="text-[11px] uppercase tracking-wider text-cyan-200">Tokens Remaining</div>
            <div class="text-xl font-bold text-white">{{ tokensRemaining }}</div>
            <div class="text-[11px] text-cyan-100">to graduation</div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-amber-400/30">
            <div class="text-[11px] uppercase tracking-wider text-amber-200">Reserve (Real)</div>
            <div class="text-xl font-bold text-white">{{ formatRetro(launch.launch?.reserve_real_uretro) }}</div>
            <div class="text-[11px] text-amber-100">Backing in RETRO</div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-indigo-400/30">
            <div class="text-[11px] uppercase tracking-wider text-indigo-200">Reserve (Virtual)</div>
            <div class="text-xl font-bold text-white">{{ formatRetro(launch.launch?.virtual_reserve_uretro) }}</div>
            <div class="text-[11px] text-indigo-100">AMM liquidity helper</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Launch</h2>
          <span class="text-[11px] text-slate-400">ID: {{ launch.launch?.id ?? '—' }}</span>
        </div>
        <div class="grid gap-2 md:grid-cols-2 text-sm text-slate-200">
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Denom</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ launch.launch?.denom || '—' }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Creator</div>
            <RouterLink v-if="launch.launch?.creator" :to="{ name: 'account', params: { address: launch.launch.creator } }" class="font-mono text-xs text-emerald-200 break-all hover:underline">
              {{ shortAddr(launch.launch?.creator) }}
            </RouterLink>
            <div v-else class="font-mono text-xs text-emerald-200">—</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Max Supply</div>
            <div class="font-semibold">{{ formatInt(launch.launch?.max_supply) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Tokens Sold / Remaining</div>
            <div class="font-semibold">{{ tokensSold }} / {{ tokensRemaining }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Reserve (real)</div>
            <div class="font-semibold">{{ formatRetro(launch.launch?.reserve_real_uretro) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Reserve (virtual)</div>
            <div class="font-semibold">{{ formatRetro(launch.launch?.virtual_reserve_uretro) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Graduation Reserve</div>
            <div class="font-semibold">{{ formatRetro(launch.launch?.graduation_reserve_uretro) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">DEX LP Denom</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ launch.launch?.dex_lp_denom || '—' }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Fees & Params</h2>
          <span class="text-[11px] text-slate-400">/retrochain/launcher/v1/params</span>
        </div>
        <div v-if="!params" class="text-sm text-slate-400">Params unavailable.</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-slate-200">
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Trading Fee</div>
            <div class="font-semibold">{{ tradingFeeBps ?? '—' }} bps</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Create Launch Fee</div>
            <div class="font-semibold">{{ formatRetro(params.create_launch_fee) }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Fee Recipient</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ params.fee_recipient || '—' }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
          <div>
            <h2 class="text-base font-semibold text-white">Live Activity</h2>
            <p class="text-[11px] text-slate-400">Tx events from CometBFT WS (MsgBuy/MsgSell)</p>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-200">
            <span>Last price</span>
            <span class="font-semibold text-emerald-200">{{ livePrice }}</span>
          </div>
        </div>
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <svg v-if="sparkPath" :width="240" :height="70" class="w-full" viewBox="0 0 240 70">
              <path :d="sparkPath" fill="none" stroke="#22c55e" stroke-width="2" />
            </svg>
            <div v-else class="text-xs text-slate-500">No trades yet.</div>
          </div>
          <div class="flex-1 overflow-x-auto">
            <table class="table text-xs">
              <thead>
                <tr class="text-slate-400">
                  <th>Side</th>
                  <th>Price (RETRO)</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in [...trades].reverse()" :key="t.time + t.amountIn" class="text-slate-200">
                  <td>
                    <span class="badge text-[11px]" :class="t.side === 'buy' ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'">
                      {{ t.side }}
                    </span>
                  </td>
                  <td>{{ Number.isFinite(t.price) ? t.price.toFixed(6) : '—' }}</td>
                  <td>{{ t.amountIn }}</td>
                  <td>{{ t.amountOut }}</td>
                  <td class="text-[11px] text-slate-500">{{ new Date(t.time).toLocaleTimeString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
