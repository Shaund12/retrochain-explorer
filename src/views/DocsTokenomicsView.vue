<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const dataHeight = ref<string | null>(null);

const supplyUretro = ref<string | null>(null);
const inflation = ref<string | null>(null);
const annualProvisions = ref<string | null>(null);
const mintParams = ref<Record<string, any> | null>(null);
const stakingParams = ref<Record<string, any> | null>(null);
const distributionParams = ref<Record<string, any> | null>(null);
const slashingParams = ref<Record<string, any> | null>(null);
const burnParams = ref<Record<string, any> | null>(null);

const GENESIS_SUPPLY_RETRO = 100_000_000;

const retroFromUretro = (amount?: string | number | null) => {
  if (amount === null || amount === undefined) return null;
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000;
};

const burnFeeRateDisplay = computed(() => {
  const raw = burnParams.value?.fee_burn_rate;
  return raw === null || raw === undefined ? "—" : fmtPercent(raw);
});

const burnProvisionRateDisplay = computed(() => {
  const raw = burnParams.value?.provision_burn_rate;
  return raw === null || raw === undefined ? "—" : fmtPercent(raw);
});

const fmt = (value: number | null | undefined, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const fmtPercent = (value?: string | number | null, digits = 2) => {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
};

const currentSupplyRetro = computed(() => retroFromUretro(supplyUretro.value));
const netMintedRetro = computed(() => {
  if (currentSupplyRetro.value === null) return null;
  return currentSupplyRetro.value - GENESIS_SUPPLY_RETRO;
});

const unbondingTimeDisplay = computed(() => {
  const raw = stakingParams.value?.unbonding_time ?? stakingParams.value?.unbondingTime;
  if (typeof raw !== "string") return "—";
  if (!raw.endsWith("s")) return raw;
  const seconds = Number(raw.slice(0, -1));
  if (!Number.isFinite(seconds)) return raw;
  const days = seconds / 86400;
  return `${days.toFixed(days >= 10 ? 0 : 1)} days (${raw})`;
});

const fetchAll = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, supplyRes, inflationRes, annualRes, mintRes, stakingRes, distRes, slashRes, burnRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/bank/v1beta1/supply/by_denom", { params: { denom: "uretro" } }).catch(() => null),
      api.get("/cosmos/mint/v1beta1/inflation").catch(() => null),
      api.get("/cosmos/mint/v1beta1/annual_provisions").catch(() => null),
      api.get("/cosmos/mint/v1beta1/params").catch(() => null),
      api.get("/cosmos/staking/v1beta1/params").catch(() => null),
      api.get("/cosmos/distribution/v1beta1/params").catch(() => null),
      api.get("/cosmos/slashing/v1beta1/params").catch(() => null),
      api.get("/cosmos/burn/v1beta1/params").catch(() => null)
    ]);

    dataHeight.value = latest?.data?.block?.header?.height ?? null;

    // bank supply endpoint returns: { amount: { denom, amount } }
    const supplyAmt = supplyRes?.data?.amount?.amount;
    supplyUretro.value = typeof supplyAmt === "string" ? supplyAmt : null;

    inflation.value = inflationRes?.data?.inflation ?? null;
    annualProvisions.value = annualRes?.data?.annual_provisions ?? null;
    mintParams.value = mintRes?.data?.params ?? null;
    stakingParams.value = stakingRes?.data?.params ?? null;
    distributionParams.value = distRes?.data?.params ?? null;
    slashingParams.value = slashRes?.data?.params ?? null;
    burnParams.value = burnRes?.data?.params ?? null;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Tokenomics (RETRO)</h1>
      <p class="text-sm text-slate-400 mt-1">
        Token economics as implemented/configured in this explorer. Live network responses are authoritative.
      </p>
      <div v-if="dataHeight" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ dataHeight }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading tokenomics from REST endpoints..." />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load live tokenomics: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Source of truth">
      <ul class="text-xs text-slate-300 list-disc list-inside space-y-1">
        <li>Live network (REST/RPC) is authoritative; this page is a snapshot + live queries.</li>
        <li>Params can change via governance: inflation, burn rates, module enables, etc.</li>
      </ul>
    </RcDisclaimer>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3" v-if="!loading">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Denoms</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Symbol (display): <span class="font-semibold text-slate-100">RETRO</span></div>
          <div>Base denom (on-chain): <code class="text-xs">uretro</code></div>
          <div>Decimals: <span class="font-mono text-slate-200">6</span></div>
          <div class="text-xs text-slate-400">1 RETRO = 1,000,000 uretro</div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Supply</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Genesis supply: <span class="font-semibold text-slate-100">100,000,000 RETRO</span></div>
          <div>Current supply (live): <span class="font-semibold text-emerald-200">{{ fmt(currentSupplyRetro) }} RETRO</span></div>
          <div>Net minted since genesis: <span class="font-semibold text-indigo-200">{{ fmt(netMintedRetro) }} RETRO</span></div>
          <div class="text-[11px] text-slate-500 mt-2">
            REST: <code>/cosmos/bank/v1beta1/supply/by_denom?denom=uretro</code>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Mint & inflation</div>
        <div class="mt-2 space-y-1 text-sm">
          <div>Inflation (live): <span class="font-semibold text-amber-200">{{ fmtPercent(inflation) }}</span></div>
          <div>
            Annual provisions (live):
            <span class="font-semibold text-slate-100">
              {{ fmt(retroFromUretro(annualProvisions)) }} RETRO/yr
            </span>
          </div>
          <div class="text-[11px] text-slate-500 mt-2">
            REST: <code>/cosmos/mint/v1beta1/inflation</code>, <code>/cosmos/mint/v1beta1/annual_provisions</code>
          </div>
        </div>
      </div>
    </div>

    <div class="card" v-if="!loading">
      <h2 class="text-sm font-semibold text-slate-100 mb-3">Staking & security economics</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Staking params</div>
          <div>Bond denom: <code class="text-xs">{{ stakingParams?.bond_denom ?? '—' }}</code></div>
          <div>Unbonding time: <span class="font-semibold text-slate-100">{{ unbondingTimeDisplay }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/staking/v1beta1/params</code></div>
        </div>
        <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Distribution params</div>
          <div>Community tax: <span class="font-semibold text-slate-100">{{ distributionParams?.community_tax ?? '—' }}</span></div>
          <div>Withdraw addr enabled: <span class="font-mono text-slate-200">{{ distributionParams?.withdraw_addr_enabled ?? '—' }}</span></div>
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
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Burn (x/burn)</div>
          <div>Fee burn rate: <span class="font-semibold text-slate-100">{{ burnFeeRateDisplay }}</span></div>
          <div>Provision burn rate: <span class="font-semibold text-slate-100">{{ burnProvisionRateDisplay }}</span></div>
          <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/burn/v1beta1/params</code></div>
        </div>
      </div>
    </div>

    <div class="card" v-if="!loading">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query bank supply-by-denom uretro
retrochaind query staking params
retrochaind query mint params
retrochaind query distribution params
retrochaind query gov params</code></pre>
    </div>
  </div>
</template>
