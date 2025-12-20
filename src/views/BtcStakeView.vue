<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import dayjs from "dayjs";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useBtcStake } from "@/composables/useBtcStake";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import { useNetwork } from "@/composables/useNetwork";
import { getTokenMeta } from "@/constants/tokens";

const WBTC_DECIMALS = 8;
const RETRO_DECIMALS = 6;
const NETWORK = "retrochain-mainnet";

const toast = useToast();
const { address, connect, isAvailable, signAndBroadcastWithREST } = useKeplr();
const { restBase, rpcBase } = useNetwork();
const {
  params,
  pool,
  userStake,
  pendingRewards,
  userBalance,
  loading,
  userLoading,
  error,
  lastUpdated,
  restHealthy,
  rpcHealthy,
  allowedDenom,
  hasValidDenom,
  poolEndpoint,
  refreshAll,
  startPolling,
  stopPolling
} = useBtcStake();

const stakeAmount = ref("");
const unstakeAmount = ref("");
const txLoading = ref(false);
const lastRefreshedLabel = computed(() => (lastUpdated.value ? dayjs(lastUpdated.value).fromNow() : "never"));

const formatFromBase = (value?: string | null, decimals = 6, symbol = "") => {
  const num = Number(value ?? "0");
  if (!Number.isFinite(num)) return `0 ${symbol}`.trim();
  const normalized = num / Math.pow(10, decimals);
  return `${normalized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals > 6 ? 6 : decimals })}${symbol ? ` ${symbol}` : ""}`;
};

const formatWbtc = (value?: string | null) => formatFromBase(value, WBTC_DECIMALS, "WBTC");
const formatRetro = (value?: string | null) => formatFromBase(value, RETRO_DECIMALS, "RETRO");

const poolTotalStaked = computed(() => formatWbtc(pool.value?.total_staked_amount));
const poolRewardBalance = computed(() => formatRetro(pool.value?.reward_balance_uretro));
const poolUndistributed = computed(() => formatRetro(pool.value?.undistributed_uretro));

const userStakedDisplay = computed(() => formatWbtc(userStake.value?.staked_amount));
const pendingRewardsDisplay = computed(() => formatRetro(pendingRewards.value?.pending_uretro));
const userBalanceDisplay = computed(() => formatWbtc(userBalance.value));
const userBalanceBase = computed(() => userBalance.value ?? "0");

const allowedTokenMeta = computed(() => getTokenMeta(allowedDenom.value));
const allowedTokenSymbol = computed(() => allowedTokenMeta.value.symbol);

const shortAddress = (addr?: string | null, size = 10) => {
  if (!addr) return "—";
  return `${addr.slice(0, size)}...${addr.slice(-6)}`;
};

const denomWarning = computed(() => !hasValidDenom.value);

const restStatus = computed(() => {
  if (restHealthy.value === true) return { label: "Online", class: "text-emerald-200 border-emerald-400/60", dot: "bg-emerald-400" };
  if (restHealthy.value === false) return { label: "Offline", class: "text-rose-200 border-rose-400/60", dot: "bg-rose-400" };
  return { label: "Unknown", class: "text-slate-300 border-white/20", dot: "bg-slate-400" };
});

const rpcStatus = computed(() => {
  if (rpcHealthy.value === true) return { label: "Online", class: "text-emerald-200 border-emerald-400/60", dot: "bg-emerald-400" };
  if (rpcHealthy.value === false) return { label: "Offline", class: "text-rose-200 border-rose-400/60", dot: "bg-rose-400" };
  return { label: "Unknown", class: "text-slate-300 border-white/20", dot: "bg-slate-400" };
});

const parseHumanAmount = (input: string, decimals: number): string | null => {
  if (!input || !Number.isFinite(Number(input))) return null;
  const normalized = input.trim();
  if (!normalized) return null;
  const negative = normalized.startsWith("-");
  if (negative) return null;
  const [wholeRaw = "0", fractionRaw = ""] = normalized.split(".");
  if (!/^\d+$/.test(wholeRaw || "0")) return null;
  if (fractionRaw && !/^\d+$/.test(fractionRaw)) return null;
  const fraction = (fractionRaw || "").slice(0, decimals).padEnd(decimals, "0");
  try {
    const whole = BigInt(wholeRaw || "0");
    const base = whole * (10n ** BigInt(decimals)) + BigInt(fraction || "0");
    if (base <= 0n) return null;
    return base.toString();
  } catch {
    return null;
  }
};

const maxUnstakeReadable = computed(() => {
  const base = userStake.value?.staked_amount ?? "0";
  const num = Number(base) / Math.pow(10, WBTC_DECIMALS);
  if (!Number.isFinite(num)) return "0";
  return num.toFixed(8);
});

const pendingRewardsBase = computed(() => BigInt(pendingRewards.value?.pending_uretro ?? "0"));

const setUnstakeMax = () => {
  unstakeAmount.value = maxUnstakeReadable.value;
};

const setStakePercent = (percent: number) => {
  const base = Number(userBalanceBase.value) / Math.pow(10, WBTC_DECIMALS);
  if (!Number.isFinite(base) || base <= 0) return;
  const amount = (base * percent).toFixed(WBTC_DECIMALS);
  stakeAmount.value = amount;
};

const validateStakeInput = () => parseHumanAmount(stakeAmount.value, WBTC_DECIMALS);
const validateUnstakeInput = () => parseHumanAmount(unstakeAmount.value, WBTC_DECIMALS);

const runTx = async (msgs: any[], memo: string) => {
  txLoading.value = true;
  try {
    const result = await signAndBroadcastWithREST(NETWORK, msgs, null, memo);
    if (result.code === 0) {
      const hash = result.txhash || result.transactionHash || "";
      toast.showTxSuccess(hash || "");
      await refreshAll(address.value);
    } else {
      throw new Error(result.rawLog || result.log || "Transaction failed");
    }
  } catch (err: any) {
    toast.showTxError(err?.message ?? String(err));
    throw err;
  } finally {
    txLoading.value = false;
  }
};

const handleStake = async () => {
  if (!address.value) {
    toast.showError("Connect your wallet first");
    return;
  }
  if (!hasValidDenom.value) {
    toast.showError("WBTC staking module is not configured");
    return;
  }
  const baseAmount = validateStakeInput();
  if (!baseAmount) {
    toast.showWarning("Enter a valid WBTC amount");
    return;
  }
  const msg = {
    typeUrl: "/retrochain.btcstake.v1.MsgStake",
    value: {
      creator: address.value,
      amount: baseAmount
    }
  };
  await runTx([msg], "Stake WBTC");
  stakeAmount.value = "";
};

const handleUnstake = async () => {
  if (!address.value) {
    toast.showError("Connect your wallet first");
    return;
  }
  const baseAmount = validateUnstakeInput();
  if (!baseAmount) {
    toast.showWarning("Enter a valid WBTC amount to unstake");
    return;
  }
  const currentStake = BigInt(userStake.value?.staked_amount ?? "0");
  if (BigInt(baseAmount) > currentStake) {
    toast.showError("Cannot unstake more than you have staked");
    return;
  }
  const msg = {
    typeUrl: "/retrochain.btcstake.v1.MsgUnstake",
    value: {
      creator: address.value,
      amount: baseAmount
    }
  };
  await runTx([msg], "Unstake WBTC");
  unstakeAmount.value = "";
};

const handleClaimRewards = async () => {
  if (!address.value) {
    toast.showError("Connect your wallet first");
    return;
  }
  if (pendingRewardsBase.value === 0n) {
    toast.showInfo("No rewards to claim yet");
    return;
  }
  const msg = {
    typeUrl: "/retrochain.btcstake.v1.MsgClaimRewards",
    value: {
      creator: address.value
    }
  };
  await runTx([msg], "Claim BTC stake rewards");
};

const connectWallet = async () => {
  try {
    await connect();
    if (address.value) {
      await refreshAll(address.value);
      startPolling(address.value);
    }
  } catch (err: any) {
    toast.showError(err?.message ?? "Failed to connect wallet");
  }
};

onMounted(async () => {
  await refreshAll(address.value);
  startPolling(address.value);
});

onBeforeUnmount(() => {
  stopPolling();
});

watch(
  () => address.value,
  async (next) => {
    await refreshAll(next);
    startPolling(next);
  }
);
</script>

<template>
  <div class="space-y-4">
    <RcDisclaimer type="info" title="? Bitcoin Liquid Staking">
      <p>
        Stake wrapped Bitcoin (WBTC) using RetroChain's <code class="text-emerald-300">btcstake</code> module to earn RETRO-denominated rewards.
        This interface talks directly to the on-chain module—transactions are live on <strong>retrochain-mainnet</strong>.
      </p>
      <p class="mt-2 text-[11px] text-slate-400">
        Rewards are distributed in <code>uretro</code>. Always double-check amounts before signing transactions.
      </p>
    </RcDisclaimer>

    <div class="card relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/15 to-rose-500/10 rounded-full blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[11px] uppercase tracking-[0.3em] text-amber-200">WBTC Yield</p>
            <h1 class="text-2xl font-bold text-white">Stake WBTC</h1>
            <p class="text-sm text-slate-400">Secure RetroChain's BTC vault and earn RETRO rewards</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            <div class="badge" :class="restStatus.class">
              <span class="w-1.5 h-1.5 rounded-full" :class="restStatus.dot"></span>
              <span class="ml-1">REST {{ restStatus.label }}</span>
            </div>
            <div class="badge" :class="rpcStatus.class">
              <span class="w-1.5 h-1.5 rounded-full" :class="rpcStatus.dot"></span>
              <span class="ml-1">RPC {{ rpcStatus.label }}</span>
            </div>
          </div>
        </div>
        <div class="text-[11px] text-slate-500">
          REST: <code>{{ restBase }}</code> · RPC: <code>{{ rpcBase }}</code>
        </div>
      </div>
    </div>

    <div v-if="denomWarning" class="card border-rose-500/40 bg-rose-500/5">
      <p class="text-sm text-rose-200 font-semibold mb-1">WBTC denom unavailable</p>
      <p class="text-xs text-rose-100/80">
        The btcstake module has not announced an IBC denom yet. Once governance enables the pool, the allowed denom will appear automatically.
      </p>
    </div>

    <div v-if="error" class="card border-rose-500/40 bg-rose-500/5">
      <p class="text-xs text-rose-200">{{ error }}</p>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="text-sm font-semibold text-white">Pool Stats</h2>
            <p class="text-[11px] text-slate-500">Last update {{ lastRefreshedLabel }}</p>
          </div>
          <a :href="poolEndpoint" target="_blank" rel="noopener" class="btn text-[11px]">View on chain</a>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500">Allowed Denom</p>
            <p class="font-mono text-xs text-slate-100 break-all">{{ allowedDenom || '—' }}</p>
            <p v-if="allowedDenom" class="text-[11px] text-slate-500 mt-0.5">Symbol: {{ allowedTokenSymbol }}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500">Total Staked</p>
            <p class="text-lg font-semibold text-emerald-200">{{ poolTotalStaked }}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500">Reward Balance</p>
            <p class="text-lg font-semibold text-cyan-200">{{ poolRewardBalance }}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500">Undistributed Rewards</p>
            <p class="text-lg font-semibold text-indigo-200">{{ poolUndistributed }}</p>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-white">Your Position</h2>
          <button class="btn text-[11px]" @click="refreshAll(address)">
            {{ loading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500">Staked WBTC</p>
            <p class="text-lg font-semibold text-white">{{ userStakedDisplay }}</p>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-500">Pending Rewards</p>
            <p class="text-lg font-semibold text-emerald-200 flex items-center gap-2">
              {{ pendingRewardsDisplay }}
              <button class="btn text-[10px]" @click="handleClaimRewards" :disabled="txLoading || pendingRewardsBase === 0n || !address">
                Claim
              </button>
            </p>
          </div>
        </div>
        <p class="text-[11px] text-slate-500 mt-2">
          Last refreshed {{ lastRefreshedLabel }} · Address {{ shortAddress(address || undefined, 12) }}
        </p>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-2">
      <div class="card">
        <h3 class="text-sm font-semibold text-white mb-3">Stake WBTC</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Amount (WBTC)</label>
            <div class="space-y-2">
              <input
                v-model="stakeAmount"
                type="number"
                min="0"
                step="0.00000001"
                placeholder="0.00000000"
                class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white"
              />
              <div class="flex items-center justify-between text-[11px] text-slate-500">
                <span>Available: {{ userBalanceDisplay }}</span>
                <div class="flex gap-1">
                  <button class="btn text-[10px]" @click="setStakePercent(0.25)" :disabled="!address">25%</button>
                  <button class="btn text-[10px]" @click="setStakePercent(0.5)" :disabled="!address">50%</button>
                  <button class="btn text-[10px]" @click="setStakePercent(0.75)" :disabled="!address">75%</button>
                  <button class="btn text-[10px]" @click="setStakePercent(1)" :disabled="!address">Max</button>
                </div>
              </div>
            </div>
          </div>
          <button class="btn btn-primary w-full" @click="handleStake" :disabled="txLoading || !address || denomWarning">
            {{ txLoading ? 'Processing…' : address ? 'Stake WBTC' : 'Connect Wallet' }}
          </button>
        </div>
      </div>

      <div class="card">
        <h3 class="text-sm font-semibold text-white mb-3">Unstake WBTC</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-slate-400 mb-1 block">Amount (WBTC)</label>
            <div class="flex items-center gap-2">
              <input
                v-model="unstakeAmount"
                type="number"
                min="0"
                step="0.00000001"
                placeholder="0.00000000"
                class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-sm text-white"
              />
              <button class="btn text-[10px]" @click="setUnstakeMax" :disabled="!address || userStake?.staked_amount === '0'">Max</button>
            </div>
            <p class="text-[11px] text-slate-500 mt-1">Available: {{ userStakedDisplay }}</p>
          </div>
          <button class="btn btn-primary w-full" @click="handleUnstake" :disabled="txLoading || !address || denomWarning">
            {{ txLoading ? 'Processing…' : 'Unstake' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="!address" class="card border-amber-500/30 bg-amber-500/5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-white">Wallet Required</p>
          <p class="text-xs text-slate-400">Connect Keplr to see your BTC stake position</p>
        </div>
        <button class="btn btn-primary text-xs" @click="connectWallet" :disabled="!isAvailable">
          {{ isAvailable ? 'Connect Keplr' : 'Install Keplr' }}
        </button>
      </div>
    </div>
  </div>
</template>
