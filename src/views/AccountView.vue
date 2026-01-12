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
import { getAccountLabel } from "@/constants/accountLabels";
import { getTokenMeta, type TokenAccent, type TokenMeta } from "@/constants/tokens";
import dayjs from "dayjs";

const route = useRoute();
const router = useRouter();
const { balances, bech32Address, accountInfo, delegations, rewards, unbondings, loading, error, load } = useAccount();
const { txs, allTxs, searchByAddress } = useTxs();
const { notify } = useToast();
const { address: keplrAddress } = useKeplr();
const { base: faucetBase, loading: faucetLoading, error: faucetError, requestTokens } = useFaucet();
const faucetAmount = ref<string>("1000000"); // default 1 RETRO in micro (uretro)

const addressInput = ref<string>((route.params.address as string) || "");
const loadingTxs = ref(false);
const txPage = ref(1);
const txPageSize = ref(20);
const txHasMore = computed(() => txs.value.length > txPageSize.value);
const visibleTxs = computed(() => txs.value.slice(0, txPageSize.value));

const arcadeRewards = computed(() => {
  const rewards = allTxs.value.flatMap((tx) =>
    (tx.arcadeRewards || []).map((r) => ({ ...r, hash: tx.hash, height: tx.height, timestamp: tx.timestamp }))
  );
  return rewards.sort((a, b) => (b.height || 0) - (a.height || 0));
});

const totalArcadeRewards = computed(() => arcadeRewards.value.reduce((sum, r) => sum + (r.amount || 0), 0));

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

const retroPrice = computed(() => {
  const hint = priceLookup.value.RETRO;
  return hint && hint > 0 ? hint : null;
});

const totalUretroAll = computed(() => liquidUretro.value + stakedUretro.value + rewardsUretro.value + unbondingUretro.value + vestingUretro.value);

const totalRetroDisplay = computed(() => fmtAmount(String(totalUretroAll.value), "uretro", { minDecimals: 2, maxDecimals: 2, showZerosForIntegers: true }));

const totalRetroUsd = computed(() => {
  if (!retroPrice.value) return null;
  return (totalUretroAll.value / 1_000_000) * retroPrice.value;
});

const totalNonRetroUsd = computed(() => {
  return decoratedBalances.value
    .filter((b: any) => (b.meta?.symbol || "").toUpperCase() !== "RETRO")
    .map((b: any) => b.usdValue)
    .filter((v: any): v is number => typeof v === "number" && Number.isFinite(v))
    .reduce((a: number, b: number) => a + b, 0);
});

const totalUsdAll = computed(() => {
  const retro = totalRetroUsd.value ?? 0;
  const others = totalNonRetroUsd.value ?? 0;
  const total = retro + others;
  return total > 0 ? total : null;
});

const quickRetroStats = computed(() => {
  const items = [
    { label: "Liquid", amount: liquidUretro.value },
    { label: "Staked", amount: stakedUretro.value },
    { label: "Rewards", amount: rewardsUretro.value },
    { label: "Unbonding", amount: unbondingUretro.value },
    { label: "Vesting", amount: vestingUretro.value }
  ];
  return items.map((item) => {
    const display = fmtAmount(String(item.amount), "uretro", { minDecimals: 2, maxDecimals: 2 });
    const usd = retroPrice.value ? (item.amount / 1_000_000) * retroPrice.value : null;
    return { ...item, display, usd };
  });
});

const liquidUretro = computed(() => {
  const liquid = balances.value.find(b => b.denom === "uretro");
  return Number(liquid?.amount ?? "0");
});

const stakedUretro = computed(() => {
  return delegations.value.reduce((sum, d) => sum + Number(d?.balance?.amount ?? 0), 0);
});

const rewardsUretro = computed(() => {
  return rewards.value
    .filter((r: any) => r?.denom === "uretro")
    .reduce((sum: number, r: any) => sum + Number(r?.amount ?? 0), 0);
});

const unbondingUretro = computed(() => {
  return unbondings.value.reduce((sum, u) => {
    const entries: any[] = u?.entries || [];
    const sub = entries.reduce((s, e) => s + Number(e?.balance ?? 0), 0);
    return sum + sub;
  }, 0);
});

const vestingUretro = computed(() => {
  const base = accountInfo.value?.base_vesting_account;
  if (!base?.original_vesting) return 0;
  return base.original_vesting
    .filter((c: any) => c?.denom === "uretro")
    .reduce((sum: number, c: any) => sum + Number(c?.amount ?? 0), 0);
});

const portfolioBreakdown = computed(() => {
  const entries = [
    { label: "Liquid", amount: liquidUretro.value, color: "emerald" },
    { label: "Staked", amount: stakedUretro.value, color: "cyan" },
    { label: "Rewards", amount: rewardsUretro.value, color: "amber" },
    { label: "Unbonding", amount: unbondingUretro.value, color: "indigo" },
    { label: "Vesting", amount: vestingUretro.value, color: "violet" }
  ];
  const total = entries.reduce((s, e) => s + e.amount, 0) || 1;
  return entries.map(e => ({
    ...e,
    share: (e.amount / total) * 100,
    display: fmtAmount(String(e.amount), "uretro", { minDecimals: 2, maxDecimals: 2 })
  }));
});

const delegationDistribution = computed(() => {
  const total = stakedUretro.value || 1;
  return delegations.value
    .map((d: any) => {
      const amount = Number(d?.balance?.amount ?? 0);
      return {
        validator: d?.delegation?.validator_address || "-",
        amount,
        share: (amount / total) * 100
      };
    })
    .sort((a, b) => b.amount - a.amount);
});

const transferFlows = computed(() => {
  const map = new Map<string, { incoming: number; outgoing: number; denom: string }>();
  allTxs.value.forEach((tx) => {
    const date = (tx.timestamp || "").slice(0, 10);
    if (!date) return;
    const bucket = map.get(date) || { incoming: 0, outgoing: 0, denom: "uretro" };
    (tx.transfers || []).forEach((tr) => {
      const denom = (tr.denom || "").toLowerCase();
      bucket.denom = denom || bucket.denom;
      if (tr.direction === "in") bucket.incoming += tr.amount;
      if (tr.direction === "out") bucket.outgoing += tr.amount;
    });
    map.set(date, bucket);
  });
  const ordered = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  const recent = ordered.slice(-14);
  return recent.map(([date, v]) => ({ date, incoming: v.incoming, outgoing: v.outgoing, net: v.incoming - v.outgoing, denom: v.denom }));
});

const transferFlowsPage = ref(1);
const transferFlowsPageSize = ref(7);
const transferFlowsHasMore = computed(() => transferFlows.value.length > transferFlowsPage.value * transferFlowsPageSize.value);
const visibleTransferFlows = computed(() => {
  const start = (transferFlowsPage.value - 1) * transferFlowsPageSize.value;
  return transferFlows.value.slice(start, start + transferFlowsPageSize.value);
});

watch(transferFlows, () => {
  transferFlowsPage.value = 1;
});

const activityByType = computed(() => {
  const counts: Record<string, { count: number; lastHeight: number }> = {};
  allTxs.value.forEach((tx) => {
    (tx.messageTypes || []).forEach((type) => {
      if (!counts[type]) counts[type] = { count: 0, lastHeight: 0 };
      counts[type].count += 1;
      counts[type].lastHeight = Math.max(counts[type].lastHeight, tx.height || 0);
    });
  });
  return Object.entries(counts)
    .map(([type, meta]) => ({ type, ...meta }))
    .sort((a, b) => b.count - a.count);
});

const knownAccount = computed(() => getAccountLabel(bech32Address.value || addressInput.value));

const USD_PRICE_HINTS: Record<string, number | undefined> = {
  USDC: 1,
  RETRO: Number(import.meta.env.VITE_PRICE_RETRO_USD ?? "0") || undefined,
  OSMO: Number(import.meta.env.VITE_PRICE_OSMO_USD ?? "0") || 0.6,
  ATOM: Number(import.meta.env.VITE_PRICE_ATOM_USD ?? "0") || 10,
  WBTC: Number(import.meta.env.VITE_PRICE_WBTC_USD ?? "0") || 40000
};

const formatUsd = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const shortDenomLabel = (denom: string) => {
  if (!denom) return "—";
  const lower = denom.toLowerCase();
  if (lower.startsWith("factory/")) {
    const parts = denom.split("/");
    return parts[parts.length - 1] || denom;
  }
  return denom;
};

const shortFactoryPath = (denom: string) => {
  if (!denom?.toLowerCase().startsWith("factory/")) return denom;
  const parts = denom.split("/");
  const addr = parts[1] || "";
  const token = parts[2] || denom;
  const shortAddr = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
  return `factory/${shortAddr}/${token}`;
};

const priceOverrides = ref<Record<string, number>>({});

const priceLookup = computed(() => ({ ...USD_PRICE_HINTS, ...priceOverrides.value }));

const fetchLivePrices = async () => {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=osmosis,cosmos,wrapped-bitcoin&vs_currencies=usd",
      { cache: "no-store" }
    );
    const data = await res.json();
    const overrides: Record<string, number> = {};
    const osmo = Number(data?.osmosis?.usd);
    if (Number.isFinite(osmo) && osmo > 0) overrides.OSMO = osmo;
    const atom = Number(data?.cosmos?.usd);
    if (Number.isFinite(atom) && atom > 0) overrides.ATOM = atom;
    const wbtc = Number(data?.["wrapped-bitcoin"]?.usd);
    if (Number.isFinite(wbtc) && wbtc > 0) overrides.WBTC = wbtc;
    priceOverrides.value = overrides;
  } catch (err) {
    console.warn("Failed to fetch live prices", err);
  }
};

const submit = async () => {
  if (!addressInput.value) {
    notify("Enter a RetroChain address first.");
    return;
  }
  router.replace({ name: "account", params: { address: addressInput.value } });
  await loadAccount();
};

const loadAccount = async () => {
  txPage.value = 1;
  await load(addressInput.value);
  
  // Load transactions for this address
  if (addressInput.value) {
    await loadTransactions();
  }
};

const loadTransactions = async () => {
  if (!addressInput.value) return;
  loadingTxs.value = true;
  try {
    await searchByAddress(addressInput.value, txPageSize.value, txPage.value - 1);
  } catch (e) {
    console.error("Failed to load transactions:", e);
  } finally {
    loadingTxs.value = false;
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
  rawDenomDisplay: string | null;
  rawDenomTitle: string | null;
}

const decoratedBalances = computed<DecoratedBalance[]>(() => {
  return balances.value
    .map((coin) => {
      const meta = getTokenMeta(coin.denom);
      const denomLower = coin.denom?.toLowerCase() || "";
      const isLp = denomLower.startsWith("dex/");
      const isFactory = coin.denom?.toLowerCase().startsWith("factory/");
      const tokenLabel = shortDenomLabel(coin.denom);
      const displaySymbol = isFactory ? tokenLabel : (meta.symbol || tokenLabel);
      const displayName = isFactory ? tokenLabel : (meta.name || displaySymbol);
      const displayChain = isFactory ? "Factory asset" : meta.chain;
      const displayDescription = isFactory ? "Factory-issued token" : meta.description;
      const decimals = meta.decimals ?? 6;
      const divisor = Math.pow(10, decimals);
      const numeric = Number(coin.amount ?? "0") / divisor;
      const localeAmount = Number.isFinite(numeric)
        ? `${numeric.toLocaleString(undefined, { maximumFractionDigits: Math.min(6, decimals) })} ${displaySymbol}`
        : formatAmount(coin.amount, coin.denom);
      const priceHint = meta.symbol ? priceLookup.value[meta.symbol.toUpperCase()] : undefined;
      const usdValue = Number.isFinite(numeric) && priceHint && priceHint > 0 ? numeric * priceHint : null;
      const adjustedMeta: TokenMeta = {
        ...meta,
        symbol: displaySymbol,
        name: displayName,
        chain: displayChain,
        description: displayDescription
      };

      return {
        denom: coin.denom,
        amount: coin.amount,
        denomLabel: displaySymbol,
        formatted: formatAmount(coin.amount, coin.denom),
        displayAmount: localeAmount,
        rawAmount: Number.isFinite(numeric) ? numeric : 0,
        meta: adjustedMeta,
        accent: ACCENT_CLASS_MAP[adjustedMeta.accent] ?? ACCENT_CLASS_MAP.slate,
        usdValue,
        rawDenomDisplay: isLp ? null : coin.denom,
        rawDenomTitle: isLp ? null : null
      } as DecoratedBalance & { usdValue: number | null };
    })
    .sort((a, b) => b.rawAmount - a.rawAmount);
});

const totalPortfolioUsd = computed(() => {
  const values = decoratedBalances.value
    .map((b: any) => b.usdValue)
    .filter((v: any): v is number => typeof v === "number" && Number.isFinite(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0);
});

// Expose faucet URL for template without inline import.meta in interpolation
const FAUCET_DISPLAY = import.meta.env.VITE_FAUCET_URL || 'faucet';
const { current: network } = useNetwork();

onMounted(async () => {
  // Load address book
  loadAddressBook();
  // Fetch live USD prices for supported assets (fallback to env hints)
  fetchLivePrices();
  
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

watch(txPageSize, async () => {
  txPage.value = 1;
  await loadTransactions();
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

const formatFeeCoins = (fees?: Array<{ amount: string; denom: string }>) => {
  if (!fees || !fees.length) return "—";
  return fees
    .slice(0, 3)
    .map((f) => fmtAmount(f.amount, f.denom, { minDecimals: 2, maxDecimals: 2 }))
    .join(", ");
};

const formatValueTransfers = (values?: Array<{ amount: string; denom: string }>) => {
  if (!values || !values.length) return "—";
  return values
    .map((v) => `${fmtAmount(v.amount, v.denom, { minDecimals: 2, maxDecimals: 2 })}`)
    .join(", ");
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
      <div class="grid gap-3 grid-cols-1 lg:grid-cols-4">
        <!-- Balance Overview -->
        <div class="card">
          <div class="text-xs uppercase tracking-wider text-slate-400 mb-2">
            Total Balance
          </div>
          <div class="text-2xl font-bold text-emerald-400 mb-1">
            {{ totalRetroDisplay }}
          </div>
          <div class="text-xs text-emerald-200" v-if="totalRetroUsd !== null">
            ≈ {{ formatUsd(totalRetroUsd) }} (RETRO)
          </div>
          <div class="text-[11px] text-slate-400" v-if="totalUsdAll !== null">
            All assets (incl. IBC/WBTC): {{ formatUsd(totalUsdAll) }}
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
          <div class="mt-2 grid grid-cols-2 gap-2 text-[11px]" v-if="quickRetroStats.length">
            <div v-for="item in quickRetroStats" :key="item.label" class="p-2 rounded-lg bg-slate-900/60 border border-slate-700">
              <div class="flex items-center justify-between">
                <span class="text-slate-400 uppercase tracking-wider">{{ item.label }}</span>
                <span class="font-semibold text-slate-100">{{ item.display }}</span>
              </div>
              <div v-if="item.usd !== null" class="text-emerald-300">≈ {{ formatUsd(item.usd) }}</div>
            </div>
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

        <!-- Arcade Rewards -->
        <div class="card">
          <div class="flex items-center justify-between mb-2">
            <div>
              <div class="text-xs uppercase tracking-wider text-slate-400">Arcade Rewards</div>
              <div class="text-[11px] text-slate-500">From <code>arcade.reward_distributed</code> events</div>
            </div>
            <span class="badge border-emerald-400/60 text-emerald-200 text-[11px]">Game sessions</span>
          </div>
          <div class="text-2xl font-bold text-emerald-400 mb-1">
            {{ totalArcadeRewards.toLocaleString() }} pts
          </div>
          <div class="text-xs text-slate-400 mb-2">
            Earned across {{ arcadeRewards.length }} reward events
          </div>
          <div v-if="arcadeRewards.length" class="space-y-2 text-xs text-slate-300">
            <div
              v-for="reward in arcadeRewards.slice(0, 5)"
              :key="reward.hash + (reward.sessionId || '') + (reward.msgIndex || '')"
              class="p-2 rounded-lg bg-slate-900/60 border border-slate-800"
            >
              <div class="flex items-center justify-between">
                <div class="font-semibold text-emerald-200">+{{ reward.amount }} pts</div>
                <div class="text-[10px] text-slate-500">#{{ reward.height || '—' }}</div>
              </div>
              <div class="text-[11px] text-slate-400 flex flex-wrap gap-2">
                <span v-if="reward.gameId">Game: {{ reward.gameId }}</span>
                <span v-if="reward.sessionId">Session: {{ reward.sessionId }}</span>
                <span v-if="reward.timestamp">{{ dayjs(reward.timestamp).fromNow?.() || reward.timestamp }}</span>
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-slate-500">No arcade rewards found for this account yet.</div>
          <p class="mt-2 text-[11px] text-slate-500">
            Rewards are granted when a session ends (e.g., <code>MsgSubmitScore</code>) and are emitted as
            <code>arcade.reward_distributed</code> events on-chain.
          </p>
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

      <!-- Account Insights -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100">Account Insights</h2>
          <span class="text-[11px] text-slate-400">Live from bank / staking / distribution</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div
            v-for="entry in portfolioBreakdown"
            :key="entry.label"
            class="p-3 rounded-xl border bg-slate-900/60"
            :class="{
              'border-emerald-400/40 bg-emerald-500/5': entry.color === 'emerald',
              'border-cyan-400/40 bg-cyan-500/5': entry.color === 'cyan',
              'border-amber-400/40 bg-amber-500/5': entry.color === 'amber',
              'border-indigo-400/40 bg-indigo-500/5': entry.color === 'indigo',
              'border-violet-400/40 bg-violet-500/5': entry.color === 'violet'
            }"
          >
            <div class="text-[11px] uppercase tracking-widest text-slate-400 mb-1">{{ entry.label }}</div>
            <div class="text-sm font-semibold text-slate-100">{{ entry.display }}</div>
            <div class="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                class="h-full"
                :class="{
                  'bg-emerald-400': entry.color === 'emerald',
                  'bg-cyan-400': entry.color === 'cyan',
                  'bg-amber-400': entry.color === 'amber',
                  'bg-indigo-400': entry.color === 'indigo',
                  'bg-violet-400': entry.color === 'violet'
                }"
                :style="{ width: entry.share.toFixed(1) + '%' }"
              ></div>
            </div>
            <div class="text-[11px] text-slate-500 mt-1">{{ entry.share.toFixed(1) }}% of total</div>
          </div>
        </div>
      </div>

      <!-- Account Meta + Balances Table -->
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">Account</h2>
        <div v-if="accountInfo" class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
          <div class="p-3 rounded bg-slate-900/60 border border-slate-700">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Account Number</div>
            <div class="font-mono">{{ accountInfo.account_number || accountInfo.base_account?.account_number || '—' }}</div>
          </div>
          <div class="p-3 rounded bg-slate-900/60 border border-slate-700">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Sequence</div>
            <div class="font-mono">{{ accountInfo.sequence || accountInfo.base_account?.sequence || '—' }}</div>
          </div>
          <div class="p-3 rounded bg-slate-900/60 border border-slate-700 overflow-hidden">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">PubKey</div>
            <code class="text-[10px] break-all">{{ accountInfo.pub_key?.key || accountInfo.base_account?.pub_key?.key || '—' }}</code>
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
            class="p-4 rounded-2xl border shadow-inner animate-fade-in min-w-0"
            :class="bal.accent.card"
          >
            <div class="flex items-center gap-3">
              <div class="h-12 w-12 rounded-2xl flex items-center justify-center text-2xl emoji-text overflow-hidden"
                   :class="bal.accent.icon">
                <img
                  v-if="bal.meta.logo"
                  :src="bal.meta.logo"
                  :alt="`${bal.meta.symbol} logo`"
                  class="h-full w-full object-contain"
                  loading="lazy"
                />
                <span v-else>
                  {{ bal.meta.icon }}
                </span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 text-sm font-semibold text-white">
                  <span>{{ bal.meta.symbol }}</span>
                  <span class="badge text-[10px]" :class="bal.accent.badge">{{ bal.meta.chain }}</span>
                </div>
                <p class="text-xs text-slate-400">{{ bal.meta.name }}</p>
                <p class="text-[11px] text-slate-500 font-mono truncate max-w-[240px]">{{ bal.denomLabel }}</p>
                <p
                  v-if="bal.rawDenomDisplay"
                  class="text-[10px] text-slate-600 font-mono truncate max-w-[220px]"
                  :title="bal.rawDenomTitle || bal.rawDenomDisplay"
                >
                  {{ bal.rawDenomDisplay }}
                </p>
              </div>
            </div>
            <div class="mt-3 flex items-end justify-between gap-4">
              <div class="min-w-0">
                <div class="text-[10px] text-slate-500 uppercase tracking-widest">On-chain Amount</div>
                <div class="font-mono text-sm text-slate-200 truncate max-w-[240px]">{{ bal.displayAmount }}</div>
                <div v-if="bal.meta.description" class="text-[10px] text-slate-500 mt-1">
                  {{ bal.meta.description }}
                </div>
              </div>
              <div class="text-right min-w-0">
                <div class="text-lg font-semibold text-white truncate max-w-[200px] ml-auto">{{ bal.displayAmount }}</div>
                <div class="text-xs text-slate-400 truncate max-w-[200px] ml-auto">{{ bal.formatted }}</div>
                <div v-if="bal.usdValue !== null" class="text-[11px] text-emerald-300 truncate max-w-[200px] ml-auto">≈ {{ formatUsd(bal.usdValue) }}</div>
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

      <!-- Delegation Distribution -->
      <div class="card" v-if="delegationDistribution.length">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100">Delegation Distribution</h2>
          <span class="text-[11px] text-slate-400">Total staked: {{ fmtAmount(String(stakedUretro), 'uretro', { minDecimals: 2, maxDecimals: 2 }) }}</span>
        </div>
        <div class="space-y-2">
          <div
            v-for="row in delegationDistribution"
            :key="row.validator"
            class="p-3 rounded-lg bg-slate-900/60 border border-slate-800"
          >
            <div class="flex items-center justify-between text-xs mb-1">
              <div class="font-mono text-[11px] text-cyan-200">{{ row.validator }}</div>
              <div class="text-slate-200 font-semibold">{{ fmtAmount(String(row.amount), 'uretro', { minDecimals: 2, maxDecimals: 2 }) }}</div>
            </div>
            <div class="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full bg-cyan-400" :style="{ width: row.share.toFixed(1) + '%' }"></div>
            </div>
            <div class="text-[11px] text-slate-500 mt-1">{{ row.share.toFixed(1) }}% of staked</div>
          </div>
        </div>
      </div>

      <!-- Recent Transactions -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100">Recent Transactions</h2>
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <span v-if="loadingTxs">Loading...</span>
            <div class="flex items-center gap-1">
              <span class="text-[11px]">Per page</span>
              <select
                v-model.number="txPageSize"
                class="bg-slate-900/80 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
              >
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>
          </div>
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
                <th>Msgs</th>
                <th>Transfers</th>
                <th>Fee</th>
                <th>Gas</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in visibleTxs"
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
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="m in (t.messageTypes || []).slice(0, 3)"
                      :key="m"
                      class="badge text-[10px] border-indigo-400/40 text-indigo-100"
                    >
                      {{ m.split('.').pop() || m }}
                    </span>
                    <span v-if="(t.messageTypes?.length || 0) > 3" class="text-[10px] text-slate-500">+{{ t.messageTypes.length - 3 }}</span>
                  </div>
                </td>
                <td class="text-[11px] text-slate-200 whitespace-nowrap max-w-[200px] truncate" :title="formatValueTransfers(t.valueTransfers)">
                  {{ formatValueTransfers(t.valueTransfers) }}
                </td>
                <td class="text-[11px] text-slate-300" :title="formatFeeCoins(t.fees)">
                  {{ formatFeeCoins(t.fees) }}
                </td>
                <td class="text-xs text-slate-300">
                  {{ t.gasUsed || '-' }} / {{ t.gasWanted || '-' }}
                </td>
                <td class="text-[11px] text-slate-400 whitespace-nowrap">
                  {{ t.timestamp ? dayjs(t.timestamp).format('YYYY-MM-DD HH:mm:ss') : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="flex items-center justify-between mt-3 text-xs text-slate-400">
            <div>Page {{ txPage }}</div>
            <div class="flex items-center gap-2">
              <button class="btn text-[11px]" :disabled="txPage <= 1 || loadingTxs" @click="txPage = Math.max(1, txPage - 1); loadTransactions();">
                Prev
              </button>
              <button
                class="btn text-[11px]"
                :disabled="!txHasMore || loadingTxs"
                @click="txPage += 1; loadTransactions();"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Transfer Flows -->
      <div class="card" v-if="transferFlows.length">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100">Net Transfers (last 14 days)</h2>
          <div class="flex items-center gap-3 text-[11px] text-slate-400">
            <span>Incoming vs Outgoing (all denoms)</span>
            <div class="flex items-center gap-2">
              <button class="btn btn-xs" :disabled="transferFlowsPage <= 1" @click="transferFlowsPage = Math.max(1, transferFlowsPage - 1)">Prev</button>
              <button class="btn btn-xs" :disabled="!transferFlowsHasMore" @click="transferFlowsPage += 1">Next</button>
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <div
            v-for="day in visibleTransferFlows"
            :key="day.date"
            class="p-3 rounded-lg bg-slate-900/60 border border-slate-800"
          >
            <div class="flex items-center justify-between text-xs mb-2">
              <div class="text-slate-300 font-mono">{{ day.date }}</div>
              <div class="flex gap-3 text-[11px] text-slate-400">
                <span class="text-emerald-300">+{{ fmtAmount(String(day.incoming), day.denom, { minDecimals: 2, maxDecimals: 2 }) }}</span>
                <span class="text-rose-300">-{{ fmtAmount(String(day.outgoing), day.denom, { minDecimals: 2, maxDecimals: 2 }) }}</span>
                <span :class="day.net >= 0 ? 'text-emerald-200' : 'text-rose-200'">Net {{ fmtAmount(String(day.net), day.denom, { minDecimals: 2, maxDecimals: 2 }) }}</span>
              </div>
            </div>
            <div class="h-2 rounded-full bg-slate-800 overflow-hidden flex">
              <div class="h-full bg-emerald-400" :style="{ width: Math.min(100, (day.incoming / (day.incoming + day.outgoing || 1)) * 100) + '%' }"></div>
              <div class="h-full bg-rose-400" :style="{ width: Math.min(100, (day.outgoing / (day.incoming + day.outgoing || 1)) * 100) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity By Type -->
      <div class="card" v-if="activityByType.length">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-100">Activity by Message Type</h2>
          <div class="text-[11px] text-slate-400">Grouped from recent transactions</div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <div
            v-for="entry in activityByType"
            :key="entry.type"
            class="p-3 rounded-lg bg-slate-900/60 border border-slate-800"
          >
            <div class="text-[11px] uppercase tracking-widest text-slate-400 mb-1">{{ entry.type.split('.').pop() }}</div>
            <div class="text-lg font-bold text-slate-100">{{ entry.count }}</div>
            <div class="text-[11px] text-slate-500">Last seen at height {{ entry.lastHeight }}</div>
          </div>
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
                Remove
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
