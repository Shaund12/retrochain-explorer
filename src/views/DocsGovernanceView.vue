<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const depositParams = ref<Record<string, any> | null>(null);
const votingParams = ref<Record<string, any> | null>(null);
const tallyParams = ref<Record<string, any> | null>(null);

const fmtAmount = (amount: string) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return (n / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 6 });
};

const minDepositRetro = computed(() => {
  const deposits: Array<{ denom: string; amount: string }> | undefined =
    depositParams.value?.min_deposit ?? depositParams.value?.minDeposit;
  if (!deposits || !deposits.length) return "—";
  const entry = deposits.find((d) => d.denom === "uretro") || deposits[0];
  if (!entry?.amount) return "—";
  return `${fmtAmount(entry.amount)} RETRO`;
});

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, depRes, voteRes, talRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/gov/v1/params/deposit").catch(() => null),
      api.get("/cosmos/gov/v1/params/voting").catch(() => null),
      api.get("/cosmos/gov/v1/params/tallying").catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    depositParams.value = depRes?.data?.deposit_params ?? null;
    votingParams.value = voteRes?.data?.voting_params ?? null;
    tallyParams.value = talRes?.data?.tally_params ?? null;
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
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Governance Guide</h1>
      <p class="text-sm text-slate-400 mt-1">
        Proposal lifecycle and how to verify governance economics via live REST endpoints.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading governance docs…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load governance docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Governance economics">
      <p class="text-sm text-slate-300">
        On Cosmos chains, governance requires a deposit to enter voting. Deposit thresholds and voting windows are live parameters that can
        change via governance.
      </p>
    </RcDisclaimer>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Proposal lifecycle</h2>
      <ol class="list-decimal list-inside text-sm text-slate-300 space-y-1">
        <li><strong>Deposit period</strong>: proposal collects deposits until it meets the minimum.</li>
        <li><strong>Voting period</strong>: validators/delegators vote (Yes/No/NoWithVeto/Abstain).</li>
        <li><strong>Tally</strong>: quorum/threshold/veto rules decide pass/fail.</li>
      </ol>
    </div>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Deposit params</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Min deposit: <span class="font-semibold text-slate-100">{{ minDepositRetro }}</span></div>
          <div>Max deposit period: <span class="font-mono text-slate-200">{{ depositParams?.max_deposit_period ?? '—' }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/gov/v1/params/deposit</code></div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Voting params</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Voting period: <span class="font-mono text-slate-200">{{ votingParams?.voting_period ?? '—' }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/gov/v1/params/voting</code></div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Tally params</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Quorum: <span class="font-mono text-slate-200">{{ tallyParams?.quorum ?? '—' }}</span></div>
          <div>Threshold: <span class="font-mono text-slate-200">{{ tallyParams?.threshold ?? '—' }}</span></div>
          <div>Veto threshold: <span class="font-mono text-slate-200">{{ tallyParams?.veto_threshold ?? '—' }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/gov/v1/params/tallying</code></div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query gov params
retrochaind query gov proposals --reverse
retrochaind query gov proposal &lt;id&gt;</code></pre>
    </div>
  </div>
</template>
