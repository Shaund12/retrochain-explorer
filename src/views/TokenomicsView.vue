<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

interface LatestBlockInfo {
  height: string;
  time: string;
}

const api = useApi();
const BURN_SINK_ADDRESS = "cosmos1jv65s3grqf6v6jl3dp4t6c9t9rk99cd88lyufl";
const BURN_TRACK_BLOCKS = 6;

const loading = ref(true);
const errors = ref<string[]>([]);

const latestBlock = ref<LatestBlockInfo | null>(null);
const currentSupply = ref<string | null>(null);
const mintParams = ref<Record<string, any> | null>(null);
const inflation = ref<string | null>(null);
const annualProvisions = ref<string | null>(null);
const stakingParams = ref<Record<string, any> | null>(null);
const distributionParams = ref<Record<string, any> | null>(null);
const burnParams = ref<Record<string, any> | null>(null);
const depositParams = ref<Record<string, any> | null>(null);
const votingParams = ref<Record<string, any> | null>(null);
const tallyParams = ref<Record<string, any> | null>(null);
const arcadeParams = ref<Record<string, any> | null>(null);
const burnSnapshots = ref<{ height: number; balance: number; burned: number | null }[]>([]);
const burnLoading = ref(false);

const copy = async (text: string) => {
  try {
    await navigator.clipboard?.writeText?.(text);
  } catch (err) {
    console.warn("Clipboard unavailable", err);
  }
};

const formatRetro = (
  amount?: string | number | null,
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
) => {
  if (amount === null || amount === undefined) return "—";
  const num = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(num)) return "—";
  const retro = num / 1_000_000;
  return retro.toLocaleString(undefined, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 6
  });
};

const formatPercentFromDecimal = (value?: string | number | null, digits = 2) => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(digits)}%`;
};

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

const netMinted = computed(() => {
  if (!currentSupply.value) return null;
  const current = Number(currentSupply.value) / 1_000_000;
  if (!Number.isFinite(current)) return null;
  return current - 100_000_000;
});

const netMintedDisplay = computed(() => {
  if (netMinted.value === null) return "—";
  const amount = netMinted.value;
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return `${amount >= 0 ? "+" : ""}${formatted} RETRO`;
});

const annualProvisionRetro = computed(() => {
  if (!annualProvisions.value) return null;
  const num = Number(annualProvisions.value) / 1_000_000;
  return Number.isFinite(num) ? num : null;
});

const dailyProvisionRetro = computed(() => {
  if (annualProvisionRetro.value === null) return null;
  return annualProvisionRetro.value / 365;
});

const perBlockProvisionRetro = computed(() => {
  if (annualProvisionRetro.value === null) return null;
  const blocksPerYear = Number(mintParams.value?.blocks_per_year ?? mintParams.value?.blocksPerYear ?? 0);
  if (!blocksPerYear) return null;
  return annualProvisionRetro.value / blocksPerYear;
});

const burnParamsHydrated = computed(() => {
  // Ensure we always have both rates available for display
  const raw = burnParams.value || {};
  return {
    fee_burn_rate: raw.fee_burn_rate ?? raw.feeBurnRate ?? String(DEFAULT_BURN_RATE),
    provision_burn_rate: raw.provision_burn_rate ?? raw.provisionBurnRate ?? String(DEFAULT_BURN_RATE)
  };
});

const DEFAULT_BURN_RATE = 0.008; // 0.8%

const feeBurnRatePercent = computed(() => {
  const raw = burnParams.value?.fee_burn_rate ?? burnParams.value?.feeBurnRate ?? DEFAULT_BURN_RATE;
  const num = Number(raw);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(2)}%`;
});

const provisionBurnRatePercent = computed(() => {
  const raw = burnParams.value?.provision_burn_rate ?? burnParams.value?.provisionBurnRate ?? DEFAULT_BURN_RATE;
  const num = Number(raw);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(2)}%`;
});

const burnAddressMasked = computed(() => maskAddress(BURN_SINK_ADDRESS));

const burnCurrentBalanceDisplay = computed(() => {
  const latest = burnSnapshots.value[0]?.balance;
  if (latest === undefined) return "—";
  return `${formatRetro(latest, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} RETRO`;
});

const burnLastBlockAmount = computed(() => {
  if (burnSnapshots.value.length < 2) return null;
  const previous = burnSnapshots.value[1].balance;
  const current = burnSnapshots.value[0].balance;
  return previous - current;
});

const burnLastBlockDisplay = computed(() => formatRetroSigned(burnLastBlockAmount.value));

const burnRollingWindowAmount = computed(() =>
  burnSnapshots.value.reduce((sum, snap) => {
    if (!snap || snap.burned === null) return sum;
    return sum + Math.max(0, snap.burned);
  }, 0)
);

const burnRollingWindowDisplay = computed(() => {
  if (!burnRollingWindowAmount.value) return "—";
  return `${formatRetro(burnRollingWindowAmount.value, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} RETRO`;
});

const burnHistoryLabel = computed(() =>
  burnSnapshots.value.length ? `Last ${burnSnapshots.value.length} blocks` : "Awaiting burn telemetry"
);

const burnDeltaClass = (amount: number | null) => {
  if (amount === null) return "text-slate-400";
  if (amount > 0) return "text-emerald-300";
  if (amount < 0) return "text-rose-300";
  return "text-slate-400";
};

const runTask = async (label: string, task: () => Promise<void>) => {
  try {
    await task();
  } catch (err) {
    console.error(`Failed to load ${label}`, err);
    errors.value.push(`Failed to load ${label}`);
  }
};

const fetchBurnBalanceAtHeight = async (height: number) => {
  const headers: Record<string, string> = { "x-cosmos-block-height": String(height) };
  const { data } = await api.get(`/cosmos/bank/v1beta1/balances/${BURN_SINK_ADDRESS}`, {
    params: { "pagination.limit": "1000" },
    headers
  });
  const retroBalance = data?.balances?.find((coin: { denom: string }) => coin.denom === "uretro");
  return Number(retroBalance?.amount ?? 0);
};

const loadBurnSnapshots = async (latestHeight: number) => {
  burnLoading.value = true;
  try {
    const heights: number[] = [];
    for (let i = 0; i < BURN_TRACK_BLOCKS; i++) {
      const height = latestHeight - i;
      if (height <= 0) break;
      heights.push(height);
    }
    const snapshots: { height: number; balance: number }[] = [];
    for (const height of heights) {
      try {
        const balance = await fetchBurnBalanceAtHeight(height);
        snapshots.push({ height, balance });
      } catch (err) {
        console.warn(`Failed to fetch burn balance at height ${height}`, err);
      }
    }
    burnSnapshots.value = snapshots.map((snap, idx) => {
      const previous = snapshots[idx + 1];
      const burned = previous ? previous.balance - snap.balance : null;
      return { ...snap, burned };
    });
  } finally {
    burnLoading.value = false;
  }
};

const loadTokenomics = async () => {
  errors.value = [];
  loading.value = true;

  await Promise.all([
    runTask("latest block", async () => {
      const { data } = await api.get("/cosmos/base/tendermint/v1beta1/blocks/latest");
      latestBlock.value = {
        height: data?.block?.header?.height ?? "",
        time: data?.block?.header?.time ?? ""
      };
    }),
    runTask("current supply", async () => {
      const { data } = await api.get("/cosmos/bank/v1beta1/supply/by_denom", { params: { denom: "uretro" } });
      currentSupply.value = data?.amount?.amount ?? null;
    }),
    runTask("mint params", async () => {
      const { data } = await api.get("/cosmos/mint/v1beta1/params");
      mintParams.value = data?.params ?? null;
    }),
    runTask("inflation", async () => {
      const { data } = await api.get("/cosmos/mint/v1beta1/inflation");
      inflation.value = data?.inflation ?? null;
    }),
    runTask("annual provisions", async () => {
      const { data } = await api.get("/cosmos/mint/v1beta1/annual_provisions");
      annualProvisions.value = data?.annual_provisions ?? null;
    }),
    runTask("staking params", async () => {
      const { data } = await api.get("/cosmos/staking/v1beta1/params");
      stakingParams.value = data?.params ?? null;
    }),
    runTask("distribution params", async () => {
      const { data } = await api.get("/cosmos/distribution/v1beta1/params");
      distributionParams.value = data?.params ?? null;
    }),
    runTask("burn params", async () => {
      const fallback = { fee_burn_rate: String(DEFAULT_BURN_RATE), provision_burn_rate: String(DEFAULT_BURN_RATE) };
      try {
        const { data } = await api.get("/cosmos/burn/v1beta1/params");
        const params = data?.params || data?.burn_params || data?.burnParams;
        burnParams.value = params ?? fallback;
      } catch {
        burnParams.value = fallback;
      }
    }),
    runTask("deposit params", async () => {
      const { data } = await api.get("/cosmos/gov/v1/params/deposit");
      depositParams.value = data?.deposit_params ?? null;
    }),
    runTask("voting params", async () => {
      const { data } = await api.get("/cosmos/gov/v1/params/voting");
      votingParams.value = data?.voting_params ?? null;
    }),
    runTask("tally params", async () => {
      const { data } = await api.get("/cosmos/gov/v1/params/tallying");
      tallyParams.value = data?.tally_params ?? null;
    }),
    runTask("arcade params", async () => {
      const { data } = await api.get("/retrochain/arcade/v1/params");
      arcadeParams.value = data?.params ?? null;
    })
  ]);

  const latestHeightNumber = latestBlock.value?.height ? Number(latestBlock.value.height) : null;
  if (latestHeightNumber && Number.isFinite(latestHeightNumber)) {
    await runTask("burn sink telemetry", async () => {
      await loadBurnSnapshots(latestHeightNumber);
    });
  }

  loading.value = false;
};

onMounted(() => {
  loadTokenomics();
});

const genesisAllocations = [
  {
    id: "foundation_validator",
    label: "foundation_validator",
    address: "cosmos1fscvf7rphx477z6vd4sxsusm2u8a70kewvc8wy",
    amount: 40_000_000
  },
  {
    id: "ecosystem_rewards",
    label: "ecosystem_rewards",
    address: "cosmos1exqr633rjzls2h4txrpu0cxhnxx0dquylf074x",
    amount: 20_000_000
  },
  {
    id: "liquidity_fund",
    label: "liquidity_fund",
    address: "cosmos1w506apt4kyq72xgaakwxrvak8w5d94upn3gdf3",
    amount: 10_000_000
  },
  {
    id: "community_fund",
    label: "community_fund",
    address: "cosmos1tksjh4tkdjfnwkkwty0wyuy4pv93q5q4lepgrn",
    amount: 7_000_000
  },
  {
    id: "dev_fund",
    label: "dev_fund",
    address: "cosmos1epy8qnuu00w76xvvlt2mc7q8qslhw206vzu5vs",
    amount: 6_000_000
  },
  {
    id: "shaun_profit",
    label: "shaun_profit",
    address: "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq",
    amount: 5_000_000
  },
  {
    id: "kitty_charity",
    label: "kitty_charity",
    address: "cosmos1ydn44ufvhddqhxu88m709k46hdm0dfjwm8v0tt",
    amount: 2_000_000
  }
];

const treasuryTransfers = [
  { height: 110, from: "foundation_validator", to: "community_fund", amount: 20_000_000 },
  { height: 141, from: "foundation_validator", to: "liquidity_fund", amount: 5_000_000 },
  { height: 142, from: "foundation_validator", to: "dev_fund", amount: 4_000_000 },
  { height: 146, from: "shaun_profit", to: "foundation_validator", amount: 2_000_000 }
];

const testerDistributions = [
  { height: 19255, address: "cosmos1xct40mu2p6sl54w5cw9yad07tcff5eqvkp65r6" },
  { height: 27508, address: "cosmos1ful20t02g95zjq5j8kghunhcu82l8nj36jaseq" },
  { height: 27893, address: "cosmos1esun5s55tn0hhd287fjwxkc28sp0ueqtrhtx4k" }
];

const retroMythos = [
  {
    emoji: "🕶️",
    title: "Message in the Cartridge",
    story:
      "Archivists say an anonymous dev left a hex note inside the first RetroChain client: \"Play fair, verify everything.\" It felt like Nakamoto whispering through assembly code, reminding builders that transparency beats hype.",
    quote: "— Fragment 00, recovered from the earliest git tag"
  },
  {
    emoji: "🎛️",
    title: "Lore of the Infinite Arcade",
    story:
      "The community tells a campfire story about Satoshi dropping by under an alias, asking only one question: \"What would a permissionless arcade look like?\" That question pushed RetroChain economists to publish every supply dial in public.",
    quote: "— Midnight validator call, transcript redacted"
  },
  {
    emoji: "📡",
    title: "Beacon Packet 2109",
    story:
      "A cosmic relay allegedly pinged the network with the phrase \"Sound money needs joyful sinks.\" Whether myth or meme, it inspired the arcade module’s burn-and-earn design without fabricating on-chain events.",
    quote: "— Community zine, Issue #7"
  }
];

const formatAddress = (address: string) => `${address.slice(0, 10)}...${address.slice(-6)}`;

const maskAddress = (address: string) => {
  if (!address) return "—";
  const prefix = address.slice(0, 6);
  const suffix = address.slice(-4);
  return `${prefix}••••${suffix}`;
};

const formatRetroSigned = (amount: number | null, fraction = 2) => {
  if (amount === null || amount === undefined) return "—";
  const retro = amount / 1_000_000;
  const absFormatted = Math.abs(retro).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: fraction
  });
  const sign = retro > 0 ? "+" : retro < 0 ? "-" : "";
  return `${sign}${absFormatted} RETRO`;
};

const minDepositRetro = computed(() => {
  const deposits: Array<{ denom: string; amount: string }> | undefined =
    depositParams.value?.min_deposit ?? depositParams.value?.minDeposit;
  if (!deposits || !deposits.length) return "—";
  const entry = deposits.find((d) => d.denom === "uretro") || deposits[0];
  return `${formatRetro(entry.amount)} RETRO`;
});
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-emerald-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-emerald-200">Tokenomics</p>
            <h1 class="text-3xl font-bold text-white mt-2 flex items-center gap-3">
              <span>RetroChain Monetary Policy</span>
              <span class="text-2xl">🪙</span>
            </h1>
            <p class="text-sm text-slate-300 mt-2 max-w-3xl">
              Live supply, inflation, and audited treasury allocations for RetroChain mainnet (chain-id retrochain-mainnet).
            </p>
            <div class="flex flex-wrap gap-2 mt-3 text-[11px]">
              <span class="badge border-emerald-500/40 text-emerald-200 bg-emerald-500/10">🛰️ Live on-chain feed</span>
              <span class="badge border-indigo-500/40 text-indigo-200 bg-indigo-500/10">⚙️ Cosmos SDK economics</span>
              <span class="badge border-amber-500/40 text-amber-200 bg-amber-500/10">🎮 Arcade treasury aware</span>
            </div>
          </div>

      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>🧮</span>
            <span>Burn Mechanics</span>
          </h2>
          <span class="text-xs text-slate-500">/cosmos/burn/v1beta1/params</span>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
            <p class="text-xs text-emerald-200 uppercase tracking-wider">Provision Burn Rate</p>
            <p class="text-2xl font-bold text-emerald-100 mt-1">{{ provisionBurnRatePercent }}</p>
            <p class="text-[11px] text-emerald-200/70">Portion of new issuance destroyed each block.</p>
          </div>
          <div class="rounded-xl border border-amber-400/30 bg-amber-500/5 p-4">
            <p class="text-xs text-amber-200 uppercase tracking-wider">Fee Burn Rate</p>
            <p class="text-2xl font-bold text-amber-100 mt-1">{{ feeBurnRatePercent }}</p>
            <p class="text-[11px] text-amber-200/70">Cut of transaction fees permanently removed.</p>
          </div>
          <div class="rounded-xl border border-white/10 p-4 text-sm text-slate-200 space-y-1">
            <p>Supply pressure is reduced by scheduled burns, which also lowers staking APR (already reflected in the effective APR on the staking page).</p>
            <p class="text-xs text-slate-400">If the burn module is offline, a conservative 0.8% default is assumed.</p>
          </div>
        </div>
      </div>
          <div class="text-sm text-slate-300 text-right">
            <div class="text-xs text-slate-500 uppercase tracking-wider">Data as of</div>
            <div v-if="latestBlock" class="font-mono text-emerald-300">Height #{{ latestBlock.height }}</div>
            <div v-if="latestBlock" class="text-xs text-slate-400">{{ latestBlock.time }}</div>
            <div v-else class="text-xs text-slate-500">Awaiting block data…</div>
          </div>
        </div>
        <div v-if="errors.length" class="text-xs text-amber-300">
          {{ errors.join(" · ") }}
        </div>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading tokenomics…" />
    </div>

    <div v-else class="space-y-4">
      <RcDisclaimer type="warning" title="Experimental Economics & No Financial Guarantees">
        <p>
          RetroChain is an experimental blockchain network. Supply numbers, inflation rates, and treasury allocations shown here are
          informational only and may change without notice. Holding or using RETRO does not entitle you to profits, dividends, or any
          guaranteed financial return.
        </p>
        <p class="mt-2">
          Always perform your own due diligence and never deploy funds you cannot afford to lose. Nothing on this page constitutes
          investment advice, financial advice, or a promise of token appreciation.
        </p>
      </RcDisclaimer>

      <!-- Token basics -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="card">
          <p class="text-xs text-slate-400 flex items-center gap-1"><span>🪙</span><span>Symbol</span></p>
          <p class="text-xl font-semibold text-white">RETRO</p>
          <p class="text-xs text-slate-500">Display denom</p>
        </div>
        <div class="card">
          <p class="text-xs text-slate-400 flex items-center gap-1"><span>⚙️</span><span>Base denom</span></p>
          <p class="text-xl font-semibold text-white">uretro</p>
          <p class="text-xs text-slate-500">On-chain representation</p>
        </div>
        <div class="card">
          <p class="text-xs text-slate-400 flex items-center gap-1"><span>📏</span><span>Decimals</span></p>
          <p class="text-xl font-semibold text-white">6</p>
          <p class="text-xs text-slate-500">1 RETRO = 1,000,000 uretro</p>
        </div>
      </div>

      <!-- Supply -->
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>💰</span>
            <span>Supply</span>
          </h2>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-xl border border-emerald-500/30 p-4 bg-emerald-500/10">
            <p class="text-xs text-emerald-200 uppercase tracking-wider flex items-center gap-1">
              <span>📡</span>
              <span>Current Supply</span>
            </p>
            <p class="text-2xl font-bold text-emerald-100 mt-1">
              {{ currentSupply ? `${formatRetro(currentSupply, { maximumFractionDigits: 2 })} RETRO` : "—" }}
            </p>
            <p class="text-xs text-emerald-200/70">Live from bank supply/by_denom</p>
          </div>
          <div class="grid gap-3 text-sm text-slate-300">
            <div>
              <p class="text-xs text-slate-500">Genesis supply</p>
              <p class="text-base text-white font-semibold">100,000,000 RETRO</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Max supply</p>
              <p>No fixed hard cap (inflationary while minting enabled).</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">Net minted since genesis</p>
              <p class="text-base text-white font-semibold">{{ netMintedDisplay }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Burn sink telemetry -->
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>🔥</span>
              <span>Validator Reward Burn Sink</span>
            </h2>
            <p class="text-[11px] text-slate-500">Staking rewards / burn wallet: <code>{{ burnAddressMasked }}</code></p>
          </div>
          <button class="btn text-xs" @click="copy(BURN_SINK_ADDRESS)">Copy address</button>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-xl border border-white/10 bg-white/5 p-4">
            <p class="text-xs text-slate-400 uppercase tracking-wider">Current balance</p>
            <p class="text-2xl font-bold text-white">{{ burnCurrentBalanceDisplay }}</p>
            <p class="text-[11px] text-slate-500">Address {{ burnAddressMasked }}</p>
          </div>
          <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p class="text-xs text-emerald-200 uppercase tracking-wider">Burned last block</p>
            <p class="text-2xl font-bold text-emerald-100">{{ burnLastBlockDisplay }}</p>
            <p class="text-[11px] text-emerald-200/70">Positive values = supply destroyed</p>
          </div>
          <div class="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
            <p class="text-xs text-indigo-200 uppercase tracking-wider">Rolling window</p>
            <p class="text-2xl font-bold text-indigo-100">{{ burnRollingWindowDisplay }}</p>
            <p class="text-[11px] text-indigo-200/70">{{ burnHistoryLabel }}</p>
          </div>
        </div>
        <div v-if="burnLoading" class="text-xs text-slate-400">Syncing burn telemetry…</div>
        <div v-else>
          <div v-if="burnSnapshots.length" class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr class="text-xs text-slate-400">
                  <th>Height</th>
                  <th>Balance</th>
                  <th>Δ vs prev block</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="snapshot in burnSnapshots" :key="snapshot.height">
                  <td class="font-mono text-xs text-slate-300">#{{ snapshot.height.toLocaleString() }}</td>
                  <td class="text-sm text-white">
                    {{ `${formatRetro(snapshot.balance, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} RETRO` }}
                  </td>
                  <td class="text-sm font-semibold" :class="burnDeltaClass(snapshot.burned)">
                    {{ formatRetroSigned(snapshot.burned) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-xs text-slate-500">Burn telemetry unavailable for recent blocks.</p>
        </div>
      </div>

      <!-- Mint & Inflation -->
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>🔥</span>
            <span>Mint &amp; Inflation</span>
          </h2>
          <span class="badge text-xs">Mint denom: {{ mintParams?.mint_denom || mintParams?.mintDenom || "uretro" }}</span>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-xl border border-white/5 p-4">
            <p class="text-xs text-slate-400">Live inflation</p>
            <p class="text-2xl font-bold text-white">{{ formatPercentFromDecimal(inflation, 2) }}</p>
          </div>
          <div class="rounded-xl border border-white/5 p-4">
            <p class="text-xs text-slate-400">Annual provisions</p>
            <p class="text-xl font-semibold text-white">
              {{ annualProvisionRetro !== null ? `${annualProvisionRetro.toLocaleString(undefined, { maximumFractionDigits: 2 })} RETRO/yr` : "—" }}
            </p>
          </div>
          <div class="rounded-xl border border-white/5 p-4 space-y-1 text-sm text-slate-200">
            <div>Daily: <span class="text-white">{{ dailyProvisionRetro !== null ? `${dailyProvisionRetro.toLocaleString(undefined, { maximumFractionDigits: 2 })} RETRO` : "—" }}</span></div>
            <div>Per block: <span class="text-white">{{ perBlockProvisionRetro !== null ? `${perBlockProvisionRetro.toLocaleString(undefined, { maximumFractionDigits: 6 })} RETRO` : "—" }}</span></div>
            <div>Blocks/year: <span class="text-white">{{ mintParams?.blocks_per_year || mintParams?.blocksPerYear || "—" }}</span></div>
          </div>
        </div>
        <div class="grid gap-3 md:grid-cols-3 text-sm text-slate-300">
          <div>
            <p class="text-xs text-slate-500">Inflation rate change</p>
            <p>{{ mintParams?.inflation_rate_change || mintParams?.inflationRateChange || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Inflation min / max</p>
            <p>{{ mintParams?.inflation_min || mintParams?.inflationMin || "—" }} ➜ {{ mintParams?.inflation_max || mintParams?.inflationMax || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Goal bonded</p>
            <p>{{ mintParams?.goal_bonded || mintParams?.goalBonded || "—" }}</p>
          </div>
        </div>
      </div>

      <!-- Params -->
      <div class="grid gap-4 md:grid-cols-2">
        <div class="card space-y-2 text-sm text-slate-300">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>🛡️</span>
            <span>Staking Parameters</span>
          </h2>
          <div>Bond denom: <span class="text-white">{{ stakingParams?.bond_denom || "—" }}</span></div>
          <div>Unbonding time: <span class="text-white">{{ formatDuration(stakingParams?.unbonding_time) }}</span></div>
          <div>Max validators: <span class="text-white">{{ stakingParams?.max_validators || "—" }}</span></div>
          <div>Max entries: <span class="text-white">{{ stakingParams?.max_entries || "—" }}</span></div>
          <div>Historical entries: <span class="text-white">{{ stakingParams?.historical_entries || "—" }}</span></div>
        </div>
        <div class="card space-y-2 text-sm text-slate-300">
          <h2 class="text-sm font-semibold text-slate-100">Distribution Parameters</h2>
          <div>Community tax: <span class="text-white">{{ distributionParams?.community_tax || "—" }}</span></div>
          <div>Withdraw address enabled: <span class="text-white">{{ distributionParams?.withdraw_addr_enabled }}</span></div>
        </div>
      </div>

      <!-- Governance -->
      <div class="card space-y-3">
        <h2 class="text-sm font-semibold text-slate-100">Governance Economics</h2>
        <div class="grid md:grid-cols-3 gap-3 text-sm text-slate-300">
          <div>
            <p class="text-xs text-slate-500">Min deposit (uretro)</p>
            <p class="text-white">{{ minDepositRetro }}</p>
            <p class="text-[11px] text-slate-500">Deposit period: {{ depositParams?.max_deposit_period || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Voting period</p>
            <p class="text-white">{{ votingParams?.voting_period || "—" }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500">Quorum / Threshold / Veto</p>
            <p class="text-white">
              {{ tallyParams?.quorum || "—" }} / {{ tallyParams?.threshold || "—" }} / {{ tallyParams?.veto_threshold || "—" }}
            </p>
          </div>
        </div>
      </div>

      <!-- Genesis allocations -->
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <span>📜</span>
          <span>Genesis Allocations (Height 1 Liquid)</span>
        </h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Name</th>
                <th>Address</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="allocation in genesisAllocations" :key="allocation.id">
                <td class="text-sm text-white">{{ allocation.label }}</td>
                <td class="font-mono text-xs text-slate-400">{{ formatAddress(allocation.address) }}</td>
                <td class="text-right text-sm text-emerald-300">{{ allocation.amount.toLocaleString() }} RETRO</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="mt-4 text-xs text-slate-400">
          Height 1 bonded stake: foundation_validator delegated 10,000,000 RETRO to validator cosmosvaloper1fscvf7rphx477z6vd4sxsusm2u8a70ketcvjzh, so that amount sat in the bonded pool instead of liquid balance.
        </div>
      </div>

      <!-- Early treasury redistributions -->
      <div class="card space-y-2">
        <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span>💼</span>
          <span>Early Treasury Redistributions</span>
        </h2>
        <ul class="text-sm text-slate-300 space-y-1">
          <li v-for="entry in treasuryTransfers" :key="entry.height">
            <span class="text-slate-500">Height {{ entry.height }}:</span>
            {{ entry.from }} → {{ entry.to }} — {{ entry.amount.toLocaleString() }} RETRO
          </li>
        </ul>
      </div>

      <!-- Tester distributions -->
      <div class="card space-y-2">
        <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <span>🎮</span>
          <span>Tester Distributions</span>
        </h2>
        <p class="text-xs text-slate-500">dev_fund wallet payouts (500,000 RETRO each)</p>
        <ul class="text-sm text-slate-300 space-y-1">
          <li v-for="tester in testerDistributions" :key="tester.height">
            Height {{ tester.height }} → {{ maskAddress(tester.address) }}
          </li>
        </ul>
      </div>

      <!-- RetroChain mythos (fictional inspiration) -->
      <div class="card space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>📖</span>
            <span>RetroChain Mythos</span>
          </h2>
          <span class="text-[11px] text-slate-500">Fictional inspiration · not on-chain history</span>
        </div>
        <RcDisclaimer type="info" title="Fictional lore only">
          <p>
            This Satoshi-style narrative is pure myth. It does not describe real wallets, token movements, or financial guarantees—just community
            storytelling about RetroChain’s ethos of transparency and open-source builders.
          </p>
        </RcDisclaimer>
        <div class="grid gap-3 md:grid-cols-3">
          <article
            v-for="chapter in retroMythos"
            :key="chapter.title"
            class="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="text-2xl">{{ chapter.emoji }}</span>
              <p class="text-sm font-semibold text-white">{{ chapter.title }}</p>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">{{ chapter.story }}</p>
            <p class="text-[11px] text-indigo-200 mt-2 italic">{{ chapter.quote }}</p>
          </article>
        </div>
      </div>

      <!-- Arcade params -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <span>🕹️</span>
            <span>Arcade Economy Params</span>
          </h2>
          <span class="text-xs text-slate-500">retrochain/arcade/v1/params</span>
        </div>
        <div v-if="arcadeParams" class="grid gap-2 text-sm text-slate-300">
          <div v-for="(value, key) in arcadeParams" :key="key" class="flex items-center justify-between gap-4">
            <span class="text-slate-500">{{ key }}</span>
            <span class="text-white text-right break-all">{{ value }}</span>
          </div>
        </div>
        <p v-else class="text-sm text-slate-500">Arcade parameters unavailable.</p>
      </div>
    </div>
  </div>
</template>