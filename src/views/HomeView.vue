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
import RcAddKeplrButton from "@/components/RcAddKeplrButton.vue";
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

const latestGasUtilizationDisplay = computed(() => {
  const util = latestBlockSummary.value?.gasUtilization;
  if (typeof util !== "number" || !Number.isFinite(util)) return "—";
  return `${(util * 100).toFixed(1)}%`;
});

const totalTxsDisplay = computed(() => {
  if (typeof info.value.totalTxs === "number" && info.value.totalTxs >= 0) {
    return info.value.totalTxs.toLocaleString();
  }
  return "—";
});

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
  <div class="grid grid-1-3 gap-4">
    <div class="col-span-full">
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
    </div>
    <div v-if="network === 'mainnet'" class="col-span-full">
      <div class="card-soft border-emerald-500/40">
        <div class="flex items-center justify-between">
          <div class="text-sm">
            <span class="text-emerald-300 font-semibold">Mainnet is live</span> — welcome to RetroChain! 🚀
          </div>
          <div class="flex items-center gap-2">
            <RcAddKeplrButton />
            <a href="/api/cosmos/base/tendermint/v1beta1/node_info" class="btn text-xs">Node Info</a>
          </div>
        </div>
      </div>
    </div>
    <section class="flex flex-col gap-3">
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
            <RcAddKeplrButton />
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
      <div class="card">
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

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
          <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Latest Block</div>
          <div class="text-3xl font-bold text-indigo-200">
            {{ loadingInfo ? '…' : latestBlockHeightDisplay }}
          </div>
          <div class="text-[11px] text-slate-400">{{ latestBlockTimeRelative }}</div>
          <div class="text-[11px] text-slate-500">Timestamp: {{ latestBlockTimeAbsolute }}</div>
          <div class="text-[11px] text-slate-500 mt-1">Proposer: <span class="text-slate-300">{{ latestProposerDisplay }}</span></div>
        </div>
        <div class="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Live Block Time</div>
            <div class="text-[10px] text-slate-500">Last {{ blockTimeDeltas.length || 0 }} blocks</div>
          </div>
          <div class="text-3xl font-bold text-emerald-200">{{ avgBlockTimeDisplay }}</div>
          <svg :width="160" :height="40" class="mt-2">
            <path :d="sparkPath(blockTimeDeltas)" stroke="rgb(16 185 129)" fill="none" stroke-width="2" />
          </svg>
        </div>
        <div class="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Tx Throughput</div>
            <div class="text-[10px] text-slate-500">Last 20 blocks</div>
          </div>
          <div class="text-3xl font-bold text-blue-200">{{ avgTxPerBlockDisplay }}</div>
          <div class="text-[11px] text-slate-500">Latest block: {{ latestBlockSummary?.txs ?? 0 }} txs</div>
          <svg :width="160" :height="40" class="mt-2">
            <path :d="sparkPath(txsPerBlock)" stroke="rgb(59 130 246)" fill="none" stroke-width="2" />
          </svg>
        </div>
        <div class="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30">
          <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Gas Utilization</div>
          <div class="text-3xl font-bold text-amber-200">{{ latestGasUtilizationDisplay }}</div>
          <div class="text-[11px] text-slate-500">
            Gas: {{ latestBlockSummary?.gasUsed?.toLocaleString?.() ?? '0' }} /
            {{ latestBlockSummary?.gasWanted?.toLocaleString?.() ?? '0' }}
          </div>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="card">
        <h2 class="text-lg font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          Network Statistics
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Status</div>
            <div class="text-xl font-bold flex items-center gap-2" :class="networkStatus.textClass">
              <span class="w-2 h-2 rounded-full animate-pulse" :class="networkStatus.indicator"></span>
              {{ networkStatus.label }}
            </div>
            <div class="text-[11px] text-slate-500">{{ networkStatus.subtext }}</div>
          </div>
          <div class="p-3 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Chain ID</div>
            <div class="text-xl font-bold text-indigo-200">{{ info.chainId || '—' }}</div>
          </div>
          <div class="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Total Blocks</div>
            <div class="text-xl font-bold text-blue-200">{{ latestBlockHeightDisplay }}</div>
          </div>
          <div class="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Total Txs</div>
            <div class="text-xl font-bold text-purple-200">{{ totalTxsDisplay }}</div>
          </div>
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
                {{ entry.player.slice(0, 12) }}...
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

      <div class="card">
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
        <table v-else class="table">
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
                  <span class="truncate max-w-[180px] inline-block align-middle">{{ b.hash.slice(0, 16) }}...</span>
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
    </section>

    <section class="flex flex-col gap-3">
      <div class="card">
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
        <table v-else class="table">
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
              @click="router.push({ name: 'tx-detail', params: { hash: t.hash } })"
            >
              <td class="font-mono text-[11px]">
                {{ t.hash.slice(0, 10) }}...
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

      <!-- 🎯 Recent Game Sessions -->
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
            class="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:border-purple-400/40 transition-colors cursor-pointer"
          >
            <div class="flex items-start justify-between mb-2">
              <div>
                <div class="text-xs font-bold text-slate-100">{{ session.game_id }}</div>
                <div class="text-[11px] text-slate-400 font-mono">{{ session.player.slice(0, 20) }}...</div>
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

      <!-- 🏅 Latest Achievements -->
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
                  <div class="text-[11px] text-slate-400 font-mono">{{ achievement.player.slice(0, 16) }}...</div>
                  <div class="text-[10px] text-slate-500">{{ formatTime(achievement.unlocked_at) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
