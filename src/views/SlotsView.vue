<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useApi } from "@/composables/useApi";

const retroSlotsUrl = "https://retrochain.ddns.net/slots/slots/";
const poolAccount = "cosmos18drc5z3lce2al80s2fegsy59rd4j9h05umhvk2";
const DECIMALS = 6n;
const URETRO_PER_RETRO = 1_000_000n;

const api = useApi();

const loading = ref(true);
const partialError = ref(false);

const snapshotHeight = ref<string | null>(null);
const snapshotTime = ref<string | null>(null);

const globalStats = ref<any | null>(null);
const globalPool = ref<any | null>(null);
const params = ref<any | null>(null);
const poolAccountBalance = ref<string | null>(null);

interface MachineRow {
  machine: any;
  stats: any | null;
  pool: any | null;
}

const machines = ref<MachineRow[]>([]);

const formatRetro = (input?: string | number | null): string => {
  if (input === undefined || input === null) return "—";
  try {
    const raw = typeof input === "number" ? BigInt(Math.trunc(input)) : BigInt(input);
    const whole = raw / URETRO_PER_RETRO;
    const frac = raw % URETRO_PER_RETRO;
    const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (frac === 0n) return `${wholeStr} RETRO`;
    let fracStr = frac.toString().padStart(Number(DECIMALS), "0");
    fracStr = fracStr.replace(/0+$/, "");
    return `${wholeStr}.${fracStr} RETRO`;
  } catch {
    return "—";
  }
};

const formatInt = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString();
};

const formatTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const dataAsOf = computed(() => {
  if (!snapshotHeight.value || !snapshotTime.value) return "—";
  return `Data as of height ${snapshotHeight.value} (${formatTime(snapshotTime.value)})`;
});

const fetchLatestBlock = async () => {
  try {
    const res = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/latest`);
    snapshotHeight.value = res.data?.block?.header?.height ?? null;
    snapshotTime.value = res.data?.block?.header?.time ?? null;
  } catch (err) {
    partialError.value = true;
  }
};

const fetchGlobal = async () => {
  try {
    const [statsRes, poolRes, paramsRes] = await Promise.all([
      api.get(`/retrochain/slots/v1/stats`),
      api.get(`/retrochain/slots/v1/pool`),
      api.get(`/retrochain/slots/v1/params`).catch(() => null)
    ]);
    globalStats.value = statsRes.data?.stats ?? null;
    globalPool.value = poolRes.data?.pool ?? null;
    params.value = paramsRes ? paramsRes.data?.params ?? null : null;
  } catch (err) {
    partialError.value = true;
  }
};

const fetchPoolAccountBalance = async () => {
  try {
    const res = await api.get(`/cosmos/bank/v1beta1/balances/${poolAccount}`, {
      params: { "pagination.limit": "200" }
    });
    const balances: Array<{ denom: string; amount: string }> = res.data?.balances ?? [];
    const retro = balances.find((b) => b.denom === "uretro")?.amount;
    poolAccountBalance.value = retro ?? "0";
  } catch (err) {
    partialError.value = true;
  }
};

const fetchMachinesPaged = async (): Promise<any[]> => {
  const all: any[] = [];
  let startAfter: string | undefined;
  try {
    do {
      const res = await api.get(`/retrochain/slots/v1/machines`, {
        params: {
          enabled_only: true,
          limit: 200,
          ...(startAfter ? { start_after: startAfter } : {})
        }
      });
      const machinesPage = res.data?.machines ?? [];
      if (Array.isArray(machinesPage) && machinesPage.length) {
        all.push(...machinesPage);
      }
      startAfter = res.data?.next_start_after || undefined;
    } while (startAfter);
  } catch (err) {
    partialError.value = true;
  }
  return all;
};

const withLimit = async <T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let idx = 0;

  const run = async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      try {
        results[current] = await worker(items[current], current);
      } catch (err) {
        partialError.value = true;
        results[current] = await Promise.resolve(null as unknown as R);
      }
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, run);
  await Promise.all(workers);
  return results;
};

const fetchMachineDetails = async (machine: any): Promise<MachineRow> => {
  try {
    const [statsRes, poolRes] = await Promise.all([
      api.get(`/retrochain/slots/v1/machines/${machine.machine_id}/stats`).catch(() => ({ data: null })),
      api.get(`/retrochain/slots/v1/machines/${machine.machine_id}/pool`).catch(() => ({ data: null }))
    ]);
    return {
      machine,
      stats: statsRes.data?.stats ?? null,
      pool: poolRes.data?.pool ?? null
    };
  } catch (err) {
    partialError.value = true;
    return { machine, stats: null, pool: null };
  }
};

const loadMachines = async () => {
  const list = await fetchMachinesPaged();
  if (!list.length) {
    machines.value = [];
    return;
  }
  const detailed = await withLimit(list, 10, fetchMachineDetails);
  machines.value = detailed;
};

const loadAll = async () => {
  loading.value = true;
  partialError.value = false;
  try {
    await Promise.all([fetchLatestBlock(), fetchGlobal(), fetchPoolAccountBalance(), loadMachines()]);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadAll();
});

const machinePoolAmount = (row: MachineRow) => formatRetro(row.pool?.balance?.amount);
const globalPoolAmount = computed(() => formatRetro(globalPool.value?.balance?.amount));
const tokensPerCredit = (machine: any) => formatRetro(machine?.tokens_per_credit);
const poolAccountBalanceDisplay = computed(() => formatRetro(poolAccountBalance.value));
const machineLeaderboard = computed(() => {
  return machines.value
    .filter((m) => m.stats)
    .map((m) => ({
      id: m.machine?.machine_id,
      spins: Number(m.stats?.spins ?? 0),
      wins: Number(m.stats?.wins ?? 0),
      bet: m.stats?.total_bet_uretro,
      payout: m.stats?.total_payout_uretro
    }))
    .sort((a, b) => b.spins - a.spins)
    .slice(0, 10);
});

const sumBigInt = (values: Array<string | number | null | undefined>) => {
  return values.reduce((acc, v) => {
    if (v === null || v === undefined) return acc;
    try {
      const b = typeof v === "number" ? BigInt(Math.trunc(v)) : BigInt(v);
      return acc + b;
    } catch {
      return acc;
    }
  }, 0n);
};

const machineCount = computed(() => machines.value.length);
const enabledMachineCount = computed(() => machines.value.filter((m) => m.machine?.enabled).length);
const totalMachinePool = computed(() => {
  const sum = sumBigInt(machines.value.map((m) => m.pool?.balance?.amount));
  return formatRetro(sum.toString());
});
const totalMachineBet = computed(() => {
  const sum = sumBigInt(machines.value.map((m) => m.stats?.total_bet_uretro));
  return formatRetro(sum.toString());
});
const totalMachinePayout = computed(() => {
  const sum = sumBigInt(machines.value.map((m) => m.stats?.total_payout_uretro));
  return formatRetro(sum.toString());
});

const bestMachine = computed(() => machineLeaderboard.value[0]);
const machineSpotlight = computed(() => {
  if (!bestMachine.value) return null;
  const row = machines.value.find((m) => m.machine?.machine_id === bestMachine.value?.id);
  return row || null;
});

const topPayoutMachines = computed(() => {
  return machines.value
    .filter((m) => m.stats)
    .map((m) => ({
      id: m.machine?.machine_id,
      payout: m.stats?.total_payout_uretro ?? "0",
      bet: m.stats?.total_bet_uretro ?? "0",
      spins: Number(m.stats?.spins ?? 0)
    }))
    .sort((a, b) => Number(b.payout || 0) - Number(a.payout || 0))
    .slice(0, 3);
});

const headToHead = computed(() => machineLeaderboard.value.slice(0, 2));

const formatBps = (value?: string | number | null) => {
  if (value === undefined || value === null) return "—";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num} bps`;
};
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-purple-600/20 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-emerald-200">Slots & Randomness</p>
            <h1 class="text-3xl font-bold text-white mt-1 flex items-center gap-3">
              <span>Slots</span>
              <span class="text-2xl">&#127920;</span>
            </h1>
            <p class="text-sm text-slate-300 mt-2 max-w-3xl">On-chain dashboard (x/slots)</p>
            <p class="text-[11px] text-slate-400 mt-1">{{ dataAsOf }}</p>
          </div>
          <div class="flex items-center gap-2">
            <a
              :href="retroSlotsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn text-sm flex items-center gap-2 border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
            >
              <span>Play RetroSlots</span>
              <span class="text-lg">&#128640;</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <RcDisclaimer v-if="partialError" type="warning" title="Some data unavailable">
      <p>One or more slots endpoints could not be loaded. Displaying available data.</p>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Syncing slots data…" />
    </div>

    <template v-else>
      <div class="grid gap-3 md:grid-cols-3">
        <div class="card border border-emerald-500/40 bg-emerald-500/5">
          <p class="text-xs uppercase tracking-wider text-emerald-200">Global Pool</p>
          <p class="text-2xl font-bold text-white mt-1">{{ globalPoolAmount }}</p>
          <p class="text-[11px] text-emerald-200/70">Balance (RETRO)</p>
        </div>
        <div class="card border border-indigo-500/40 bg-indigo-500/5">
          <p class="text-xs uppercase tracking-wider text-indigo-200">Pool Account</p>
          <p class="text-2xl font-bold text-white mt-1">{{ poolAccountBalanceDisplay }}</p>
          <p class="text-[11px] text-indigo-200/70 truncate">{{ poolAccount }}</p>
        </div>
        <div class="card border border-cyan-500/40 bg-cyan-500/5">
          <p class="text-xs uppercase tracking-wider text-cyan-200">Spins / Wins</p>
          <p class="text-2xl font-bold text-white mt-1">{{ formatInt(globalStats?.spins) }} / {{ formatInt(globalStats?.wins) }}</p>
          <p class="text-[11px] text-cyan-200/70">Total spins / wins</p>
        </div>
        <div class="card border border-amber-500/40 bg-amber-500/5">
          <p class="text-xs uppercase tracking-wider text-amber-200">Inserts / Credits</p>
          <p class="text-2xl font-bold text-white mt-1">{{ formatInt(globalStats?.inserts) }} / {{ formatInt(globalStats?.total_credits_purchased) }}</p>
          <p class="text-[11px] text-amber-200/70">Inserts and credits purchased</p>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="card border border-emerald-400/40 bg-emerald-500/5">
          <p class="text-[11px] uppercase tracking-wider text-emerald-200">Machines</p>
          <p class="text-2xl font-bold text-white">{{ machineCount }}</p>
          <p class="text-[11px] text-emerald-200/70">Enabled: {{ enabledMachineCount }}</p>
        </div>
        <div class="card border border-indigo-400/40 bg-indigo-500/5">
          <p class="text-[11px] uppercase tracking-wider text-indigo-200">Total Machine Pool</p>
          <p class="text-xl font-bold text-white">{{ totalMachinePool }}</p>
          <p class="text-[11px] text-indigo-200/70">Sum of machine pools</p>
        </div>
        <div class="card border border-cyan-400/40 bg-cyan-500/5">
          <p class="text-[11px] uppercase tracking-wider text-cyan-200">Total Bet</p>
          <p class="text-xl font-bold text-white">{{ totalMachineBet }}</p>
          <p class="text-[11px] text-cyan-200/70">All machines combined</p>
        </div>
        <div class="card border border-amber-400/40 bg-amber-500/5">
          <p class="text-[11px] uppercase tracking-wider text-amber-200">Total Payout</p>
          <p class="text-xl font-bold text-white">{{ totalMachinePayout }}</p>
          <p class="text-[11px] text-amber-200/70">All machines combined</p>
        </div>
      </div>

      <div class="card" v-if="machineSpotlight">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Top Machine Spotlight</h2>
          <span class="text-[11px] text-slate-400">Most spins</span>
        </div>
        <div class="flex flex-col gap-2 text-sm text-slate-200">
          <div class="flex items-center justify-between">
            <div class="font-mono text-xs text-emerald-200 truncate">{{ machineSpotlight.machine?.machine_id }}</div>
            <span class="badge text-[11px]" :class="machineSpotlight.machine?.enabled ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'">
              {{ machineSpotlight.machine?.enabled ? 'Enabled' : 'Disabled' }}
            </span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div class="p-2 rounded-lg bg-white/5 border border-white/10">
              <div class="text-slate-400">Spins</div>
              <div class="text-white font-semibold">{{ formatInt(machineSpotlight.stats?.spins) }}</div>
            </div>
            <div class="p-2 rounded-lg bg-white/5 border border-white/10">
              <div class="text-slate-400">Wins</div>
              <div class="text-white font-semibold">{{ formatInt(machineSpotlight.stats?.wins) }}</div>
            </div>
            <div class="p-2 rounded-lg bg-white/5 border border-white/10">
              <div class="text-slate-400">Bet</div>
              <div class="text-white font-semibold">{{ formatRetro(machineSpotlight.stats?.total_bet_uretro) }}</div>
            </div>
            <div class="p-2 rounded-lg bg-white/5 border border-white/10">
              <div class="text-slate-400">Payout</div>
              <div class="text-white font-semibold">{{ formatRetro(machineSpotlight.stats?.total_payout_uretro) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="card">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-base font-semibold text-white">Slots Leaderboard</h2>
            <span class="text-[11px] text-slate-400">Top by spins</span>
          </div>
          <div v-if="!machineLeaderboard.length" class="text-xs text-slate-400">No leaderboard data yet.</div>
          <div v-else class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr class="text-xs text-slate-400">
                  <th>#</th>
                  <th>Machine</th>
                  <th>Spins</th>
                  <th>Wins</th>
                  <th>Total Bet</th>
                  <th>Total Payout</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(entry, idx) in machineLeaderboard" :key="entry.id" class="text-sm">
                  <td class="font-mono text-xs text-slate-300">{{ idx + 1 }}</td>
                  <td class="font-mono text-xs text-slate-200">{{ entry.id || '—' }}</td>
                  <td class="text-slate-100">{{ formatInt(entry.spins) }}</td>
                  <td class="text-slate-100">{{ formatInt(entry.wins) }}</td>
                  <td class="text-slate-100">{{ formatRetro(entry.bet) }}</td>
                  <td class="text-slate-100">{{ formatRetro(entry.payout) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-base font-semibold text-white">Battles</h2>
            <span class="text-[11px] text-slate-400">Head-to-head top 2</span>
          </div>
          <div v-if="headToHead.length < 2" class="text-xs text-slate-400">Need at least two machines with stats.</div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              v-for="entry in headToHead"
              :key="entry.id"
              class="p-3 rounded-lg bg-slate-900/60 border border-white/10"
            >
              <div class="flex items-center justify-between">
                <div class="text-sm font-semibold text-white">{{ entry.id || '—' }}</div>
                <span class="badge text-[11px] border-emerald-400/60 text-emerald-200">{{ formatInt(entry.spins) }} spins</span>
              </div>
              <div class="text-[11px] text-slate-400">Wins: {{ formatInt(entry.wins) }}</div>
              <div class="text-[11px] text-emerald-200">Payout: {{ formatRetro(entry.payout) }}</div>
              <div class="text-[11px] text-cyan-200">Bet: {{ formatRetro(entry.bet) }}</div>
            </div>
          </div>
          <div class="mt-2 text-[11px] text-slate-500">Ranked by spins; compare top machines head-to-head.</div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-white">Top Payout Machines</h2>
          <span class="text-[11px] text-slate-400">Top 3 by total payout</span>
        </div>
        <div v-if="!topPayoutMachines.length" class="text-xs text-slate-400">No payout data yet.</div>
        <div v-else class="grid gap-2 md:grid-cols-3">
          <div
            v-for="entry in topPayoutMachines"
            :key="entry.id"
            class="p-3 rounded-lg bg-white/5 border border-white/10"
          >
            <div class="text-sm font-semibold text-white truncate">{{ entry.id || '—' }}</div>
            <div class="text-[11px] text-emerald-200">Payout: {{ formatRetro(entry.payout) }}</div>
            <div class="text-[11px] text-cyan-200">Bet: {{ formatRetro(entry.bet) }}</div>
            <div class="text-[11px] text-slate-400">Spins: {{ formatInt(entry.spins) }}</div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <div class="card">
          <h2 class="text-base font-semibold text-white mb-2">Global Summary</h2>
          <div class="grid grid-cols-2 gap-2 text-sm text-slate-200">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Bet</div>
              <div class="font-semibold">{{ formatRetro(globalStats?.total_bet_uretro) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Payout</div>
              <div class="font-semibold">{{ formatRetro(globalStats?.total_payout_uretro) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Tokens Spent</div>
              <div class="font-semibold">{{ formatRetro(globalStats?.total_tokens_spent_uretro) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Pool Added</div>
              <div class="font-semibold">{{ formatRetro(globalStats?.total_pool_added_uretro) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total House Sent</div>
              <div class="font-semibold">{{ formatRetro(globalStats?.total_house_sent_uretro) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Burned</div>
              <div class="font-semibold">{{ formatRetro(globalStats?.total_burned_uretro) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Bet Credits</div>
              <div class="font-semibold">{{ formatInt(globalStats?.total_bet_credits) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Total Lines Played</div>
              <div class="font-semibold">{{ formatInt(globalStats?.total_lines_played) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Last Insert Height</div>
              <div class="font-semibold">{{ formatInt(globalStats?.last_insert_height) }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400">Last Spin Height</div>
              <div class="font-semibold">{{ formatInt(globalStats?.last_spin_height) }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2 class="text-base font-semibold text-white mb-2">Params</h2>
          <div class="text-sm text-slate-200 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px] uppercase tracking-wider">Base credits cost</span>
              <span class="font-semibold">{{ formatRetro(params?.base_credits_cost) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px] uppercase tracking-wider">Pool share</span>
              <span class="font-semibold">{{ formatBps(params?.pool_share_bps) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px] uppercase tracking-wider">House share</span>
              <span class="font-semibold">{{ formatBps(params?.house_share_bps) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px] uppercase tracking-wider">Burn share</span>
              <span class="font-semibold">{{ formatBps(params?.burn_share_bps) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px] uppercase tracking-wider">Pool account</span>
              <RouterLink :to="{ name: 'account', params: { address: poolAccount } }" class="font-mono text-xs text-emerald-200 break-all hover:underline">
                {{ poolAccount }}
              </RouterLink>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400 text-[11px] uppercase tracking-wider">House address</span>
              <span class="font-mono text-xs text-emerald-200 break-all">{{ params?.house_address || '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white flex items-center gap-2"><span>🎰</span><span>Slots Machines</span></h2>
          <span class="text-[11px] text-slate-400">Randomness-backed machines</span>
        </div>

        <div v-if="!machines.length" class="text-sm text-slate-400">No machines registered.</div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Machine ID</th>
                <th>Enabled</th>
                <th>Developer</th>
                <th>Tokens / Credit</th>
                <th>Pool</th>
                <th>Inserts</th>
                <th>Spins</th>
                <th>Wins</th>
                <th>Total Bet</th>
                <th>Total Payout</th>
                <th>Last Insert</th>
                <th>Last Spin</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in machines" :key="row.machine.machine_id" class="text-sm">
                <td class="font-mono text-xs text-slate-200">{{ row.machine.machine_id }}</td>
                <td>
                  <span class="badge text-[11px]" :class="row.machine.enabled ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'">
                    {{ row.machine.enabled ? 'Yes' : 'No' }}
                  </span>
                </td>
                <td class="font-mono text-xs text-slate-300 break-all">{{ row.machine.developer_address || '—' }}</td>
                <td class="text-slate-100">{{ tokensPerCredit(row.machine) }}</td>
                <td class="text-slate-100">{{ machinePoolAmount(row) }}</td>
                <td class="text-slate-100">{{ formatInt(row.stats?.inserts) }}</td>
                <td class="text-slate-100">{{ formatInt(row.stats?.spins) }}</td>
                <td class="text-slate-100">{{ formatInt(row.stats?.wins) }}</td>
                <td class="text-slate-100">{{ formatRetro(row.stats?.total_bet_uretro) }}</td>
                <td class="text-slate-100">{{ formatRetro(row.stats?.total_payout_uretro) }}</td>
                <td class="text-slate-100">{{ formatInt(row.stats?.last_insert_height) }}</td>
                <td class="text-slate-100">{{ formatInt(row.stats?.last_spin_height) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
