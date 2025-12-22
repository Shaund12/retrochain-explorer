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

const chainId = ref<string | null>(null);
const bech32Prefix = ref<string | null>(null);

const restExample = "/cosmos/base/tendermint/v1beta1/blocks/latest";
const rpcExample = "(RPC) /status";

const fetchNetworkOverview = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latestBlockRes, nodeInfoRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/base/tendermint/v1beta1/node_info").catch(() => null)
    ]);

    height.value = latestBlockRes?.data?.block?.header?.height ?? null;

    const nodeInfo = nodeInfoRes?.data?.default_node_info;
    chainId.value = nodeInfo?.network ?? null;

    // Cosmos SDK doesn't have a universal REST endpoint for bech32 prefix; best-effort via node_info.
    // Some nodes expose it in application_version or config, but not guaranteed.
    bech32Prefix.value = nodeInfoRes?.data?.bech32_prefix ?? null;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchNetworkOverview();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Network Overview</h1>
      <p class="text-sm text-slate-400 mt-1">
        Chain identifiers, denoms, endpoints, and how to verify them on a live network.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading network overview…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load network overview: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Source of truth">
      <ul class="text-xs text-slate-300 list-disc list-inside space-y-1">
        <li>Nodes differ by operator configuration (min gas prices, pruning, etc.).</li>
        <li>Chain params can change by governance. Prefer querying live endpoints.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Chain identity</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>
            Chain-id (live):
            <span class="font-semibold text-slate-100">{{ chainId ?? '—' }}</span>
          </div>
          <div>
            Bech32 prefix:
            <span class="font-semibold text-slate-100">{{ bech32Prefix ?? 'cosmos' }}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/base/tendermint/v1beta1/node_info</code></div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Token units</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Native display: <span class="font-semibold text-slate-100">RETRO</span></div>
          <div>Native base denom: <code class="text-xs">uretro</code></div>
          <div>Decimals: <span class="font-mono text-slate-200">6</span></div>
          <div class="text-xs text-slate-400">1 RETRO = 1,000,000 uretro</div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">REST endpoints</div>
        <div class="mt-2 space-y-2 text-sm">
          <div>
            Latest block:
            <div class="mt-1">
              <code class="text-[11px]">GET {{ restExample }}</code>
            </div>
          </div>
          <div>
            Node info:
            <div class="mt-1">
              <code class="text-[11px]">GET /cosmos/base/tendermint/v1beta1/node_info</code>
            </div>
          </div>
          <div class="text-xs text-slate-500">Explorers should show a “Data as of height …” banner.</div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">RPC endpoints</div>
        <div class="mt-2 space-y-2 text-sm">
          <div>
            Tendermint status:
            <div class="mt-1"><code class="text-[11px]">{{ rpcExample }}</code></div>
          </div>
          <div class="text-xs text-slate-500">
            This explorer UI uses REST for most data. RPC is used by wallets/relayers for consensus-level queries.
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Common verify commands (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind status
retrochaind query bank supply-by-denom uretro
retrochaind query staking params</code></pre>
    </div>
  </div>
</template>
