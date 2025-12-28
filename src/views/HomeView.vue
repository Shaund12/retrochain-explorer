<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import { useChainInfo } from "@/composables/useChainInfo";
import { useBlocks } from "@/composables/useBlocks";
import { useTxs } from "@/composables/useTxs";
import { useMempool } from "@/composables/useMempool";
import { useValidators } from "@/composables/useValidators";
import { useArcade } from "@/composables/useArcade";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
import { useApi } from "@/composables/useApi";
import RcStatCard from "@/components/RcStatCard.vue";
import RcSearchBar from "@/components/RcSearchBar.vue";
import RcArcadeGameCard from "@/components/RcArcadeGameCard.vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { useNetwork } from "@/composables/useNetwork";
import RcDisclaimer from "@/components/RcDisclaimer.vue";

const router = useRouter();
const { info, loading: loadingInfo, refresh } = useChainInfo();
const { blocks, loading: loadingBlocks, fetchLatest } = useBlocks();
const { txs, loading: loadingTxs, searchRecent } = useTxs();
const { snapshot: mempool, loading: loadingMempool, error: mempoolError, refresh: refreshMempool } = useMempool();
const { validators, fetchValidators } = useValidators();
const api = useApi();

const showSpaceInvadersNotice = ref(true);
const spaceInvadersNoticeKey = "home-space-invaders-beta-dismissed";

const blockPage = ref(0);
const blockPageSize = 10;
const txPage = ref(0);
const txPageSize = 10;

const CARD_STORAGE_KEY = "rc_home_cards_v1";
const dashboardCards = [
  { id: "network", title: "Network Pulse", show: () => true },
  { id: "health", title: "Chain Health & Fees", show: () => true },
  { id: "block-stats", title: "Block & Gas Stats", show: () => true },
  { id: "arcade-burn", title: "Arcade Insert Coin Burn", show: () => true },
  { id: "blocks", title: "Latest Blocks", show: () => true },
      { id: "features", title: "RetroChain Feature Pack", show: () => true },
  { id: "howto", title: "How to use this explorer", show: () => network.value !== "mainnet" }
];

const defaultOrderMap = dashboardCards.reduce<Record<string, number>>((map, card, idx) => {
  map[card.id] = idx;
  return map;
}, {});

const cardState = ref<Record<string, { order: number; collapsed: boolean }>>({});

const blockStartHeight = (page: number) => {
  const latest = info.value.latestBlockHeight || blocks.value[0]?.height;
  if (!latest) return undefined;
  return Math.max(1, latest - page * blockPageSize);
};

const loadCardState = () => {
  try {
    const saved = localStorage.getItem(CARD_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, { order: number; collapsed: boolean }>;
      cardState.value = { ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load card layout", e);
  }

  cardState.value = dashboardCards.reduce<Record<string, { order: number; collapsed: boolean }>>((map, card) => {
    const existing = cardState.value[card.id];
    map[card.id] = {
      order: existing?.order ?? defaultOrderMap[card.id],
      collapsed: existing?.collapsed ?? false
    };
    return map;
  }, {});
};

const persistCardState = () => {
  try {
    localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(cardState.value));
  } catch (e) {
    console.warn("Failed to persist card layout", e);
  }
};

const getOrder = (id: string) => cardState.value[id]?.order ?? defaultOrderMap[id] ?? 0;
const isCollapsed = (id: string) => cardState.value[id]?.collapsed ?? false;

const toggleCollapse = (id: string) => {
  const current = cardState.value[id] ?? { order: defaultOrderMap[id] ?? 0, collapsed: false };
  cardState.value = {
    ...cardState.value,
    [id]: { ...current, collapsed: !current.collapsed }
  };
  persistCardState();
};

const moveCard = (id: string, delta: number) => {
  const ordered = dashboardCards
      .filter((c: any) => c.show())
      .map((c: any) => ({ ...c, order: getOrder(c.id) }))
      .sort((a: any, b: any) => a.order - b.order);

  const index = ordered.findIndex((c) => c.id === id);
  if (index === -1) return;
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= ordered.length) return;

  const temp = ordered[index].order;
  ordered[index].order = ordered[targetIndex].order;
  ordered[targetIndex].order = temp;

  ordered.forEach((c, idx) => {
    cardState.value[c.id] = { order: idx, collapsed: cardState.value[c.id]?.collapsed ?? false };
  });

  persistCardState();
};

const orderedCards = computed(() => {
  return dashboardCards
    .filter((c) => c.show())
    .map((c) => ({ ...c, order: getOrder(c.id) }))
    .sort((a, b) => a.order - b.order);
});

const refreshAll = async () => {
  await Promise.all([
    refresh(),
    fetchLatest(blockPageSize, blockStartHeight(blockPage.value)),
    searchRecent(txPageSize, txPage.value),
    refreshMempool(),
    fetchValidators(),
    loadArcadeBurnTotals()
  ]);
};

const { enabled: autoRefreshEnabled, countdown, toggle: toggleAutoRefresh } = useAutoRefresh(
  refreshAll,
  10000
);

const arcadeBurnLoading = ref(false);
const arcadeBurnTotal = ref<number | null>(null);
const arcadeBurnLatest = ref<{ amount: number; gameId?: string; player?: string } | null>(null);

const parseArcadeBurn = (tx: any): { amount: number; gameId?: string; player?: string } | null => {
  const events = Array.isArray(tx?.events) ? tx.events : [];
  let tokensBurned: number | null = null;
  let gameId: string | null = null;
  let player: string | null = null;

  events.forEach((ev: any) => {
    const attrs = Array.isArray(ev?.attributes) ? ev.attributes : [];
    const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
      if (curr?.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (ev?.type === "arcade.credits_inserted" && map.tokens_burned) {
      const amt = Number(map.tokens_burned);
      if (Number.isFinite(amt)) tokensBurned = amt;
      if (map.game_id) gameId = map.game_id;
      if (map.player) player = map.player;
    }
  });

  if (tokensBurned === null) return null;
  return { amount: tokensBurned, gameId: gameId || undefined, player: player || undefined } as const;
};

const loadArcadeBurnTotals = async () => {
  arcadeBurnLoading.value = true;
  arcadeBurnTotal.value = null;
  arcadeBurnLatest.value = null;
  try {
    const { data } = await api.get("/cosmos/tx/v1beta1/txs", {
      params: {
        events: "message.action='/retrochain.arcade.v1.MsgInsertCoin'",
        order_by: "ORDER_BY_DESC",
        "pagination.limit": "50"
      }
    });
    const txs = Array.isArray(data?.tx_responses) ? data.tx_responses : [];
    const burns: Array<{ amount: number; gameId?: string; player?: string }> = [];
    for (const txResp of txs as any[]) {
      const parsed = parseArcadeBurn(txResp as any);
      if (parsed && typeof parsed.amount === "number" && Number.isFinite(parsed.amount)) {
        burns.push(parsed);
      }
    }

    if (burns.length) {
      arcadeBurnTotal.value = burns.reduce((sum, b) => sum + b.amount, 0);
      arcadeBurnLatest.value = burns[0];
    } else {
      arcadeBurnTotal.value = 0;
    }
  } catch (err) {
    console.warn("Failed to load arcade burn totals", err);
  } finally {
    arcadeBurnLoading.value = false;
  }
};

const arcadeBurnDisplay = computed(() => {
  if (arcadeBurnTotal.value === null) return "—";
  const retro = arcadeBurnTotal.value / 1_000_000;
  return `${retro.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} RETRO`;
});

onMounted(async () => {
  try {
    const stored = localStorage.getItem(spaceInvadersNoticeKey);
    showSpaceInvadersNotice.value = stored !== "true";
  } catch {}
  loadCardState();
  await refreshAll();
});

const formatTime = (value?: string | null) =>
  value ? dayjs(value).fromNow?.() ?? value : "-";

// Expose environment endpoint values to template without using import.meta inside template expressions
const REST_DISPLAY = import.meta.env.VITE_REST_API_URL || '/api';
const RPC_DISPLAY = import.meta.env.VITE_RPC_URL || '/rpc';
const { current: network } = useNetwork();

const copy = async (text: string) => {
  try { await navigator.clipboard?.writeText?.(text); } catch {}
};

const shortString = (value?: string | null, length = 10) => {
  if (typeof value !== "string" || !value.length) return "—";
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
};

const goToTx = (hash?: string | null) => {
  if (!hash) return;
  router.push({ name: "tx-detail", params: { hash } });
};

const dismissSpaceInvadersNotice = () => {
  showSpaceInvadersNotice.value = false;
  try {
    localStorage.setItem(spaceInvadersNoticeKey, "true");
  } catch {}
};

// Production stats and sparklines (no extra libs)
const recentBlocks = computed(() => blocks.value.slice(0, 20));
const txsPerBlock = computed(() => recentBlocks.value.map(b => b.txs));
const blockTimes = computed(() => recentBlocks.value.map(b => (b.time ? new Date(b.time).getTime() : 0)).filter(v => v));
const blockTimeDeltas = computed(() => {
  const arr: number[] = [];
  for (let i = 1; i < blockTimes.value.length; i++) {
    const delta = Math.abs((blockTimes.value[i - 1] - blockTimes.value[i]) / 1000);
    if (Number.isFinite(delta) && delta > 0) {
      arr.push(delta);
    }
  }
  return arr;
});

const avgBlockTimeSeconds = computed(() => {
  if (!blockTimeDeltas.value.length) return null;
  return blockTimeDeltas.value.reduce((a, b) => a + b, 0) / blockTimeDeltas.value.length;
});

const avgBlockTimeDisplay = computed(() => {
  if (avgBlockTimeSeconds.value === null) return "—";
  return `${avgBlockTimeSeconds.value.toFixed(2)}s`;
});

// Gas price tiers (micro denom per gas unit) from recent txs with fee info
const gasPriceTiers = computed(() => {
  const prices: number[] = [];
  txs.value.forEach((tx) => {
    const gasWanted = Number(tx.gasWanted ?? 0);
    if (!gasWanted || !Array.isArray(tx.fees)) return;
    tx.fees.forEach((fee) => {
      const amt = Number(fee?.amount ?? 0);
      if (amt > 0 && gasWanted > 0) {
        prices.push(amt / gasWanted);
      }
    });
  });
  if (!prices.length) return null;
  const sorted = prices.sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    low: pick(0.1),
    mid: pick(0.5),
    high: pick(0.9)
  };
});

const gasPriceDisplay = (value?: number | null) => {
  if (!value || !Number.isFinite(value)) return "—";
  return `${value.toFixed(3)} uretro/gas`;
};

const onlineValidators = computed(() => validators.value.filter(v => v.status === "BOND_STATUS_BONDED" && !v.jailed).length);

const avgTxPerBlock = computed(() => {
  if (!recentBlocks.value.length) return null;
  const total = recentBlocks.value.reduce((sum, block) => sum + (block.txs || 0), 0);
  return total / recentBlocks.value.length;
});

const avgTxPerBlockDisplay = computed(() => {
  if (avgTxPerBlock.value === null) return "—";
  return avgTxPerBlock.value < 1
    ? avgTxPerBlock.value.toFixed(2)
    : avgTxPerBlock.value.toFixed(1);
});

const latestBlockHeightDisplay = computed(() => {
  const height = info.value.latestBlockHeight;
  if (typeof height === "number" && Number.isFinite(height)) {
    return height.toLocaleString();
  }
  return "—";
});

const latestBlockSummary = computed(() => recentBlocks.value[0] ?? null);

const latestBlockTimeRelative = computed(() => {
  const time = latestBlockSummary.value?.time;
  if (!time) return "—";
  return dayjs(time).fromNow?.() ?? dayjs(time).format("YYYY-MM-DD HH:mm:ss");
});

const latestBlockTimeAbsolute = computed(() => {
  const time = latestBlockSummary.value?.time;
  if (!time) return info.value.latestBlockTime || "—";
  return dayjs(time).format("YYYY-MM-DD HH:mm:ss");
});

const latestProposerDisplay = computed(() => {
  const latest = latestBlockSummary.value;
  if (!latest) return "—";
  const proposerLabel = (latest as any).proposerLabel as string | { label?: string } | undefined;
  return (
    (typeof proposerLabel === "string" ? proposerLabel : proposerLabel?.label) ||
    latest.proposerMoniker ||
    latest.proposerOperator?.slice(0, 16)?.concat("…") ||
    "Unknown"
  );
});

const latestProposerShort = computed(() => {
  const label = latestProposerDisplay.value;
  if (!label || label === "—") return "—";
  return label.length > 32 ? `${label.slice(0, 32)}…` : label;
});

const latestGasUtilizationDisplay = computed(() => {
  const util = latestBlockSummary.value?.gasUtilization;
  if (typeof util !== "number" || !Number.isFinite(util)) return "—";
  return `${(util * 100).toFixed(1)}%`;
});

const latestGasUtilizationPercent = computed(() => {
  const util = latestBlockSummary.value?.gasUtilization;
  if (typeof util !== "number" || !Number.isFinite(util)) return null;
  return Math.max(0, Math.min(100, Number((util * 100).toFixed(1))));
});

const totalTxsDisplay = computed(() => {
  if (typeof info.value.totalTxs === "number" && info.value.totalTxs >= 0) {
    return info.value.totalTxs.toLocaleString();
  }
  return "—";
});

const totalTxsWindow = computed(() =>
  recentBlocks.value.reduce((sum, block) => sum + (block.txs || 0), 0)
);

const totalTxsWindowDisplay = computed(() => totalTxsWindow.value.toLocaleString());

const blockSampleLabel = computed(() =>
  blockTimeDeltas.value.length
    ? `Last ${blockTimeDeltas.value.length} blocks`
    : "Awaiting blocks"
);

const canNextBlocks = computed(() => {
  const latest = info.value.latestBlockHeight || recentBlocks.value[0]?.height || 0;
  return latest - (blockPage.value + 1) * blockPageSize > 0;
});

const nextBlocksPage = async () => {
  if (!canNextBlocks.value) return;
  blockPage.value += 1;
  await fetchLatest(blockPageSize, blockStartHeight(blockPage.value));
};

const prevBlocksPage = async () => {
  if (blockPage.value === 0) return;
  blockPage.value -= 1;
  await fetchLatest(blockPageSize, blockStartHeight(blockPage.value));
};

const nextTxPage = async () => {
  txPage.value += 1;
  await searchRecent(txPageSize, txPage.value);
};

const prevTxPage = async () => {
  if (txPage.value === 0) return;
  txPage.value -= 1;
  await searchRecent(txPageSize, txPage.value);
};

const networkStatus = computed(() => {
  if (loadingInfo.value) {
    return {
      label: "Syncing",
      indicator: "bg-amber-400",
      textClass: "text-amber-200",
      subtext: "Fetching latest state"
    };
  }
  if (!info.value.latestBlockHeight) {
    return {
      label: "Offline",
      indicator: "bg-rose-400",
      textClass: "text-rose-200",
      subtext: "No recent blocks"
    };
  }
  return {
    label: "Active",
    indicator: "bg-emerald-400",
    textClass: "text-emerald-200",
    subtext: `Height #${info.value.latestBlockHeight?.toLocaleString?.() ?? info.value.latestBlockHeight}`
  };
});

const featureHighlights = [
  {
    icon: "🎮",
    title: "Arcade-first",
    body: "Sessions, leaderboards, and achievements stream straight into the explorer."
  },
  {
    icon: "🔗",
    title: "IBC routing",
    body: "Cosmos Hub + Noble channels preconfigured for rapid bridging."
  },
  {
    icon: "⚡",
    title: "Live telemetry",
    body: "10s auto-refresh keeps blocks, txs, and sparkline insights fresh."
  },
  {
    icon: "🛠️",
    title: "Builder toolkit",
    body: "REST, RPC, and WebSocket endpoints surfaced inline for dev workflows."
  }
];

// Sparkline path generator
function sparkPath(data: number[], width = 160, height = 40) {
  if (!data || !data.length) return "";
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const step = width / (data.length - 1 || 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * height;
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  });
  return points.join(" ");
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="showSpaceInvadersNotice"
      class="card border border-emerald-400/70 bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-indigo-600/15 shadow-lg shadow-emerald-500/20"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="text-3xl sm:text-4xl">🚨👾🧱</div>
          <div>
            <div class="text-xs uppercase tracking-[0.2em] text-emerald-200">Arcade Alert</div>
            <div class="text-sm font-semibold text-emerald-100">RetroVaders & RetroNoid are LIVE</div>
            <p class="text-xs sm:text-sm text-slate-200 mt-1">
              Jump in, drop coins, blast aliens, and smash bricks. Leaderboards are on—stack combos and climb fast.
            </p>
            <p class="text-[11px] text-emerald-200/80 mt-1">Beta mode · Rewards flowing · Report bugs in Discord</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <a class="btn btn-primary text-xs" href="/arcade/arcade/" target="_blank" rel="noopener">Play RetroVaders</a>
          <a class="btn text-xs" href="/retronoid/retronoid/" target="_blank" rel="noopener">🧱 Play RetroNoid</a>
          <button class="btn text-xs" @click="dismissSpaceInvadersNotice">Dismiss</button>
        </div>
      </div>
    </div>

    <RcDisclaimer type="warning" title="⚠️ Experimental Mainnet Notice">
      <p>
        <strong>RetroChain is a live Cosmos SDK mainnet, but the network, modules, and contracts remain experimental.</strong>
      </p>
      <p>
        Upgrades, validator rotations, and RPC changes can happen without notice. Expect occasional downtime while we harden the chain.
      </p>
      <p>
        Transactions are irreversible—double-check recipients, fees, and any Keplr prompts, and only risk funds you can afford to lose.
      </p>
      <p class="mt-2 text-xs text-amber-200/80">
        Read the full
        <RouterLink to="/legal" class="underline underline-offset-2 hover:text-amber-100">
          Terms &amp; Conditions
        </RouterLink>
        for detailed legal disclosures.
      </p>
    </RcDisclaimer>

    <div v-if="network === 'mainnet'" class="card-soft border-emerald-500/40">
      <div class="flex items-center justify-between">
        <div class="text-sm">
          <span class="text-emerald-300 font-semibold">Mainnet is live</span> — welcome to RetroChain! 🚀
        </div>
        <div class="flex items-center gap-2">
          <a href="/api/cosmos/base/tendermint/v1beta1/node_info" class="btn text-xs">Node Info</a>
        </div>
      </div>
    </div>

    <section class="flex flex-col gap-3 min-w-0">
      <!-- Hero Welcome Card -->
      <div class="card-soft relative overflow-hidden">
        <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
        <div class="relative">
          <div class="flex flex-wrap items-baseline gap-2 mb-2">
            <h1 class="text-2xl font-bold">
              <span class="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                RetroChain Arcade Explorer
              </span>
            </h1>
            <span class="badge text-emerald-200 border-emerald-500/40 text-xs">
              {{ network === 'mainnet' ? 'mainnet' : 'testnet' }}
            </span>
          </div>
          <p class="text-sm text-slate-300 mb-4">
            Custom Cosmos-SDK app chain for arcade-style gaming.
            Now live on <span class="text-emerald-300 font-semibold">{{ network === 'mainnet' ? 'MAINNET' : 'TESTNET' }}</span> —
            monitor chain health, blocks, transactions, validators, and governance in real-time.
          </p>
          
          <!-- Quick Action Buttons -->
          <div class="flex flex-wrap gap-2 mb-4">
            <button 
              class="btn btn-primary text-xs"
              @click="router.push({ name: 'blocks' })"
            >
              Explore Blocks
            </button>
            <button 
              class="btn text-xs"
              @click="router.push({ name: 'validators' })"
            >
              Validators
            </button>
            <button 
              class="btn text-xs"
              @click="router.push({ name: 'account' })"
            >
              Account Lookup
            </button>
          </div>

          <!-- Network Info Tags -->
          <div class="flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span class="badge">
              REST: <code>{{ REST_DISPLAY }}</code>
            </span>
            <span class="badge">
              RPC: <code>{{ RPC_DISPLAY }}</code>
            </span>
            <span class="badge">Token: {{ network === 'mainnet' ? 'RETRO / uretro' : 'DRETRO / udretro' }}</span>
          </div>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="card overflow-visible relative z-50">
        <div class="flex items-center gap-3 mb-3">
          <div class="text-2xl"></div>
          <div>
            <h2 class="text-base font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Universal Search
            </h2>
            <p class="text-xs text-slate-400">
              Search by block height, transaction hash, or account address
            </p>
          </div>
        </div>
        <RcSearchBar />
      </div>

      <div class="flex flex-col gap-4">
        <div
          v-for="card in orderedCards"
          :key="card.id"
          class="card"
          :style="{ order: getOrder(card.id) }"
        >
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-slate-100">{{ card.title }}</h2>
            <div class="flex items-center gap-1">
              <button class="btn text-[10px]" @click="moveCard(card.id, -1)">↑</button>
              <button class="btn text-[10px]" @click="moveCard(card.id, 1)">↓</button>
              <button class="btn text-[10px]" @click="toggleCollapse(card.id)">
                {{ isCollapsed(card.id) ? 'Expand' : 'Collapse' }}
              </button>
            </div>
          </div>

          <div v-show="!isCollapsed(card.id)">
            <template v-if="card.id === 'network'">
              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article class="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col gap-1">
                  <div class="text-xs uppercase tracking-wider text-slate-400">Status</div>
                  <div class="text-xl font-semibold flex items-center gap-2" :class="networkStatus.textClass">
                    <span class="w-2 h-2 rounded-full animate-pulse" :class="networkStatus.indicator"></span>
                    {{ networkStatus.label }}
                  </div>
                  <div class="text-[11px] text-slate-400">{{ networkStatus.subtext }}</div>
                </article>
                <article class="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex flex-col gap-1">
                  <div class="text-xs uppercase tracking-wider text-slate-400">Chain ID</div>
                  <div class="text-xl font-semibold text-white truncate">{{ info.chainId || '—' }}</div>
                  <div class="text-[11px] text-slate-500">REST {{ REST_DISPLAY }} · RPC {{ RPC_DISPLAY }}</div>
                </article>
                <article class="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col gap-1">
                  <div class="text-xs uppercase tracking-wider text-slate-400">Total Blocks</div>
                  <div class="text-2xl font-semibold text-white">{{ latestBlockHeightDisplay }}</div>
                  <div class="text-[11px] text-slate-500">Synced height</div>
                </article>
                <article class="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 flex flex-col gap-1">
                  <div class="text-xs uppercase tracking-wider text-slate-400">Total Txs</div>
                  <div class="text-2xl font-semibold text-white">{{ totalTxsDisplay }}</div>
                  <div class="text-[11px] text-slate-500">Rolling counter</div>
                </article>
              </div>
            </template>

            <template v-else-if="card.id === 'arcade-burn'">
              <div class="grid gap-3 md:grid-cols-3">
                <article class="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <div class="text-xs uppercase tracking-wider text-emerald-200 flex items-center justify-between">
                    <span>Insert Coin Burn (events)</span>
                    <span class="text-[10px] text-emerald-200/80">Auto-refresh</span>
                  </div>
                  <div class="text-3xl font-bold text-emerald-100 mt-2">{{ arcadeBurnDisplay }}</div>
                  <p class="text-[11px] text-emerald-200/80 mt-1">
                    RETRO burned from Insert Coin purchases (tokens_burned in arcade.credits_inserted events). Default split is 80% burn / 20% to the game developer; if the game is unregistered or lacks a developer wallet, 100% is burned.
                  </p>
                  <div class="text-xs text-emerald-200 flex items-center gap-2 mt-3 flex-wrap">
                    <RouterLink class="underline underline-offset-2" to="/tokenomics">View burn telemetry</RouterLink>
                    <span class="text-emerald-300/60">·</span>
                    <RouterLink class="underline underline-offset-2" to="/arcade">Play &amp; burn</RouterLink>
                    <span class="text-emerald-300/60">·</span>
                    <span>{{ arcadeBurnLoading ? 'Syncing…' : 'Live sample' }}</span>
                  </div>
                </article>

                <article class="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 md:col-span-2">
                  <div class="text-xs uppercase tracking-wider text-amber-200">Why it matters</div>
                  <p class="text-sm text-slate-100 font-semibold mt-1">Insert Coin is a native burn sink.</p>
                  <p class="text-xs text-amber-100/80 mt-2 leading-relaxed">
                    Every Insert Coin purchase consumes uretro on-chain instead of recycling it. Arcade credits are minted, but the
                    RETRO you spend is permanently removed at the burn sink above—no treasury accrual, just deflationary pressure tied to player activity.
                  </p>
                  <p class="text-[11px] text-amber-100/70 mt-2">
                    Watch the running balance in real time and compare with the Tokenomics burn telemetry to see arcade-driven burns.
                  </p>
                </article>
              </div>
            </template>

            <template v-else-if="card.id === 'health'">
              <div class="grid gap-3 xl:grid-cols-3">
                <article class="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-emerald-100">Chain Health</h2>
                    <span class="text-[11px] text-slate-400">Live sample</span>
                  </div>
                  <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <div>
                      <div class="text-[11px] uppercase tracking-wider text-slate-400">Avg Block Time</div>
                      <div class="text-base font-semibold text-slate-100">{{ avgBlockTimeDisplay }}</div>
                    </div>
                    <div>
                      <div class="text-[11px] uppercase tracking-wider text-slate-400">Online Validators</div>
                      <div class="text-base font-semibold text-slate-100">{{ onlineValidators || '—' }}</div>
                    </div>
                    <div>
                      <div class="text-[11px] uppercase tracking-wider text-slate-400">Block Sample</div>
                      <div class="text-base font-semibold text-slate-100">{{ blockSampleLabel }}</div>
                    </div>
                  </div>
                </article>

                <article class="border border-cyan-500/30 bg-cyan-500/5 rounded-2xl p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-cyan-100">Mempool</h2>
                    <button class="btn text-[11px]" :disabled="loadingMempool" @click="refreshMempool">{{ loadingMempool ? '...' : 'Refresh' }}</button>
                  </div>
                  <div class="text-sm text-slate-200">Pending Txs: <span class="font-semibold text-white">{{ mempool.count }}</span></div>
                  <div class="text-xs text-slate-400">Size: {{ (mempool.totalBytes / 1024).toFixed(1) }} KB</div>
                  <div v-if="mempoolError" class="text-[11px] text-rose-300 mt-2">{{ mempoolError }}</div>
                </article>

                <article class="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-4">
                  <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-amber-100">Fee Estimator</h2>
                    <span class="text-[11px] text-slate-400">Recent txs</span>
                  </div>
                  <div v-if="!gasPriceTiers" class="text-xs text-slate-400">Not enough fee data yet</div>
                  <div v-else class="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div class="text-[11px] uppercase tracking-wider text-slate-500">Low</div>
                      <div class="font-semibold text-slate-100">{{ gasPriceDisplay(gasPriceTiers.low) }}</div>
                    </div>
                    <div>
                      <div class="text-[11px] uppercase tracking-wider text-slate-500">Mid</div>
                      <div class="font-semibold text-slate-100">{{ gasPriceDisplay(gasPriceTiers.mid) }}</div>
                    </div>
                    <div>
                      <div class="text-[11px] uppercase tracking-wider text-slate-500">High</div>
                      <div class="font-semibold text-slate-100">{{ gasPriceDisplay(gasPriceTiers.high) }}</div>
                    </div>
                  </div>
                </article>
              </div>
            </template>

            <template v-else-if="card.id === 'block-stats'">
              <div class="grid gap-4 xl:grid-cols-4">
                <article class="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-800/40 p-5 shadow-xl shadow-black/30 flex flex-col gap-4 xl:col-span-2">
                  <div class="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-emerald-200">
                    <span>Latest Block</span>
                    <span class="text-[10px] text-slate-400 normal-case tracking-normal">{{ latestBlockTimeRelative }}</span>
                  </div>
                  <div class="flex flex-wrap items-end gap-3">
                    <div class="text-4xl font-bold text-white leading-none">
                      {{ loadingInfo ? '…' : latestBlockHeightDisplay }}
                    </div>
                    <span class="px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.2em] border border-emerald-400/50 text-emerald-200">
                      {{ network === 'mainnet' ? 'Mainnet' : 'Testnet' }}
                    </span>
                  </div>
                  <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-xs text-slate-400">
                    <div>
                      <dt class="uppercase tracking-wider text-[10px] text-slate-500">Timestamp</dt>
                      <dd class="text-sm text-slate-100 font-mono">{{ latestBlockTimeAbsolute }}</dd>
                    </div>
                    <div>
                      <dt class="uppercase tracking-wider text-[10px] text-slate-500">Proposer</dt>
                      <dd class="text-sm text-slate-100 truncate" :title="latestProposerDisplay">{{ latestProposerShort }}</dd>
                    </div>
                    <div>
                      <dt class="uppercase tracking-wider text-[10px] text-slate-500">Gas Used</dt>
                      <dd class="text-sm text-slate-100">
                        {{ latestBlockSummary?.gasUsed?.toLocaleString?.() ?? '—' }}
                      </dd>
                    </div>
                    <div>
                      <dt class="uppercase tracking-wider text-[10px] text-slate-500">Gas Wanted</dt>
                      <dd class="text-sm text-slate-100">
                        {{ latestBlockSummary?.gasWanted?.toLocaleString?.() ?? '—' }}
                      </dd>
                    </div>
                  </dl>
                </article>

                <article class="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 p-5 shadow-lg flex flex-col gap-3">
                  <div class="flex items-center justify-between text-[11px] uppercase tracking-wider text-emerald-200">
                    <span>Live Block Time</span>
                    <span class="text-[10px] text-slate-600 dark:text-slate-300 font-normal tracking-normal">{{ blockSampleLabel }}</span>
                  </div>
                  <div class="text-4xl font-semibold text-white">
                    {{ avgBlockTimeDisplay }}
                  </div>
                  <svg :width="240" :height="60" class="-mx-2">
                    <path :d="sparkPath(blockTimeDeltas, 240, 60)" stroke="rgb(16 185 129)" fill="none" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </article>

                <article class="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5 shadow-lg flex flex-col gap-3">
                  <div class="flex items-center justify-between text-[11px] uppercase tracking-wider text-indigo-200">
                    <span>Tx Throughput</span>
                    <span class="text-[10px] text-slate-500 font-normal tracking-normal">20-block window</span>
                  </div>
                  <div class="text-4xl font-semibold text-white">
                    {{ avgTxPerBlockDisplay }}
                  </div>
                  <div class="text-[11px] text-slate-400">
                    Latest block: <span class="text-slate-100">{{ latestBlockSummary?.txs ?? 0 }}</span> txs · Window total: <span class="text-slate-100">{{ totalTxsWindowDisplay }}</span>
                  </div>
                  <svg :width="240" :height="60" class="-mx-2">
                    <path :d="sparkPath(txsPerBlock, 240, 60)" stroke="rgb(99 102 241)" fill="none" stroke-width="2" stroke-linecap="round" />
                  </svg>
                </article>

                <article class="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-5 shadow-lg flex flex-col gap-3">
                  <div class="flex items-center justify-between text-[11px] uppercase tracking-wider text-amber-200">
                    <span>Gas Utilization</span>
                    <span class="text-[10px] text-slate-600 dark:text-slate-300 font-normal tracking-normal">{{ latestGasUtilizationDisplay }}</span>
                  </div>
                  <div class="text-4xl font-semibold text-white">
                    {{ latestGasUtilizationDisplay }}
                  </div>
                  <div class="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-amber-400 to-orange-500"
                      :style="{ width: latestGasUtilizationPercent !== null ? `${latestGasUtilizationPercent}%` : '6%' }"
                    ></div>
                  </div>
                  <div class="text-[11px] text-slate-400 flex flex-col gap-1">
                    <span>Gas Used: <span class="text-slate-100">{{ latestBlockSummary?.gasUsed?.toLocaleString?.() ?? '—' }}</span></span>
                    <span>Gas Wanted: <span class="text-slate-100">{{ latestBlockSummary?.gasWanted?.toLocaleString?.() ?? '—' }}</span></span>
                  </div>
                </article>
              </div>
            </template>

            <template v-else-if="card.id === 'blocks'">
              <div class="grid gap-3 xl:grid-cols-2 min-w-0">
                <div class="min-w-0 overflow-hidden">
                  <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-slate-100">Latest blocks</h2>
                    <div class="flex items-center gap-2">
                      <button
                        class="btn text-xs"
                        :class="autoRefreshEnabled ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
                        @click="toggleAutoRefresh"
                      >
                        {{ autoRefreshEnabled ? `Auto (${countdown}s)` : "Paused" }}
                      </button>
                      <div class="flex items-center gap-1">
                        <button class="btn text-[10px]" :disabled="blockPage === 0" @click="prevBlocksPage">Prev</button>
                        <span class="text-[11px] text-slate-400">Page {{ blockPage + 1 }}</span>
                        <button class="btn text-[10px]" :disabled="!canNextBlocks" @click="nextBlocksPage">Next</button>
                      </div>
                      <button class="btn text-xs" @click="router.push({ name: 'blocks' })">
                        View all
                      </button>
                    </div>
                  </div>
                  <div v-if="loadingBlocks" class="text-xs text-slate-400">
                    Loading latest blocks...
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="table min-w-full">
                      <colgroup>
                        <col style="width: 120px" />
                        <col />
                        <col style="width: 90px" />
                        <col style="width: 220px" />
                      </colgroup>
                      <thead>
                        <tr class="text-slate-300 text-xs">
                          <th>Height</th>
                          <th>Hash</th>
                          <th>Txs</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="b in blocks"
                          :key="b.height"
                          class="cursor-pointer hover:bg-white/5 transition-colors"
                          @click="router.push({ name: 'block-detail', params: { height: b.height } })"
                        >
                          <td class="font-mono text-[12px] py-2">{{ b.height }}</td>
                          <td class="font-mono text-[12px] py-2">
                            <div class="flex items-center gap-2 whitespace-nowrap">
                              <span class="truncate max-w-[180px] inline-block align-middle">{{ shortString(b.hash, 16) }}</span>
                              <button class="btn text-[10px]" @click.stop="copy(b.hash)">Copy</button>
                            </div>
                          </td>
                          <td class="text-xs py-2">
                            <span class="badge" :class="b.txs > 0 ? 'border-cyan-400/60 text-cyan-200' : ''">
                              {{ b.txs }}
                            </span>
                          </td>
                          <td class="text-xs text-slate-300 py-2 whitespace-nowrap">
                            <span v-if="b.time">{{ dayjs(b.time).format('YYYY-MM-DD HH:mm:ss') }}</span>
                            <span v-else>-</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div class="min-w-0 overflow-hidden">
                  <div class="flex items-center justify-between mb-2">
                    <h2 class="text-sm font-semibold text-slate-100">
                      Recent transactions
                    </h2>
                    <div class="flex items-center gap-2">
                      <div class="flex items-center gap-1">
                        <button class="btn text-[10px]" :disabled="txPage === 0" @click="prevTxPage">Prev</button>
                        <span class="text-[11px] text-slate-400">Page {{ txPage + 1 }}</span>
                        <button class="btn text-[10px]" :disabled="txs.length < txPageSize" @click="nextTxPage">Next</button>
                      </div>
                      <button class="btn text-xs" @click="router.push({ name: 'txs' })">
                        View all txs
                      </button>
                    </div>
                  </div>
                  <div v-if="loadingTxs" class="text-xs text-slate-400">
                    Loading recent transactions...
                  </div>
                  <div v-else-if="txs.length === 0" class="text-xs text-slate-400 py-4 text-center">
                    <div class="mb-2"></div>
                    <div>No transactions yet</div>
                    <div class="text-[11px] mt-1">
                      Generate some activity using the CLI or faucet
                    </div>
                  </div>
                  <div v-else class="overflow-x-auto">
                    <table class="table min-w-full">
                      <thead>
                        <tr class="text-slate-300 text-xs">
                          <th>Hash</th>
                          <th>Height</th>
                          <th>Code</th>
                          <th>Gas</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="t in txs"
                          :key="t.hash"
                          class="cursor-pointer"
                          @click="goToTx(t.hash)"
                        >
                          <td class="font-mono text-[11px]">
                            {{ shortString(t.hash, 10) }}
                          </td>
                          <td class="font-mono text-[11px]">{{ t.height }}</td>
                          <td class="text-xs">
                            <span
                              class="badge"
                              :class="t.code === 0 ? 'border-emerald-400/60' : 'border-rose-400/60 text-rose-200'"
                            >
                              {{ t.code ?? 0 }}
                            </span>
                          </td>
                          <td class="text-[11px] text-slate-300">
                            {{ t.gasUsed || '-' }} / {{ t.gasWanted || '-' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </template>


            <template v-else-if="card.id === 'features'">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-bold text-white flex items-center gap-2">
                  <span>✨</span>
                  RetroChain Feature Pack
                </h2>
                <span class="text-[11px] text-slate-400">Explorer-native perks</span>
              </div>
              <div class="grid gap-3 md:grid-cols-2">
                <article
                  v-for="feature in featureHighlights"
                  :key="feature.title"
                  class="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3"
                >
                  <div class="text-2xl">{{ feature.icon }}</div>
                  <div>
                    <h3 class="text-sm font-semibold text-white">{{ feature.title }}</h3>
                    <p class="text-xs text-slate-300 leading-relaxed">{{ feature.body }}</p>
                  </div>
                </article>
              </div>
            </template>

            <template v-else-if="card.id === 'howto'">
              <div class="text-xs text-slate-300 leading-relaxed">
                <h3 class="text-sm font-semibold mb-1 text-slate-100 flex items-center gap-2">
                  <span>ℹ️</span>
                  How to use this explorer
                </h3>
                <ol class="list-decimal list-inside space-y-1">
                  <li>Keep <code>ignite chain serve</code> running for RetroChain.</li>
                  <li>
                    Ensure REST API is reachable at the configured endpoint (default <code>/api</code> when proxied).
                  </li>
                  <li>
                    Start this UI with
                    <code>npm install && npm run dev</code>
                    inside
                    <code>vue/</code>.
                  </li>
                  <li>
                    Use the faucet or CLI to generate traffic and watch blocks / txs update.
                  </li>
                  <li class="text-indigo-300">
                    🎮 Use arcade module to register games, insert coins, and start sessions!
                  </li>
                </ol>
              </div>
            </template>
          </div>
        </div>
      </div>

    </section>
  </div>
</template>
