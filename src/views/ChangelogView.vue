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
        <p class="text-xl font-semibold text-white">{{ releases[0]?.version ?? '' }}</p>
        <p class="text-xs text-slate-500">{{ releases[0]?.date ?? 'Add the first entry' }}</p>
      </div>
      <div class="card-soft text-center py-4">
        <p class="text-xs text-slate-400">Entries Logged</p>
        <p class="text-xl font-semibold text-white">{{ totalChanges }}</p>
        <p class="text-xs text-slate-500">Across {{ releases.length }} release{{ releases.length === 1 ? '' : 's' }}</p>
      </div>
      <div class="card-soft text-center py-4">
        <p class="text-xs text-slate-400">Last Updated</p>
        <p class="text-xl font-semibold text-white">{{ releases[0]?.date ?? '' }}</p>
        <p class="text-xs text-slate-500">Keep this current with every deploy</p>
      </div>
    </section>

    <section v-if="releases.length === 0" class="card border border-slate-700 bg-slate-900/50 text-center py-10">
      <h2 class="text-xl font-semibold text-white mb-2">Nothing logged yet</h2>
      <p class="text-sm text-slate-400">
        This changelog stays blank until the next deploy. Add real release notes in <code class="font-mono text-xs">ChangelogView.vue</code> whenever you ship.
      </p>
    </section>

    <section v-else class="space-y-6">
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
    version: "2025.12.22-2",
    codename: "GitBook Sprint",
    date: "2025-12-22",
    summary:
      "Introduced a GitBook-style Docs hub with a full explorer-focused documentation set, automatic IBC denom registry discovery, and consistent navigation between docs pages.",
    changes: [
      {
        type: "feature",
        title: "Docs hub (GitBook-style)",
        description:
          "Added a dedicated /docs landing page with card layout, searchable list, and tag filtering to quickly access explorer documentation."
      },
      {
        type: "feature",
        title: "New docs pages (IBC + explorer ops)",
        description:
          "Added docs routes for IBC packets & timeouts, IBC relayers, IBC asset registry, fee collector flow, and validator uptime."
      },
      {
        type: "improvement",
        title: "Back navigation on every docs page",
        description:
          "All docs views now include a consistent back link that uses history when available and falls back to the Docs hub."
      },
      {
        type: "feature",
        title: "Next/Previous docs navigation",
        description:
          "Added a canonical docs ordering and inserted Previous/Next navigation cards on docs pages for quick sequential reading."
      },
      {
        type: "feature",
        title: "Automatic IBC Asset Registry discovery",
        description:
          "IBC Asset Registry now auto-fetches /cosmos/bank/v1beta1/denoms_metadata, detects all ibc/ denoms, merges them with curated entries, and labels each row as Curated or Discovered."
      },
      {
        type: "improvement",
        title: "Expanded curated IBC denom list",
        description:
          "Seeded the registry with known RetroChain IBC denoms for ATOM, OSMO, USDC, and WBTC (including aliases) so icons/decimals render even if metadata endpoints are missing."
      },
      {
        type: "improvement",
        title: "Holiday theme persistence",
        description:
          "Holiday mode now defaults to Off, remembers the user’s selection (including snow level) via localStorage, and Auto mode still picks the correct seasonal theme based on the current date."
      }
    ]
  },
  {
    version: "2025.12.22",
    codename: "Stake & Trace",
    date: "2025-12-22",
    summary: "BTC staking UX got richer guidance, chain metadata adds stWBTC and Noble USDC, and tx details now surface parsed transfers with token context.",
    changes: [
      {
        type: "improvement",
        title: "Stake WBTC preflight and safety controls",
        description: "Added preflight checklist, max-minus-gas helper, copy buttons, and zero-balance CTA to the BTC staking page for safer sends."
      },
      {
        type: "feature",
        title: "stWBTC visible in wallet metadata",
        description: "Registered the stWBTC module denom in chain metadata/Keplr suggestion so the derivative shows with proper symbol/decimals instead of unknown denom."
      },
      {
        type: "feature",
        title: "Noble USDC IBC hash recognized",
        description: "Added Noble → Osmosis → RetroChain USDC IBC hash with icon/decimals so balances render correctly across explorer pages."
      },
      {
        type: "feature",
        title: "Transfers card on tx detail",
        description: "Transaction details now parse transfer events, format amounts with token metadata (including IBC denoms), and show sender/recipient for quick at-a-glance context."
      }
    ]
  },
  {
    version: "2025.12.20",
    codename: "Dashboard Flex",
    date: "2025-12-20",
    summary: "Home dashboard got movable cards, persisted layout, richer telemetry, and paginated blocks/txs while search added saved-query support.",
    changes: [
      {
        type: "feature",
        title: "Movable & collapsible homepage cards",
        description: "All hero dashboard cards can be reordered and collapsed, with preferences persisted to localStorage and a default reset on cache clear."
      },
      {
        type: "improvement",
        title: "Blocks & transactions side-by-side with pagination",
        description: "Latest blocks and recent txs now share a single split card with prev/next paging controls, keeping both feeds visible at once."
      },
      {
        type: "feature",
        title: "Mempool snapshot + fee estimator",
        description: "Added live mempool pending count/size and gas price tiers computed from recent tx fees (low/mid/high) to guide fee selection."
      },
      {
        type: "improvement",
        title: "Saved searches via ?q= query",
        description: "Search bar now reads and writes the q querystring so searches can be bookmarked, shared, and auto-run on load."
      },
      {
        type: "fix",
        title: "IBC denom helper copy",
        description: "Escaped the literal <hash> placeholder in IBC denom resolver text to prevent Vue compile errors."
      },
      {
        type: "improvement",
        title: "Navigation link to Ecosystem Wallets",
        description: "Header now includes a direct link to the Ecosystem Wallets page under Network, keeping IBC link hidden until ready."
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
