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

const stakingParams = ref<Record<string, any> | null>(null);
const distributionParams = ref<Record<string, any> | null>(null);
const slashingParams = ref<Record<string, any> | null>(null);

const formatDuration = (duration?: string | null) => {
  if (!duration) return "—";
  if (!duration.endsWith("s")) return duration;
  const seconds = Number(duration.slice(0, -1));
  if (!Number.isFinite(seconds)) return duration;
  const days = seconds / 86400;
  if (days >= 1) return `${days.toFixed(days >= 10 ? 0 : 1)} days (${duration})`;
  const hours = seconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)} hours (${duration})`;
  return `${seconds}s`;
};

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, stakingRes, distRes, slashRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/staking/v1beta1/params").catch(() => null),
      api.get("/cosmos/distribution/v1beta1/params").catch(() => null),
      api.get("/cosmos/slashing/v1beta1/params").catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    stakingParams.value = stakingRes?.data?.params ?? null;
    distributionParams.value = distRes?.data?.params ?? null;
    slashingParams.value = slashRes?.data?.params ?? null;
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
      <h1 class="text-xl font-bold text-slate-50">Staking Guide</h1>
      <p class="text-sm text-slate-400 mt-1">
        How delegation works on RetroChain (RETRO), what to expect during unbonding, and how to verify economics.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading staking docs…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load staking docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="warning" title="Risks">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>Unbonding is not instant. During unbonding, tokens do not earn staking rewards.</li>
        <li>Validators can be jailed/slashed for downtime or double-signing (see slashing params).</li>
        <li>APRs change as bonded ratio, inflation, and burn/community tax params change.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">Core actions</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Delegate</div>
          <p class="text-slate-300">
            Stake <code>uretro</code> to a validator to secure the chain and earn rewards.
          </p>
          <div class="text-[11px] text-slate-500 mt-2">Msg: <code>/cosmos.staking.v1beta1.MsgDelegate</code></div>
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Undelegate</div>
          <p class="text-slate-300">
            Start unbonding. Tokens unlock after the unbonding period.
          </p>
          <div class="text-[11px] text-slate-500 mt-2">Msg: <code>/cosmos.staking.v1beta1.MsgUndelegate</code></div>
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Claim rewards</div>
          <p class="text-slate-300">
            Withdraw accumulated rewards per validator.
          </p>
          <div class="text-[11px] text-slate-500 mt-2">Msg: <code>/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward</code></div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-3">Live parameters</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Staking params</div>
          <div>Bond denom: <code class="text-xs">{{ stakingParams?.bond_denom ?? '—' }}</code></div>
          <div>Unbonding time: <span class="font-semibold text-slate-100">{{ formatDuration(stakingParams?.unbonding_time ?? null) }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/staking/v1beta1/params</code></div>
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Distribution params</div>
          <div>Community tax: <span class="font-mono text-slate-200">{{ distributionParams?.community_tax ?? '—' }}</span></div>
          <div>Withdraw enabled: <span class="font-mono text-slate-200">{{ distributionParams?.withdraw_addr_enabled ?? '—' }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/distribution/v1beta1/params</code></div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Slashing params</div>
          <div>Signed blocks window: <span class="font-mono text-slate-200">{{ slashingParams?.signed_blocks_window ?? '—' }}</span></div>
          <div>Min signed per window: <span class="font-mono text-slate-200">{{ slashingParams?.min_signed_per_window ?? '—' }}</span></div>
          <div>Downtime jail: <span class="font-mono text-slate-200">{{ slashingParams?.downtime_jail_duration ?? '—' }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/slashing/v1beta1/params</code></div>
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Explorer notes</div>
          <ul class="list-disc list-inside text-sm text-slate-300 space-y-1">
            <li>APR is derived; there is no single canonical “APR endpoint”.</li>
            <li>Commission reduces delegator rewards (per validator).</li>
            <li>Burn/community tax reduce effective yield chain-wide.</li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query staking params
retrochaind query distribution params
retrochaind query slashing params
retrochaind query staking delegations &lt;delegator-address&gt;</code></pre>
    </div>
  </div>
</template>
