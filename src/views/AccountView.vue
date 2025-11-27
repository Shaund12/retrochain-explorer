<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAccount } from "@/composables/useAccount";
import { useTxs } from "@/composables/useTxs";
import { useToast } from "@/composables/useToast";
import { useKeplr } from "@/composables/useKeplr";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";

const route = useRoute();
const router = useRouter();
const { balances, bech32Address, loading, error, load } = useAccount();
const { txs, searchByAddress } = useTxs();
const { notify } = useToast();
const { address: keplrAddress } = useKeplr();

const addressInput = ref<string>((route.params.address as string) || "");
const loadingTxs = ref(false);

const totalBalance = computed(() => {
  const retroBalance = balances.value.find(b => b.denom === "uretro");
  if (!retroBalance) return "0 RETRO";
  const amount = parseInt(retroBalance.amount, 10) / 1_000_000;
  return `${amount.toFixed(6)} RETRO`;
});

const submit = async () => {
  if (!addressInput.value) {
    notify("Enter a RetroChain address first.");
    return;
  }
  router.replace({ name: "account", params: { address: addressInput.value } });
  await loadAccount();
};

const loadAccount = async () => {
  await load(addressInput.value);
  
  // Load transactions for this address
  if (addressInput.value) {
    loadingTxs.value = true;
    try {
      await searchByAddress(addressInput.value, 20);
    } catch (e) {
      console.error("Failed to load transactions:", e);
    } finally {
      loadingTxs.value = false;
    }
  }
};

const formatAmount = (amount: string, denom: string) => {
  if (denom === "uretro") {
    return `${(parseInt(amount, 10) / 1_000_000).toFixed(6)} RETRO`;
  }
  return `${amount} ${denom}`;
};

onMounted(async () => {
  // If route has an address, use it
  if (addressInput.value) {
    await loadAccount();
  }
  // Otherwise, if Keplr is connected, auto-load that address
  else if (keplrAddress.value) {
    addressInput.value = keplrAddress.value;
    await loadAccount();
  }
});

// Watch for Keplr connection changes
watch(keplrAddress, (newAddress) => {
  // If no address is currently loaded and Keplr connects, auto-load
  if (newAddress && !bech32Address.value) {
    addressInput.value = newAddress;
    loadAccount();
  }
});

watch(error, (val) => {
  if (val) notify(val);
});
</script>

<template>
  <div class="space-y-3">
    <!-- Search Section -->
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50 mb-2">
        Account Explorer
      </h1>
      <p class="text-sm text-slate-400 mb-4">
        Look up balances and transactions for any RetroChain account
      </p>

      <!-- Keplr Quick Load -->
      <div v-if="keplrAddress && !bech32Address" class="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-emerald-400 text-lg">Link</span>
            <div>
              <div class="text-sm font-medium text-emerald-200">Keplr Wallet Connected</div>
              <code class="text-xs text-slate-400">{{ keplrAddress.slice(0, 20) }}...{{ keplrAddress.slice(-8) }}</code>
            </div>
          </div>
          <button 
            class="btn btn-primary text-xs" 
            @click="addressInput = keplrAddress; submit()"
          >
            Load My Account
          </button>
        </div>
      </div>

      <form class="flex gap-2 max-w-2xl" @submit.prevent="submit">
        <div class="relative flex-1">
          <input
            v-model="addressInput"
            type="text"
            placeholder="Enter address (retro1... or retrovaloper1...)"
            class="w-full px-4 py-2.5 rounded-full bg-slate-900/90 border border-slate-700 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
          />
          <!-- Badge showing if this is your Keplr address -->
          <div 
            v-if="bech32Address && keplrAddress && bech32Address === keplrAddress"
            class="absolute right-4 top-1/2 -translate-y-1/2 badge border-emerald-400/60 text-emerald-200 text-xs"
          >
            Your Wallet
          </div>
        </div>
        <button class="btn btn-primary text-sm" type="submit" :disabled="loading">
          {{ loading ? "Loading..." : "Search" }}
        </button>
      </form>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !bech32Address">
      <RcLoadingSpinner size="md" text="Loading account data..." />
    </div>

    <!-- Error State -->
    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <!-- Account Data -->
    <template v-if="bech32Address">
      <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <!-- Balance Overview -->
        <div class="card">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Total Balance
          </div>
          <div class="text-2xl font-bold text-emerald-400 mb-1">
            {{ totalBalance }}
          </div>
          <div class="text-xs text-slate-400">
            Address: <code class="text-[10px]">{{ bech32Address.slice(0, 16) }}...</code>
          </div>
        </div>

        <!-- Assets Count -->
        <div class="card">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Assets
          </div>
          <div class="text-2xl font-bold text-cyan-400 mb-1">
            {{ balances.length }}
          </div>
          <div class="text-xs text-slate-400">
            Different denominations
          </div>
        </div>

        <!-- Transactions -->
        <div class="card">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Transactions
          </div>
          <div class="text-2xl font-bold text-indigo-400 mb-1">
            {{ txs.length }}
          </div>
          <div class="text-xs text-slate-400">
            Recent activities
          </div>
        </div>
      </div>

      <!-- Balances Table -->
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">Balances</h2>
        
        <div v-if="balances.length === 0" class="text-sm text-slate-400">
          No balances found for this address
        </div>
        
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-300">
                <th>Denomination</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Formatted</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in balances" :key="b.denom" class="animate-fade-in">
                <td class="font-mono text-sm">{{ b.denom }}</td>
                <td class="font-mono text-right text-sm text-slate-300">{{ b.amount }}</td>
                <td class="text-right text-sm text-emerald-300">
                  {{ formatAmount(b.amount, b.denom) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100">Recent Transactions</h2>
          <span v-if="loadingTxs" class="text-xs text-slate-400">Loading...</span>
        </div>
        
        <div v-if="txs.length === 0 && !loadingTxs" class="text-sm text-slate-400">
          No recent transactions found
        </div>
        
        <div v-else-if="txs.length > 0" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-300">
                <th>Hash</th>
                <th>Height</th>
                <th>Status</th>
                <th>Gas</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in txs"
                :key="t.hash"
                class="cursor-pointer animate-fade-in"
                @click="router.push({ name: 'tx-detail', params: { hash: t.hash } })"
              >
                <td class="font-mono text-xs">{{ t.hash.slice(0, 16) }}...</td>
                <td class="font-mono text-sm">{{ t.height }}</td>
                <td>
                  <span
                    class="badge text-xs"
                    :class="t.code === 0 ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'"
                  >
                    {{ t.code === 0 ? "Success" : "Failed" }}
                  </span>
                </td>
                <td class="text-xs text-slate-300">
                  {{ t.gasUsed || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Help Section -->
    <div class="card bg-slate-900/50 border-slate-700">
      <h2 class="text-sm font-semibold mb-2 text-slate-100">
        Tips
      </h2>
      <ul class="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
        <li>
          Use <code class="text-emerald-400">alice</code> and <code class="text-emerald-400">bob</code> accounts from Ignite's default setup
        </li>
        <li>
          Access the faucet at <code class="text-cyan-400">http://localhost:4500</code> to get test tokens
        </li>
        <li>
          All amounts are shown in micro-units (1 RETRO = 1,000,000 uretro)
        </li>
        <li>
          Validator addresses start with <code class="text-indigo-400">retrovaloper</code>
        </li>
      </ul>
    </div>
  </div>
</template>
