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
const showSpaceInvadersNotice = ref(true);
const spaceInvadersNoticeKey = "space-invaders-beta-dismissed";

// Hide placeholder/test entries
const visibleGames = computed(() => games.value.filter((g) => (g.game_id || "").toLowerCase() !== "test"));

const blockedGameIds = ["test", "test-game", "testgame"];
const blockedPlayersFromTestGames = computed(() => {
  const set = new Set<string>();
  sessions.value.forEach((s: any) => {
    const gid = (s?.game_id || "").toString().toLowerCase();
    if (blockedGameIds.includes(gid)) {
      const player = (s?.player || "").toString().toLowerCase();
      if (player) set.add(player);
    }
  });
  return set;
});

// Filter leaderboard to drop test game noise
const visibleLeaderboard = computed(() =>
  leaderboard.value.filter((entry: any) => {
    const player = (entry?.player || "").toString().toLowerCase();
    const title = (entry?.title || "").toString().toLowerCase();
    const gameId = (entry?.game_id || "").toString().toLowerCase();
    if (blockedPlayersFromTestGames.value.has(player)) return false;
    return player !== "test" && !title.includes("test") && gameId !== "test";
  })
);

const topPlayer = computed(() => visibleLeaderboard.value[0] || null);
const totalPlayers = computed(() => visibleLeaderboard.value.length);
const totalGames = computed(() => visibleGames.value.length);
const topScore = computed(() => Math.max(0, ...visibleLeaderboard.value.map((e: any) => Number(e.total_score || 0))));
const totalArcadeTokens = computed(() => visibleLeaderboard.value.reduce((sum, e: any) => sum + Number(e.arcade_tokens || 0), 0));
const podium = computed(() => visibleLeaderboard.value.slice(0, 3));
const avgScore = computed(() => {
  if (!visibleLeaderboard.value.length) return 0;
  const total = visibleLeaderboard.value.reduce((sum: number, e: any) => sum + Number(e.total_score || 0), 0);
  return Math.round(total / visibleLeaderboard.value.length);
});
const totalSessions = computed(() => sessions.value.length);
const activeSessions = computed(() => sessions.value.filter((s: any) => (s.status || "").toLowerCase() === "active").length);
const totalAchievements = computed(() => achievements.value.length);
const topTokenEarners = computed(() =>
  [...visibleLeaderboard.value]
    .filter((e: any) => Number.isFinite(Number(e.arcade_tokens)))
    .sort((a, b) => Number(b.arcade_tokens || 0) - Number(a.arcade_tokens || 0))
    .slice(0, 5)
);

const recentSessions = computed(() => sessions.value.slice(0, 6));
const recentAchievements = computed(() => achievements.value.slice(0, 6));

const sessionsToday = computed(() => sessions.value.filter((s: any) => dayjs(s.started_at).isAfter(dayjs().startOf("day"))).length);
const achievementsToday = computed(() => achievements.value.filter((a: any) => dayjs(a.unlocked_at).isAfter(dayjs().startOf("day"))).length);
const completionRate = computed(() => {
  if (!sessions.value.length) return 0;
  const completed = sessions.value.filter((s: any) => (s.status || "").toLowerCase() === "completed").length;
  return Math.round((completed / sessions.value.length) * 100);
});
const mostPlayedGame = computed(() => {
  if (!sessions.value.length) return null;
  const counts = sessions.value.reduce((acc: Record<string, number>, s: any) => {
    const key = s.game_id || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const [id, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { gameId: id, count } as { gameId: string; count: number };
});

const refreshAll = async () => {
  refreshing.value = true;
  try {
    await Promise.all([fetchGames(), fetchLeaderboard(20), fetchRecentSessions(10), fetchLatestAchievements(10)]);
  } finally {
    refreshing.value = false;
  }
};

onMounted(async () => {
  try {
    const stored = localStorage.getItem(spaceInvadersNoticeKey);
    showSpaceInvadersNotice.value = stored !== "true";
  } catch {}
  await refreshAll();
});

const dismissSpaceInvadersNotice = () => {
  showSpaceInvadersNotice.value = false;
  try {
    localStorage.setItem(spaceInvadersNoticeKey, "true");
  } catch {}
};

const shortAddr = (addr?: string, size = 12) => {
  if (!addr) return "—";
  return `${addr.slice(0, size)}…${addr.slice(-6)}`;
};
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="showSpaceInvadersNotice"
      class="card border border-emerald-400/50 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 shadow-lg shadow-emerald-500/20"
    >
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="text-2xl sm:text-3xl">👾🛸</div>
          <div>
            <div class="text-sm font-semibold text-emerald-200">Space Invaders Beta is LIVE!</div>
            <p class="text-xs sm:text-sm text-slate-200 mt-1">Drop coins, blast aliens, and climb the leaderboard. Jump in now and help us battle the invasion!</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <a class="btn btn-primary text-xs" href="/arcade/arcade/" target="_blank" rel="noopener">Play Space Invaders</a>
          <button class="btn text-xs" @click="dismissSpaceInvadersNotice">Dismiss</button>
        </div>
      </div>
    </div>

    <div class="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="text-sm uppercase tracking-[0.2em] text-indigo-200">Arcade Dashboard</div>
        <h1 class="text-2xl font-bold text-white mt-1">Play, Compete, Win</h1>
        <p class="text-sm text-slate-300 mt-1">Live leaderboard, sessions, achievements, and trophies.</p>
      </div>
      <div class="flex gap-2 flex-wrap justify-end">
        <button class="btn text-xs" @click="router.push({ name: 'home' })">← Back to Home</button>
        <a class="btn text-xs" href="/arcade/arcade/" target="_blank" rel="noopener">🎮 Play Space Invaders</a>
        <button class="btn btn-primary text-xs" :disabled="refreshing || loading" @click="refreshAll">
          {{ refreshing ? 'Refreshing...' : 'Refresh Data' }}
        </button>
      </div>
    </div>

    <div
      v-if="topPlayer"
      class="card border border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-pink-500/10 to-indigo-500/10 shadow-lg shadow-amber-500/30"
    >
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-3">
          <div class="text-3xl">🏆</div>
          <div>
            <div class="text-xs uppercase tracking-[0.2em] text-amber-200">Hall of Fame</div>
            <div class="text-lg font-semibold text-white">Top Player: {{ shortAddr(topPlayer.player, 14) }}</div>
            <div class="text-sm text-slate-200">
              {{ Number(topPlayer.total_score || 0).toLocaleString() }} pts · {{ topPlayer.games_played ?? '—' }} games · Tokens {{ topPlayer.arcade_tokens ?? '—' }}
            </div>
            <div v-if="topPlayer.title" class="text-xs text-amber-200/90 mt-1">Title: {{ topPlayer.title }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-100 text-xs border border-emerald-400/40">🎉 Celebration bonus: Keep the streak alive!</div>
          <div class="px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-100 text-xs border border-indigo-400/40">📣 Share your score and claim bragging rights.</div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="card border-indigo-500/40 bg-indigo-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Top Score</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">🥇 <span>{{ topScore.toLocaleString() }}</span></div>
        <div class="text-xs text-slate-400">Highest total score across leaderboard</div>
      </div>
      <div class="card border-emerald-500/40 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Players Ranked</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">🧑‍🚀 <span>{{ totalPlayers }}</span></div>
        <div class="text-xs text-slate-400">Players with arcade activity</div>
      </div>
      <div class="card border-cyan-500/40 bg-cyan-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Average Score</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">📈 <span>{{ avgScore.toLocaleString() }}</span></div>
        <div class="text-xs text-slate-400">Across all ranked players</div>
      </div>
      <div class="card border-amber-500/40 bg-amber-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Arcade Tokens</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">🪙 <span>{{ totalArcadeTokens.toLocaleString() }}</span></div>
        <div class="text-xs text-slate-400">Sum across leaderboard</div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="card border-fuchsia-500/40 bg-fuchsia-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Sessions Today</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">🔥 <span>{{ sessionsToday }}</span></div>
        <div class="text-xs text-slate-400">New runs started in the last 24h</div>
      </div>
      <div class="card border-sky-500/40 bg-sky-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Achievements Today</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">🏅 <span>{{ achievementsToday }}</span></div>
        <div class="text-xs text-slate-400">Fresh unlocks in the last 24h</div>
      </div>
      <div class="card border-lime-500/40 bg-lime-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Completion Rate</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">✅ <span>{{ completionRate }}%</span></div>
        <div class="text-xs text-slate-400">Completed vs all recorded sessions</div>
      </div>
      <div class="card border-purple-500/40 bg-purple-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Most Played</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">🎲 <span>{{ mostPlayedGame?.gameId ?? '—' }}</span></div>
        <div class="text-xs text-slate-400">Plays: {{ mostPlayedGame?.count ?? '—' }}</div>
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
                <td class="font-mono">
                  <span v-if="entry.rank === 1">🥇</span>
                  <span v-else-if="entry.rank === 2">🥈</span>
                  <span v-else-if="entry.rank === 3">🥉</span>
                  <span v-else>{{ entry.rank }}</span>
                </td>
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
          <h2 class="text-sm font-semibold text-slate-100">Podium</h2>
          <span class="text-[11px] text-slate-400">Top 3</span>
        </div>
        <div v-if="!podium.length" class="text-xs text-slate-400">No podium yet.</div>
        <div v-else class="space-y-2">
          <div v-for="(p, idx) in podium" :key="p.player" class="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-xl">{{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉' }}</span>
              <div>
                <div class="text-sm font-semibold text-white">{{ shortAddr(p.player, 14) }}</div>
                <div class="text-[11px] text-slate-400">{{ Number(p.total_score || 0).toLocaleString() }} pts</div>
              </div>
            </div>
            <div class="text-right text-[11px] text-emerald-300">Tokens: {{ p.arcade_tokens ?? '—' }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
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

      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Top Token Earners</h2>
          <span class="text-[11px] text-slate-400">Top 5 by arcade tokens</span>
        </div>
        <div v-if="topTokenEarners.length === 0" class="text-xs text-slate-400">No token earners yet.</div>
        <div v-else class="space-y-2">
          <div
            v-for="entry in topTokenEarners"
            :key="entry.player"
            class="p-3 rounded-lg bg-slate-900/60 border border-emerald-400/30 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <div class="text-lg">🪙</div>
              <div>
                <div class="text-sm font-semibold text-white">{{ shortAddr(entry.player, 14) }}</div>
                <div class="text-[11px] text-slate-400">{{ Number(entry.total_score || 0).toLocaleString() }} pts</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-emerald-300 font-semibold">{{ entry.arcade_tokens }}</div>
              <div class="text-[11px] text-slate-500">tokens</div>
            </div>
          </div>
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
          <div v-for="s in recentSessions" :key="s.session_id" class="p-3 rounded-lg bg-slate-900/60 border border-indigo-500/30">
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
              <span class="font-semibold text-slate-100">🏆 {{ a.name }}</span>
              <span>{{ dayjs(a.unlocked_at).format('YYYY-MM-DD HH:mm') }}</span>
            </div>
            <div class="text-xs text-slate-300 mb-1">{{ a.description }}</div>
            <div class="text-[11px] text-slate-400 font-mono">{{ shortAddr(a.player, 14) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Trophies & Badges</h2>
          <span class="text-[11px] text-slate-400">Celebrating recent unlocks</span>
        </div>
        <div v-if="recentAchievements.length === 0" class="text-xs text-slate-400">No trophies yet. Keep playing!</div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="a in recentAchievements.slice(0, 4)"
            :key="a.achievement_id"
            class="p-3 rounded-lg border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 via-indigo-500/10 to-slate-900/60"
          >
            <div class="flex items-center gap-2 text-sm text-white">
              <span>🎖️</span>
              <div class="font-semibold">{{ a.name }}</div>
            </div>
            <div class="text-[11px] text-slate-300 mt-1 line-clamp-2">{{ a.description }}</div>
            <div class="text-[11px] text-amber-200 mt-1">Unlocked by {{ shortAddr(a.player, 12) }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Momentum</h2>
          <span class="text-[11px] text-slate-400">Keep the hype going</span>
        </div>
        <div class="space-y-2 text-xs text-slate-200">
          <div class="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-400/30">
            <span>🚀 Active sessions</span>
            <span class="font-semibold text-emerald-200">{{ activeSessions }} / {{ totalSessions }}</span>
          </div>
          <div class="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-400/30">
            <span>🧠 Games registered</span>
            <span class="font-semibold text-amber-200">{{ totalGames }}</span>
          </div>
          <div class="flex items-center justify-between p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30">
            <span>🌟 Achievements total</span>
            <span class="font-semibold text-cyan-200">{{ totalAchievements }}</span>
          </div>
          <div class="flex items-center justify-between p-2 rounded-lg bg-pink-500/10 border border-pink-400/30">
            <span>🎯 Leaderboard entries</span>
            <span class="font-semibold text-pink-200">{{ totalPlayers }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">Arcade Games</h2>
        <span class="text-[11px] text-slate-400">{{ visibleGames.length }} listed</span>
      </div>
      <div v-if="visibleGames.length === 0" class="text-xs text-slate-400">No games registered yet.</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RcArcadeGameCard v-for="game in visibleGames" :key="game.game_id" :game="game" />
      </div>
    </div>
  </div>
</template>
