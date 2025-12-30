<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useAccounts } from '@/composables/useAccounts';
import type { WalletSummary } from '@/composables/useAccounts';
import { useRouter } from 'vue-router';
import { formatAmount } from '@/utils/format';
import { useNetwork } from '@/composables/useNetwork';
import { getAccountLabel, type AccountLabelMeta } from '@/constants/accountLabels';

const USD_PRICE_HINTS: Record<string, number | undefined> = {
  RETRO: Number(import.meta.env.VITE_PRICE_RETRO_USD ?? '0') || 0,
  USDC: 1,
  OSMO: Number(import.meta.env.VITE_PRICE_OSMO_USD ?? '0') || 0.6,
  ATOM: Number(import.meta.env.VITE_PRICE_ATOM_USD ?? '0') || 10,
  WBTC: Number(import.meta.env.VITE_PRICE_WBTC_USD ?? '0') || 40000
};

const formatUsd = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const { accounts, loading, error, totalAccounts, fetchAccounts } = useAccounts();
const router = useRouter();
const { current: network } = useNetwork();

const priceOverrides = ref<Record<string, number>>({});
const priceLookup = computed(() => ({ ...USD_PRICE_HINTS, ...priceOverrides.value }));
const retroPrice = computed(() => {
  const val = priceLookup.value.RETRO;
  return val && val > 0 ? val : null;
});

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

const knownAccounts = computed(() => labeledAccounts.value.filter((acc) => !!acc.knownLabel));

const communityAccounts = computed(() =>
  labeledAccounts.value.filter(acc => !acc.knownLabel)
);

const filteredCommunityAccounts = computed(() => {
  let filtered = communityAccounts.value;

  if (searchQuery.value) {
    filtered = filtered.filter(a =>
      a.address.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  filtered = [...filtered].sort((a, b) => {
    if (sortBy.value === 'balance') {
      const diff = parseInt(b.balance) - parseInt(a.balance);
      return sortOrder.value === 'desc' ? diff : -diff;
    }
    const diff = a.address.localeCompare(b.address);
    return sortOrder.value === 'desc' ? -diff : diff;
  });

  return filtered;
});

const accountUsd = (acc: WalletSummary) => {
  if (!retroPrice.value) return null;
  const micro = Number(acc.balance || 0);
  if (!Number.isFinite(micro)) return null;
  return (micro / 1_000_000) * retroPrice.value;
};

const totalBalanceUsd = computed(() => {
  if (!retroPrice.value) return null;
  const usd = accounts.value
    .map((a) => accountUsd(a))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!usd.length) return null;
  return usd.reduce((a, b) => a + b, 0);
});

const topHolders = computed(() => filteredCommunityAccounts.value.slice(0, 5));

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
  fetchLivePrices();
});

const fetchLivePrices = async () => {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=retro,usd-coin,osmosis,cosmos,wrapped-bitcoin&vs_currencies=usd',
      { cache: 'no-store' }
    );
    const data = await res.json();
    const overrides: Record<string, number> = {};
    const retro = Number(data?.retro?.usd);
    if (Number.isFinite(retro) && retro > 0) overrides.RETRO = retro;
    const usdc = Number(data?.['usd-coin']?.usd);
    if (Number.isFinite(usdc) && usdc > 0) overrides.USDC = usdc;
    const osmo = Number(data?.osmosis?.usd);
    if (Number.isFinite(osmo) && osmo > 0) overrides.OSMO = osmo;
    const atom = Number(data?.cosmos?.usd);
    if (Number.isFinite(atom) && atom > 0) overrides.ATOM = atom;
    const wbtc = Number(data?.['wrapped-bitcoin']?.usd);
    if (Number.isFinite(wbtc) && wbtc > 0) overrides.WBTC = wbtc;
    priceOverrides.value = overrides;
  } catch (err) {
    console.warn('Failed to fetch live prices', err);
  }
};
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
        <div class="flex flex-wrap gap-2">
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
            {{ loading ? 'Loading...' : '🔄 Refresh' }}
          </button>
          <button 
            class="btn text-xs" 
            @click="router.push({ name: 'ecosystem-accounts' })"
          >
            Ecosystem Wallets →
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
        <div class="text-xs text-emerald-300" v-if="totalBalanceUsd !== null">≈ {{ formatUsd(totalBalanceUsd) }}</div>
        <div class="text-xs text-slate-500">Across all accounts</div>
      </div>
      
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Chain Total</div>
        <div class="text-2xl font-bold text-indigo-400">{{ totalAccounts || accounts.length }}</div>
        <div class="text-xs text-slate-500">Reported by auth module</div>
      </div>
    </div>

    <!-- Featured / Top Holders -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div class="card" v-if="knownAccounts.length">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Featured Accounts</h2>
          <span class="text-[11px] text-slate-500">From curated labels</span>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <div
            v-for="acc in knownAccounts.slice(0, 4)"
            :key="acc.address"
            class="p-3 rounded-xl bg-slate-900/60 border border-amber-400/30"
          >
            <div class="flex items-center gap-2 text-xs">
              <span class="text-xl">{{ acc.knownLabel?.icon }}</span>
              <div>
                <div class="font-semibold text-amber-100">{{ acc.knownLabel?.label }}</div>
                <div class="text-[10px] text-slate-500">{{ acc.address.slice(0, 10) }}...{{ acc.address.slice(-6) }}</div>
              </div>
            </div>
            <div class="mt-2 text-[11px] text-slate-300">{{ acc.knownLabel?.description }}</div>
            <div class="mt-2 text-sm font-mono text-emerald-200">
              {{ formatAmount(acc.balance, acc.denom, { minDecimals: 2, maxDecimals: 2 }) }}
              <span v-if="accountUsd(acc) !== null" class="text-[11px] text-emerald-300 ml-1">(≈ {{ formatUsd(accountUsd(acc)) }})</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-sm font-semibold text-slate-100">Top Holders</h2>
          <span class="text-[11px] text-slate-500">Based on loaded set</span>
        </div>
        <div v-if="topHolders.length === 0" class="text-xs text-slate-400">No accounts loaded.</div>
        <div v-else class="space-y-2">
          <div
            v-for="(acc, idx) in topHolders"
            :key="acc.address"
            class="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span class="text-lg">{{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐' }}</span>
              <div class="text-xs font-mono text-slate-200">{{ acc.address.slice(0, 12) }}...{{ acc.address.slice(-8) }}</div>
            </div>
            <div class="text-right text-xs">
              <div class="font-mono text-emerald-200">
                {{ formatAmount(acc.balance, acc.denom, { minDecimals: 2, maxDecimals: 2 }) }}
              </div>
              <div v-if="accountUsd(acc) !== null" class="text-[11px] text-emerald-300">≈ {{ formatUsd(accountUsd(acc)) }}</div>
            </div>
          </div>
        </div>
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
          Accounts ({{ filteredCommunityAccounts.length }})
        </h2>
        <div class="flex gap-2 text-xs">
          <button 
            class="btn"
            :class="sortBy === 'balance' ? 'border-cyan-400/70 bg-cyan-500/10' : ''"
            @click="toggleSort('balance')"
          >
            Balance {{ sortBy === 'balance' ? (sortOrder === 'desc' ? '▼' : '▲') : '' }}
          </button>
          <button 
            class="btn"
            :class="sortBy === 'address' ? 'border-cyan-400/70 bg-cyan-500/10' : ''"
            @click="toggleSort('address')"
          >
            Address {{ sortBy === 'address' ? (sortOrder === 'desc' ? '▼' : '▲') : '' }}
          </button>
        </div>
      </div>

      <div v-if="filteredCommunityAccounts.length === 0" class="text-center py-12">
        <div class="text-4xl mb-3">😕</div>
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
              <th class="text-right">USD</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(account, index) in filteredCommunityAccounts"
              :key="account.address"
              class="cursor-pointer hover:bg-white/5 transition-colors"
              @click="router.push({ name: 'account', params: { address: account.address } })"
            >
              <td class="font-mono text-xs">
                <span v-if="index === 0 && sortBy === 'balance' && sortOrder === 'desc'" class="text-yellow-300">🥇</span>
                <span v-else-if="index === 1 && sortBy === 'balance' && sortOrder === 'desc'" class="text-slate-300">🥈</span>
                <span v-else-if="index === 2 && sortBy === 'balance' && sortOrder === 'desc'" class="text-orange-300">🥉</span>
                <span v-else>{{ index + 1 }}</span>
              </td>
              
              <td class="text-xs">
                <div class="flex items-center gap-2 font-mono">
                  <span>{{ account.address.slice(0, 12) }}...{{ account.address.slice(-8) }}</span>
                  <RcIconButton variant="ghost" size="xs" title="Copy address" @click.stop="copy(account.address)">
                    <Copy class="h-3.5 w-3.5" />
                  </RcIconButton>
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
                <RcIconButton
                  variant="ghost"
                  size="sm"
                  title="View account"
                  @click.stop="router.push({ name: 'account', params: { address: account.address } })"
                >
                  <ArrowRight class="h-4 w-4" />
                </RcIconButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Info -->
    <div class="card bg-slate-900/50 border-slate-700">
      <h3 class="text-sm font-semibold mb-2 text-slate-100">ℹ️ About This Page</h3>
      <ul class="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
        <li>Displays paginated accounts returned by the Cosmos auth module</li>
        <li>Balances are fetched directly from the bank module in real-time</li>
        <li>Sorted by balance (highest first) by default</li>
        <li>Click any account to view detailed information</li>
        <li>Top 3 accounts are highlighted with medals 🥇 🥈 🥉</li>
      </ul>
    </div>
  </div>
</template>
