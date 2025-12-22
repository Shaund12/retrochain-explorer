<script setup lang="ts">
import { onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const distributionParams = ref<Record<string, any> | null>(null);
const burnParams = ref<Record<string, any> | null>(null);
const mintParams = ref<Record<string, any> | null>(null);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, distRes, burnRes, mintRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/distribution/v1beta1/params").catch(() => null),
      api.get("/cosmos/burn/v1beta1/params").catch(() => null),
      api.get("/cosmos/mint/v1beta1/params").catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    distributionParams.value = distRes?.data?.params ?? null;
    burnParams.value = burnRes?.data?.params ?? null;
    mintParams.value = mintRes?.data?.params ?? null;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />

    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Fee Collector Flow</h1>
      <p class="text-sm text-slate-400 mt-1">
        How transaction fees are collected and routed through module accounts. This page is written for explorers/indexers.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading fee collector docs…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load fee collector context: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="High-level flow">
      <ol class="list-decimal list-inside text-sm text-slate-300 space-y-1">
        <li>User submits a tx with a fee in <code>uretro</code> (or accepted fee denoms).</li>
        <li>Fees are paid to the <strong>fee collector</strong> module account during ante-handling.</li>
        <li>At end-block, modules may route balances (burn, distribution, community pool, etc.).</li>
      </ol>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Distribution module</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <p>
            The distribution module controls the <strong>community pool</strong> and sets the <strong>community tax</strong>, which may affect
            how rewards/fees end up allocated.
          </p>
          <div>
            Community tax (live):
            <span class="font-mono text-slate-200">{{ distributionParams?.community_tax ?? '—' }}</span>
          </div>
          <div class="text-[11px] text-slate-500">REST: <code>/cosmos/distribution/v1beta1/params</code></div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Burn module (x/burn)</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <p>
            RetroChain includes a burn module that can burn a portion of tx fees and/or a portion of mint provisions.
          </p>
          <div>
            Fee burn rate (live):
            <span class="font-mono text-slate-200">{{ burnParams?.fee_burn_rate ?? '—' }}</span>
          </div>
          <div>
            Provision burn rate (live):
            <span class="font-mono text-slate-200">{{ burnParams?.provision_burn_rate ?? '—' }}</span>
          </div>
          <div class="text-[11px] text-slate-500">REST: <code>/cosmos/burn/v1beta1/params</code></div>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Mint module</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <p>
            Mint provisions typically go to a module account (often <code>mint</code>) then are distributed further (staking/distribution).
            If provision burning is enabled, explorers should show the effective net mint.
          </p>
          <div>
            Mint denom (live):
            <code class="text-xs">{{ mintParams?.mint_denom ?? mintParams?.mintDenom ?? '—' }}</code>
          </div>
          <div class="text-[11px] text-slate-500">REST: <code>/cosmos/mint/v1beta1/params</code></div>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Explorer recommendations</div>
        <ul class="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          <li>Display fees by denom and show whether burn modules are enabled for the chain.</li>
          <li>Track module account balances (fee collector, community pool, burn sink) where addresses are known.</li>
          <li>Derive “net fee to validators” = fees ? burned ? community pool allocation (chain-dependent).</li>
          <li>When possible, link fee collector transfers to block end events or module msgs.</li>
        </ul>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query distribution params
retrochaind query mint params
retrochaind query burn params
# inspect a tx’s fee & events
retrochaind query tx &lt;txhash&gt;</code></pre>
    </div>
  </div>
</template>
