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
    version: "2025.12.14",
    codename: "Mainnet Polish",
    date: "2025-12-14",
    summary: "Messaging + analytics pass from MAINNET_LIVE_UPDATE.md to match the chain's third live day.",
    changes: [
      {
        type: "feature",
        title: "DEX and Buy disclaimers now announce live trading",
        description: "Updated the RcDisclaimer copy exactly as outlined in MAINNET_LIVE_UPDATE.md so /dex shows \"Native DEX  Mainnet Ready\" and /buy advertises cross-chain swaps instead of under-construction language."
      },
      {
        type: "improvement",
        title: "Consistent info tone across public pages",
        description: "All public notices swapped from warning (yellow) to info (blue) so users immediately see that staking, bridging, and swapping already work on mainnet."
      },
      {
        type: "ops",
        title: "Vercel Analytics instrumentation",
        description: "Installed @vercel/analytics@1.1.1 and call inject() in src/main.ts per MAINNET_LIVE_UPDATE.md, giving the team real-time traffic, referrer, and performance data for the live explorer."
      }
    ]
  },
  {
    version: "2025.12.13",
    codename: "Real Transactions",
    date: "2025-12-13",
    summary: "Fulfilled the REAL_TRANSACTIONS.md and REWARDS_READY_TO_CLAIM.md plan so every button signs real Cosmos SDK messages.",
    changes: [
      {
        type: "feature",
        title: "On-chain DEX, staking, and IBC flows",
        description: "Swap, add liquidity, place limit orders, delegate, undelegate, claim rewards, and bridge via IBC exactly as documented in REAL_TRANSACTIONS.md  all actions now call Keplr and broadcast to the RetroChain RPC."
      },
      {
        type: "fix",
        title: "REST-based signing + registry patch",
        description: "Adopted the TxRaw encoding + defaultRegistryTypes approach from REWARDS_READY_TO_CLAIM.md so there are no more \"invalid empty tx\" or \"Unregistered type url\" panics when withdrawing rewards."
      },
      {
        type: "ops",
        title: "Fee floor bumped to 50,000 uretro",
        description: "Raised fees to 0.05 RETRO (per REWARDS_READY_TO_CLAIM.md) so transactions respect the chain's 0.025 uretro gas price requirement and reward claims succeed on the first attempt."
      }
    ]
  },
  {
    version: "2025.12.12",
    codename: "Launch Sprint",
    date: "2025-12-12",
    summary: "Launch-day UX upgrades captured in KEPLR_AUTO_CONNECT.md, NATIVE_DEX_USDC.md, AMAZING_DETAILS.md, and NEXT_LEVEL_ENHANCEMENTS.md.",
    changes: [
      {
        type: "feature",
        title: "Keplr auto-connect on Account view",
        description: "AccountView.vue now auto-loads the connected wallet, shows the Your Wallet badge, and offers the quick-load banner exactly as described in KEPLR_AUTO_CONNECT.md."
      },
      {
        type: "feature",
        title: "Native DEX + bridge UI surfaces",
        description: "Delivered the multi-tab /dex experience from NATIVE_DEX_USDC.md, including swap/limit/pool creation plus Noble + Axelar bridging with fee and ETA callouts."
      },
      {
        type: "improvement",
        title: "Homepage and footer redesign",
        description: "Implemented the professional hero, stats, and 4-column footer documented in AMAZING_DETAILS.md so the explorer looks production-ready."
      },
      {
        type: "improvement",
        title: "Toast + disclaimer system",
        description: "Shipped the Vue Toastification stack and RcDisclaimer usage from NEXT_LEVEL_ENHANCEMENTS.md, giving users contextual warnings, copy-to-clipboard feedback, and transaction toasts."
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
