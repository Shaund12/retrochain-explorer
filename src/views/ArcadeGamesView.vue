<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useArcade } from "@/composables/useArcade";
import RcArcadeGameCard from "@/components/RcArcadeGameCard.vue";
import { useRouter } from "vue-router";

const router = useRouter();
const { games, fetchGames } = useArcade();

const gameModalOpen = ref(false);
const selectedGame = ref<any | null>(null);

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
  if (gid === "retrovaders") return "/arcade/arcade/";
  if (gid === "retronoid") return "/retronoid/retronoid/";
  if (gid === "retroman") return "/retroman/retroman/";
  if (gid === "retrowar") return "/retrowar/retrowar/";
  if (gid === "avoidtheretro") return "/avoidtheretro/avoidtheretro/";
  const direct = (game?.launch_url || game?.play_url || game?.url) as string | undefined;
  if (direct && typeof direct === "string") return direct;
  return null;
};

const playSelectedGame = () => {
  const url = resolveGameLaunchUrl(selectedGame.value);
  if (!url) return;
  window.open(url, "_blank", "noopener");
};

const enableRetroVaders = import.meta.env.VITE_ARCADE_GAME_RETROVADERS_ENABLED !== "false";
const enableRetroNoid = import.meta.env.VITE_ARCADE_GAME_RETRONOID_ENABLED !== "false";
const enableRetroMan = import.meta.env.VITE_ARCADE_GAME_RETROMAN_ENABLED !== "false";
const enableRetroWar = true;

const normalizeGenre = (g: any) => {
  const raw = (g?.genre || "Arcade").toString();
  const cleaned = raw.replace(/^genre[_-]?/i, "");
  return cleaned || "Arcade";
};

const genreEmoji = (g: any) => {
  const genre = normalizeGenre(g).toLowerCase();
  if (genre === "shooter") return "🎯";
  if (genre === "puzzle") return "🧩";
  if (genre === "racing") return "🏎️";
  if (genre === "platformer") return "🦘";
  if (genre === "fighting") return "🥊";
  if (genre === "rpg") return "🧙‍♂️";
  if (genre === "strategy") return "🧠";
  if (genre === "sports") return "🏀";
  if (genre === "music") return "🎵";
  return "🎮";
};

const selectedGameIcon = computed(() => genreEmoji(selectedGame.value));

const gamesList = computed(() => (Array.isArray(games.value) ? games.value : []));
const visibleGames = computed(() =>
  gamesList.value.filter((g) => {
    const gid = (g.game_id || "").toString().toLowerCase();
    const name = (g.name || "").toString().toLowerCase();
    if (gid === "test") return false;
    if (gid === "space-invaders" || gid === "spaceinvaders" || gid === "space_invaders") return false;
    if (name === "space invaders" || name === "space-invaders" || name === "spaceinvaders") return false;
    if (!enableRetroVaders && gid === "retrovaders") return false;
    if (!enableRetroNoid && gid === "retronoid") return false;
    if (!enableRetroMan && gid === "retroman") return false;
    if (!enableRetroWar && gid === "retrowar") return false;
    return true;
  })
);

const selectedGenre = ref<string>("all");
const genreOptions = computed(() => {
  const set = new Set<string>();
  visibleGames.value.forEach((g) => {
    const genre = normalizeGenre(g);
    if (genre) set.add(genre);
  });
  return ["all", ...Array.from(set).sort()];
});

const filteredGames = computed(() => {
  if (selectedGenre.value === "all") return visibleGames.value;
  const target = selectedGenre.value.toLowerCase();
  return visibleGames.value.filter((g) => normalizeGenre(g).toLowerCase() === target);
});

const stats = computed(() => {
  const total = visibleGames.value.length;
  const active = visibleGames.value.filter((g) => g.active).length;
  const genres = genreOptions.value.filter((g) => g !== "all").length;
  const maxScore = Math.max(0, ...visibleGames.value.map((g) => Number(g.max_score || 0)));
  return { total, active, genres, maxScore };
});

const selectedGameStatus = computed(() => (selectedGame.value?.active ? "🟢 Active" : "⏸️ Inactive"));
const selectedGameDifficulty = computed(() => (selectedGame.value?.difficulty ? selectedGame.value.difficulty.toString() : "Casual"));
const selectedGameCreator = computed(() => (selectedGame.value?.creator || "—"));
const selectedGameMaxScore = computed(() => {
  const n = Number(selectedGame.value?.max_score ?? 0);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString() : "—";
});
const selectedGameLaunchable = computed(() => Boolean(resolveGameLaunchUrl(selectedGame.value)));

onMounted(async () => {
  await fetchGames();
});
</script>

<template>
  <div class="space-y-3">
    <div class="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="text-xs uppercase tracking-[0.18em] text-emerald-200">Arcade Library</div>
        <h1 class="text-2xl font-bold text-white">On-chain Games</h1>
        <p class="text-sm text-slate-300">Playable titles with live leaderboards and burns.</p>
        <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span class="badge border-emerald-400/60 text-emerald-200 bg-emerald-500/10">👾 RetroVaders</span>
          <span class="badge border-cyan-400/60 text-cyan-200 bg-cyan-500/10">🧱 RetroNoid</span>
          <span class="badge border-amber-400/60 text-amber-200 bg-amber-500/10">🕹️ RetroMan</span>
          <span class="badge border-indigo-400/60 text-indigo-200 bg-indigo-500/10">⚔️ RetroWar</span>
          <span class="badge border-rose-400/60 text-rose-200 bg-rose-500/10">🚫 Avoid The Retro</span>
        </div>
      </div>
      <div class="flex gap-2 flex-wrap justify-end">
        <button class="btn text-xs" @click="router.push({ name: 'arcade' })">← Back to Arcade Dash</button>
        <a class="btn text-xs" href="/avoidtheretro/avoidtheretro/" target="_blank" rel="noopener">🚫 Play Avoid The Retro</a>
        <button class="btn btn-primary text-xs" :disabled="!visibleGames.length" @click="selectedGame = visibleGames[0]; gameModalOpen = true">Play Now</button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-4">
      <div class="card border-emerald-400/30 bg-emerald-500/10 shadow-emerald-500/20 shadow-lg">
        <div class="text-[11px] uppercase tracking-wider text-emerald-200">Total Games</div>
        <div class="text-3xl font-bold text-white flex items-center gap-2">🎮 <span>{{ stats.total }}</span></div>
        <div class="text-[11px] text-emerald-100">All listed on-chain arcade titles</div>
      </div>
      <div class="card border-cyan-400/30 bg-cyan-500/10 shadow-cyan-500/20 shadow-lg">
        <div class="text-[11px] uppercase tracking-wider text-cyan-200">Active</div>
        <div class="text-3xl font-bold text-white flex items-center gap-2">🚀 <span>{{ stats.active }}</span></div>
        <div class="text-[11px] text-cyan-100">Currently marked active</div>
      </div>
      <div class="card border-amber-400/30 bg-amber-500/10 shadow-amber-500/20 shadow-lg">
        <div class="text-[11px] uppercase tracking-wider text-amber-200">Genres</div>
        <div class="text-3xl font-bold text-white flex items-center gap-2">🎨 <span>{{ stats.genres }}</span></div>
        <div class="text-[11px] text-amber-100">Playable flavors</div>
      </div>
      <div class="card border-indigo-400/30 bg-indigo-500/10 shadow-indigo-500/20 shadow-lg">
        <div class="text-[11px] uppercase tracking-wider text-indigo-200">Top Max Score</div>
        <div class="text-3xl font-bold text-white flex items-center gap-2">🏆 <span>{{ stats.maxScore.toLocaleString() }}</span></div>
        <div class="text-[11px] text-indigo-100">Highest published max score</div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">Games Catalog</h2>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-400">{{ filteredGames.length }} shown</span>
          <select
            v-model="selectedGenre"
            class="bg-slate-900/80 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
          >
            <option v-for="g in genreOptions" :key="g" :value="g">{{ g === 'all' ? 'All genres' : g }}</option>
          </select>
        </div>
      </div>
      <div v-if="!filteredGames.length" class="text-xs text-slate-400">No games match this filter.</div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RcArcadeGameCard v-for="game in filteredGames" :key="game.game_id" :game="game" @select="openGameModal" />
      </div>
    </div>

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
              <div class="text-sm font-semibold text-white">{{ selectedGame.name }}</div>
              <div class="text-[11px] text-slate-400">ID: {{ selectedGame.game_id }}</div>
              <div class="mt-1 flex flex-wrap gap-1 text-[11px]">
                <span class="badge border-emerald-400/40 text-emerald-200">{{ genreEmoji(selectedGame) }} {{ normalizeGenre(selectedGame) }}</span>
                <span class="badge border-cyan-400/40 text-cyan-200">{{ selectedGameDifficulty }}</span>
                <span class="badge border-amber-400/40 text-amber-200">{{ selectedGameStatus }}</span>
              </div>
            </div>
          </div>
          <button class="btn text-xs" @click="closeGameModal">✖ Close</button>
        </div>
        <div class="p-5 space-y-3 text-sm text-slate-200">
          <p class="text-slate-300">{{ selectedGame.description || 'No description provided.' }}</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
            <div class="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <span class="text-slate-500">Difficulty</span>
              <span class="text-slate-200">{{ selectedGameDifficulty }}</span>
            </div>
            <div class="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <span class="text-slate-500">Max Score</span>
              <span class="text-slate-200">{{ selectedGameMaxScore }}</span>
            </div>
            <div class="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <span class="text-slate-500">Creator</span>
              <span class="text-slate-200">{{ selectedGameCreator }}</span>
            </div>
            <div class="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
              <span class="text-slate-500">Status</span>
              <span class="text-slate-200">{{ selectedGameStatus }}</span>
            </div>
          </div>
        </div>
        <div class="p-5 border-t border-white/10 flex items-center justify-between gap-3">
          <div class="text-xs text-slate-400 flex items-center gap-2">
            <span>{{ selectedGameLaunchable ? 'Launches a hosted game client in a new tab.' : 'Launch URL not configured yet.' }}</span>
          </div>
          <div class="flex gap-2">
            <button class="btn text-xs" @click="closeGameModal">Cancel</button>
            <button class="btn btn-primary text-xs" :disabled="!selectedGameLaunchable" @click="playSelectedGame">▶ Play</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
