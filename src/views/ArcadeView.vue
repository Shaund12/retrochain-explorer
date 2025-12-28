<script setup lang="ts">
import { onMounted, computed, ref } from "vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useArcade } from "@/composables/useArcade";
import RcArcadeGameCard from "@/components/RcArcadeGameCard.vue";
import { useRouter } from "vue-router";
import ApexChart from "vue3-apexcharts";
import { useApi } from "@/composables/useApi";

dayjs.extend(relativeTime);

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
const api = useApi();

const selectedGame = ref<any | null>(null);
const gameModalOpen = ref(false);

const openGameModal = (game: any) => {
  selectedGame.value = game;
  gameModalOpen.value = true;
};

const closeGameModal = () => {
  gameModalOpen.value = false;
  selectedGame.value = null;
};

const resolveGameLaunchUrl = (game: any) => {
  const gid = (game?.game_id || "").toString().toLowerCase();
  // Known built-in hosted games
  if (gid === "retrovaders") return "/arcade/arcade/";
  if (gid === "retronoid") return "/retronoid/retronoid/";

  // API-provided launch URL (if present)
  const direct = (game?.launch_url || game?.play_url || game?.url) as string | undefined;
  if (direct && typeof direct === "string") return direct;

  return null;
};

const playSelectedGame = () => {
  const url = resolveGameLaunchUrl(selectedGame.value);
  if (!url) return;
  // Use router only for internal paths
  if (url.startsWith("/")) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener");
};

const selectedGameLaunchUrl = computed(() => resolveGameLaunchUrl(selectedGame.value));
const selectedGameIcon = computed(() => {
  const genre = (selectedGame.value?.genre || "").toString().toLowerCase();
  if (genre === "shooter") return "🎯";
  if (genre === "puzzle") return "🧩";
  if (genre === "racing") return "🏎️";
  if (genre === "platformer") return "🦘";
  if (genre === "fighting") return "🥊";
  if (genre === "rpg") return "🧙‍♂️";
  return "🎮";
});

const gamesList = computed(() => (Array.isArray(games.value) ? games.value : []));
const leaderboardList = computed(() => (Array.isArray(leaderboard.value) ? leaderboard.value : []));
const sessionsList = computed(() => (Array.isArray(sessions.value) ? sessions.value : []));
const achievementsList = computed(() => (Array.isArray(achievements.value) ? achievements.value : []));

const refreshing = ref(false);
const showSpaceInvadersNotice = ref(true);
const spaceInvadersNoticeKey = "space-invaders-beta-dismissed";

// Hide placeholder/test entries and legacy/renamed games.
// Note: "space-invaders" is deprecated and has been renamed to RetroVaders.
const visibleGames = computed(() =>
  gamesList.value.filter((g) => {
    const gid = (g.game_id || "").toString().toLowerCase();
    if (gid === "test") return false;
    if (gid === "space-invaders" || gid === "spaceinvaders" || gid === "space_invaders") return false;
    return true;
  })
);

const blockedGameIds = ["test", "test-game", "testgame"];
const blockedPlayersFromTestGames = computed(() => {
  const set = new Set<string>();
  sessionsList.value.forEach((s: any) => {
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
  leaderboardList.value.filter((entry: any) => {
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
const normalizeStatus = (status: any) => (typeof status === "string" ? status.toLowerCase() : String(status || "").toLowerCase());
const formatStatus = (status: any) => {
  const val = normalizeStatus(status);
  if (val === "active") return "🟢 Active";
  if (val === "completed") return "✅ Completed";
  if (val === "failed") return "❌ Failed";
  return val ? `ℹ️ ${val}` : "—";
};
const totalSessions = computed(() => sessionsList.value.length);
const activeSessions = computed(() => sessionsList.value.filter((s: any) => normalizeStatus(s.status) === "active").length);
const totalAchievements = computed(() => achievementsList.value.length);
const totalUniquePlayers = computed(() => {
  const set = new Set<string>();
  sessionsList.value.forEach((s: any) => {
    const p = (s?.player || "").toString().toLowerCase();
    if (p) set.add(p);
  });
  achievementsList.value.forEach((a: any) => {
    const p = (a?.player || "").toString().toLowerCase();
    if (p) set.add(p);
  });
  return set.size;
});
const topTokenEarners = computed(() =>
  [...visibleLeaderboard.value]
    .filter((e: any) => Number.isFinite(Number(e.arcade_tokens)))
    .sort((a, b) => Number(b.arcade_tokens || 0) - Number(a.arcade_tokens || 0))
    .slice(0, 5)
);

const recentSessions = computed(() => sessionsList.value.slice(0, 6));
const recentAchievements = computed(() => achievementsList.value.slice(0, 6));

const topAchievers = computed(() => {
  const counts: Record<string, number> = {};
  achievementsList.value.forEach((a: any) => {
    const p = (a?.player || "").toString();
    if (!p) return;
    counts[p] = (counts[p] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([player, count]) => ({ player, count }));
});

const sessionsToday = computed(() => sessionsList.value.filter((s: any) => dayjs(s.started_at).isAfter(dayjs().startOf("day"))).length);
const achievementsToday = computed(() => achievementsList.value.filter((a: any) => dayjs(a.unlocked_at).isAfter(dayjs().startOf("day"))).length);

const completionRate = computed(() => {
  if (!sessionsList.value.length) return 0;
  const completed = sessionsList.value.filter((s: any) => normalizeStatus(s.status) === "completed").length;
  return Math.round((completed / sessionsList.value.length) * 100);
});

const mostPlayedGame = computed(() => {
  if (!sessionsList.value.length) return null;
  const counts = sessionsList.value.reduce((acc: Record<string, number>, s: any) => {
    const key = s.game_id || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const [id, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { gameId: id, count } as { gameId: string; count: number };
});

const chartDays = computed(() => {
  const days = [] as dayjs.Dayjs[];
  for (let i = 6; i >= 0; i -= 1) {
    days.push(dayjs().subtract(i, "day"));
  }
  return days;
});

const chartCategories = computed(() => chartDays.value.map((d) => d.format("MMM D")));

const sessions7d = computed(() =>
  chartDays.value.map((d) => sessionsList.value.filter((s: any) => dayjs(s.started_at).isSame(d, "day")).length)
);

const achievements7d = computed(() =>
  chartDays.value.map((d) => achievementsList.value.filter((a: any) => dayjs(a.unlocked_at).isSame(d, "day")).length)
);

const apexSeries = computed(() => [
  { name: "Sessions", data: sessions7d.value },
  { name: "Achievements", data: achievements7d.value }
]);

const apexOptions = computed(() => ({
  chart: { toolbar: { show: false }, background: "transparent", foreColor: "#cbd5e1" },
  theme: { mode: "dark" },
  dataLabels: { enabled: false },
  stroke: { curve: "smooth", width: 3 },
  fill: {
    type: "gradient",
    gradient: { shadeIntensity: 0.8, opacityFrom: 0.3, opacityTo: 0.05, stops: [0, 50, 100] }
  },
  grid: { borderColor: "rgba(148,163,184,0.25)", strokeDashArray: 3 },
  xaxis: {
    categories: chartCategories.value,
    axisBorder: { color: "rgba(148,163,184,0.3)" },
    axisTicks: { color: "rgba(148,163,184,0.3)" },
    labels: { style: { colors: chartCategories.value.map(() => "#94a3b8") } }
  },
  yaxis: { labels: { style: { colors: ["#94a3b8"] } }, min: 0, forceNiceScale: true },
  legend: { labels: { colors: "#e2e8f0" } },
  colors: ["#34d399", "#a78bfa"]
}));

const arcadeBurns = ref<{ amount: number; gameId?: string; player?: string; hash?: string; timestamp?: string }[]>([]);
const arcadeBurnTotal = ref<number | null>(null);
const arcadeBurnLoading = ref(false);

const parseArcadeBurn = (tx?: any) => {
  if (!tx) return null;
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
  return {
    amount: tokensBurned,
    gameId: gameId || undefined,
    player: player || undefined,
    hash: tx?.txhash || tx?.hash,
    timestamp: tx?.timestamp
  } as const;
};

const loadArcadeBurns = async () => {
  arcadeBurnLoading.value = true;
  arcadeBurnTotal.value = null;
  arcadeBurns.value = [];
  try {
    const { data } = await api.get("/cosmos/tx/v1beta1/txs", {
      params: {
        events: "message.action='/retrochain.arcade.v1.MsgInsertCoin'",
        order_by: "ORDER_BY_DESC",
        "pagination.limit": "100"
      }
    });
    const txs = Array.isArray(data?.tx_responses) ? data.tx_responses : [];
    const burns = txs
      .map(parseArcadeBurn)
      .filter(
        (b: unknown): b is {
          amount: number;
          gameId?: string;
          player?: string;
          hash?: string;
          timestamp?: string;
        } => Boolean(b) && Number.isFinite((b as any).amount)
      );

    arcadeBurns.value = burns;
    if (burns.length) {
      arcadeBurnTotal.value = burns.reduce((sum: number, b: any) => sum + b.amount, 0);
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

const arcadeBurnCount = computed(() => arcadeBurns.value.length);
const latestBurns = computed(() => arcadeBurns.value.slice(0, 5));

const formatRetroAmount = (amt?: number | null) => {
  if (!amt || !Number.isFinite(amt)) return "—";
  const retro = amt / 1_000_000;
  return `${retro.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} RETRO`;
};

const refreshAll = async () => {
  refreshing.value = true;
  try {
    await Promise.all([fetchGames(), fetchLeaderboard(20), fetchRecentSessions(10), fetchLatestAchievements(10), loadArcadeBurns()]);
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

const achievementIcon = (a: any) => {
  const text = `${a?.name || ""} ${a?.description || ""}`.toLowerCase();
  if (text.includes("speed") || text.includes("fast") || text.includes("time")) return "⚡";
  if (text.includes("boss") || text.includes("elite") || text.includes("master")) return "🐲";
  if (text.includes("coin") || text.includes("token") || text.includes("treasure")) return "🪙";
  if (text.includes("combo") || text.includes("streak") || text.includes("chain")) return "🎯";
  if (text.includes("first") || text.includes("new") || text.includes("beginner")) return "🌱";
  if (text.includes("win") || text.includes("victory") || text.includes("champ")) return "🏆";
  return "🎖️";
};
</script>

<template>
  <div class="space-y-4">
    <div v-if="showSpaceInvadersNotice" class="space-y-3">
      <div class="card border border-emerald-400/70 bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-indigo-600/15 shadow-lg shadow-emerald-500/20">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="text-3xl sm:text-4xl">🚨👾🛸</div>
            <div>
            <div class="text-sm font-semibold text-emerald-200 uppercase tracking-[0.18em]">RetroVaders Alert</div>
              <p class="text-xs sm:text-sm text-slate-200 mt-1">
                Aliens on the radar! Drop coins, blast waves, and race up the leaderboard. Suit up and defend RetroChain HQ.
              </p>
              <p class="text-[11px] text-emerald-200/80 mt-1">Live event · Beta mode · Rewards flowing</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <a class="btn btn-primary text-xs" href="/arcade/arcade/" target="_blank" rel="noopener">Play RetroVaders</a>
            <button class="btn text-xs" @click="dismissSpaceInvadersNotice">Dismiss</button>
          </div>
        </div>
      </div>

      <div class="card border border-amber-400/70 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 shadow-lg shadow-amber-400/20">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-3">
            <div class="text-3xl sm:text-4xl">🧱✨🎯</div>
            <div>
              <div class="text-sm font-semibold text-amber-200 uppercase tracking-[0.18em]">RetroNoid Rally</div>
              <p class="text-xs sm:text-sm text-slate-200 mt-1">
                Brick-busting chaos is live! Curve the paddle, stack combos, and chase perfect clears in the RetroNoid beta.
              </p>
              <p class="text-[11px] text-amber-200/80 mt-1">Precision mode · Combo fever · Beta rewards</p>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            <a class="btn text-xs" href="/retronoid/retronoid/" target="_blank" rel="noopener">Play RetroNoid</a>
            <button class="btn text-xs" @click="dismissSpaceInvadersNotice">Dismiss</button>
          </div>
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
        <a class="btn text-xs" href="/arcade/arcade/" target="_blank" rel="noopener">🎮 Play RetroVaders</a>
        <button class="btn btn-primary text-xs" :disabled="refreshing || loading" @click="refreshAll">
          {{ refreshing ? 'Refreshing...' : 'Refresh Data' }}
        </button>
      </div>
    </div>

    <div class="card border border-rose-500/60 bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-amber-500/10 shadow-lg shadow-rose-500/20">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-start gap-3">
          <div class="text-4xl sm:text-5xl">🔥</div>
          <div>
            <div class="text-sm font-semibold text-rose-100 uppercase tracking-[0.18em]">Insert Coin Burn Counter</div>
            <p class="text-xs sm:text-sm text-slate-100 mt-1">
              Live RETRO burned from <code class="text-amber-200">MsgInsertCoin</code> arcade purchases.
            </p>
            <div class="flex items-center gap-3 mt-2 flex-wrap text-[11px] text-rose-100">
              <span class="px-2 py-1 rounded-full bg-rose-500/20 border border-rose-400/40">{{ arcadeBurnDisplay }}</span>
              <span class="px-2 py-1 rounded-full bg-amber-500/15 border border-amber-400/40">{{ arcadeBurnCount }} insertions</span>
              <span class="px-2 py-1 rounded-full bg-orange-500/15 border border-orange-400/40" v-if="arcadeBurns.length">
                Last: {{ formatRetroAmount(latestBurns[0]?.amount) }}
              </span>
              <span v-if="arcadeBurnLoading" class="text-[11px] text-amber-200">Syncing…</span>
            </div>
          </div>
        </div>
        <div class="w-full sm:w-auto flex-1">
          <div class="grid gap-2 sm:grid-cols-2">
            <div v-for="burn in latestBurns" :key="burn.hash || burn.timestamp" class="p-3 rounded-xl bg-slate-900/70 border border-rose-400/30 text-xs text-slate-100 flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-lg">🔥</span>
                <div class="min-w-0">
                  <div class="font-semibold truncate">{{ formatRetroAmount(burn.amount) }}</div>
                  <div class="text-[11px] text-slate-400 truncate">{{ burn.gameId || 'unregistered game' }}</div>
                </div>
              </div>
              <div class="text-right text-[11px] text-amber-100">
                <div>{{ burn.timestamp ? dayjs(burn.timestamp).fromNow() : 'just now' }}</div>
                <div class="text-slate-500" v-if="burn.player">{{ shortAddr(burn.player, 10) }}</div>
              </div>
            </div>
            <div v-if="!latestBurns.length" class="text-[11px] text-slate-400">No Insert Coin burns yet.</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="topPlayer"
      class="card border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-pink-500/10 to-indigo-500/10 shadow-lg shadow-amber-500/30"
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
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">
          🥇 <span>{{ topScore.toLocaleString() }}</span>
        </div>
        <div class="text-xs text-slate-400">Highest total score across leaderboard</div>
      </div>
      <div class="card border-emerald-500/40 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Players Ranked</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">
          🧑‍🚀 <span>{{ totalPlayers }}</span>
        </div>
        <div class="text-xs text-slate-400">Players with arcade activity</div>
      </div>
      <div class="card border-cyan-500/40 bg-cyan-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Average Score</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">
          📈 <span>{{ avgScore.toLocaleString() }}</span>
        </div>
        <div class="text-xs text-slate-400">Across all ranked players</div>
      </div>
      <div class="card border-amber-500/40 bg-amber-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Arcade Tokens</div>
        <div class="text-3xl font-extrabold text-white flex items-center gap-2">
          🪙 <span>{{ totalArcadeTokens.toLocaleString() }}</span>
        </div>
        <div class="text-xs text-slate-400">Sum across leaderboard</div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-slate-100">Arcade Pulse</h2>
        <span class="text-[11px] text-slate-400">Sessions vs Achievements (7d)</span>
      </div>
      <div v-if="sessionsList.length === 0 && achievementsList.length === 0" class="text-xs text-slate-400">No activity yet.</div>
      <div v-else>
        <ApexChart type="area" height="240" :options="apexOptions" :series="apexSeries" />
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
        <div v-if="leaderboardList.length === 0" class="text-xs text-slate-400">No leaderboard entries yet.</div>
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
              <tr v-for="entry in leaderboardList" :key="entry.player" class="text-[11px]">
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
        <!-- Top Player Spotlight -->
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
        <!-- Recent Sessions -->
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
            <div class="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{{ formatStatus(s.status) }}</span>
              <span class="text-slate-500">Level {{ s.level_reached }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <!-- Latest Achievements -->
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
              <span class="font-semibold text-slate-100">{{ achievementIcon(a) }} {{ a.name }}</span>
              <span>{{ dayjs(a.unlocked_at).fromNow() }}</span>
            </div>
            <div class="text-xs text-slate-300 mb-1">{{ a.description }}</div>
            <div class="text-[11px] text-slate-400 font-mono">{{ shortAddr(a.player, 14) }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <!-- Achievement Leaders -->
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Achievement Leaders</h2>
          <span class="text-[11px] text-slate-400">Top unlockers</span>
        </div>
        <div class="flex flex-wrap gap-2 text-[11px] mb-2">
          <span class="px-2 py-1 rounded bg-emerald-500/10 text-emerald-200 border border-emerald-400/30">Total {{ totalAchievements }}</span>
          <span class="px-2 py-1 rounded bg-amber-500/10 text-amber-200 border border-amber-400/30">Today {{ achievementsToday }}</span>
          <span class="px-2 py-1 rounded bg-cyan-500/10 text-cyan-200 border border-cyan-400/30">Players {{ totalUniquePlayers }}</span>
        </div>
        <div v-if="topAchievers.length === 0" class="text-xs text-slate-400">No achievements yet.</div>
        <div v-else class="space-y-2">
          <div
            v-for="(p, idx) in topAchievers"
            :key="p.player"
            class="p-3 rounded-lg bg-slate-900/60 border border-emerald-400/30 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <div class="text-lg">{{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉' }}</div>
              <div>
                <div class="text-sm font-semibold text-white">{{ shortAddr(p.player, 12) }}</div>
                <div class="text-[11px] text-slate-400">{{ p.count }} unlocks</div>
              </div>
            </div>
            <div class="text-[11px] text-emerald-300">{{ ((p.count / Math.max(1, totalAchievements)) * 100).toFixed(0) }}%</div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <div class="card">
        <!-- Trophies & Badges -->
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
        <!-- Momentum -->
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
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-slate-100">Arcade Games</h2>
        <span class="text-[11px] text-slate-400">{{ visibleGames.length }} listed</span>
      </div>
      <div v-if="visibleGames.length === 0" class="text-xs text-slate-400">No games registered yet.</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RcArcadeGameCard v-for="game in visibleGames" :key="game.game_id" :game="game" @click="openGameModal" />
      </div>
    </div>

    <!-- Game Details Modal -->
    <div
      v-if="gameModalOpen && selectedGame"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      @click.self="closeGameModal"
    >
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div class="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[rgba(10,14,39,0.98)] shadow-2xl shadow-black/50">
        <div class="p-5 border-b border-white/10 flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="text-4xl">{{ selectedGameIcon }}</div>
            <div>
              <div class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ selectedGame.game_id }}</div>
              <h3 class="text-xl font-bold text-white">{{ selectedGame.name }}</h3>
              <div class="mt-1 flex flex-wrap gap-2 text-[11px]">
                <span class="badge border-white/10 text-slate-200">{{ selectedGame.genre || 'arcade' }}</span>
                <span v-if="selectedGame.difficulty" class="badge border-white/10 text-slate-200">{{ selectedGame.difficulty }}</span>
                <span v-if="selectedGame.active" class="badge border-emerald-500/40 text-emerald-200">Active</span>
                <span v-else class="badge border-slate-500/40 text-slate-300">Inactive</span>
              </div>
            </div>
          </div>
          <button class="btn btn-xs" @click="closeGameModal">Close</button>
        </div>

        <div class="p-5 space-y-4">
          <div class="text-sm text-slate-200" v-if="selectedGame.description">
            {{ selectedGame.description }}
          </div>
          <div v-else class="text-sm text-slate-400">No description provided.</div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="p-3 rounded-xl border border-white/10 bg-white/5">
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Max Score</div>
              <div class="text-sm font-semibold text-white">{{ selectedGame.max_score?.toLocaleString?.() ?? '—' }}</div>
            </div>
            <div class="p-3 rounded-xl border border-white/10 bg-white/5">
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Status</div>
              <div class="text-sm font-semibold text-white">{{ selectedGame.active ? 'Active' : 'Inactive' }}</div>
            </div>
          </div>

          <div v-if="selectedGameLaunchUrl" class="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
            <div class="text-[11px] uppercase tracking-wider text-emerald-200">Play</div>
            <div class="text-[11px] text-slate-200 font-mono break-all">{{ selectedGameLaunchUrl }}</div>
            <div class="mt-3 flex gap-2">
              <button class="btn btn-primary btn-sm" @click="playSelectedGame">Play now</button>
              <a v-if="selectedGameLaunchUrl.startsWith('/')" class="btn btn-sm" :href="selectedGameLaunchUrl" target="_blank" rel="noopener">Open in new tab</a>
              <a v-else class="btn btn-sm" :href="selectedGameLaunchUrl" target="_blank" rel="noopener">Open link</a>
            </div>
          </div>
          <div v-else class="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <div class="text-[11px] uppercase tracking-wider text-amber-200">Play</div>
            <div class="text-sm text-slate-200">No launch URL configured for this game yet.</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
