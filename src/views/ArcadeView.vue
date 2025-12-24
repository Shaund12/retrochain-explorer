<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import dayjs from "dayjs";
import { useArcade } from "@/composables/useArcade";
import RcArcadeGameCard from "@/components/RcArcadeGameCard.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const {
  games,
  leaderboard,
  sessions,
  achievements,
  loading,
  error,
  fetchGames,
  fetchLeaderboard,
  fetchRecentSessions,
  fetchLatestAchievements
} = useArcade();

const refreshing = ref(false);

const topPlayer = computed(() => leaderboard.value[0] || null);
const totalPlayers = computed(() => leaderboard.value.length);
const totalGames = computed(() => games.value.length);
const topScore = computed(() => Math.max(0, ...leaderboard.value.map((e: any) => Number(e.total_score || 0))));
const totalArcadeTokens = computed(() => leaderboard.value.reduce((sum, e: any) => sum + Number(e.arcade_tokens || 0), 0));

const recentSessions = computed(() => sessions.value.slice(0, 6));
const recentAchievements = computed(() => achievements.value.slice(0, 6));

const refreshAll = async () => {
  refreshing.value = true;
  try {
    await Promise.all([
      fetchGames(),
      fetchLeaderboard(20),
      fetchRecentSessions(10),
      fetchLatestAchievements(10)
    ]);
  } finally {
    refreshing.value = false;
  }
};

onMounted(async () => {
  await refreshAll();
});

const shortAddr = (addr?: string, size = 12) => {
  if (!addr) return "—";
  return `${addr.slice(0, size)}…${addr.slice(-6)}`;
};
</script>

<template>
  <div class="space-y-4">
    <div class="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="text-sm uppercase tracking-[0.2em] text-indigo-200">Arcade Dashboard</div>
        <h1 class="text-2xl font-bold text-white mt-1">Play, Compete, Win</h1>
        <p class="text-sm text-slate-300 mt-1">Live leaderboard, sessions, and achievements from the arcade module.</p>
      </div>
      <div class="flex gap-2">
        <button class="btn text-xs" @click="router.push({ name: 'home' })">? Back to Home</button>
        <button class="btn btn-primary text-xs" :disabled="refreshing || loading" @click="refreshAll">
          {{ refreshing ? 'Refreshing...' : 'Refresh Data' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/10 text-rose-100 text-sm">
      {{ error }}
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="card border-indigo-500/40 bg-indigo-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Top Score</div>
        <div class="text-2xl font-bold text-white">{{ topScore.toLocaleString() }}</div>
        <div class="text-xs text-slate-400">Highest total score across leaderboard</div>
      </div>
      <div class="card border-emerald-500/40 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Players Ranked</div>
        <div class="text-2xl font-bold text-white">{{ totalPlayers }}</div>
        <div class="text-xs text-slate-400">Players with arcade activity</div>
      </div>
      <div class="card border-cyan-500/40 bg-cyan-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Games Listed</div>
        <div class="text-2xl font-bold text-white">{{ totalGames }}</div>
        <div class="text-xs text-slate-400">Registered arcade games</div>
      </div>
      <div class="card border-amber-500/40 bg-amber-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Arcade Tokens</div>
        <div class="text-2xl font-bold text-white">{{ totalArcadeTokens.toLocaleString() }}</div>
        <div class="text-xs text-slate-400">Sum of tokens across leaderboard</div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Leaderboard</h2>
          <span class="text-[11px] text-slate-400">Live from /arcade/v1/leaderboard</span>
        </div>
        <div v-if="leaderboard.length === 0" class="text-xs text-slate-400">No leaderboard entries yet.</div>
        <div v-else class="overflow-x-auto">
          <table class="table min-w-full">
            <thead>
              <tr class="text-xs text-slate-300">
                <th>Rank</th>
                <th>Player</th>
                <th>Total Score</th>
                <th>Games</th>
                <th>Tokens</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in leaderboard" :key="entry.player" class="text-[11px]">
                <td class="font-mono">{{ entry.rank }}</td>
                <td class="font-mono">{{ shortAddr(entry.player, 14) }}</td>
                <td class="font-semibold text-slate-100">{{ Number(entry.total_score || 0).toLocaleString() }}</td>
                <td class="text-slate-200">{{ entry.games_played }}</td>
                <td class="text-emerald-300">{{ entry.arcade_tokens ?? '—' }}</td>
                <td class="text-slate-300">{{ entry.title || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Top Player Spotlight</h2>
          <span class="text-[11px] text-slate-400">From leaderboard[0]</span>
        </div>
        <div v-if="!topPlayer" class="text-xs text-slate-400">No top player yet.</div>
        <div v-else class="space-y-1 text-sm text-slate-200">
          <div class="font-mono text-[11px] text-emerald-200">{{ topPlayer.player }}</div>
          <div class="text-lg font-semibold text-white">{{ Number(topPlayer.total_score || 0).toLocaleString() }} pts</div>
          <div class="text-xs text-slate-400">Games played: {{ topPlayer.games_played ?? '—' }}</div>
          <div class="text-xs text-slate-400">Arcade tokens: {{ topPlayer.arcade_tokens ?? '—' }}</div>
          <div class="text-xs text-amber-300" v-if="topPlayer.title">{{ topPlayer.title }}</div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Recent Sessions</h2>
          <span class="text-[11px] text-slate-400">{{ recentSessions.length }} shown</span>
        </div>
        <div v-if="recentSessions.length === 0" class="text-xs text-slate-400">No sessions recorded yet.</div>
        <div v-else class="space-y-2">
          <div
            v-for="s in recentSessions"
            :key="s.session_id"
            class="p-3 rounded-lg bg-slate-900/60 border border-indigo-500/30"
          >
            <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span class="font-semibold text-slate-200">{{ s.game_id }}</span>
              <span>{{ dayjs(s.started_at).format('YYYY-MM-DD HH:mm') }}</span>
            </div>
            <div class="flex items-center justify-between text-xs text-slate-300">
              <span class="font-mono">{{ shortAddr(s.player, 14) }}</span>
              <span class="text-emerald-300">Score: {{ s.score }}</span>
            </div>
            <div class="text-[11px] text-slate-500">Level {{ s.level_reached }} · Status {{ s.status }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Latest Achievements</h2>
          <span class="text-[11px] text-slate-400">{{ recentAchievements.length }} shown</span>
        </div>
        <div v-if="recentAchievements.length === 0" class="text-xs text-slate-400">No achievements yet.</div>
        <div v-else class="space-y-2">
          <div
            v-for="a in recentAchievements"
            :key="a.achievement_id"
            class="p-3 rounded-lg bg-slate-900/60 border border-amber-500/30"
          >
            <div class="flex items-center justify-between text-[11px] text-amber-200 mb-1">
              <span class="font-semibold text-slate-100">{{ a.name }}</span>
              <span>{{ dayjs(a.unlocked_at).format('YYYY-MM-DD HH:mm') }}</span>
            </div>
            <div class="text-xs text-slate-300 mb-1">{{ a.description }}</div>
            <div class="text-[11px] text-slate-400 font-mono">{{ shortAddr(a.player, 14) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">Arcade Games</h2>
        <span class="text-[11px] text-slate-400">{{ games.length }} listed</span>
      </div>
      <div v-if="games.length === 0" class="text-xs text-slate-400">No games registered yet.</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RcArcadeGameCard
          v-for="game in games"
          :key="game.game_id"
          :game="game"
        />
      </div>
    </div>
  </div>
</template>
