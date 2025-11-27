<script setup lang="ts">
import { onMounted } from "vue";
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
</script>

<template>
  <div class="grid grid-1-3 gap-4">
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
              devnet
            </span>
          </div>
          <p class="text-sm text-slate-300 mb-4">
            Custom Cosmos-SDK app chain for arcade-style gaming. Monitor chain health, 
            blocks, transactions, validators, and governance in real-time.
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
              REST: <code>http://localhost:1317</code>
            </span>
            <span class="badge">
              Node: <code>http://localhost:26657</code>
            </span>
            <span class="badge">Token: RETRO / uretro</span>
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

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <RcStatCard
          label="Latest Block"
          icon=""
          :value="loadingInfo ? '…' : info.latestBlockHeight ?? '—'"
          :hint="info.latestBlockTime ? `${info.latestBlockTime}` : 'Syncing...'"
          trend="up"
        />
        <RcStatCard
          label="Chain ID"
          icon=""
          :value="loadingInfo ? '…' : info.chainId ?? 'retrochain-arcade-1'"
          hint="Network identifier"
        />
        <RcStatCard
          label="Recent Txs"
          icon=""
          :value="loadingTxs ? '…' : txs.length"
          hint="Last 10 transactions"
          trend="neutral"
        />
      </div>

      <!-- Quick Stats -->
      <div class="card">
        <h2 class="text-lg font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Network Statistics</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="p-3 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Avg Block Time</div>
            <div class="text-xl font-bold text-indigo-300">~6s</div>
          </div>
          <div class="p-3 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Network</div>
            <div class="text-xl font-bold text-emerald-300 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Active
            </div>
          </div>
          <div class="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Total Blocks</div>
            <div class="text-xl font-bold text-blue-300">
              {{ info.latestBlockHeight || '-' }}
            </div>
          </div>
          <div class="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Total Txs</div>
            <div class="text-xl font-bold text-purple-300">{{ txs.length }}+</div>
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
              class="cursor-pointer"
              @click="router.push({ name: 'block-detail', params: { height: b.height } })"
            >
              <td class="font-mono text-[11px]">{{ b.height }}</td>
              <td class="font-mono text-[11px]">
                {{ b.hash.slice(0, 10) }}...
              </td>
              <td class="text-xs">
                <span class="badge">
                  {{ b.txs }} tx
                </span>
              </td>
              <td class="text-xs text-slate-300">
                {{ b.time || "-" }}
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

      <div class="card text-xs text-slate-300 leading-relaxed">
        <h3 class="text-sm font-semibold mb-1 text-slate-100 flex items-center gap-2">
          <span>ℹ️</span>
          How to use this explorer
        </h3>
        <ol class="list-decimal list-inside space-y-1">
          <li>Keep <code>ignite chain serve</code> running for RetroChain.</li>
          <li>
            Ensure REST API is exposed at
            <code>http://localhost:1317</code>
            (default).
          </li>
          <li>
            Start this UI with
            <code>npm install && npm run dev</code>
            inside
            <code>vue/</code>.
          </li>
          <li>
            Hit the faucet endpoint or use CLI to generate traffic and watch
            blocks / txs update.
          </li>
          <li class="text-indigo-300">
            🎮 Use arcade module to register games, insert coins, and start sessions!
          </li>
        </ol>
      </div>
    </section>
  </div>
</template>
