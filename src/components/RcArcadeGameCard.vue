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
    class="card cursor-pointer hover:scale-[1.02] transition-transform"
    @click="emit('select', game)"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <div class="text-4xl">{{ getGameIcon(game.genre) }}</div>
        <div>
          <h3 class="font-bold text-sm text-slate-100">{{ game.name }}</h3>
          <p class="text-[11px] text-slate-400">{{ game.game_id }}</p>
        </div>
      </div>
      <span
        v-if="game.active"
        class="badge text-emerald-200 border-emerald-500/40 text-[10px]"
      >
        Active
      </span>
      <span v-else class="badge text-slate-400 border-slate-500/40 text-[10px]">
        Inactive
      </span>
    </div>

    <p v-if="game.description" class="text-xs text-slate-300 mb-3 line-clamp-2">
      {{ game.description }}
    </p>

    <div class="flex items-center justify-between">
      <span
        v-if="game.difficulty"
        class="badge text-[10px]"
        :class="getDifficultyColor(game.difficulty)"
      >
        {{ game.difficulty }}
      </span>
      <span v-if="game.max_score" class="text-[11px] text-slate-400">
        Max: {{ game.max_score?.toLocaleString() }}
      </span>
    </div>
  </div>
</template>
