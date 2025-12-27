<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAccounts, type WalletSummary } from '@/composables/useAccounts';
import { getAccountLabel, type AccountLabelMeta } from '@/constants/accountLabels';
import { formatAmount } from '@/utils/format';
import { useRouter } from 'vue-router';

const router = useRouter();
const { accounts, loading, error, fetchAccounts } = useAccounts();

const TARGETS_URETRO: Record<string, string> = {
  foundation_validator: "10000000000000", // 10,000,000
  ecosystem_rewards: "35000000000000", // 35,000,000
  liquidity_fund: "10000000000000", // 10,000,000
  community_fund: "8721193994610", // 8,721,193.994610
  dev_fund: "8000000000000", // 8,000,000
  dev_profit: "6000000000000", // 6,000,000
  kitty_charity: "1007310758033", // 1,007,310.758033
  community_pool: "20000000000000", // 20,000,000
  ibc_relayer: "4998572638", // 4,998.572638
  staking_rewards_vault: "162508513858" // 162,508.513858
};

type LabeledWallet = WalletSummary & {
  knownLabel: AccountLabelMeta | null;
  targetUretro?: bigint;
  targetDisplay?: string;
  coveragePct?: number;
};

const labeledAccounts = computed<LabeledWallet[]>(() =>
  accounts.value.map(acc => ({
    ...acc,
    knownLabel: getAccountLabel(acc.address)
  }))
);

const ecosystemAccounts = computed(() =>
  labeledAccounts.value
    .filter(acc => !!acc.knownLabel)
    .map(acc => {
      const target = acc.knownLabel ? TARGETS_URETRO[acc.knownLabel.id] : undefined;
      const targetBig = target ? BigInt(target) : undefined;
      const balanceBig = BigInt(acc.balance || "0");
      const coverage = targetBig && targetBig > 0n
        ? Number(Math.min(200, Number((balanceBig * 10000n) / targetBig)) / 100)
        : undefined;
      return {
        ...acc,
        targetUretro: targetBig,
        targetDisplay: targetBig ? formatAmount(targetBig.toString(), acc.denom, { minDecimals: 2, maxDecimals: 2 }) : undefined,
        coveragePct: coverage
      } as LabeledWallet;
    })
);

const totalBalance = computed(() =>
  ecosystemAccounts.value.reduce((sum, acc) => sum + parseInt(acc.balance || '0'), 0)
);

const totalTarget = computed(() => {
  return ecosystemAccounts.value.reduce((sum, acc) => sum + (acc.targetUretro ?? 0n), 0n);
});

const totalCoverage = computed(() => {
  if (!totalTarget.value) return null;
  const coverage = (BigInt(totalBalance.value) * 10000n) / totalTarget.value;
  return Number(coverage) / 100;
});

onMounted(() => {
  fetchAccounts(300);
});
</script>

<template>
  <div class="space-y-3">
    <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <div class="flex items-baseline gap-2 mb-2">
          <h1 class="text-2xl font-bold">
            <span class="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              Ecosystem Wallets
            </span>
          </h1>
        </div>
        <p class="text-sm text-slate-300 mb-4">
          Foundation, treasury, rewards, and infrastructure wallets tracked on-chain.
        </p>
        <div class="flex gap-2">
          <button 
            class="btn text-xs" 
            @click="fetchAccounts(300)"
            :disabled="loading"
          >
            {{ loading ? 'Loading...' : '?? Refresh' }}
          </button>
          <button class="btn text-xs" @click="router.push({ name: 'accounts' })">
            ? Back to Accounts
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="card border-amber-400/40 bg-amber-500/5">
        <div class="text-xs uppercase tracking-wider text-amber-200 mb-1">Ecosystem Wallets</div>
        <div class="text-2xl font-bold text-amber-100">{{ ecosystemAccounts.length }}</div>
        <div class="text-xs text-amber-200/70">Tracked addresses</div>
      </div>
      <div class="card border-amber-400/40 bg-amber-500/5">
        <div class="text-xs uppercase tracking-wider text-amber-200 mb-1">Total Balance</div>
        <div class="text-2xl font-bold text-amber-100">
          {{ formatAmount(totalBalance.toString(), 'uretro', { minDecimals: 2, maxDecimals: 2 }) }}
        </div>
        <div class="text-xs text-amber-200/70">Across labeled wallets</div>
      </div>
      <div class="card border-emerald-400/40 bg-emerald-500/5">
        <div class="text-xs uppercase tracking-wider text-emerald-200 mb-1">Target Coverage</div>
        <div class="text-2xl font-bold text-emerald-100">
          {{ totalCoverage !== null ? `${totalCoverage.toFixed(2)}%` : '' }}
        </div>
        <div class="text-xs text-emerald-200/70">Total target: {{ formatAmount(totalTarget.toString(), 'uretro', { minDecimals: 2, maxDecimals: 2 }) }}</div>
      </div>
      <div class="card border-amber-400/40 bg-amber-500/5">
        <div class="text-xs uppercase tracking-wider text-amber-200 mb-1">Status</div>
        <div class="text-2xl font-bold" :class="loading ? 'text-amber-200' : 'text-emerald-200'">
          {{ loading ? 'Syncing...' : 'Live' }}
        </div>
        <div class="text-xs text-amber-200/70">Balances fetched directly</div>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && ecosystemAccounts.length === 0" class="card">
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4"></div>
          <div class="text-sm text-amber-100">Loading ecosystem wallets...</div>
        </div>
      </div>
    </div>

    <div v-else-if="ecosystemAccounts.length === 0" class="card text-center py-12">
      <div class="text-4xl mb-3">??</div>
      <div class="text-sm text-slate-400">No ecosystem wallets found</div>
      <div class="text-xs text-slate-500 mt-1">Check labeling config</div>
    </div>

    <div v-else class="card border-amber-400/30 bg-amber-500/5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-amber-100">
          Ecosystem Wallets ({{ ecosystemAccounts.length }})
        </h2>
        <p class="text-xs text-amber-200/80 flex items-center gap-2">
          <span>Progress vs targets</span>
          <span class="px-2 py-1 rounded-full border border-amber-400/40 text-[10px] text-amber-100 bg-amber-500/10">
            Total: {{ totalCoverage !== null ? `${totalCoverage.toFixed(2)}%` : '' }}
          </span>
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr class="text-xs text-amber-100/80">
              <th>Label</th>
              <th>Address</th>
              <th>Description</th>
              <th class="text-right">Balance</th>
              <th class="text-right">Target</th>
              <th class="text-right">Coverage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="account in ecosystemAccounts"
              :key="account.address"
              class="cursor-pointer hover:bg-amber-500/5 transition-colors"
              @click="router.push({ name: 'account', params: { address: account.address } })"
            >
              <td class="text-xs">
                <div
                  v-if="account.knownLabel"
                  class="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-100 font-sans"
                  :title="account.knownLabel.description"
                >
                  <span class="text-base leading-none">{{ account.knownLabel.icon }}</span>
                  <span>{{ account.knownLabel.label }}</span>
                </div>
              </td>
              <td class="text-xs font-mono">
                <div class="flex items-center gap-2">
                  <span>{{ account.address.slice(0, 12) }}...{{ account.address.slice(-8) }}</span>
                  <button 
                    class="btn text-[10px]" 
                    @click.stop="navigator.clipboard?.writeText?.(account.address)"
                  >
                    Copy
                  </button>
                </div>
              </td>
              <td class="text-xs text-slate-200 max-w-xs">
                <span v-if="account.knownLabel">{{ account.knownLabel.description }}</span>
              </td>
              <td class="text-right text-sm">
                <span class="font-mono text-amber-100">
                  {{ formatAmount(account.balance, account.denom, { minDecimals: 2, maxDecimals: 6 }) }}
                </span>
              </td>
              <td class="text-right text-xs text-amber-200">
                <span v-if="account.targetDisplay" class="font-mono">{{ account.targetDisplay }}</span>
                <span v-else class="text-amber-300/70"></span>
              </td>
              <td class="text-right text-xs">
                <div v-if="account.coveragePct !== undefined" class="flex flex-col items-end gap-1">
                  <span class="font-semibold text-amber-100">{{ account.coveragePct.toFixed(2) }}%</span>
                  <div class="w-32 h-2 rounded-full bg-amber-500/20 overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400"
                      :style="{ width: `${Math.min(200, account.coveragePct)}%` }"
                    ></div>
                  </div>
                </div>
                <span v-else class="text-amber-300/70"></span>
              </td>
              <td>
                <button 
                  class="btn text-xs"
                  @click.stop="router.push({ name: 'account', params: { address: account.address } })"
                >
                  View ?
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card bg-slate-900/60 border-amber-400/20">
      <h3 class="text-sm font-semibold mb-2 text-amber-100">?? About Ecosystem Wallets</h3>
      <ul class="text-xs text-slate-200 space-y-1.5 list-disc list-inside">
        <li>Labels are managed in <code>src/constants/accountLabels.ts</code>. Update there to add or adjust wallets.</li>
        <li>Balances are live from the bank module; refresh anytime.</li>
        <li>Click any wallet row to jump to its full account view.</li>
        <li>Coverage compares current balance vs the communicated target allocation for transparency.</li>
      </ul>
    </div>

    <div class="card border-rose-400/40 bg-rose-500/5">
      <h3 class="text-sm font-semibold mb-2 text-rose-100">?? Disclaimer</h3>
      <p class="text-xs text-rose-100/90 leading-relaxed">
        Targets and labels are informational only and do not represent guarantees, vesting schedules, or spend approvals. Balances can move at any time based on governance decisions, operational needs, or protocol mechanics. Always verify on-chain data and governance proposals before relying on these figures.
      </p>
    </div>
  </div>
</template>
