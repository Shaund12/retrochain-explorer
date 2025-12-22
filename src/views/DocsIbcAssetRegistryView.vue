<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import { useApi } from "@/composables/useApi";
import { getTokenMeta } from "@/constants/tokens";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

type AssetRow = {
  denom: string;
  hash?: string;
  baseDenom?: string | null;
  path?: string | null;
  symbol?: string | null;
  decimals?: number | null;
  icon?: string | null;
  source?: "live" | "curated";
};

// Curated starter list: these are examples/samples; the page also supports resolving any hash via the resolver.
// You can extend this list as RetroChain adds more IBC routes.
const curated: AssetRow[] = [
  {
    denom: "ibc/27394fb092d2eccd56123c74f36e4c1f926001ceada9ca97ea622b25f41e5eb2",
    source: "curated"
  },
  {
    denom: "ibc/0471f1c4e7afd3f07702bef6dc365268d64570f7c1fdc98ea6098dd6de59817b",
    source: "curated"
  },
  {
    denom: "ibc/6b199312b29cf047bf8b1337450ef3aa0475fe0c312db94055f2d5b22cd1e71a",
    source: "curated"
  },
  {
    denom: "ibc/cf57a83ced6cec7d706631b5dc53abc21b7eda7df7490732b4361e6d5dd19c73",
    source: "curated"
  },
  {
    denom: "ibc/99b00614ddbe6189aa03b77066ff8eb3f93680bd790c43cf56096b7f23542015",
    source: "curated"
  },
  {
    denom: "ibc/atom",
    source: "curated"
  },
  {
    denom: "ibc/usdc",
    source: "curated"
  }
];

const resolverHash = ref<string>("27394fb092d2eccd56123c74f36e4c1f926001ceada9ca97ea622b25f41e5eb2");
const resolverResult = ref<AssetRow | null>(null);

const normalize = (s: string) => s.trim();

const loadHeight = async () => {
  const res = await api.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
  height.value = res?.data?.block?.header?.height ?? null;
};

const fetchDenomTrace = async (hash: string) => {
  try {
    const res = await api.get(`/ibc/apps/transfer/v1/denom_traces/${hash}`);
    return res.data?.denom_trace ?? null;
  } catch {
    return null;
  }
};

const enrichRow = async (row: AssetRow): Promise<AssetRow> => {
  const hash = row.denom.startsWith("ibc/") ? row.denom.split("/")[1] : row.hash;
  const tokenMeta = getTokenMeta(row.denom);
  const trace = hash ? await fetchDenomTrace(hash) : null;

  return {
    ...row,
    hash: hash || row.hash,
    baseDenom: trace?.base_denom ?? trace?.baseDenom ?? row.baseDenom ?? null,
    path: trace?.path ?? row.path ?? null,
    symbol: tokenMeta?.symbol ?? null,
    decimals: typeof tokenMeta?.decimals === "number" ? tokenMeta.decimals : null,
    icon: tokenMeta?.icon ?? null
  };
};

const rows = ref<AssetRow[]>([]);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    await loadHeight();
    rows.value = await Promise.all(curated.map(enrichRow));
  } catch (e: any) {
    error.value = e?.message ?? String(e);
    rows.value = [];
  } finally {
    loading.value = false;
  }
};

const resolve = async () => {
  const h = normalize(resolverHash.value).toLowerCase();
  if (!h) {
    resolverResult.value = null;
    return;
  }

  resolverResult.value = null;
  try {
    const trace = await fetchDenomTrace(h);
    const denom = `ibc/${h}`;
    const tokenMeta = getTokenMeta(denom);

    resolverResult.value = {
      denom,
      hash: h,
      baseDenom: trace?.base_denom ?? trace?.baseDenom ?? null,
      path: trace?.path ?? null,
      symbol: tokenMeta?.symbol ?? null,
      decimals: typeof tokenMeta?.decimals === "number" ? tokenMeta.decimals : null,
      icon: tokenMeta?.icon ?? null,
      source: "live"
    };
  } catch {
    resolverResult.value = null;
  }
};

const hasCurated = computed(() => rows.value.length > 0);

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">IBC Asset Registry</h1>
      <p class="text-sm text-slate-400 mt-1">
        Curated IBC denoms used on RetroChain, plus a live denom-trace resolver. This helps explorers render symbols/decimals instead of raw
        <code>ibc/&lt;hash&gt;</code> strings.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading IBC asset registry…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load IBC asset registry: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="How to use this">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li><strong>Curated</strong> entries are “known good” and can be extended as new routes get adopted.</li>
        <li><strong>Live resolver</strong> queries <code>/ibc/apps/transfer/v1/denom_traces/&lt;hash&gt;</code> for any hash.</li>
        <li>Symbols/decimals/icons are pulled from the explorer’s token metadata mapping when available.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="card">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-100">Live resolver</h2>
          <p class="text-[11px] text-slate-500">REST: <code>/ibc/apps/transfer/v1/denom_traces/&lt;hash&gt;</code></p>
        </div>
        <button class="btn text-xs" @click="resolve">Resolve</button>
      </div>

      <div class="mt-3 flex flex-col sm:flex-row gap-2">
        <input
          v-model="resolverHash"
          type="text"
          class="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono"
          placeholder="hash (no ibc/ prefix)"
        />
        <button class="btn btn-primary" @click="resolve">Resolve hash</button>
      </div>

      <div class="mt-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
        <div v-if="resolverResult" class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wider">Denom</div>
            <div class="font-mono text-xs text-slate-200">{{ resolverResult.denom }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wider">Base denom</div>
            <div class="font-mono text-xs text-slate-200">{{ resolverResult.baseDenom ?? '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wider">Path</div>
            <div class="font-mono text-xs text-slate-200">{{ resolverResult.path ?? '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500 uppercase tracking-wider">Metadata</div>
            <div class="text-xs text-slate-200">
              <span v-if="resolverResult.icon" class="mr-1">{{ resolverResult.icon }}</span>
              <span>{{ resolverResult.symbol ?? 'Unknown' }}</span>
              <span v-if="resolverResult.decimals !== null" class="text-slate-400"> · {{ resolverResult.decimals }} decimals</span>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-slate-400">No result yet (or endpoint unsupported / hash unknown).</div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-slate-100">Curated entries</h2>
        <button class="btn text-xs" @click="load">Refresh</button>
      </div>

      <div v-if="!hasCurated" class="text-sm text-slate-400 mt-3">No curated entries yet.</div>

      <div v-else class="overflow-x-auto mt-3">
        <table class="table">
          <thead>
            <tr class="text-xs text-slate-400">
              <th>Asset</th>
              <th>Denom</th>
              <th>Base denom</th>
              <th>Path</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.denom" class="hover:bg-white/5">
              <td class="text-sm text-slate-200">
                <span v-if="row.icon" class="mr-1">{{ row.icon }}</span>
                <span class="font-semibold">{{ row.symbol ?? 'Unknown' }}</span>
                <span v-if="row.decimals !== null" class="text-xs text-slate-500"> ({{ row.decimals }}d)</span>
              </td>
              <td class="font-mono text-xs text-slate-300">{{ row.denom }}</td>
              <td class="font-mono text-xs text-slate-300">{{ row.baseDenom ?? '—' }}</td>
              <td class="font-mono text-[11px] text-slate-500">{{ row.path ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-3 text-[11px] text-slate-500">
        Tip: to add more curated assets, extend the <code>curated</code> array in <code>DocsIbcAssetRegistryView.vue</code> (and add
        metadata in <code>src/constants/tokens.ts</code> for icons/decimals).
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query ibc-transfer denom-trace &lt;hash&gt;
retrochaind query bank balances &lt;address&gt;
retrochaind query bank supply</code></pre>
    </div>
  </div>
</template>
