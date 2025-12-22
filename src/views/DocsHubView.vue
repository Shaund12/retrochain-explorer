<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { DOCS_NAV } from "@/constants/docsNav";

const router = useRouter();

type DocLink = {
  title: string;
  description: string;
  to: { name: string };
  tag?: string;
};

const DESCRIPTIONS: Record<string, string> = {
  "docs-network": "Chain-id, denoms, endpoints, and how explorers should verify live network identity.",
  "docs-tokenomics": "Supply, inflation, burn mechanics, staking economics, and how to verify via REST/CLI.",
  "docs-staking": "Delegation, undelegation, rewards, slashing risks, and how to verify via REST/CLI.",
  "docs-accounts": "Address types, sequences, and module accounts explorers commonly surface.",
  "docs-governance": "Deposit/voting/tally params, proposal lifecycle, and verify endpoints.",
  "docs-modules": "Arcade, DEX, burn, claimdrop and their REST endpoints.",
  "docs-fees": "Fee model, minimum gas prices, fee collector flow, and explorer UX best practices.",
  "docs-fees-flow": "How fees move through module accounts (fee collector, burn, community pool).",
  "docs-validator-uptime": "Missed blocks, signing info, jail duration, and how explorers estimate liveness.",
  "docs-consensus": "CometBFT concepts, validator set endpoints, and what explorers should surface.",
  "docs-contracts": "Code IDs, contracts, and common explorer queries on CosmWasm-enabled networks.",
  "docs-ibc": "How ibc/<hash> assets work and how explorers should resolve denom traces.",
  "docs-ibc-channels": "Active connections/channels, transfer ports, and how explorers identify common routes.",
  "docs-ibc-packets": "Pending packets, acknowledgements, timeouts, and relayer troubleshooting.",
  "docs-ibc-assets": "Curated list of common IBC denoms with live denom-trace resolution.",
  "docs-ibc-relayers": "Relayer responsibilities, monitoring, and common failure modes."
};

const docs = computed<DocLink[]>(() =>
  DOCS_NAV.map((d) => ({
    title: d.title,
    description: DESCRIPTIONS[d.name] || "",
    to: { name: d.name },
    tag: d.tag
  }))
);

const query = ref("");
const tag = ref<string>("all");

const tags = computed(() => {
  const set = new Set<string>();
  docs.value.forEach((d) => {
    if (d.tag) set.add(d.tag);
  });
  return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
});

const normalizedQuery = computed(() => query.value.trim().toLowerCase());

const filteredDocs = computed(() => {
  const q = normalizedQuery.value;
  const t = tag.value;
  return docs.value.filter((d) => {
    const tagOk = t === "all" ? true : d.tag === t;
    if (!tagOk) return false;
    if (!q) return true;
    const hay = `${d.title} ${d.description} ${d.tag || ""}`.toLowerCase();
    return hay.includes(q);
  });
});

const go = (link: DocLink) => router.push(link.to);
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-10 space-y-8">
    <header class="space-y-3">
      <p class="text-xs uppercase tracking-[0.4em] text-emerald-300">Docs</p>
      <h1 class="text-3xl font-bold text-white">RetroChain GitBook</h1>
      <p class="text-sm text-slate-400">
        Network documentation pages designed for explorers and builders. Live chain state is always the source of truth.
      </p>
    </header>

    <section class="card-soft border border-white/5 bg-slate-900/40">
      <div class="flex flex-col sm:flex-row gap-2">
        <input
          v-model="query"
          type="text"
          placeholder="Search docs (IBC, fees, staking...)"
          class="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
        />
        <select
          v-model="tag"
          class="sm:w-52 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
        >
          <option v-for="t in tags" :key="t" :value="t">{{ t === 'all' ? 'All tags' : t }}</option>
        </select>
      </div>
      <div class="mt-2 text-[11px] text-slate-500">
        Showing <span class="text-slate-200">{{ filteredDocs.length }}</span> of <span class="text-slate-200">{{ docs.length }}</span>
      </div>
    </section>

    <section class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        v-for="doc in filteredDocs"
        :key="doc.title"
        type="button"
        class="card-soft text-left border border-white/5 bg-slate-900/60 hover:border-emerald-400/40 transition"
        @click="go(doc)"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-white">{{ doc.title }}</h2>
            <p class="text-sm text-slate-400 mt-1">{{ doc.description }}</p>
          </div>
          <span
            v-if="doc.tag"
            class="px-2 py-0.5 rounded-full text-[11px] border border-emerald-400/30 text-emerald-200 bg-emerald-500/10 whitespace-nowrap"
          >
            {{ doc.tag }}
          </span>
        </div>
        <div class="mt-4 text-xs text-slate-500">Open ?</div>
      </button>
    </section>

    <section class="card-soft border border-indigo-400/30 bg-indigo-500/5">
      <h2 class="text-lg font-semibold text-white mb-2">Planned docs (next batches)</h2>
      <ul class="list-disc list-inside text-sm text-slate-200 space-y-1">
        <li>Genesis & upgrades (how to verify genesis checksum, upgrade plan tracking)</li>
        <li>Events & indexing (how explorers should index tx events reliably)</li>
      </ul>
    </section>
  </div>
</template>
