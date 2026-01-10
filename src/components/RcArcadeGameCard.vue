<script setup lang="ts">
import type { Game } from "@/composables/useArcade";

defineProps<{
  game: Game;
}>();

const emit = defineEmits<{
  select: [game: Game];
}>();

const getDifficultyColor = (difficulty?: string | number | null) => {
  const diff = difficulty == null ? "" : difficulty.toString().toLowerCase();
  switch (diff) {
    case "easy":
      return "text-emerald-300 border-emerald-500/40";
    case "medium":
      return "text-yellow-300 border-yellow-500/40";
    case "hard":
      return "text-orange-300 border-orange-500/40";
    case "extreme":
      return "text-rose-300 border-rose-500/40";
    default:
      return "text-slate-300 border-slate-500/40";
  }
};

const getGameIcon = (genre?: string | number | null) => {
  const g = genre == null ? "" : genre.toString().toLowerCase();
  switch (g) {
    case "shooter":
      return "🎯";
    case "puzzle":
      return "🧩";
    case "racing":
      return "🏎️";
    case "platformer":
      return "🦘";
    case "fighting":
      return "🥊";
    case "rpg":
      return "🧙‍♂️";
    default:
      return "🎮";
  }
};
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-slate-900/80 to-cyan-500/10 shadow-xl shadow-emerald-900/30 hover:shadow-cyan-900/30 cursor-pointer transition duration-200 hover:-translate-y-1"
    @click="emit('select', game)"
  >
    <div class="absolute inset-0 pointer-events-none opacity-60 blur-2xl bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-indigo-500/10"></div>
    <div class="relative p-4 space-y-3">
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="text-4xl drop-shadow-sm">{{ getGameIcon(game.genre) }}</div>
          <div>
            <h3 class="font-bold text-base text-white leading-tight">{{ game.name }}</h3>
            <p class="text-[11px] text-slate-400">ID: {{ game.game_id }}</p>
          </div>
        </div>
        <span
          v-if="game.active"
          class="badge text-[10px] border-emerald-400/50 text-emerald-200 bg-emerald-500/10"
        >
          🟢 Active
        </span>
        <span v-else class="badge text-[10px] border-slate-500/50 text-slate-300 bg-slate-500/10">
          ⏸️ Inactive
        </span>
      </div>

      <p v-if="game.description" class="text-sm text-slate-200/90 line-clamp-3">
        {{ game.description }}
      </p>

      <div class="flex flex-wrap items-center gap-2 text-[11px]">
        <span class="badge border-cyan-400/50 text-cyan-200 bg-cyan-500/10">{{ getGameIcon(game.genre) }} {{ game.genre || 'Arcade' }}</span>
        <span
          v-if="game.difficulty"
          class="badge text-[10px] bg-white/5"
          :class="getDifficultyColor(game.difficulty)"
        >
          Difficulty: {{ game.difficulty }}
        </span>
        <span v-if="game.max_score" class="badge text-[10px] border-amber-400/50 text-amber-200 bg-amber-500/10">
          🏆 Max {{ game.max_score?.toLocaleString() }}
        </span>
      </div>

      <div class="flex items-center justify-between pt-2">
        <div class="text-[11px] text-slate-400">Tap for details & leaderboard</div>
        <button class="btn btn-primary btn-xs" @click.stop="emit('select', game)">
          ▶ Play
        </button>
      </div>
    </div>
  </div>
</template>
