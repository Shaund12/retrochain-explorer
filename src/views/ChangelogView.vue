<template>
  <div class="max-w-5xl mx-auto px-4 py-10 space-y-8">
    <header class="space-y-3 text-center">
      <p class="text-xs uppercase tracking-[0.4em] text-emerald-300">Release Notes</p>
      <h1 class="text-3xl font-bold text-white">RetroChain Changelog</h1>
      <p class="text-sm text-slate-400">
        A living timeline of every user-facing improvement, so the community can track progress and product teams can audit what changed.
      </p>
    </header>

    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card-soft text-center py-4">
        <p class="text-xs text-slate-400">Latest Release</p>
        <p class="text-xl font-semibold text-white">{{ releases[0]?.version ?? '—' }}</p>
        <p class="text-xs text-slate-500">{{ releases[0]?.date ?? 'Add the first entry' }}</p>
      </div>
      <div class="card-soft text-center py-4">
        <p class="text-xs text-slate-400">Entries Logged</p>
        <p class="text-xl font-semibold text-white">{{ totalChanges }}</p>
        <p class="text-xs text-slate-500">Across {{ releases.length }} release{{ releases.length === 1 ? '' : 's' }}</p>
      </div>
      <div class="card-soft text-center py-4">
        <p class="text-xs text-slate-400">Last Updated</p>
        <p class="text-xl font-semibold text-white">{{ releases[0]?.date ?? '—' }}</p>
        <p class="text-xs text-slate-500">Keep this current with every deploy</p>
      </div>
    </section>

    <section class="space-y-6">
      <article
        v-for="release in releases"
        :key="release.version"
        class="card border border-white/5 bg-slate-900/60"
      >
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/5 pb-4">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-xl font-semibold text-white">{{ release.version }}</h2>
              <span v-if="release.codename" class="px-2 py-0.5 rounded-full text-[11px] border border-indigo-400/40 text-indigo-200">
                {{ release.codename }}
              </span>
            </div>
            <p class="text-sm text-slate-400">{{ release.summary }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-500 uppercase tracking-wide">Published</p>
            <p class="text-sm text-white">{{ release.date }}</p>
          </div>
        </div>

        <ul class="divide-y divide-white/5">
          <li
            v-for="change in release.changes"
            :key="change.title"
            class="py-4 flex flex-col sm:flex-row sm:items-start sm:gap-6"
          >
            <div class="flex items-center gap-2 mb-2 sm:mb-0">
              <span :class="['px-2 py-0.5 rounded-full text-[11px] font-medium border', badgeClass(change.type)]">
                {{ change.type }}
              </span>
              <h3 class="text-base font-semibold text-white">{{ change.title }}</h3>
            </div>
            <p class="text-sm text-slate-400 flex-1">{{ change.description }}</p>
          </li>
        </ul>
      </article>
    </section>

    <section class="card-soft border border-amber-400/30 bg-amber-500/5">
      <h2 class="text-lg font-semibold text-white mb-2">How to keep this log fresh</h2>
      <ul class="list-disc list-inside text-sm text-slate-200 space-y-1">
        <li>Every feature, fix, or operational change shipped to users must add a new entry in <strong>ChangelogView.vue</strong>.</li>
        <li>Group related bullet points into a release bucket (weekly, sprint, or deploy train) so the timeline stays readable.</li>
        <li>When backfilling history, add older releases beneath the current one to preserve chronological order.</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
type ChangeType = "feature" | "improvement" | "fix" | "ops" | "note";

interface ChangeItem {
  type: ChangeType;
  title: string;
  description: string;
}

interface Release {
  version: string;
  codename?: string;
  date: string;
  summary: string;
  changes: ChangeItem[];
}

const releases: Release[] = [
  {
    version: "2024.10.1",
    codename: "Duality",
    date: "2024-10-03",
    summary: "Dual-direction IBC transfers and public release tracking.",
    changes: [
      {
        type: "feature",
        title: "Dedicated changelog view",
        description: "Introduced this page so every launch and fix is documented for the community and internal QA alike."
      },
      {
        type: "improvement",
        title: "Retro ? Cosmos bridge parity",
        description: "Bridge UI now lets operators choose which asset crosses the IBC channel in either direction, ensuring RETRO and ATOM can return to their home chains."
      },
      {
        type: "ops",
        title: "Cosmos Hub channel defaults",
        description: "Recorded canonical channel mappings (channel-1638 / channel-0) inside the example env file to reduce deploy misconfigurations."
      }
    ]
  },
  {
    version: "Backlog",
    codename: "Fill Me In",
    date: "YYYY-MM-DD",
    summary: "Document earlier milestones here as you backfill history.",
    changes: [
      {
        type: "note",
        title: "Add previous releases",
        description: "Move your recent deploy notes into this timeline so contributors can see what changed over time."
      }
    ]
  }
];

const totalChanges = releases.reduce((sum, release) => sum + release.changes.length, 0);

const badgeStyles: Record<ChangeType, string> = {
  feature: "border-emerald-400/50 text-emerald-300 bg-emerald-500/10",
  improvement: "border-cyan-400/50 text-cyan-300 bg-cyan-500/10",
  fix: "border-rose-400/50 text-rose-300 bg-rose-500/10",
  ops: "border-amber-400/50 text-amber-300 bg-amber-500/10",
  note: "border-slate-500/40 text-slate-200 bg-slate-700/30"
};

const badgeClass = (type: ChangeType) => badgeStyles[type] ?? badgeStyles.note;
</script>
