<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useChainInfo } from "@/composables/useChainInfo";
import { useBlocks } from "@/composables/useBlocks";
import { useTxs } from "@/composables/useTxs";
import { useArcade } from "@/composables/useArcade";
import { useAutoRefresh } from "@/composables/useAutoRefresh";
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
const {
  games,
  leaderboard,
  sessions,
  achievements,
  loading: loadingArcade,
  fetchGames,
  fetchLeaderboard,
  fetchRecentSessions,
  fetchLatestAchievements,
} = useArcade();

const refreshAll = async () => {
  await Promise.all([
    refresh(),
    fetchLatest(10),
    searchRecent(10),
    fetchGames(),
    fetchLeaderboard(5),
    fetchRecentSessions(5),
    fetchLatestAchievements(5),
  ]);
};

const { enabled: autoRefreshEnabled, countdown, toggle: toggleAutoRefresh } = useAutoRefresh(
  refreshAll,
  10000
);

onMounted(async () => {
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
  return (
    latest.proposerLabel?.name ||
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

      <!-- Network Pulse (promoted) -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Network Pulse
          </h2>
          <span class="text-[11px] text-slate-500">Live refresh every 10s</span>
        </div>
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
      </div>

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

      <div class="grid gap-3 xl:grid-cols-2 min-w-0">
        <div class="card min-w-0 overflow-hidden">
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

        <div class="card min-w-0 overflow-hidden">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold text-slate-100">
              Recent transactions
            </h2>
            <button class="btn text-xs" @click="router.push({ name: 'txs' })">
              View all txs
            </button>
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

      <div class="grid gap-3 xl:grid-cols-2 min-w-0">
        <div class="card">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span class="text-xl">🎯</span>
              Recent Game Sessions
            </h2>
          </div>
          <div v-if="loadingArcade" class="text-xs text-slate-400">
            Loading sessions...
          </div>
          <div v-else-if="sessions.length === 0" class="text-xs text-slate-400 py-4 text-center">
            <div class="mb-2 text-2xl">🎯</div>
            <div>No game sessions yet</div>
            <div class="text-[11px] mt-1">
              Start a game using MsgInsertCoin and MsgStartSession
            </div>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="session in sessions"
              :key="session.session_id"
              class="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-400/40 transition-colors"
            >
              <div class="flex items-start justify-between mb-2">
                <div>
                  <div class="text-xs font-bold text-slate-100">{{ session.game_id }}</div>
                  <div class="text-[11px] text-slate-400 font-mono">{{ shortString(session.player, 20) }}</div>
                </div>
                <span
                  class="badge text-[10px]"
                  :class="
                    session.status === 'active'
                      ? 'text-emerald-200 border-emerald-500/40'
                      : 'text-slate-300 border-slate-500/40'
                  "
                >
                  {{ session.status }}
                </span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-300">Score: <span class="text-indigo-300 font-bold">{{ session.score }}</span></span>
                <span class="text-slate-400">Level {{ session.level_reached }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span class="text-xl">🏅</span>
              Latest Achievements
            </h2>
          </div>
          <div v-if="loadingArcade" class="text-xs text-slate-400">
            Loading achievements...
          </div>
          <div v-else-if="achievements.length === 0" class="text-xs text-slate-400 py-4 text-center">
            <div class="mb-2 text-2xl">🏅</div>
            <div>No achievements unlocked yet</div>
            <div class="text-[11px] mt-1">
              Unlock achievements by playing games!
            </div>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="achievement in achievements"
              :key="achievement.achievement_id"
              class="p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 hover:border-yellow-400/40 transition-colors"
            >
              <div class="flex items-start gap-3">
                <div class="text-2xl">🏅</div>
                <div class="flex-1">
                  <div class="text-xs font-bold text-slate-100">{{ achievement.name }}</div>
                  <div class="text-[11px] text-slate-300 mb-1">{{ achievement.description }}</div>
                  <div class="flex items-center justify-between">
                    <div class="text-[11px] text-slate-400 font-mono">{{ shortString(achievement.player, 16) }}</div>
                    <div class="text-[10px] text-slate-500">{{ formatTime(achievement.unlocked_at) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Highlights -->
      <div class="card">
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
      </div>

      <!-- 🎮 Arcade Games Section -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span class="text-xl">🎮</span>
            Arcade Games
          </h2>
        </div>
        <div v-if="loadingArcade" class="text-xs text-slate-400">
          Loading arcade games...
        </div>
        <div v-else-if="games.length === 0" class="text-xs text-slate-400 py-4 text-center">
          <div class="mb-2 text-2xl">🎮</div>
          <div>No arcade games registered yet</div>
          <div class="text-[11px] mt-1">
            Register games using the arcade module CLI
          </div>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RcArcadeGameCard
            v-for="game in games.slice(0, 4)"
            :key="game.game_id"
            :game="game"
            @click="() => {}"
          />
        </div>
      </div>

      <!-- 🏆 Global Leaderboard Section -->
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span class="text-xl">🏆</span>
            Global Leaderboard
          </h2>
        </div>
        <div v-if="loadingArcade" class="text-xs text-slate-400">
          Loading leaderboard...
        </div>
        <div v-else-if="leaderboard.length === 0" class="text-xs text-slate-400 py-4 text-center">
          <div class="mb-2 text-2xl">🏆</div>
          <div>No leaderboard entries yet</div>
          <div class="text-[11px] mt-1">
            Start playing games to appear on the leaderboard!
          </div>
        </div>
        <table v-else class="table">
          <thead>
            <tr class="text-slate-300 text-xs">
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
              <th>Games</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in leaderboard"
              :key="entry.rank"
              class="cursor-pointer"
              @click="router.push({ name: 'account', params: { address: entry.player } })"
            >
              <td class="font-mono text-[11px]">
                <span v-if="entry.rank === 1" class="text-yellow-300">🥇</span>
                <span v-else-if="entry.rank === 2" class="text-slate-300">🥈</span>
                <span v-else-if="entry.rank === 3" class="text-orange-300">🥉</span>
                <span v-else>{{ entry.rank }}</span>
              </td>
              <td class="font-mono text-[11px]">
                {{ shortString(entry.player, 12) }}
              </td>
              <td class="text-xs">
                <span class="badge border-indigo-400/60">
                  {{ entry.total_score.toLocaleString() }}
                </span>
              </td>
              <td class="text-[11px] text-slate-300">
                {{ entry.games_played }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>


      <div v-if="network !== 'mainnet'" class="card text-xs text-slate-300 leading-relaxed">
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

    </section>
  </div>
</template>
