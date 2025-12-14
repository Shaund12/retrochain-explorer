<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useAccounts } from '@/composables/useAccounts';
import type { WalletSummary } from '@/composables/useAccounts';
import { useRouter } from 'vue-router';
import { formatAmount } from '@/utils/format';
import { useNetwork } from '@/composables/useNetwork';
import { getAccountLabel, type AccountLabelMeta } from '@/constants/accountLabels';

const { accounts, loading, error, totalAccounts, fetchAccounts } = useAccounts();
const router = useRouter();
const { current: network } = useNetwork();

const searchQuery = ref('');
const sortBy = ref<'balance' | 'address'>('balance');
const sortOrder = ref<'asc' | 'desc'>('desc');

type LabeledWallet = WalletSummary & {
  knownLabel: AccountLabelMeta | null;
};

const labeledAccounts = computed<LabeledWallet[]>(() =>
  accounts.value.map(acc => ({
    ...acc,
    knownLabel: getAccountLabel(acc.address)
  }))
);

const filteredAccounts = computed(() => {
  let filtered = labeledAccounts.value;
  
  // Filter by search
  if (searchQuery.value) {
    filtered = filtered.filter(a => 
      a.address.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }
  
  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy.value === 'balance') {
      const diff = parseInt(b.balance) - parseInt(a.balance);
      return sortOrder.value === 'desc' ? diff : -diff;
    } else {
      const diff = a.address.localeCompare(b.address);
      return sortOrder.value === 'desc' ? -diff : diff;
    }
  });
  
  return filtered;
});

const totalBalance = computed(() => {
  return accounts.value.reduce((sum, acc) => sum + parseInt(acc.balance || '0'), 0);
});

const toggleSort = (field: 'balance' | 'address') => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  } else {
    sortBy.value = field;
    sortOrder.value = 'desc';
  }
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard?.writeText?.(text);
  } catch {}
};

onMounted(() => {
  fetchAccounts(100);
});
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <div class="flex items-baseline gap-2 mb-2">
          <h1 class="text-2xl font-bold">
            <span class="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              All Accounts
            </span>
          </h1>
        </div>
        <p class="text-sm text-slate-300 mb-4">
          Browse all active accounts on RetroChain {{ network === 'mainnet' ? 'Mainnet' : 'Testnet' }}
        </p>
        
        <!-- Search -->
        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by address..."
            class="flex-1 px-4 py-2.5 rounded-full bg-slate-900/90 border border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
          />
          <button 
            class="btn text-xs" 
            @click="fetchAccounts(100)"
            :disabled="loading"
          >
            {{ loading ? 'Loading...' : '?? Refresh' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Accounts Loaded</div>
        <div class="text-2xl font-bold text-cyan-400">{{ accounts.length }}</div>
        <div class="text-xs text-slate-500">Currently displayed</div>
      </div>
      
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Total Balance</div>
        <div class="text-2xl font-bold text-emerald-400">
          {{ formatAmount(totalBalance.toString(), 'uretro', { minDecimals: 2, maxDecimals: 2 }) }}
        </div>
        <div class="text-xs text-slate-500">Across all accounts</div>
      </div>
      
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Chain Total</div>
        <div class="text-2xl font-bold text-indigo-400">{{ totalAccounts || accounts.length }}</div>
        <div class="text-xs text-slate-500">Reported by auth module</div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && accounts.length === 0" class="card">
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
          <div class="text-sm text-slate-400">Loading accounts from the chain...</div>
          <div class="text-xs text-slate-500 mt-1">This may take a moment</div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <!-- Accounts Table -->
    <div v-if="!loading || accounts.length > 0" class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">
          Accounts ({{ filteredAccounts.length }})
        </h2>
        <div class="flex gap-2 text-xs">
          <button 
            class="btn"
            :class="sortBy === 'balance' ? 'border-cyan-400/70 bg-cyan-500/10' : ''"
            @click="toggleSort('balance')"
          >
            Balance {{ sortBy === 'balance' ? (sortOrder === 'desc' ? '?' : '?') : '' }}
          </button>
          <button 
            class="btn"
            :class="sortBy === 'address' ? 'border-cyan-400/70 bg-cyan-500/10' : ''"
            @click="toggleSort('address')"
          >
            Address {{ sortBy === 'address' ? (sortOrder === 'desc' ? '?' : '?') : '' }}
          </button>
        </div>
      </div>

      <div v-if="filteredAccounts.length === 0" class="text-center py-12">
        <div class="text-4xl mb-3">??</div>
        <div class="text-sm text-slate-400">No accounts found</div>
        <div class="text-xs text-slate-500 mt-1">Try adjusting your search</div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr class="text-xs text-slate-300">
              <th>Rank</th>
              <th>Address</th>
              <th class="text-right">Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(account, index) in filteredAccounts"
              :key="account.address"
              class="cursor-pointer hover:bg-white/5 transition-colors"
              @click="router.push({ name: 'account', params: { address: account.address } })"
            >
              <td class="font-mono text-xs">
                <span v-if="index === 0 && sortBy === 'balance' && sortOrder === 'desc'" class="text-yellow-300">??</span>
                <span v-else-if="index === 1 && sortBy === 'balance' && sortOrder === 'desc'" class="text-slate-300">??</span>
                <span v-else-if="index === 2 && sortBy === 'balance' && sortOrder === 'desc'" class="text-orange-300">??</span>
                <span v-else>{{ index + 1 }}</span>
              </td>
              
              <td class="text-xs">
                <div class="flex items-center gap-2 font-mono">
                  <span>{{ account.address.slice(0, 12) }}...{{ account.address.slice(-8) }}</span>
                  <button 
                    class="btn text-[10px]" 
                    @click.stop="copy(account.address)"
                  >
                    Copy
                  </button>
                </div>
                <div
                  v-if="account.knownLabel"
                  class="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 font-sans"
                  :title="account.knownLabel.description"
                >
                  <span class="text-base leading-none">{{ account.knownLabel.icon }}</span>
                  <span>{{ account.knownLabel.label }}</span>
                </div>
              </td>
              
              <td class="text-right text-sm">
                <span 
                  class="font-mono"
                  :class="parseInt(account.balance) > 0 ? 'text-emerald-300' : 'text-slate-500'"
                >
                  {{ formatAmount(account.balance, account.denom, { minDecimals: 2, maxDecimals: 6 }) }}
                </span>
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

    <!-- Info -->
    <div class="card bg-slate-900/50 border-slate-700">
      <h3 class="text-sm font-semibold mb-2 text-slate-100">?? About This Page</h3>
      <ul class="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
        <li>Displays paginated accounts returned by the Cosmos auth module</li>
        <li>Balances are fetched directly from the bank module in real-time</li>
        <li>Sorted by balance (highest first) by default</li>
        <li>Click any account to view detailed information</li>
        <li>Top 3 accounts are highlighted with medals ??????</li>
      </ul>
    </div>
  </div>
</template>
