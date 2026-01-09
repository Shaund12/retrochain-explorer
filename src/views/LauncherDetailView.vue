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
const buyAmountRetro = ref("1");
const sellAmountToken = ref("1");
const slippageBps = ref(100); // 1%
const buyQuote = ref<any | null>(null);
const sellQuote = ref<any | null>(null);
const quotingBuy = ref(false);
const quotingSell = ref(false);
const trades = ref<Array<{ side: "buy" | "sell"; price: number; amountIn: string; amountOut: string; time: string }>>([]);
let ws: WebSocket | null = null;

const toUretro = (val?: string | number | null) => {
  if (val === null || val === undefined || val === "") return "";
  const str = typeof val === "number" ? val.toString() : val;
  const parts = str.trim().replace(/,/g, "").split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(6, "0").slice(0, 6);
  if (!/^[-+]?\d+$/.test(whole) || !/^\d+$/.test(frac)) return "";
  const sign = whole.startsWith("-") || whole.startsWith("+") ? whole[0] : "";
  const wholeNum = whole.replace(/^[-+]/, "") || "0";
  const micro = BigInt(sign + wholeNum) * 1_000_000n + BigInt(frac || "0");
  return micro.toString();
};

const buyAmountUretro = computed(() => toUretro(buyAmountRetro.value));
const sellAmountTokensMicro = computed(() => toUretro(sellAmountToken.value));

const formatRetro = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  try {
    const str = value.toString();
    if (str.includes(".")) {
      const num = Number(str);
      if (!Number.isFinite(num)) return "—";
      return `${num.toLocaleString(undefined, { maximumFractionDigits: 6 })} RETRO`;
    }
    const raw = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(str);
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

const formatToken = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  try {
    const str = value.toString();
    if (str.includes(".")) {
      const num = Number(str);
      if (!Number.isFinite(num)) return "—";
      return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
    const raw = typeof value === "number" ? BigInt(Math.trunc(value)) : BigInt(str);
    const whole = raw / 1_000_000n;
    const frac = raw % 1_000_000n;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (frac === 0n) return wholeStr;
    let fracStr = frac.toString().padStart(6, "0");
    fracStr = fracStr.replace(/0+$/, "");
    return `${wholeStr}.${fracStr}`;
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

const normalizeLaunch = (data: any): LaunchWithComputed | null => {
  if (!data) return null;
  if (data.launch_with_computed) return data.launch_with_computed;
  if (data.launch && data.computed) return { launch: data.launch, computed: data.computed };
  if (data.launch) return { launch: data.launch, computed: data.launch.computed ?? null };
  return data;
};

const fetchDetail = async () => {
  if (!denom.value) return;
  loading.value = true;
  error.value = null;
  try {
    const [launchRes, paramsRes] = await Promise.all([
      api.get(`/retrochain/launcher/v1/launch/${denom.value}`),
      api.get(`/retrochain/launcher/v1/params`).catch(() => null)
    ]);
    launch.value = normalizeLaunch(launchRes.data);
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

const tokensSold = computed(() => formatToken(launch.value?.computed?.tokens_sold));
const tokensRemaining = computed(() => formatToken(launch.value?.computed?.tokens_remaining));

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
  if (!denom.value || !sellAmountTokensMicro.value) return;
  quotingSell.value = true;
  sellQuote.value = null;
  try {
    const res = await api.get(`/retrochain/launcher/v1/quote/sell`, {
      params: { denom: denom.value, amount_in: sellAmountTokensMicro.value }
    });
    sellQuote.value = res.data;
  } catch (e) {
    sellQuote.value = null;
  } finally {
    quotingSell.value = false;
  }
};

const extractAttr = (ev: any, key: string) => ev?.attributes?.find((a: any) => a.key === key)?.value;

const parseTradesFromTxs = (txs: any[], side: "buy" | "sell") => {
  const out: Array<{ side: "buy" | "sell"; price: number; amountIn: string; amountOut: string; time: string }> = [];
  txs.forEach((tx: any) => {
    const ts = tx?.timestamp || tx?.tx_response?.timestamp;
    const events = tx?.events || tx?.tx_response?.events || [];
    events
      .filter((ev: any) => ev?.type === (side === "buy" ? "launcher_buy" : "launcher_sell"))
      .forEach((ev: any) => {
        const amtInU = extractAttr(ev, "amount_in_uretro") || extractAttr(ev, "amount_in_uretro") || extractAttr(ev, "amount_in_uretro");
        const amtOutTokens = extractAttr(ev, "amount_out") || extractAttr(ev, "amount_out_tokens") || extractAttr(ev, "amount_out");
        const amtInTokens = extractAttr(ev, "amount_in") || extractAttr(ev, "amount_in_tokens");
        const amtOutU = extractAttr(ev, "amount_out_uretro");
        let price = 0;
        if (side === "buy" && amtInU && amtOutTokens) {
          price = Number(amtInU) / Number(amtOutTokens);
        } else if (side === "sell" && amtInTokens && amtOutU) {
          price = Number(amtOutU) / Number(amtInTokens);
        }
        out.push({
          side,
          price,
          amountIn: side === "buy" ? formatRetro(amtInU) : formatToken(amtInTokens),
          amountOut: side === "buy" ? `${formatToken(amtOutTokens)} tokens` : formatRetro(amtOutU),
          time: ts || new Date().toISOString()
        });
      });
  });
  return out;
};

const fetchRecentTrades = async () => {
  if (!launch.value?.launch?.id) return;
  try {
    const id = launch.value.launch.id;
    const [buysRes, sellsRes] = await Promise.all([
      api.get(`/cosmos/tx/v1beta1/txs`, { params: { events: `launcher_buy.launch_id=${id}`, order_by: "ORDER_BY_DESC", limit: 20 } }),
      api.get(`/cosmos/tx/v1beta1/txs`, { params: { events: `launcher_sell.launch_id=${id}`, order_by: "ORDER_BY_DESC", limit: 20 } }).catch(() => ({ data: { tx_responses: [] } }))
    ]);
    const buys = buysRes.data?.tx_responses || [];
    const sells = sellsRes.data?.tx_responses || [];
    const parsed = [...parseTradesFromTxs(buys, "buy"), ...parseTradesFromTxs(sells, "sell")] 
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .slice(0, 40);
    trades.value = parsed;
  } catch (e) {
    trades.value = [];
  }
};

watch(() => launch.value?.launch?.id, fetchRecentTrades);

watch([buyAmountRetro, denom], fetchBuyQuote, { immediate: true });
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
        amountInUretro: buyAmountUretro.value || "0",
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
        amountIn: sellAmountTokensMicro.value,
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

const sortedTrades = computed(() => [...trades.value].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()));
const pricePoints = computed(() => sortedTrades.value.map((t) => t.price).filter((p) => Number.isFinite(p)));
const lastPrice = computed(() => (sortedTrades.value.length ? sortedTrades.value[sortedTrades.value.length - 1].price : null));

const chartData = computed(() => {
  const width = 440;
  const height = 160;
  const padding = 24;
  const ordered = sortedTrades.value.filter((t) => Number.isFinite(t.price));

  const pts = ordered.length ? ordered : launch.value?.computed?.spot_price_uretro_per_token ? [{ price: Number(launch.value.computed.spot_price_uretro_per_token) / 1_000_000, time: new Date().toISOString(), side: "buy", amountIn: "", amountOut: "" }] : [];
  if (!pts.length) return { line: "", area: "", min: 0, max: 0, coords: [], labels: { x: [], y: [] } };

  const prices = pts.map((p: any) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const coords = prices.map((p, idx) => {
    const x = padding + (idx / Math.max(prices.length - 1, 1)) * (width - padding * 2);
    const y = padding + (1 - (p - min) / span) * (height - padding * 2);
    return { x, y, price: p, time: pts[idx].time };
  });
  const line = coords.map((c, idx) => `${idx === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x.toFixed(2)},${(height - padding).toFixed(2)} L${coords[0].x.toFixed(2)},${(height - padding).toFixed(2)} Z`;

  const first = coords[0];
  const mid = coords[Math.floor(coords.length / 2)];
  const last = coords[coords.length - 1];
  const fmtTime = (t?: string) => (t ? new Date(t).toLocaleTimeString() : "");

  return {
    line,
    area,
    min,
    max,
    coords,
    labels: {
      x: [fmtTime(first?.time), fmtTime(mid?.time), fmtTime(last?.time)].filter(Boolean),
      y: [max.toFixed(6), ((min + max) / 2).toFixed(6), min.toFixed(6)]
    }
  };
});
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-indigo-600/15 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-2">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <button class="text-emerald-200 hover:underline" @click="router.push({ name: 'launcher' })">Launcher</button>
          <span class="text-slate-500">/</span>
          <span class="font-mono text-xs text-emerald-200 break-all">{{ denom }}</span>
        </div>
        <h1 class="text-3xl font-bold text-white flex items-center gap-3">
          <span>Launch Detail</span>
          <span class="text-xs px-2 py-1 rounded-full border border-white/10 bg-white/5 font-mono">{{ denom }}</span>
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
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Launch not available">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div v-else-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading launch…" />
    </div>

    <template v-else-if="launch">
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
            <div class="text-[11px] text-indigo-100 mt-1">Max supply: {{ formatToken(launch.launch?.max_supply) }}</div>
          </div>
        </div>
      </div>

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
          <div class="p-4 rounded-xl border border-emerald-400/50 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-slate-900/50 shadow-lg shadow-emerald-500/10 space-y-3">
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
              <label class="text-[11px] uppercase tracking-wider text-slate-400">Amount in RETRO</label>
              <input v-model="buyAmountRetro" class="input" placeholder="1" />
              <div class="flex flex-wrap gap-2 text-[11px]">
                <button class="btn-secondary px-2 py-1" @click="buyAmountRetro = '1'">1</button>
                <button class="btn-secondary px-2 py-1" @click="buyAmountRetro = '5'">5</button>
                <button class="btn-secondary px-2 py-1" @click="buyAmountRetro = '10'">10</button>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
              <div class="p-2 rounded-lg bg-white/5 border border-white/10">
                <div class="text-slate-400">Estimated out</div>
                <div class="font-semibold">{{ formatToken(buyQuote?.amount_out) }} tokens</div>
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
            <button class="btn btn-primary w-full" :disabled="quotingBuy || !buyAmountRetro" @click="submitBuy">Buy</button>
          </div>

          <div class="p-4 rounded-xl border border-rose-400/50 bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-slate-900/50 shadow-lg shadow-rose-500/10 space-y-3">
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
              <input v-model="sellAmountToken" class="input" placeholder="10" />
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
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold text-white">Launch Pulse</h2>
            <span class="text-[11px] text-slate-400">Live KPIs</span>
          </div>
          <div class="flex items-center gap-2 text-[11px] text-slate-300">
            <span>Price chart</span>
            <svg v-if="sparkPath" :width="160" :height="40" viewBox="0 0 160 40">
              <path :d="sparkPath" fill="none" stroke="#22c55e" stroke-width="2" />
            </svg>
            <span v-else class="text-slate-500">No data</span>
          </div>
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
            <div class="font-semibold">{{ formatToken(launch.launch?.max_supply) }}</div>
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
            <span class="font-semibold text-emerald-200">{{ livePrice || (lastPrice !== null ? lastPrice.toFixed(6) + ' RETRO' : '—') }}</span>
          </div>
        </div>
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <div class="bg-slate-900/50 border border-white/10 rounded-xl p-3">
              <div class="flex items-center justify-between text-xs text-slate-300 mb-2">
                <div class="flex gap-3">
                  <span>Min: {{ chartData.min ? chartData.min.toFixed(6) : '—' }}</span>
                  <span>Max: {{ chartData.max ? chartData.max.toFixed(6) : '—' }}</span>
                </div>
                <span>Points: {{ chartData.coords.length }}</span>
              </div>
              <svg v-if="chartData.line" :width="460" :height="180" class="w-full" viewBox="0 0 460 180">
                <defs>
                  <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#22c55e" stop-opacity="0.35" />
                    <stop offset="100%" stop-color="#22c55e" stop-opacity="0.05" />
                  </linearGradient>
                </defs>
                <path :d="chartData.area" fill="url(#priceFill)" stroke="none" />
                <path :d="chartData.line" fill="none" stroke="#22c55e" stroke-width="2.5" />
                <g fill="#22c55e" stroke="#0f172a" stroke-width="1">
                  <circle v-for="(c, idx) in chartData.coords" :key="idx" :cx="c.x" :cy="c.y" r="2.5" />
                </g>
                <g font-size="9" fill="#94a3b8">
                  <text :x="16" y="12">{{ chartData.labels.y[0] }}</text>
                  <text :x="16" y="92">{{ chartData.labels.y[1] }}</text>
                  <text :x="16" y="172">{{ chartData.labels.y[2] }}</text>
                  <text :x="70" y="176">{{ chartData.labels.x[0] || '' }}</text>
                  <text :x="220" y="176">{{ chartData.labels.x[1] || '' }}</text>
                  <text :x="380" y="176">{{ chartData.labels.x[2] || '' }}</text>
                </g>
              </svg>
              <div v-else class="text-xs text-slate-500">No trades yet.</div>
            </div>
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


