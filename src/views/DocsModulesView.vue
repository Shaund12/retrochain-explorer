<script setup lang="ts">
import RcBackLink from "@/components/RcBackLink.vue";
import RcDocsPager from "@/components/RcDocsPager.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";

type ModuleDoc = {
  title: string;
  description: string;
  endpoints: string[];
  notes?: string[];
};

const modules: ModuleDoc[] = [
  {
    title: "x/burn",
    description: "Protocol burn rates for fees and minted provisions.",
    endpoints: ["GET /cosmos/burn/v1beta1/params"],
    notes: [
      "fee_burn_rate burns a portion of fees collected through the fee collector.",
      "provision_burn_rate burns a portion of mint module provisions."
    ]
  },
  {
    title: "x/dex",
    description: "Native AMM module. When enabled, swaps pay fees routed per on-chain params.",
    endpoints: ["GET /retrochain/dex/v1/params"],
    notes: ["If the module is disabled, endpoints may return 404/501 depending on node build."]
  },
  {
    title: "x/arcade",
    description: "Arcade gameplay economy parameters used by RetroChain arcade features.",
    endpoints: ["GET /retrochain/arcade/v1/params"],
    notes: ["Use params as the source of truth for payouts, sinks, and enable flags."]
  },
  {
    title: "x/claimdrop",
    description: "One-claim-per-wallet mechanism. Claims are funded from the module account balance.",
    endpoints: ["GET /retrochain/claimdrop/v1/params"],
    notes: [
      "If enabled but unfunded, claims will fail.",
      "Explorers should show whether enabled and the configured claim amount."
    ]
  }
];
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Modules</h1>
      <p class="text-sm text-slate-400 mt-1">
        Module-level docs: what each module does and which REST endpoints explorers should query.
      </p>
    </div>

    <RcDisclaimer type="info" title="Compatibility note">
      <p class="text-sm text-slate-300">
        Some nodes may not run every optional module. Treat 404/501 results as module not available.
      </p>
    </RcDisclaimer>

    <section class="space-y-3">
      <article v-for="m in modules" :key="m.title" class="card">
        <h2 class="text-lg font-semibold text-white">{{ m.title }}</h2>
        <p class="text-sm text-slate-300 mt-1">{{ m.description }}</p>

        <div class="mt-3">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Endpoints</div>
          <ul class="space-y-1">
            <li v-for="ep in m.endpoints" :key="ep" class="text-[11px] text-slate-200">
              <code>{{ ep }}</code>
            </li>
          </ul>
        </div>

        <div v-if="m.notes?.length" class="mt-3">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Notes</div>
          <ul class="list-disc list-inside text-sm text-slate-300 space-y-1">
            <li v-for="n in m.notes" :key="n">{{ n }}</li>
          </ul>
        </div>
      </article>
    </section>
  </div>
</template>
