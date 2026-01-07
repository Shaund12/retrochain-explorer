<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(false);
const error = ref<string | null>(null);
const nodeInfo = ref<any | null>(null);
const appVersion = ref<any | null>(null);
const latestBlock = ref<any | null>(null);
const syncing = ref<boolean | null>(null);
const raw = ref<any | null>(null);

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const [nodeRes, blockRes, syncRes] = await Promise.all([
      api.get(`/cosmos/base/tendermint/v1beta1/node_info`),
      api.get(`/cosmos/base/tendermint/v1beta1/blocks/latest`),
      api.get(`/cosmos/base/tendermint/v1beta1/syncing`).catch(() => null)
    ]);

    nodeInfo.value = nodeRes.data?.default_node_info ?? null;
    appVersion.value = nodeRes.data?.application_version ?? null;
    latestBlock.value = blockRes.data?.block ?? null;
    syncing.value = syncRes ? Boolean(syncRes.data?.syncing) : null;
    raw.value = nodeRes.data ?? null;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);

const latestHeight = computed(() => {
  const h = latestBlock.value?.header?.height;
  return h ? Number(h) : null;
});

const latestTime = computed(() => latestBlock.value?.header?.time ?? null);
const chainId = computed(() => nodeInfo.value?.network ?? null);
const moniker = computed(() => nodeInfo.value?.moniker ?? "—");
const listenAddr = computed(() => nodeInfo.value?.listen_addr ?? "—");
const rpcAddr = computed(() => nodeInfo.value?.rpc_address ?? "—");
const nodeId = computed(() => nodeInfo.value?.default_node_id ?? "—");
const protocolVersion = computed(() => nodeInfo.value?.protocol_version ?? null);
const appName = computed(() => appVersion.value?.name ?? "—");
const appVer = computed(() => appVersion.value?.version ?? "—");
const git = computed(() => appVersion.value?.build_tags || appVersion.value?.git_commit || "");
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/15 via-indigo-600/15 to-cyan-500/15 blur-3xl"></div>
      <div class="relative flex flex-col gap-2">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <RouterLink to="/" class="text-emerald-200 hover:underline">Home</RouterLink>
          <span class="text-slate-500">/</span>
          <span>Node Info</span>
        </div>
        <h1 class="text-3xl font-bold text-white">Node Info</h1>
        <p class="text-sm text-slate-300">REST-backed status from /cosmos/base/tendermint/v1beta1/*</p>
      </div>
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Node info unavailable">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading node info…" />
    </div>

    <template v-else>
      <div class="grid gap-3 md:grid-cols-3">
        <div class="card border border-emerald-400/40 bg-emerald-500/5">
          <p class="text-[11px] uppercase tracking-wider text-emerald-200">Chain ID</p>
          <p class="text-xl font-bold text-white">{{ chainId || '—' }}</p>
          <p class="text-[11px] text-emerald-200/70">Moniker: {{ moniker }}</p>
        </div>
        <div class="card border border-cyan-400/40 bg-cyan-500/5">
          <p class="text-[11px] uppercase tracking-wider text-cyan-200">Latest Block</p>
          <p class="text-xl font-bold text-white">{{ latestHeight || '—' }}</p>
          <p class="text-[11px] text-cyan-200/70">{{ latestTime || '—' }}</p>
        </div>
        <div class="card border border-amber-400/40 bg-amber-500/5">
          <p class="text-[11px] uppercase tracking-wider text-amber-200">Syncing</p>
          <p class="text-xl font-bold text-white">{{ syncing === null ? '—' : (syncing ? 'Yes' : 'No') }}</p>
          <p class="text-[11px] text-amber-200/70">From /syncing</p>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Node</h2>
          <span class="text-[11px] text-slate-400">default_node_info</span>
        </div>
        <div class="grid gap-3 md:grid-cols-2 text-sm text-slate-200">
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Moniker</div>
            <div class="font-semibold">{{ moniker }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Node ID</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ nodeId }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Listen</div>
            <div class="font-mono text-xs text-slate-200 break-all">{{ listenAddr }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">RPC</div>
            <div class="font-mono text-xs text-slate-200 break-all">{{ rpcAddr }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Protocol Version</div>
            <div class="font-mono text-xs text-slate-200 break-all">{{ protocolVersion ? JSON.stringify(protocolVersion) : '—' }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-wider text-slate-400">App Version</div>
            <div class="font-mono text-xs text-emerald-200 break-all">{{ appName }} {{ appVer }}</div>
            <div class="text-[10px] text-slate-500 break-all" v-if="git">{{ git }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Latest Block Header</h2>
          <span class="text-[11px] text-slate-400">from /blocks/latest</span>
        </div>
        <div class="overflow-x-auto text-xs text-slate-200">
          <pre class="bg-slate-900/70 p-3 rounded-lg border border-slate-800 overflow-auto">{{ JSON.stringify(latestBlock?.header || latestBlock || {}, null, 2) }}</pre>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Raw Node Info</h2>
          <span class="text-[11px] text-slate-400">from /node_info</span>
        </div>
        <div class="overflow-x-auto text-xs text-slate-200">
          <pre class="bg-slate-900/70 p-3 rounded-lg border border-slate-800 overflow-auto">{{ JSON.stringify(raw || {}, null, 2) }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>
