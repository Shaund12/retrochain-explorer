<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

type DocLink = {
  title: string;
  description: string;
  to: { name: string };
  tag?: string;
};

const docs = computed<DocLink[]>(() => [
  {
    title: "Network Overview",
    description: "Chain-id, denoms, endpoints, and how explorers should verify live network identity.",
    to: { name: "docs-network" },
    tag: "Network"
  },
  {
    title: "Tokenomics (RETRO)",
    description: "Supply, inflation, burn mechanics, staking economics, and how to verify via REST/CLI.",
    to: { name: "docs-tokenomics" },
    tag: "Economics"
  },
  {
    title: "Staking Guide",
    description: "Delegation, undelegation, rewards, slashing risks, and how to verify via REST/CLI.",
    to: { name: "docs-staking" },
    tag: "Validators"
  },
  {
    title: "IBC & Denom Traces",
    description: "How ibc/<hash> assets work and how explorers should resolve denom traces.",
    to: { name: "docs-ibc" },
    tag: "Interchain"
  },
  {
    title: "IBC Channels & Routing",
    description: "Active connections/channels, transfer ports, and how explorers identify common routes.",
    to: { name: "docs-ibc-channels" },
    tag: "Interchain"
  },
  {
    title: "IBC Packets & Timeouts",
    description: "Pending packets, acknowledgements, timeouts, and relayer troubleshooting.",
    to: { name: "docs-ibc-packets" },
    tag: "Interchain"
  },
  {
    title: "IBC Asset Registry",
    description: "Curated list of common IBC denoms with live denom-trace resolution.",
    to: { name: "docs-ibc-assets" },
    tag: "Interchain"
  },
  {
    title: "IBC Relayers",
    description: "Relayer responsibilities, monitoring, and common failure modes.",
    to: { name: "docs-ibc-relayers" },
    tag: "Interchain"
  },
  {
    title: "Accounts & Addresses",
    description: "Address types, sequences, and module accounts explorers commonly surface.",
    to: { name: "docs-accounts" },
    tag: "Accounts"
  },
  {
    title: "Governance Guide",
    description: "Deposit/voting/tally params, proposal lifecycle, and verify endpoints.",
    to: { name: "docs-governance" },
    tag: "Governance"
  },
  {
    title: "Modules",
    description: "Arcade, DEX, burn, claimdrop and their REST endpoints.",
    to: { name: "docs-modules" },
    tag: "Modules"
  },
  {
    title: "Fees & Gas",
    description: "Fee model, minimum gas prices, fee collector flow, and explorer UX best practices.",
    to: { name: "docs-fees" },
    tag: "Fees"
  },
  {
    title: "Fee Collector Flow",
    description: "How fees move through module accounts (fee collector, burn, community pool).",
    to: { name: "docs-fees-flow" },
    tag: "Fees"
  },
  {
    title: "Validator Uptime",
    description: "Missed blocks, signing info, jail duration, and how explorers estimate liveness.",
    to: { name: "docs-validator-uptime" },
    tag: "Validators"
  },
  {
    title: "Consensus & Validator Ops",
    description: "CometBFT concepts, validator set endpoints, and what explorers should surface.",
    to: { name: "docs-consensus" },
    tag: "Consensus"
  },
  {
    title: "Smart Contracts (CosmWasm)",
    description: "Code IDs, contracts, and common explorer queries on CosmWasm-enabled networks.",
    to: { name: "docs-contracts" },
    tag: "Wasm"
  }
]);

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

    <section class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button
        v-for="doc in docs"
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
