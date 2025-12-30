<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useToast } from "@/composables/useToast";
import { useBlocks } from "@/composables/useBlocks";
import { useApi } from "@/composables/useApi";
import { useValidators, type ValidatorWithVotingPower } from "@/composables/useValidators";
import { decodeConsensusAddress } from "@/utils/consensus";
import { getAccountLabel } from "@/constants/accountLabels";
import dayjs from "dayjs";

const route = useRoute();
const router = useRouter();
const { copyToClipboard, shareLink, notify } = useToast();
const { fetchByHeight } = useBlocks();
const api = useApi();
const {
  validators,
  fetchValidators: fetchValidatorsList,
  loading: validatorsLoading
} = useValidators();

const loading = ref(false);
const error = ref<string | null>(null);
const block = ref<any | null>(null);
const commit = ref<any | null>(null);
const blockTxs = ref<any[]>([]);

const height = ref<number>(Number(route.params.height || 0));

// Derived header fields
const header = computed(() => block.value?.header ?? {});
const txCount = computed(() => block.value?.data?.txs?.length ?? 0);
const blockHash = computed(() => commit.value?.hash ?? "—");
const proposerAddressRaw = computed(() => header.value.proposer_address ?? "—");
const proposerConsensusHex = computed(() => decodeConsensusAddress(header.value.proposer_address));
const validatorByConsensus = computed(() => {
  const map = new Map<string, ValidatorWithVotingPower>();
  validators.value.forEach((v) => {
    if (v.consensusAddressHex) {
      map.set(v.consensusAddressHex, v);
    }
  });
  return map;
});
const proposerValidator = computed(() => {
  const hex = proposerConsensusHex.value;
  if (!hex) return null;
  return validatorByConsensus.value.get(hex) ?? null;
});
const proposerLabel = computed(() => getAccountLabel(proposerValidator.value?.operatorAddress ?? null));
const proposerDisplayName = computed(() => proposerLabel.value?.label || proposerValidator.value?.description?.moniker || "Unknown proposer");
const proposerOperatorAddress = computed(() => proposerValidator.value?.operatorAddress ?? null);
const time = computed(() => header.value.time ?? "—");
const base64Txs = computed(() => (block.value?.data?.txs as string[]) || []);
const prettyTime = computed(() => (time.value && time.value !== "—" ? dayjs(time.value).format("YYYY-MM-DD HH:mm:ss") : "—"));
const relativeTime = computed(() => (time.value && time.value !== "—" ? dayjs(time.value).fromNow() : ""));

const copy = async (text: string) => copyToClipboard(text, "Copied");

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString();
};

const formatPercent = (value?: number | null, digits = 1) => {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
};

const gasStats = computed(() => {
  if (!blockTxs.value.length) {
    return { used: null as number | null, wanted: null as number | null, utilization: null as number | null };
  }
  const totals = blockTxs.value.reduce(
    (acc, tx) => {
      acc.used += Number(tx.gas_used ?? 0);
      acc.wanted += Number(tx.gas_wanted ?? 0);
      return acc;
    },
    { used: 0, wanted: 0 }
  );
  return {
    used: totals.used,
    wanted: totals.wanted,
    utilization: totals.wanted > 0 ? totals.used / totals.wanted : null
  };
});

// Compute fallback tx hashes from base64 (when tx_responses not available)
const fallbackTxs = ref<{ hash: string; raw: string }[]>([]);
async function computeFallbackHashes(list: string[]) {
  const result: { hash: string; raw: string }[] = [];
  for (const raw of list) {
    try {
      const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      result.push({ hash: hex, raw });
    } catch {
      result.push({ hash: "", raw });
    }
  }
  fallbackTxs.value = result;
}

// Navigation helpers
const goToHeight = (h: number) => {
  if (h <= 0 || loading.value) return;
  router.push({ name: "block-detail", params: { height: h } });
};

const loadBlock = async () => {
  if (!height.value || Number.isNaN(height.value)) {
    error.value = "Invalid block height.";
    return;
  }

  loading.value = true;
  error.value = null;
  block.value = null;
  commit.value = null;
  blockTxs.value = [];

  try {
    const res = await fetchByHeight(height.value);
    block.value = res.block;
    commit.value = res.block_id;

    // Fetch tx hashes for this height
    try {
      const txRes = await api.get(`/cosmos/tx/v1beta1/txs`, {
        params: { events: `tx.height='${height.value}'`, order_by: "ORDER_BY_ASC", "pagination.limit": 100 }
      });
      blockTxs.value = txRes.data?.tx_responses || [];
    } catch (e) {
      blockTxs.value = [];
    }

    if (!blockTxs.value.length && (block.value?.data?.txs?.length || 0) > 0) {
      await computeFallbackHashes(block.value.data.txs as string[]);
    } else {
      fallbackTxs.value = [];
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    error.value = msg;
    notify(`Failed to load block #${height.value}: ${msg}`);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchValidatorsList();
  loadBlock();
});

// React when route param changes but component instance stays
watch(
  () => route.params.height,
  (val) => {
    height.value = Number(val || 0);
    loadBlock();
  }
);
</script>

<template>
  <div class="grid gap-3 grid-cols-1 lg:grid-cols-2">
    <!-- Summary / meta card -->
    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h1 class="text-sm font-semibold text-slate-100">
            Block #{{ height }}
          </h1>
          <p class="text-xs text-slate-400">
            RetroChain block details
          </p>
        </div>

        <div class="flex items-center gap-2">
          <RcIconButton
            variant="ghost"
            size="sm"
            title="Previous"
            :disabled="height <= 1 || loading"
            @click="goToHeight(height - 1)"
          >
            <ChevronLeft class="h-4 w-4" />
          </RcIconButton>
          <RcIconButton
            variant="ghost"
            size="sm"
            title="Next"
            :disabled="loading"
            @click="goToHeight(height + 1)"
          >
            <ChevronRight class="h-4 w-4" />
          </RcIconButton>
        </div>
      </div>

      <div v-if="loading" class="text-xs text-slate-400 mb-2">
        Loading block from node…
      </div>

      <div v-if="error" class="mb-2 text-xs text-rose-300">
        {{ error }}
      </div>

      <div
        v-if="block"
        class="mt-2 text-xs text-slate-200 space-y-2 border-t border-slate-800 pt-2"
      >
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Block hash
            </div>
            <div class="flex items-center gap-2">
              <code class="text-[11px] break-all">{{ blockHash }}</code>
              <RcIconButton variant="ghost" size="xs" title="Copy hash" @click="copy(blockHash)">
                <Copy class="h-3.5 w-3.5" />
              </RcIconButton>
              <RcIconButton variant="ghost" size="xs" title="Share" @click="shareLink()">
                <Share2 class="h-3.5 w-3.5" />
              </RcIconButton>
            </div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Time
            </div>
            <div class="flex items-center gap-2">
              <span>{{ prettyTime }}</span>
              <span class="text-slate-400">{{ relativeTime }}</span>
            </div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Proposer
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span v-if="proposerLabel?.icon" class="text-2xl leading-none">{{ proposerLabel.icon }}</span>
                  <div>
                    <div class="text-sm font-semibold text-white">{{ proposerDisplayName }}</div>
                    <div v-if="proposerOperatorAddress" class="text-[11px] text-slate-400 font-mono">
                      {{ proposerOperatorAddress }}
                    </div>
                    <div v-if="proposerConsensusHex" class="text-[11px] text-slate-500 font-mono">
                      cons {{ proposerConsensusHex }}
                    </div>
                  </div>
                </div>
                <span v-if="validatorsLoading" class="text-[10px] text-slate-500">syncing…</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="text-[11px] break-all flex-1">{{ proposerAddressRaw }}</code>
                <RcIconButton variant="ghost" size="xs" title="Copy proposer" @click="copy(proposerAddressRaw)">
                  <Copy class="h-3.5 w-3.5" />
                </RcIconButton>
              </div>
            </div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Tx count
            </div>

        <div class="mt-3 border-t border-slate-800 pt-3">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Gas utilization
              </div>
              <div class="text-lg font-semibold text-white">
                {{ gasStats.utilization !== null ? formatPercent(gasStats.utilization) : "—" }}
              </div>
            </div>
            <div class="text-right text-xs text-slate-400">
              {{ formatNumber(gasStats.used) }} used / {{ formatNumber(gasStats.wanted) }} wanted
            </div>
          </div>
          <div class="h-2 bg-slate-900 rounded overflow-hidden mt-2">
            <div
              v-if="gasStats.utilization !== null"
              class="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              :style="{ width: `${Math.min(100, gasStats.utilization * 100).toFixed(1)}%` }"
            ></div>
          </div>
          <p v-if="gasStats.utilization === null" class="text-[11px] text-slate-500 mt-1">
            Gas stats unavailable for this block.
          </p>
        </div>
            <div>
              <span class="badge">{{ txCount }} tx</span>
            </div>
          </div>
        </div>

        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Chain ID
            </div>
            <div>{{ header.chain_id || "—" }}</div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              App hash
            </div>
            <code class="text-[11px] break-all">
              {{ header.app_hash || "—" }}
            </code>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Last block ID hash
            </div>
            <code class="text-[11px] break-all">
              {{ header.last_block_id?.hash || "—" }}
            </code>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Version
            </div>
            <div>
              {{ header.version?.block || "—" }} /
              {{ header.version?.app || "—" }}
            </div>
          </div>
        </div>

        <div class="mt-3">
          <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Header JSON
          </div>
          <pre
            class="mt-1 p-2 rounded bg-slate-900/80 overflow-x-auto max-h-72"
          >{{ JSON.stringify(header, null, 2) }}</pre>
        </div>

        <div class="mt-3" v-if="base64Txs.length || blockTxs.length">
          <div class="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-2">
            Transactions ({{ blockTxs.length || base64Txs.length }})
          </div>
          <div class="space-y-2">
            <div v-for="(t, i) in blockTxs" :key="t.txhash || i" class="p-2 rounded bg-slate-900/60 border border-slate-700">
              <div class="text-[11px] text-slate-400 mb-1">Tx #{{ i + 1 }}</div>
              <div class="flex items-center justify-between gap-2">
                <code class="text-[11px] break-all">{{ t.txhash }}</code>
                <router-link class="btn text-[10px]" :to="{ name: 'tx-detail', params: { hash: t.txhash } }">Details</router-link>
              </div>
              <div class="mt-1 text-xs text-slate-300">
                <span class="badge" :class="t.code === 0 ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'">code {{ t.code ?? 0 }}</span>
                <span class="ml-2">height {{ t.height }}</span>
                <span class="ml-2">gas {{ t.gas_used || '-' }}/{{ t.gas_wanted || '-' }}</span>
              </div>
            </div>

            <!-- Fallback: show base64 when tx_responses unavailable -->
            <div v-if="!blockTxs.length" v-for="(f, i) in fallbackTxs" :key="i" class="p-2 rounded bg-slate-900/60 border border-slate-700">
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs text-slate-300">Tx {{ i + 1 }} (base64)</div>
                <div class="flex items-center gap-2">
                  <router-link v-if="f.hash" class="btn text-[10px]" :to="{ name: 'tx-detail', params: { hash: f.hash } }">Details</router-link>
                  <button class="btn text-[10px]" @click="copy(f.raw)">Copy</button>
                </div>
              </div>
              <details class="mt-1 text-[11px] text-slate-300">
                <summary class="cursor-pointer text-cyan-300">View base64</summary>
                <pre class="mt-1 p-2 bg-slate-900/80 overflow-x-auto">{{ f.raw }}</pre>
              </details>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!loading && !error" class="text-xs text-slate-400 mt-2">
        No block data yet for this height.
      </div>
    </div>

    <!-- Raw block JSON -->
    <div class="card">
      <h2 class="text-sm font-semibold mb-2 text-slate-100">Raw block</h2>
      <div v-if="block" class="text-xs">
        <pre
          class="p-2 rounded bg-slate-900/80 overflow-x-auto max-h-[420px]"
        >{{ JSON.stringify(block, null, 2) }}</pre>
      </div>
      <div v-else-if="loading" class="text-xs text-slate-400">
        Fetching raw block…
      </div>
      <div v-else class="text-xs text-slate-400">
        No block data yet.
      </div>
    </div>
  </div>
</template>
