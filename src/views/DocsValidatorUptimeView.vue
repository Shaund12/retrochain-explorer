<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import RcDocsPager from "@/components/RcDocsPager.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const slashingParams = ref<Record<string, any> | null>(null);

const valcons = ref<string>("");
const signingInfo = ref<any | null>(null);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, slashRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/slashing/v1beta1/params").catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    slashingParams.value = slashRes?.data?.params ?? null;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

const fetchSigningInfo = async () => {
  const key = valcons.value.trim();
  if (!key) {
    signingInfo.value = null;
    return;
  }

  try {
    const res = await api.get(`/cosmos/slashing/v1beta1/signing_infos/${encodeURIComponent(key)}`);
    signingInfo.value = res.data?.val_signing_info ?? res.data?.valSigningInfo ?? null;
  } catch {
    signingInfo.value = null;
  }
};

const signedBlocksWindow = computed(() => slashingParams.value?.signed_blocks_window ?? "");
const minSignedPerWindow = computed(() => slashingParams.value?.min_signed_per_window ?? "");
const downtimeJailDuration = computed(() => slashingParams.value?.downtime_jail_duration ?? "");

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />

    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Validator Uptime</h1>
      <p class="text-sm text-slate-400 mt-1">
        How explorers can estimate validator liveness using missed blocks and signing info.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading validator uptime docs" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load slashing params: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="What uptime means on Cosmos">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>Uptime is often derived from <strong>missed blocks</strong> within a <code>signed_blocks_window</code>.</li>
        <li>Slashing/jailing is enforced by the slashing module based on the same window and thresholds.</li>
        <li>Explorers should label this as an <em>estimate</em> and explain the window.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Slashing params (live)</div>
        <div class="mt-2 space-y-1 text-sm text-slate-300">
          <div>Signed blocks window: <span class="font-mono text-slate-200">{{ signedBlocksWindow }}</span></div>
          <div>Min signed per window: <span class="font-mono text-slate-200">{{ minSignedPerWindow }}</span></div>
          <div>Downtime jail duration: <span class="font-mono text-slate-200">{{ downtimeJailDuration }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/slashing/v1beta1/params</code></div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Query signing info</div>
        <p class="text-[11px] text-slate-500 mt-1">Provide a valcons address (consensus bech32).</p>

        <div class="mt-2 flex gap-2">
          <input
            v-model="valcons"
            type="text"
            placeholder="cosmosvalcons1..."
            class="flex-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono"
          />
          <button class="btn btn-primary" @click="fetchSigningInfo">Fetch</button>
        </div>

        <div class="mt-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div v-if="signingInfo" class="text-sm text-slate-200 space-y-1">
            <div>Missed blocks counter: <span class="font-mono">{{ signingInfo.missed_blocks_counter ?? '' }}</span></div>
            <div>Index offset: <span class="font-mono">{{ signingInfo.index_offset ?? '' }}</span></div>
            <div>Jailed until: <span class="font-mono">{{ signingInfo.jailed_until ?? '' }}</span></div>
            <div class="text-[11px] text-slate-500 mt-2">
              REST: <code>/cosmos/slashing/v1beta1/signing_infos/&lt;valcons&gt;</code>
            </div>
          </div>
          <div v-else class="text-sm text-slate-400">No signing info loaded.</div>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Explorer recommendations</div>
        <ul class="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          <li>Compute an uptime percentage over the window: <code>1 - missed_blocks_counter / signed_blocks_window</code>.</li>
          <li>Surface <code>jailed_until</code> as a countdown and label it as slashing-module state.</li>
          <li>When mapping to operators, link valcons ? valoper via staking validator endpoints.</li>
        </ul>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query slashing params
retrochaind query slashing signing-info &lt;valcons&gt;
retrochaind query staking validators --limit 25</code></pre>
    </div>

    <RcDocsPager />
  </div>
</template>
