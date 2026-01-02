<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ApexChart from "vue3-apexcharts";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useAssets, type BankToken, type Cw20Token } from "@/composables/useAssets";
import { useTxs, type TxSummary } from "@/composables/useTxs";
import type { TokenAccent } from "@/constants/tokens";

const { bankTokens, ibcTokens, cw20Tokens, nftClasses, loading, error, fetchAssets } = useAssets();
const { txs: transferTxsRaw, searchRecent: fetchRecentTxs } = useTxs();

onMounted(() => {
  fetchAssets();
  fetchLivePrices();
  loadTransferActivity();
});

const USD_PRICE_HINTS: Record<string, number | undefined> = {
  USDC: 1,
  OSMO: Number(import.meta.env.VITE_PRICE_OSMO_USD ?? "0") || 0.6,
  ATOM: Number(import.meta.env.VITE_PRICE_ATOM_USD ?? "0") || 10,
  WBTC: Number(import.meta.env.VITE_PRICE_WBTC_USD ?? "0") || 40000
};

const loadTransferActivity = async () => {
  transferLoading.value = true;
  transferError.value = null;
  try {
    await fetchRecentTxs(120, 0);
    transferTxs.value = transferTxsRaw.value.slice(0, 120);
  } catch (err: any) {
    transferError.value = err?.message || "Failed to load transfer activity";
  } finally {
    transferLoading.value = false;
  }
};

const priceOverrides = ref<Record<string, number>>({});
const priceLookup = computed(() => ({ ...USD_PRICE_HINTS, ...priceOverrides.value }));

const transferLoading = ref(false);
const transferError = ref<string | null>(null);
const transferTxs = ref<TxSummary[]>([]);

// UI filters
const tokenSearch = ref("");
const tokenKind = ref<"all" | "native" | "factory">("all");
const ibcSearch = ref("");
const nftSearch = ref("");

// Detail modal state
const showAssetModal = ref(false);
const modalKind = ref<"bank" | "ibc" | "cw20">("bank");
const modalAsset = ref<any | null>(null);

const formatUsd = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fetchLivePrices = async () => {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=osmosis,cosmos,usd-coin,wrapped-bitcoin&vs_currencies=usd",
      { cache: "no-store" }
    );
    const data = await res.json();
    const overrides: Record<string, number> = {};
    const osmo = Number(data?.osmosis?.usd);
    if (Number.isFinite(osmo) && osmo > 0) overrides.OSMO = osmo;
    const atom = Number(data?.cosmos?.usd);
    if (Number.isFinite(atom) && atom > 0) overrides.ATOM = atom;
    const usdc = Number(data?.["usd-coin"]?.usd);
    if (Number.isFinite(usdc) && usdc > 0) overrides.USDC = usdc;
    const wbtc = Number(data?.["wrapped-bitcoin"]?.usd);
    if (Number.isFinite(wbtc) && wbtc > 0) overrides.WBTC = wbtc;
    priceOverrides.value = overrides;
  } catch (err) {
    console.warn("Failed to fetch live prices", err);
  }
};

const nativeTokens = computed(() => bankTokens.value.filter((token) => !token.isFactory));
const factoryTokens = computed(() => bankTokens.value.filter((token) => token.isFactory));

const filteredBankTokens = computed(() => {
  const term = tokenSearch.value.trim().toLowerCase();
  return bankTokens.value
    .filter((token) => {
      if (tokenKind.value === "native" && token.isFactory) return false;
      if (tokenKind.value === "factory" && !token.isFactory) return false;
      if (!term) return true;
      const symbol = friendlySymbol(token).toLowerCase();
      const name = friendlyName(token).toLowerCase();
      const denom = (token.denom || "").toLowerCase();
      return symbol.includes(term) || name.includes(term) || denom.includes(term);
    })
    .sort((a, b) => friendlySymbol(a).localeCompare(friendlySymbol(b)));
});

const filteredIbcTokens = computed(() => {
  const term = ibcSearch.value.trim().toLowerCase();
  if (!term) return ibcTokens.value;
  return ibcTokens.value.filter((token) => {
    return (
      (token.tokenMeta?.symbol || "").toLowerCase().includes(term) ||
      (token.baseDenom || "").toLowerCase().includes(term) ||
      (token.denom || "").toLowerCase().includes(term) ||
      (token.tracePath || "").toLowerCase().includes(term)
    );
  });
});

const filteredCw20 = computed(() => {
  const term = tokenSearch.value.trim().toLowerCase();
  if (!term) return cw20Tokens.value;
  return cw20Tokens.value.filter((t) => {
    return (
      (t.symbol || "").toLowerCase().includes(term) ||
      (t.name || "").toLowerCase().includes(term) ||
      (t.address || "").toLowerCase().includes(term)
    );
  });
});

const filteredNfts = computed(() => {
  const term = nftSearch.value.trim().toLowerCase();
  if (!term) return nftClasses.value;
  return nftClasses.value.filter((cls) => {
    return (
      (cls.name || "").toLowerCase().includes(term) ||
      (cls.id || "").toLowerCase().includes(term) ||
      (cls.description || "").toLowerCase().includes(term) ||
      (cls.symbol || "").toLowerCase().includes(term)
    );
  });
});

const openAssetModal = (asset: any, kind: "bank" | "ibc" | "cw20") => {
  modalAsset.value = asset;
  modalKind.value = kind;
  showAssetModal.value = true;
};

const closeAssetModal = () => {
  showAssetModal.value = false;
  modalAsset.value = null;
};

const stats = computed(() => ({
  native: nativeTokens.value.length,
  factory: factoryTokens.value.length,
  ibc: ibcTokens.value.length,
  cw20: cw20Tokens.value.length,
  nft: nftClasses.value.length
}));

const tokenMixSeries = computed(() => [stats.value.native, stats.value.factory, stats.value.ibc, stats.value.cw20]);
const tokenMixLabels = ["Native", "Factory", "IBC", "CW20"];

const tokenMixOptions = computed(() => ({
  chart: { type: "donut", background: "transparent", foreColor: "#cbd5e1", toolbar: { show: false } },
  theme: { mode: "dark" },
  labels: tokenMixLabels,
  dataLabels: { enabled: false },
  legend: { labels: { colors: "#e2e8f0" } },
  colors: ["#34d399", "#22d3ee", "#a855f7", "#f59e0b"],
  stroke: { colors: ["#0b1224"] },
  plotOptions: {
    pie: {
      donut: {
        size: "60%",
        labels: { show: true, name: { show: true }, value: { show: true, formatter: (val: string) => Number(val).toLocaleString() } }
      }
    }
  }
}));

const getDenomMeta = (denom: string) => bankTokens.value.find((t) => t.denom === denom) || ibcTokens.value.find((t) => t.denom === denom);

const formatTransferAmount = (denom: string, rawAmount: number) => {
  const meta = getDenomMeta(denom);
  const decimals = meta?.decimals ?? 6;
  const symbol = meta ? friendlySymbol(meta) : denom.toUpperCase();
  const display = rawAmount / Math.pow(10, Math.max(decimals, 0));
  return { value: Number(display.toFixed(2)), symbol };
};

const topTransferTokens = computed(() => {
  const totals = new Map<string, number>();
  transferTxs.value.forEach((tx) => {
    const coins = (tx.valueTransfers || []) as Array<{ amount: string; denom: string }>;
    coins.forEach((c) => {
      const amt = Number(c.amount);
      if (!Number.isFinite(amt)) return;
      totals.set(c.denom, (totals.get(c.denom) || 0) + amt);
    });
  });
  return Array.from(totals.entries())
    .map(([denom, total]) => {
      const formatted = formatTransferAmount(denom, total);
      return { denom, total, label: formatted.symbol, display: formatted.value };
    })
    .filter((t) => Number.isFinite(t.display) && t.display > 0)
    .sort((a, b) => b.display - a.display)
    .slice(0, 6);
});

const transferVolumeOptions = computed(() => ({
  chart: { type: "bar", background: "transparent", foreColor: "#cbd5e1", toolbar: { show: false } },
  theme: { mode: "dark" },
  grid: { borderColor: "rgba(148,163,184,0.25)", strokeDashArray: 3 },
  plotOptions: { bar: { horizontal: true, borderRadius: 6, columnWidth: "50%" } },
  dataLabels: { enabled: false },
  xaxis: {
    categories: topTransferTokens.value.map((t) => t.label),
    labels: { style: { colors: topTransferTokens.value.map(() => "#94a3b8") } }
  },
  yaxis: { labels: { style: { colors: ["#94a3b8"] } } },
  colors: ["#38bdf8"]
}));

const transferVolumeSeries = computed(() => [{ name: "Recent Transfer Volume", data: topTransferTokens.value.map((t) => t.display) }]);

const tokenTypeLabel = (token: { isFactory: boolean }) => (token.isFactory ? "Factory" : "Native");

const accentBg: Record<TokenAccent, string> = {
  emerald: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40",
  violet: "bg-violet-500/15 text-violet-200 border border-violet-400/40",
  sky: "bg-sky-500/15 text-sky-200 border border-sky-400/40",
  amber: "bg-amber-500/15 text-amber-200 border border-amber-400/40",
  slate: "bg-slate-500/15 text-slate-200 border border-slate-400/40"
};

const tokenAvatarClass = (token: BankToken) => accentBg[token.tokenMeta?.accent ?? "slate"];

const shortFactoryTail = (token: BankToken) => {
  const parts = token.denom?.split("/") || [];
  const tail = parts[parts.length - 1];
  return tail || token.denom || "ASSET";
};

const friendlySymbol = (token: BankToken) => {
  if (token.tokenMeta?.symbol) return token.tokenMeta.symbol;
  if (token.metadata?.symbol) return token.metadata.symbol;
  if (token.metadata?.display) return token.metadata.display.toUpperCase();
  if (token.metadata?.name) return token.metadata.name;
  if (token.isFactory) return shortFactoryTail(token).toUpperCase();
  return token.denom?.toUpperCase() || "ASSET";
};

const friendlyName = (token: BankToken) => {
  if (token.tokenMeta?.name) return token.tokenMeta.name;
  if (token.metadata?.name) return token.metadata.name;
  if (token.metadata?.display) return token.metadata.display;
  if (token.isFactory) return shortFactoryTail(token);
  return token.denom || "—";
};

const tokenAvatarText = (token: BankToken) => {
  const raw = friendlySymbol(token);
  return raw.slice(0, 4).toUpperCase();
};

const ibcTotalUsd = computed(() => {
  const totals = ibcTokens.value
    .map((token) => {
      const symbol = token.tokenMeta?.symbol?.toUpperCase();
      if (!symbol) return null;
      const price = priceLookup.value[symbol];
      if (!price || price <= 0) return null;
      const amount = Number(token.amount) / Math.pow(10, token.decimals || 6);
      if (!Number.isFinite(amount)) return null;
      return amount * price;
    })
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!totals.length) return null;
  return totals.reduce((a, b) => a + b, 0);
});

const ibcTokenUsd = (token: BankToken) => {
  const symbolCandidate = token.tokenMeta?.symbol || token.metadata?.display || token.baseDenom;
  if (!symbolCandidate) return null;
  const symbol = symbolCandidate.replace(/^u/i, "").toUpperCase();
  const price = priceLookup.value[symbol];
  if (!price || price <= 0) return null;
  const amount = Number(token.amount) / Math.pow(10, token.decimals || 6);
  if (!Number.isFinite(amount)) return null;
  return amount * price;
};

const formatCw20Supply = (token: Cw20Token) => {
  const decimals = Number(token.decimals ?? 6);
  const divisor = Math.pow(10, Math.max(decimals, 0));
  const amount = Number(token.totalSupply) / (divisor || 1);
  if (!Number.isFinite(amount)) {
    return `${token.totalSupply} ${token.symbol}`;
  }
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(6, Math.max(decimals, 0))
  })} ${token.symbol}`;
};

const nftSourceLabel = (cls: { source?: string }) => {
  if (cls.source === "cw721") return "CW721";
  if (cls.source === "ics721") return "ICS-721";
  if (cls.source === "nft-module") return "x/nft";
  return cls.source || "NFT";
};

</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-indigo-700/20 via-purple-600/20 to-emerald-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.35em] text-emerald-200">Asset Registry</p>
          <h1 class="text-3xl font-bold text-white mt-2 flex items-center gap-3">
            <span>RetroChain Tokens &amp; Collections</span>
            <span class="text-2xl">🪙</span>
          </h1>
          <p class="text-sm text-slate-300 mt-2 max-w-3xl">
            Live inventory of fungible tokens, IBC routes, and NFT classes observed on RetroChain. All data is queried directly from
            on-chain modules via the REST API.
          </p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <p class="text-emerald-200 uppercase tracking-wider">Native Tokens</p>
            <p class="text-2xl font-bold text-white">{{ stats.native }}</p>
            <p class="text-[11px] text-slate-400">Filtered: {{ filteredBankTokens.filter(t => !t.isFactory).length }}</p>
          </div>
          <div class="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3">
            <p class="text-cyan-200 uppercase tracking-wider">Factory Tokens</p>
            <p class="text-2xl font-bold text-white">{{ stats.factory }}</p>
            <p class="text-[11px] text-slate-400">Filtered: {{ filteredBankTokens.filter(t => t.isFactory).length }}</p>
          </div>
          <div class="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3">
            <p class="text-indigo-200 uppercase tracking-wider">IBC Assets</p>
            <p class="text-2xl font-bold text-white">{{ stats.ibc }}</p>
            <p class="text-[11px] text-slate-400">Filtered: {{ filteredIbcTokens.length }}</p>
            <p class="text-[11px] text-indigo-100" v-if="ibcTotalUsd !== null">≈ {{ formatUsd(ibcTotalUsd) }}</p>
            <p v-if="ibcTotalUsd !== null" class="text-[10px] text-emerald-200 mt-1">🎉 Chain-wide IBC liquidity in USD</p>
          </div>
          <div class="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3">
            <p class="text-fuchsia-200 uppercase tracking-wider">CW20 Tokens</p>
            <p class="text-2xl font-bold text-white">{{ stats.cw20 }}</p>
            <p class="text-[11px] text-slate-400">Filtered: {{ filteredCw20.length }}</p>
          </div>
          <div class="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p class="text-amber-200 uppercase tracking-wider">NFT Collections</p>
            <p class="text-2xl font-bold text-white">{{ stats.nft }}</p>
            <p class="text-[11px] text-slate-400">Filtered: {{ filteredNfts.length }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick filters -->
    <div class="card grid gap-3 md:grid-cols-3">
      <div class="space-y-2">
        <div class="text-[11px] uppercase tracking-widest text-slate-500">Search tokens</div>
        <input
          v-model="tokenSearch"
          type="text"
          placeholder="Symbol, name, denom"
          class="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-sm"
        />
      </div>
      <div class="space-y-2">
        <div class="text-[11px] uppercase tracking-widest text-slate-500">Token type</div>
        <div class="flex flex-wrap gap-2 text-[11px]">
          <button class="btn" :class="tokenKind === 'all' ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : ''" @click="tokenKind = 'all'">All</button>
          <button class="btn" :class="tokenKind === 'native' ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : ''" @click="tokenKind = 'native'">Native</button>
          <button class="btn" :class="tokenKind === 'factory' ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : ''" @click="tokenKind = 'factory'">Factory</button>
        </div>
      </div>
      <div class="space-y-2">
        <div class="text-[11px] uppercase tracking-widest text-slate-500">Search IBC / NFTs</div>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="ibcSearch"
            type="text"
            placeholder="Search IBC tokens"
            class="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-sm"
          />
          <input
            v-model="nftSearch"
            type="text"
            placeholder="Search NFT collections"
            class="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-sm"
          />
        </div>
      </div>
    </div>

    <RcDisclaimer type="warning" title="On-chain data only">
      <p>
        This registry surfaces assets indexed by the bank, IBC transfer, and NFT modules. Tokens that have never minted supply or NFT
        classes without metadata may not appear until they exist on-chain.
      </p>
    </RcDisclaimer>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-white flex items-center gap-2">
          <span>📊</span>
          <span>Token Analytics</span>
        </h2>
        <button class="btn text-xs" :disabled="transferLoading" @click="loadTransferActivity">{{ transferLoading ? 'Syncing…' : 'Refresh' }}</button>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="text-xs uppercase tracking-wider text-emerald-200">Holder Distribution</p>
              <p class="text-sm text-slate-300">Mix of on-chain token types</p>
            </div>
            <div class="text-[11px] text-slate-400">Native / Factory / IBC / CW20</div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <ApexChart type="donut" height="220" :options="tokenMixOptions" :series="tokenMixSeries" />
            <div class="text-xs space-y-2 text-slate-200">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>Native</span>
                <span class="font-semibold">{{ stats.native }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-cyan-400"></span>Factory</span>
                <span class="font-semibold">{{ stats.factory }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-purple-400"></span>IBC</span>
                <span class="font-semibold">{{ stats.ibc }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-400"></span>CW20</span>
                <span class="font-semibold">{{ stats.cw20 }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <p class="text-xs uppercase tracking-wider text-cyan-200">Transfer Activity</p>
              <p class="text-sm text-slate-300">Top tokens by recent transfer volume</p>
            </div>
            <div class="text-[11px] text-slate-400">Last ~120 txs</div>
          </div>
          <div v-if="transferError" class="text-xs text-rose-300">{{ transferError }}</div>
          <div v-else>
            <div v-if="transferLoading" class="text-xs text-slate-400">Syncing transfer activity…</div>
            <div v-else-if="!topTransferTokens.length" class="text-xs text-slate-400">No transfer data available yet.</div>
            <div v-else class="space-y-3">
              <ApexChart type="bar" height="260" :options="transferVolumeOptions" :series="transferVolumeSeries" />
              <div class="grid grid-cols-2 gap-2 text-xs text-slate-200">
                <div v-for="token in topTransferTokens" :key="token.denom" class="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                  <div class="font-semibold">{{ token.label }}</div>
                  <div class="font-mono text-[11px] text-emerald-200">{{ token.display.toLocaleString() }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border border-rose-500/30 bg-rose-500/5 text-rose-200 text-sm">
      {{ error }}
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Syncing token registry…" />
    </div>

    <template v-else>
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">Native &amp; Factory Tokens</h2>
          <button class="btn text-xs" @click="fetchAssets">Refresh</button>
        </div>
        <div class="text-[11px] text-slate-500 mb-2">Showing {{ filteredBankTokens.length }} of {{ bankTokens.length }} tokens</div>
        <div v-if="filteredBankTokens.length === 0" class="text-xs text-slate-400">No fungible tokens match the current filters.</div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Asset</th>
                <th>Denom</th>
                <th>Supply</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="token in filteredBankTokens"
                :key="token.denom"
                class="text-sm cursor-pointer hover:bg-white/5"
                @click="openAssetModal(token, 'bank')"
              >
                <td class="py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-10 rounded-2xl flex items-center justify-center font-semibold text-xs uppercase shadow-lg overflow-hidden"
                      :class="tokenAvatarClass(token)"
                    >
                      <img
                        v-if="token.tokenMeta?.logo"
                        :src="token.tokenMeta.logo"
                        :alt="`${token.tokenMeta?.symbol || token.tokenMeta?.name || token.denom} logo`"
                        class="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                      <span v-else>
                        {{ tokenAvatarText(token) }}
                      </span>
                    </div>
                    <div>
                      <p class="font-semibold text-white">{{ friendlySymbol(token) }}</p>
                      <p class="text-xs text-slate-400">{{ friendlyName(token) }}</p>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-xs text-slate-300">{{ token.denom }}</td>
                <td class="text-slate-100">{{ token.displayAmount }}</td>
                <td>
                  <span
                    class="badge text-[11px]"
                    :class="token.isFactory ? 'border-cyan-400/60 text-cyan-200' : 'border-emerald-400/60 text-emerald-200'"
                  >
                    {{ tokenTypeLabel(token) }}
                  </span>
                </td>
                <td class="text-xs text-slate-400">{{ token.tokenMeta?.description || token.metadata?.description || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" v-if="cw20Tokens.length">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">CW20 Tokens</h2>
          <span class="text-xs text-slate-400">Discovered via smart contract queries</span>
        </div>
        <div class="text-[11px] text-slate-500 mb-2">Showing {{ filteredCw20.length }} of {{ cw20Tokens.length }}</div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Token</th>
                <th>Contract</th>
                <th>Total Supply</th>
                <th>Decimals</th>
                <th>Code ID</th>
                <th>Minter</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="token in filteredCw20"
                :key="token.address"
                class="text-sm cursor-pointer hover:bg-white/5"
                @click="openAssetModal(token, 'cw20')"
              >
                <td class="py-3">
                  <div class="font-semibold text-white">{{ token.symbol }}</div>
                  <div class="text-xs text-slate-400">{{ token.name }}</div>
                </td>
                <td class="font-mono text-xs text-slate-300 break-all">{{ token.address }}</td>
                <td class="text-slate-100">{{ formatCw20Supply(token) }}</td>
                <td class="text-slate-300">{{ token.decimals }}</td>
                <td class="text-slate-300">{{ token.codeId }}</td>
                <td class="text-xs text-slate-400">{{ token.minter || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">IBC Tokens</h2>
          <span class="text-xs text-slate-400">Path &amp; source chain are derived from denom traces.</span>
        </div>
        <div class="text-[11px] text-slate-500 mb-2">Showing {{ filteredIbcTokens.length }} of {{ ibcTokens.length }}</div>
        <div v-if="filteredIbcTokens.length === 0" class="text-xs text-slate-400">No inbound IBC assets match the current search.</div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Asset</th>
                <th>Base Denom</th>
                <th>IBC Path</th>
                <th>Supply</th>
                <th>USD</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="token in filteredIbcTokens"
                :key="token.denom"
                class="text-sm cursor-pointer hover:bg-white/5"
                @click="openAssetModal(token, 'ibc')"
              >
                <td>
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-10 rounded-2xl flex items-center justify-center font-semibold text-xs uppercase shadow-lg overflow-hidden"
                      :class="tokenAvatarClass(token)"
                    >
                      <img
                        v-if="token.tokenMeta?.logo"
                        :src="token.tokenMeta.logo"
                        :alt="`${token.tokenMeta?.symbol || token.tokenMeta?.name || token.denom} logo`"
                        class="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                      <span v-else>
                        {{ tokenAvatarText(token) }}
                      </span>
                    </div>
                    <div>
                      <p class="font-semibold text-white">{{ token.tokenMeta?.symbol || token.denom?.toUpperCase() }}</p>
                      <p class="text-xs text-slate-400">{{ token.denom }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs text-slate-300">{{ token.baseDenom || '—' }}</td>
                <td class="text-xs text-slate-400 font-mono">{{ token.tracePath || '—' }}</td>
                <td class="text-slate-100">{{ token.displayAmount }}</td>
                <td class="text-xs text-emerald-200 font-semibold whitespace-nowrap">
                  <span v-if="ibcTokenUsd(token) !== null">{{ formatUsd(ibcTokenUsd(token)) }}</span>
                  <span v-else class="text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">NFT Collections</h2>
          <span class="text-xs text-slate-400">Aggregated from x/nft, ICS-721 traces, and CW721 contracts.</span>
        </div>
        <div class="text-[11px] text-slate-500 mb-2">Showing {{ filteredNfts.length }} of {{ nftClasses.length }}</div>
        <div v-if="filteredNfts.length === 0" class="text-xs text-slate-400">No NFT classes match the current search.</div>
        <div v-else class="grid gap-3 md:grid-cols-2">
          <RouterLink
            v-for="cls in filteredNfts"
            :key="cls.id"
            :to="{ name: 'nft-detail', params: { id: cls.id } }"
            class="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-indigo-400/50 hover:-translate-y-[1px]"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-sm font-semibold text-white">{{ cls.name }}</p>
                <p class="text-[11px] text-slate-400">{{ cls.id }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge text-[10px]" v-if="cls.source">{{ nftSourceLabel(cls) }}</span>
                <span class="badge text-[10px]" v-if="cls.symbol">{{ cls.symbol }}</span>
              </div>
            </div>
            <p class="text-xs text-slate-300 min-h-[40px]">
              {{ cls.description || 'No description provided.' }}
            </p>
            <p v-if="cls.uri" class="text-[11px] text-indigo-300 truncate mt-2">{{ cls.uri }}</p>
            <p v-if="cls.data?.numTokens" class="text-[11px] text-slate-400 mt-1">{{ cls.data.numTokens }} tokens minted</p>
          </RouterLink>
        </div>
      </div>
    </template>
  </div>

  <!-- Asset Detail Modal -->
  <div
    v-if="showAssetModal && modalAsset"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    @click.self="closeAssetModal"
  >
    <div class="card w-full max-w-3xl">
      <div class="flex items-start justify-between mb-4">
        <div>
          <p class="text-[11px] uppercase tracking-widest text-slate-500">{{ modalKind.toUpperCase() }} Asset</p>
          <h2 class="text-xl font-bold text-white">
            <template v-if="modalKind === 'bank'">
              {{ friendlySymbol(modalAsset) }}
            </template>
            <template v-else-if="modalKind === 'ibc'">
              {{ modalAsset.tokenMeta?.symbol || modalAsset.denom }}
            </template>
            <template v-else>
              {{ modalAsset.symbol }}
            </template>
          </h2>
          <p class="text-xs text-slate-400 break-all">
            <template v-if="modalKind === 'bank'">{{ modalAsset.denom }}</template>
            <template v-else-if="modalKind === 'ibc'">{{ modalAsset.denom }}</template>
            <template v-else>{{ modalAsset.address }}</template>
          </p>
        </div>
        <button class="btn text-xs" @click="closeAssetModal">✖ Close</button>
      </div>

      <div class="grid gap-3 md:grid-cols-2 text-sm text-slate-300">
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Supply / Amount</div>
          <div class="text-white font-semibold">
            <template v-if="modalKind === 'bank'">{{ modalAsset.displayAmount }}</template>
            <template v-else-if="modalKind === 'ibc'">{{ modalAsset.displayAmount }}</template>
            <template v-else>{{ formatCw20Supply(modalAsset) }}</template>
          </div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Chain / Type</div>
          <div class="text-white font-semibold">
            <template v-if="modalKind === 'bank'">{{ tokenTypeLabel(modalAsset) }}</template>
            <template v-else-if="modalKind === 'ibc'">IBC</template>
            <template v-else>CW20</template>
          </div>
          <div class="text-xs text-slate-400" v-if="modalKind === 'ibc'">Base: {{ modalAsset.baseDenom || '—' }}</div>
          <div class="text-xs text-slate-400" v-if="modalKind === 'ibc'">Path: {{ modalAsset.tracePath || '—' }}</div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700" v-if="modalKind === 'cw20'">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Decimals</div>
          <div class="text-white font-semibold">{{ modalAsset.decimals }}</div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700" v-if="modalKind === 'cw20'">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Code ID / Minter</div>
          <div class="text-white font-semibold">{{ modalAsset.codeId }}</div>
          <div class="text-xs text-slate-400 break-all">{{ modalAsset.minter || '—' }}</div>
        </div>

        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700" v-if="modalKind === 'bank'">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Metadata</div>
          <div class="text-xs text-slate-200 break-words">
            {{ modalAsset.tokenMeta?.description || modalAsset.metadata?.description || 'No description' }}
          </div>
        </div>
      </div>

      <div class="mt-4 p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-xs text-slate-300">
        <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Raw JSON</div>
        <pre class="whitespace-pre-wrap break-words max-h-72 overflow-auto">{{ JSON.stringify(modalAsset, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>
