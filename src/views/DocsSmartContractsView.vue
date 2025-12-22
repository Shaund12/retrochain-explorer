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

const sampleCodeId = ref<string>("1");
const codeInfo = ref<any | null>(null);

const fetchLatestHeight = async () => {
  const latest = await api.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
  height.value = latest?.data?.block?.header?.height ?? null;
};

const fetchCodeInfo = async () => {
  codeInfo.value = null;
  try {
    const res = await api.get(`/cosmwasm/wasm/v1/code/${sampleCodeId.value}`);
    codeInfo.value = res.data?.code_info ?? null;
  } catch {
    codeInfo.value = null;
  }
};

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([fetchLatestHeight(), fetchCodeInfo()]);
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
      <h1 class="text-xl font-bold text-slate-50">Smart Contracts (CosmWasm)</h1>
      <p class="text-sm text-slate-400 mt-1">
        How CosmWasm contracts show up on RetroChain and which endpoints explorers should query.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading smart contracts docs…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load smart contracts docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Core concepts">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li><strong>Code</strong> = uploaded wasm bytecode, identified by <code>code_id</code>.</li>
        <li><strong>Contract</strong> = an instantiated address from a <code>code_id</code>.</li>
        <li><strong>Query</strong> = read-only call to contract state (smart query).</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Explorer endpoints</div>
        <ul class="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          <li><code>GET /cosmwasm/wasm/v1/code</code> (list code infos)</li>
          <li><code>GET /cosmwasm/wasm/v1/code/&lt;codeId&gt;</code> (code info)</li>
          <li><code>GET /cosmwasm/wasm/v1/code/&lt;codeId&gt;/contracts</code> (contracts for code)</li>
          <li><code>GET /cosmwasm/wasm/v1/contract/&lt;addr&gt;</code> (contract info)</li>
          <li><code>GET /cosmwasm/wasm/v1/contract/&lt;addr&gt;/smart/&lt;base64(json)&gt;</code> (smart query)</li>
        </ul>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Try fetching a code_id</div>
        <div class="mt-2 space-y-2">
          <div class="text-xs text-slate-400">Code ID:</div>
          <div class="flex gap-2">
            <input v-model="sampleCodeId" type="text" class="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono" />
            <button class="btn btn-primary" @click="fetchCodeInfo">Fetch</button>
          </div>

          <div class="mt-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div v-if="codeInfo" class="text-sm text-slate-200 space-y-1">
              <div>Creator: <span class="font-mono text-xs">{{ codeInfo.creator ?? '—' }}</span></div>
              <div>Checksum: <span class="font-mono text-xs">{{ codeInfo.data_hash ?? codeInfo.dataHash ?? '—' }}</span></div>
            </div>
            <div v-else class="text-sm text-slate-400">No code info found (or CosmWasm not enabled).</div>
          </div>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Explorer recommendations</div>
        <ul class="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          <li>Show <code>code_id</code> and <code>creator</code> prominently.</li>
          <li>Provide common smart queries (e.g. CW20: <code>{ token_info: {} }</code>).</li>
          <li>Handle missing CosmWasm endpoints gracefully (404/501) depending on node build.</li>
        </ul>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query wasm list-code
retrochaind query wasm code-info &lt;code-id&gt;
retrochaind query wasm contract &lt;contract-address&gt;</code></pre>
    </div>
  </div>
</template>
