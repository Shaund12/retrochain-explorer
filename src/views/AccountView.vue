<script setup lang="ts">
import { onMounted, ref, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAccount } from "@/composables/useAccount";
import { useTxs } from "@/composables/useTxs";
import { useToast } from "@/composables/useToast";
import { useKeplr } from "@/composables/useKeplr";
import { useNetwork } from "@/composables/useNetwork";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import { useFaucet } from "@/composables/useFaucet";
import { formatAmount as fmtAmount } from "@/utils/format";
import RcAddKeplrButton from "@/components/RcAddKeplrButton.vue";
import { getAccountLabel } from "@/constants/accountLabels";
import { getTokenMeta, type TokenAccent, type TokenMeta } from "@/constants/tokens";

const route = useRoute();
const router = useRouter();
const { balances, bech32Address, accountInfo, loading, error, load } = useAccount();
const { txs, searchByAddress } = useTxs();
const { notify } = useToast();
const { address: keplrAddress } = useKeplr();
const { base: faucetBase, loading: faucetLoading, error: faucetError, requestTokens } = useFaucet();
const faucetAmount = ref<string>("1000000"); // default 1 RETRO in micro (uretro)

const addressInput = ref<string>((route.params.address as string) || "");
const loadingTxs = ref(false);

// Transfer state
const showTransferModal = ref(false);
const transferRecipient = ref("");
const transferAmount = ref("");
const transferMemo = ref("");
const transferring = ref(false);
const showTokenDetails = ref(false);
const selectedToken = ref<DecoratedBalance | null>(null);

// Address book
const addressBook = ref<Array<{name: string, address: string}>>([
  { name: "Alice", address: "cosmos1..." },
  { name: "Bob", address: "cosmos1..." },
]);

// Load address book from localStorage
const loadAddressBook = () => {
  try {
    const saved = localStorage.getItem('retrochain_address_book');
    if (saved) {
      addressBook.value = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load address book', e);
  }
};

// Save address book to localStorage
const saveAddressBook = () => {
  try {
    localStorage.setItem('retrochain_address_book', JSON.stringify(addressBook.value));
  } catch (e) {
    console.error('Failed to save address book', e);
  }
};

// Add to address book
const addToAddressBook = (name: string, address: string) => {
  if (!name || !address) return;
  addressBook.value.push({ name, address });
  saveAddressBook();
};

// Remove from address book
const removeFromAddressBook = (index: number) => {
  addressBook.value.splice(index, 1);
  saveAddressBook();
};

const totalBalance = computed(() => {
  const coin = balances.value.find(b => b.denom === "uretro") || balances.value[0];
  if (!coin) return "0.000000 RETRO";
  return fmtAmount(coin.amount, coin.denom, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
});

const knownAccount = computed(() => getAccountLabel(bech32Address.value || addressInput.value));

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

const formatAmount = (amount: string, denom: string) => fmtAmount(amount, denom, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });

interface AccentClasses {
  card: string;
  icon: string;
  badge: string;
}

const ACCENT_CLASS_MAP: Record<TokenAccent, AccentClasses> = {
  emerald: {
    card: "border-emerald-400/40 bg-emerald-500/5",
    icon: "bg-emerald-500/10 text-emerald-200 border border-emerald-400/30",
    badge: "border-emerald-400/60 text-emerald-200"
  },
  sky: {
    card: "border-cyan-400/40 bg-cyan-500/5",
    icon: "bg-cyan-500/10 text-cyan-200 border border-cyan-400/30",
    badge: "border-cyan-400/60 text-cyan-200"
  },
  violet: {
    card: "border-violet-400/40 bg-violet-500/5",
    icon: "bg-violet-500/10 text-violet-200 border border-violet-400/30",
    badge: "border-violet-400/60 text-violet-200"
  },
  amber: {
    card: "border-amber-400/40 bg-amber-500/5",
    icon: "bg-amber-500/10 text-amber-200 border border-amber-400/30",
    badge: "border-amber-400/60 text-amber-200"
  },
  slate: {
    card: "border-slate-600/60 bg-slate-900/60",
    icon: "bg-slate-800 text-slate-200 border border-slate-600/50",
    badge: "border-slate-500/60 text-slate-200"
  }
};

interface DecoratedBalance {
  denom: string;
  denomLabel: string;
  amount: string;
  formatted: string;
  displayAmount: string;
  rawAmount: number;
  meta: TokenMeta;
  accent: AccentClasses;
}

const decoratedBalances = computed<DecoratedBalance[]>(() => {
  return balances.value
    .map((coin) => {
      const meta = getTokenMeta(coin.denom);
      const decimals = meta.decimals ?? 6;
      const divisor = Math.pow(10, decimals);
      const numeric = Number(coin.amount ?? "0") / divisor;
      const localeAmount = Number.isFinite(numeric)
        ? `${numeric.toLocaleString(undefined, { maximumFractionDigits: Math.min(6, decimals) })} ${meta.symbol}`
        : formatAmount(coin.amount, coin.denom);

      return {
        denom: coin.denom,
        amount: coin.amount,
        denomLabel: meta.symbol || coin.denom,
        formatted: formatAmount(coin.amount, coin.denom),
        displayAmount: localeAmount,
        rawAmount: Number.isFinite(numeric) ? numeric : 0,
        meta,
        accent: ACCENT_CLASS_MAP[meta.accent] ?? ACCENT_CLASS_MAP.slate
      } as DecoratedBalance;
    })
    .sort((a, b) => b.rawAmount - a.rawAmount);
});

// Expose faucet URL for template without inline import.meta in interpolation
const FAUCET_DISPLAY = import.meta.env.VITE_FAUCET_URL || 'faucet';
const { current: network } = useNetwork();

onMounted(async () => {
  // Load address book
  loadAddressBook();
  
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

// Handle token transfer
const handleTransfer = async () => {
  if (!window.keplr || !keplrAddress.value) {
    notify("Please connect Keplr wallet first");
    return;
  }

  if (!transferRecipient.value || !transferAmount.value) {
    notify("Please enter recipient and amount");
    return;
  }

  transferring.value = true;
  const toast = useToast();
  toast.showInfo("Preparing transfer...");

  try {
    const chainId = network.value === 'mainnet' ? 'retrochain-mainnet' : 'retrochain-devnet-1';
    const denom = network.value === 'mainnet' ? 'uretro' : 'udretro';
    
    // Convert to micro units
    const amountInMicro = Math.floor(parseFloat(transferAmount.value) * 1_000_000).toString();

    // Create transfer message
    const msg = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: {
        fromAddress: keplrAddress.value,
        toAddress: transferRecipient.value,
        amount: [{
          denom: denom,
          amount: amountInMicro
        }]
      }
    };

    const fee = {
      amount: [{ denom: denom, amount: "5000" }],
      gas: "200000"
    };

    // Sign and broadcast
    const result = await (window.keplr as any).signAndBroadcast(
      chainId,
      keplrAddress.value,
      [msg],
      fee,
      transferMemo.value || "Transfer from RetroChain Explorer"
    );

    if (result.code === 0) {
      toast.showTxSuccess(result.transactionHash || "");
      showTransferModal.value = false;
      transferRecipient.value = "";
      transferAmount.value = "";
      transferMemo.value = "";
      // Reload account balances
      await loadAccount();
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Transfer failed:", e);
    const toast = useToast();
    toast.showTxError(e.message || "Transaction failed");
  } finally {
    transferring.value = false;
  }
};

// Select address from address book
const selectFromAddressBook = (address: string) => {
  transferRecipient.value = address;
};

const copyAddress = async () => {
  if (!bech32Address.value) return;
  try {
    await navigator.clipboard?.writeText(bech32Address.value);
    notify("Address copied to clipboard!");
  } catch {
    notify("Failed to copy address");
  }
};

const openTokenDetails = (bal: DecoratedBalance) => {
  selectedToken.value = bal;
  showTokenDetails.value = true;
};

const closeTokenDetails = () => {
  showTokenDetails.value = false;
  selectedToken.value = null;
};
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
      <!-- Keplr Setup Notice -->
      <div v-if="keplrAddress && keplrAddress === bech32Address" class="card border-indigo-500/50 bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
        <div class="flex items-center gap-3">
          <div class="text-3xl">??</div>
          <div class="flex-1">
            <div class="text-sm font-semibold text-slate-100 mb-1">Keplr Wallet Setup</div>
            <div class="text-xs text-slate-400 mb-2">
              To see your balance in Keplr wallet, you need to add RetroChain to Keplr first.
            </div>
            <div class="flex items-center gap-2">
              <RcAddKeplrButton />
              <span class="text-xs text-slate-500">? Click here to add RetroChain to Keplr</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
        <!-- Balance Overview -->
        <div class="card">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Total Balance
          </div>
          <div class="text-2xl font-bold text-emerald-400 mb-1">
            {{ totalBalance }}
          </div>
          <div class="text-xs text-slate-400 mb-3">
            Address: <code class="text-[10px]">{{ bech32Address.slice(0, 16) }}...</code>
          </div>

          <div
            v-if="knownAccount"
            class="mb-4 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/10 p-3 shadow-lg shadow-amber-500/10"
          >
            <div class="flex items-start gap-3">
              <div class="text-3xl leading-none">
                {{ knownAccount.icon }}
              </div>
              <div class="flex-1 space-y-1">
                <div class="text-[11px] uppercase tracking-[0.2em] text-amber-200/80">
                  Featured Wallet
                </div>
                <div class="text-base font-semibold text-amber-50">
                  {{ knownAccount.label }}
                </div>
                <p class="text-xs text-amber-100/80 leading-relaxed">
                  {{ knownAccount.description }}
                </p>
              </div>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div v-if="keplrAddress && keplrAddress === bech32Address" class="flex gap-2">
            <button class="btn btn-primary text-xs flex-1" @click="showTransferModal = true">
              🚀 Send Tokens
            </button>
            <button class="btn text-xs" @click="copyAddress">
              📋 Copy
            </button>
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

        <!-- Faucet Quick Request (hidden on mainnet) -->
        <div v-if="network !== 'mainnet'" class="card">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">Faucet</div>
          <div class="text-[11px] text-slate-500 mb-2">Endpoint: <code class="text-[10px]">{{ faucetBase }}/request</code></div>
          <div class="flex items-center gap-2">
            <input v-model="faucetAmount" type="number" min="1" class="flex-1 px-3 py-2 rounded bg-slate-900/80 border border-slate-700 text-xs font-mono" placeholder="Amount in uretro" />
            <button class="btn btn-primary text-xs" :disabled="faucetLoading" @click="requestTokens(bech32Address, faucetAmount, 'uretro').then(()=>notify('Faucet requested')).catch(()=>notify('Faucet failed'))">
              {{ faucetLoading ? 'Requesting...' : 'Request Tokens' }}
            </button>
          </div>
          <div v-if="faucetError" class="text-[11px] text-rose-300 mt-2">{{ faucetError }}</div>
        </div>
      </div>

      <!-- Account Meta + Balances Table -->
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">Account</h2>
        <div v-if="accountInfo" class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
          <div class="p-3 rounded bg-slate-900/60 border border-slate-700">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Account Number</div>
            <div class="font-mono">{{ accountInfo.account_number || accountInfo.base_account?.account_number || '' }}</div>
          </div>
          <div class="p-3 rounded bg-slate-900/60 border border-slate-700">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Sequence</div>
            <div class="font-mono">{{ accountInfo.sequence || accountInfo.base_account?.sequence || '' }}</div>
          </div>
          <div class="p-3 rounded bg-slate-900/60 border border-slate-700 overflow-hidden">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">PubKey</div>
            <code class="text-[10px] break-all">{{ accountInfo.pub_key?.key || accountInfo.base_account?.pub_key?.key || '' }}</code>
          </div>
        </div>
        <h3 class="text-sm font-semibold text-slate-100 mb-2">Balances</h3>
        
        <div v-if="balances.length === 0" class="text-sm text-slate-400">
          No balances found for this address
        </div>
        
        <div v-else class="grid gap-3 sm:grid-cols-2">
          <article
            v-for="bal in decoratedBalances"
            :key="bal.denom"
            class="p-4 rounded-2xl border shadow-inner animate-fade-in"
            :class="bal.accent.card"
          >
            <div class="flex items-center gap-3">
              <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl emoji-text"
                   :class="bal.accent.icon">
                {{ bal.meta.icon }}
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 text-sm font-semibold text-white">
                  <span>{{ bal.meta.symbol }}</span>
                  <span class="badge text-[10px]" :class="bal.accent.badge">{{ bal.meta.chain }}</span>
                </div>
                <p class="text-xs text-slate-400">{{ bal.meta.name }}</p>
                <p class="text-[11px] text-slate-500 font-mono">{{ bal.denomLabel }}</p>
                <p v-if="bal.denomLabel !== bal.denom" class="text-[10px] text-slate-600 font-mono break-all">{{ bal.denom }}</p>
              </div>
            </div>
            <div class="mt-3 flex items-end justify-between gap-4">
              <div>
                <div class="text-[10px] text-slate-500 uppercase tracking-widest">On-chain Amount</div>
                <div class="font-mono text-sm text-slate-200">{{ bal.amount }}</div>
                <div v-if="bal.meta.description" class="text-[10px] text-slate-500 mt-1">
                  {{ bal.meta.description }}
                </div>
              </div>
              <div class="text-right">
                <div class="text-lg font-semibold text-white">{{ bal.displayAmount }}</div>
                <div class="text-xs text-slate-400">{{ bal.formatted }}</div>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <button class="btn text-[11px]" @click="openTokenDetails(bal)">
                🔍 Token Details
              </button>
            </div>
          </article>
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

    <!-- Help Section (hidden on mainnet) -->
    <div v-if="network !== 'mainnet'" class="card bg-slate-900/50 border-slate-700">
      <h2 class="text-sm font-semibold mb-2 text-slate-100">Tips</h2>
      <ul class="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
        <li>Use <code class="text-emerald-400">alice</code> and <code class="text-emerald-400">bob</code> accounts from Ignite's default setup</li>
        <li>Access the faucet at <code class="text-cyan-400">{{ FAUCET_DISPLAY }}</code> to get test tokens</li>
        <li>All amounts are shown in micro-units (1 RETRO = 1,000,000 uretro)</li>
        <li>Validator addresses start with <code class="text-indigo-400">retrovaloper</code></li>
      </ul>
    </div>

    <!-- Transfer Modal -->
    <div v-if="showTransferModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" @click.self="showTransferModal = false">
      <div class="card max-w-2xl w-full max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-slate-100 flex items-center gap-2">
            <span>🚀</span> Send Tokens
          </h2>
          <button class="btn text-xs" @click="showTransferModal = false">✖ Close</button>
        </div>

        <div class="space-y-4">
          <!-- Recipient -->
          <div>
            <label class="text-xs text-slate-400 mb-2 block">Recipient Address</label>
            <input 
              v-model="transferRecipient"
              type="text"
              placeholder="cosmos1..."
              class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm font-mono"
            />
          </div>

          <!-- Address Book -->
          <div v-if="addressBook.length > 0" class="space-y-2">
            <div class="text-xs text-slate-400">⚡ Quick Select</div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="(contact, index) in addressBook"
                :key="index"
                class="p-2 rounded-lg border border-slate-700 hover:border-indigo-500/50 transition-all text-left"
                @click="selectFromAddressBook(contact.address)"
              >
                <div class="text-xs font-semibold text-slate-200">{{ contact.name }}</div>
                <div class="text-[10px] text-slate-400 font-mono truncate">{{ contact.address }}</div>
              </button>
            </div>
          </div>

          <!-- Amount -->
          <div>
            <label class="text-xs text-slate-400 mb-2 block">Amount ({{ network === 'mainnet' ? 'RETRO' : 'DRETRO' }})</label>
            <div class="relative">
              <input 
                v-model="transferAmount"
                type="number"
                step="0.000001"
                placeholder="0.000000"
                class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm pr-20"
              />
              <button 
                class="absolute right-2 top-1/2 -translate-y-1/2 btn text-xs"
                @click="transferAmount = (parseFloat(totalBalance.split(' ')[0]) * 0.9).toFixed(6)"
              >
                Max
              </button>
            </div>
            <div class="text-xs text-slate-500 mt-1">Available: {{ totalBalance }}</div>
          </div>

          <!-- Memo -->
          <div>
            <label class="text-xs text-slate-400 mb-2 block">Memo (Optional)</label>
            <input 
              v-model="transferMemo"
              type="text"
              placeholder="Payment note..."
              class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
            />
          </div>

          <!-- Transaction Info -->
          <div class="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <div class="text-xs text-indigo-300 space-y-1">
              <div class="flex justify-between">
                <span>Network Fee:</span>
                <span class="font-mono">0.005 {{ network === 'mainnet' ? 'RETRO' : 'DRETRO' }}</span>
              </div>
              <div class="flex justify-between">
                <span>Total:</span>
                <span class="font-mono font-bold">
                  {{ transferAmount ? (parseFloat(transferAmount) + 0.005).toFixed(6) : '0.005' }} 
                  {{ network === 'mainnet' ? 'RETRO' : 'DRETRO' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Send Button -->
          <button 
            class="btn btn-primary w-full"
            @click="handleTransfer"
            :disabled="!transferRecipient || !transferAmount || transferring"
          >
            {{ transferring ? 'Sending...' : '🚀 Send Tokens' }}
          </button>
        </div>

        <!-- Address Book Management -->
        <div class="mt-6 pt-6 border-t border-slate-700">
          <h3 class="text-sm font-semibold text-slate-100 mb-3">📒 Address Book</h3>
          
          <!-- Add New Contact -->
          <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 mb-3">
            <div class="text-xs text-slate-400 mb-2">Add New Contact</div>
            <div class="flex gap-2">
              <input 
                ref="newContactName"
                type="text"
                placeholder="Name"
                class="w-32 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
              />
              <input 
                ref="newContactAddress"
                type="text"
                placeholder="cosmos1..."
                class="flex-1 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono"
              />
              <button 
                class="btn text-xs"
                @click="() => {
                  const name = ($refs.newContactName as HTMLInputElement)?.value;
                  const addr = ($refs.newContactAddress as HTMLInputElement)?.value;
                  if (name && addr) {
                    addToAddressBook(name, addr);
                    ($refs.newContactName as HTMLInputElement).value = '';
                    ($refs.newContactAddress as HTMLInputElement).value = '';
                  }
                }"
              >
                + Add
              </button>
            </div>
          </div>

          <!-- Contact List -->
          <div class="space-y-2">
            <div
              v-for="(contact, index) in addressBook"
              :key="index"
              class="p-2 rounded-lg bg-slate-900/60 border border-slate-700 flex items-center justify-between"
            >
              <div class="flex-1">
                <div class="text-xs font-semibold text-slate-200">{{ contact.name }}</div>
                <div class="text-[10px] text-slate-400 font-mono">{{ contact.address }}</div>
              </div>
              <button 
                class="btn text-xs text-rose-300 hover:text-rose-200"
                @click="removeFromAddressBook(index)"
              >
                ???
              </button>
            </div>
            <div v-if="addressBook.length === 0" class="text-xs text-slate-500 text-center py-4">
              No contacts yet. Add your first contact above!
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Token Details Modal -->
    <div
      v-if="showTokenDetails && selectedToken"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      @click.self="closeTokenDetails"
    >
      <div class="card w-full max-w-2xl" :class="selectedToken.accent.card" @click.stop>
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-3xl emoji-text" :class="selectedToken.accent.icon">
              {{ selectedToken.meta.icon }}
            </div>
            <div>
              <h2 class="text-lg font-bold text-white">{{ selectedToken.meta.symbol }} Details</h2>
              <p class="text-xs text-slate-300">{{ selectedToken.meta.name }} · {{ selectedToken.meta.chain }}</p>
            </div>
          </div>
          <button class="btn text-xs" @click="closeTokenDetails">✖ Close</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="p-3 rounded-xl bg-black/20 border border-white/5">
            <div class="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Display Amount</div>
            <div class="text-base font-semibold text-white">{{ selectedToken.displayAmount }}</div>
            <div class="text-xs text-slate-400">{{ selectedToken.formatted }}</div>
          </div>
          <div class="p-3 rounded-xl bg-black/20 border border-white/5">
            <div class="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Raw Amount</div>
            <div class="font-mono text-sm text-slate-200">{{ selectedToken.amount }}</div>
          </div>
          <div class="p-3 rounded-xl bg-black/20 border border-white/5">
            <div class="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Decimals</div>
            <div class="font-mono text-sm text-slate-200">{{ selectedToken.meta.decimals }}</div>
          </div>
          <div class="p-3 rounded-xl bg-black/20 border border-white/5">
            <div class="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Chain</div>
            <div class="text-sm text-slate-100">{{ selectedToken.meta.chain }}</div>
          </div>
        </div>

        <div class="mt-4 text-xs text-slate-400">
          Canonical Denom: <code class="text-[10px] break-all">{{ selectedToken.denom }}</code>
        </div>
        <p v-if="selectedToken.meta.description" class="mt-2 text-sm text-slate-300">
          {{ selectedToken.meta.description }}
        </p>
      </div>
    </div>
  </div>
</template>
