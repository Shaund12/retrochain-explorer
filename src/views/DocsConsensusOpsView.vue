<script setup lang="ts">
import { onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import RcDocsPager from "@/components/RcDocsPager.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const nodeInfo = ref<any | null>(null);
const latestValidators = ref<any[] | null>(null);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, nodeRes, valsRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/base/tendermint/v1beta1/node_info").catch(() => null),
      api.get("/cosmos/base/tendermint/v1beta1/validatorsets/latest", {
        params: { "pagination.limit": "20" }
      }).catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    nodeInfo.value = nodeRes?.data?.default_node_info ?? null;
    latestValidators.value = valsRes?.data?.validators ?? null;
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
      <h1 class="text-xl font-bold text-slate-50">Consensus & Validator Ops</h1>
      <p class="text-sm text-slate-400 mt-1">
        CometBFT/Tendermint consensus concepts relevant to explorers and validator operators.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading consensus docs…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load consensus docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Consensus vs staking">
      <p class="text-sm text-slate-300">
        Staking (Cosmos SDK) decides which validators are in the active set, but consensus (CometBFT) is what produces blocks.
        Explorers often need to connect both layers when showing proposer info.
      </p>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Node info</div>
        <div class="mt-2 space-y-1 text-sm text-slate-300">
          <div>Moniker: <span class="font-semibold text-slate-100">{{ nodeInfo?.moniker ?? '—' }}</span></div>
          <div>Network (chain-id): <span class="font-mono text-slate-200">{{ nodeInfo?.network ?? '—' }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/base/tendermint/v1beta1/node_info</code></div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Validator set (sample)</div>
        <div class="mt-2 text-sm text-slate-300">
          <p class="text-xs text-slate-500">REST: <code>/cosmos/base/tendermint/v1beta1/validatorsets/latest</code></p>
          <div v-if="latestValidators?.length" class="mt-2 space-y-1">
            <div v-for="v in latestValidators" :key="v.address" class="flex items-center justify-between gap-3">
              <code class="text-[11px] text-slate-400 truncate">{{ v.address }}</code>
              <span class="text-[11px] text-slate-200 font-mono">{{ v.voting_power }}</span>
            </div>
          </div>
          <p v-else class="mt-2 text-sm text-slate-400">Validator set unavailable.</p>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">What explorers should surface</div>
        <ul class="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          <li>Block proposer (consensus address) ? map to valoper/operator for UI moniker.</li>
          <li>Jailing and slashing events (from slashing + staking modules).</li>
          <li>Uptime signals (signed blocks window vs missed blocks) when available.</li>
        </ul>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind status
retrochaind query tendermint-validator-set
retrochaind query slashing params</code></pre>
    </div>
  </div>
</template>
