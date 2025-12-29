<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useArcade } from "@/composables/useArcade";

dayjs.extend(relativeTime);

const router = useRouter();
const { address } = useKeplr();

const {
  sessions,
  achievements,
  loading,
  error,
  fetchRecentSessions,
  fetchLatestAchievements
} = useArcade();

const battlePeriod = ref<"daily" | "weekly" | "monthly">("daily");
const battleGame = ref<"all" | "retrovaders" | "retronoid">("all");

const normalizeGameId = (gid: any) => String(gid || "").toLowerCase().trim();
const normalizeAddr = (a: any) => String(a || "").toLowerCase().trim();

const startOfPeriod = (p: "daily" | "weekly" | "monthly") => {
  if (p === "daily") return dayjs().startOf("day");
  if (p === "weekly") return dayjs().startOf("week");
  return dayjs().startOf("month");
};

const sessionsList = computed(() => (Array.isArray(sessions.value) ? sessions.value : []));
const achievementsList = computed(() => (Array.isArray(achievements.value) ? achievements.value : []));

const myWalletAddr = computed(() => normalizeAddr(address.value));

const sessionsInWindow = computed(() => {
  const start = startOfPeriod(battlePeriod.value);
  return sessionsList.value.filter((s: any) => {
    const t = dayjs(s?.started_at);
    if (!t.isValid()) return false;
    if (t.isBefore(start)) return false;
    if (battleGame.value === "all") return true;
    const gid = normalizeGameId(s?.game_id || s?.gameId);
    return gid === battleGame.value;
  });
});

const achievementsInWindow = computed(() => {
  const start = startOfPeriod(battlePeriod.value);
  // achievements don't have game id reliably; keep as period-only for now
  return achievementsList.value.filter((a: any) => {
    const t = dayjs(a?.unlocked_at);
    return t.isValid() && !t.isBefore(start);
  });
});

const mySessions = computed(() => {
  if (!myWalletAddr.value) return [] as any[];
  return sessionsInWindow.value.filter((s: any) => normalizeAddr(s?.player || s?.creator) === myWalletAddr.value);
});

const myAchievements = computed(() => {
  if (!myWalletAddr.value) return [] as any[];
  return achievementsInWindow.value.filter((a: any) => normalizeAddr(a?.player) === myWalletAddr.value);
});

const myRuns = computed(() => mySessions.value.length);
const myBestScore = computed(() => {
  const scores = mySessions.value.map((s: any) => Number(s?.score ?? 0)).filter((n: number) => Number.isFinite(n));
  return scores.length ? Math.max(...scores) : 0;
});

const questTargets = {
  q_runs_3: 3,
  q_score_5k: 5000
};

const questRows = computed(() => {
  const hasAddr = Boolean(myWalletAddr.value);
  const rows = [
    {
      id: "q_runs_3",
      title: "Warm Up",
      detail: "Play 3 runs in this battle window.",
      metricLabel: "runs",
      current: myRuns.value,
      target: questTargets.q_runs_3
    },
    {
      id: "q_score_5k",
      title: "Score Hunter",
      detail: "Hit 5,000+ best score in this battle window.",
      metricLabel: "best score",
      current: myBestScore.value,
      target: questTargets.q_score_5k
    }
  ];

  return rows.map((q) => ({
    ...q,
    ready: hasAddr && q.current >= q.target
  }));
});

const recentMyAchievements = computed(() => myAchievements.value.slice(0, 10));

const refresh = async () => {
  await Promise.all([fetchRecentSessions(50), fetchLatestAchievements(50)]);
};

onMounted(refresh);
</script>

<template>
  <div class="space-y-4">
    <div class="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="text-sm uppercase tracking-[0.2em] text-indigo-200">Battle Points</div>
        <h1 class="text-2xl font-bold text-white mt-1">Progress Tracker</h1>
        <p class="text-sm text-slate-300 mt-1">Track runs, best scores, and achievements for the current battle window.</p>
      </div>
      <div class="flex gap-2 flex-wrap justify-end">
        <button class="btn text-xs" @click="router.push({ name: 'arcade' })">? Back to Arcade</button>
        <button class="btn text-xs" @click="router.push({ name: 'battlepoints' })">Open Store</button>
        <button class="btn btn-primary text-xs" :disabled="loading" @click="refresh">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
      </div>
    </div>

    <div v-if="error" class="card border border-rose-500/30 bg-rose-500/5 text-rose-200 text-sm">{{ error }}</div>

    <div class="card">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-slate-100">Window</h2>
          <div class="text-[11px] text-slate-400">Personal progress (client-side) until the on-chain BattlePoints contract is live.</div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-xs" :class="battlePeriod === 'daily' ? 'btn-primary' : ''" @click="battlePeriod = 'daily'">Daily</button>
          <button class="btn btn-xs" :class="battlePeriod === 'weekly' ? 'btn-primary' : ''" @click="battlePeriod = 'weekly'">Weekly</button>
          <button class="btn btn-xs" :class="battlePeriod === 'monthly' ? 'btn-primary' : ''" @click="battlePeriod = 'monthly'">Monthly</button>
          <span class="text-[11px] text-slate-400 self-center" v-if="battleGame !== 'all'">Game: {{ battleGame }}</span>
        </div>
      </div>

      <div class="mt-2 flex gap-2 flex-wrap">
        <button class="btn btn-xs" :class="battleGame === 'all' ? 'btn-primary' : ''" @click="battleGame = 'all'">All games</button>
        <button class="btn btn-xs" :class="battleGame === 'retrovaders' ? 'btn-primary' : ''" @click="battleGame = 'retrovaders'">RetroVaders</button>
        <button class="btn btn-xs" :class="battleGame === 'retronoid' ? 'btn-primary' : ''" @click="battleGame = 'retronoid'">RetroNoid</button>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <div class="card border border-white/10 bg-slate-900/40">
        <div class="text-[11px] uppercase tracking-wider text-slate-400">My Summary</div>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <div class="p-3 rounded-xl bg-white/5 border border-white/10">
            <div class="text-[10px] text-slate-400">Runs</div>
            <div class="text-lg font-extrabold text-white">{{ myRuns }}</div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-white/10">
            <div class="text-[10px] text-slate-400">Best Score</div>
            <div class="text-lg font-extrabold text-white">{{ myBestScore.toLocaleString() }}</div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 col-span-2">
            <div class="text-[10px] text-slate-400">Achievements (this window)</div>
            <div class="text-lg font-extrabold text-white">{{ myAchievements.length }}</div>
          </div>
        </div>
        <div v-if="!address" class="mt-2 text-[11px] text-slate-400">Connect Keplr for personalized tracking.</div>
      </div>

      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-100">Battle Quests (preview)</h2>
          <span class="text-[11px] text-slate-400">Client-side</span>
        </div>

        <div class="mt-3 space-y-2">
          <div v-for="q in questRows" :key="q.id" class="p-3 rounded-xl bg-white/5 border border-white/10">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-white truncate">{{ q.title }}</div>
                <div class="text-[11px] text-slate-400">{{ q.detail }}</div>
              </div>
              <div class="text-right">
                <div class="text-xs font-semibold" :class="q.ready ? 'text-emerald-200' : 'text-slate-400'">{{ q.ready ? 'Ready' : 'In progress' }}</div>
                <div class="text-[11px] text-slate-500">{{ q.current }} / {{ q.target }}</div>
              </div>
            </div>
            <div class="mt-2 h-2 rounded-full bg-black/30 border border-white/10 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-emerald-400" :style="{ width: `${Math.min(100, Math.round((q.current / Math.max(1, q.target)) * 100))}%` }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-slate-100">My Recent Achievements</h2>
        <span class="text-[11px] text-slate-400">{{ recentMyAchievements.length }} shown</span>
      </div>
      <div v-if="!address" class="text-xs text-slate-400">Connect Keplr to see your achievement feed.</div>
      <div v-else-if="recentMyAchievements.length === 0" class="text-xs text-slate-400">No achievements in this window yet.</div>
      <div v-else class="space-y-2">
        <div v-for="a in recentMyAchievements" :key="a.achievement_id" class="p-3 rounded-lg bg-slate-900/60 border border-amber-500/30">
          <div class="flex items-center justify-between text-[11px] text-amber-200 mb-1">
            <span class="font-semibold text-slate-100">{{ a.name }}</span>
            <span>{{ a.unlocked_at ? dayjs(a.unlocked_at).fromNow() : '' }}</span>
          </div>
          <div class="text-xs text-slate-300">{{ a.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
