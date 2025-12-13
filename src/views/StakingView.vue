<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useStaking } from "@/composables/useStaking";
import { useValidators } from "@/composables/useValidators";
import { useNetwork } from "@/composables/useNetwork";
import { formatAmount } from "@/utils/format";
import { useToast } from "@/composables/useToast";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import dayjs from "dayjs";

const router = useRouter();
const { address, connect, isAvailable, signAndBroadcast } = useKeplr();
const { 
  delegations, 
  rewards, 
  unbonding, 
  loading: stakingLoading, 
  networkStats,
  fetchAll,
  fetchNetworkStats 
} = useStaking();
const { validators, loading: validatorsLoading, fetchValidators } = useValidators();
const { current: network } = useNetwork();
const toast = useToast();

const activeTab = ref<'overview' | 'delegate' | 'redelegate' | 'undelegate' | 'rewards'>('overview');
const selectedValidator = ref<string>("");
const amount = ref("");
const txLoading = ref(false);

const tokenDenom = computed(() => 'uretro');
const tokenSymbol = computed(() => 'RETRO');

const totalStaked = computed(() => {
  return delegations.value.reduce((sum, d) => sum + parseInt(d.balance.amount || "0", 10), 0);
});

const totalRewards = computed(() => {
  return rewards.value.reduce((sum, r) => {
    const amt = r.reward.find(rw => rw.denom === tokenDenom.value);
    return sum + parseFloat(amt?.amount || "0");
  }, 0);
});

const totalUnbonding = computed(() => {
  return unbonding.value.reduce((sum, u) => {
    return sum + u.entries.reduce((eSum, e) => eSum + parseInt(e.balance || "0", 10), 0);
  }, 0);
});

const myDelegations = computed(() => {
  return delegations.value.map(d => {
    const validator = validators.value.find(v => v.operatorAddress === d.validator_address);
    const reward = rewards.value.find(r => r.validator_address === d.validator_address);
    const rewardAmount = reward?.reward.find(rw => rw.denom === tokenDenom.value);
    
    return {
      validatorAddress: d.validator_address,
      validatorName: validator?.description?.moniker || "Unknown",
      amount: parseInt(d.balance.amount || "0", 10),
      shares: d.shares,
      reward: parseFloat(rewardAmount?.amount || "0")
    };
  });
});

const availableValidators = computed(() => {
  return validators.value.filter(v => 
    v.status === 'BOND_STATUS_BONDED' && 
    !v.jailed
  );
});

onMounted(async () => {
  await fetchValidators();
  await fetchNetworkStats();
  if (address.value) {
    await fetchAll();
  }
});

const handleConnect = async () => {
  try {
    await connect();
    if (address.value) {
      await fetchAll();
    }
  } catch (e: any) {
    console.error("Failed to connect:", e);
  }
};

const handleDelegate = async () => {
  if (!selectedValidator.value || !amount.value) return;
  if (!address.value) return;
  
  txLoading.value = true;
  try {
    const chainId = 'retrochain-mainnet';
    const amountBase = Math.floor(parseFloat(amount.value) * 1_000_000).toString();

    const msg = {
      typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
      value: {
        delegatorAddress: address.value,
        validatorAddress: selectedValidator.value,
        amount: {
          denom: tokenDenom.value,
          amount: amountBase
        }
      }
    };

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "5000" }],
      gas: "200000"
    };

    const result = await signAndBroadcast(
      chainId,
      [msg],
      fee,
      "Delegate on RetroChain"
    );

    if (result.code === 0) {
      console.log("Delegation successful!", result);
      await fetchAll();
      amount.value = "";
      selectedValidator.value = "";
      toast.showSuccess("Delegation successful!");
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Delegation failed:", e);
    toast.showError(`Delegation failed: ${e.message}`);
  } finally {
    txLoading.value = false;
  }
};

const handleClaimRewards = async (validatorAddress?: string) => {
  if (!address.value) return;
  
  txLoading.value = true;
  try {
    const chainId = 'retrochain-mainnet';

    const msgs = validatorAddress
      ? [{
          typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
          value: {
            delegatorAddress: address.value,
            validatorAddress: validatorAddress
          }
        }]
      : rewards.value.map(r => ({
          typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
          value: {
            delegatorAddress: address.value,
            validatorAddress: r.validator_address
          }
        }));

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "5000" }],
      gas: (msgs.length * 150000).toString()
    };

    const result = await signAndBroadcast(
      chainId,
      msgs,
      fee,
      "Claim staking rewards"
    );

    if (result.code === 0) {
      console.log("Rewards claimed!", result);
      await fetchAll();
      toast.showSuccess("Rewards claimed successfully!");
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Claim failed:", e);
    toast.showError(`Claim failed: ${e.message}`);
  } finally {
    txLoading.value = false;
  }
};

const handleUndelegate = async () => {
  if (!selectedValidator.value || !amount.value) return;
  if (!address.value) return;
  
  txLoading.value = true;
  try {
    const chainId = 'retrochain-mainnet';
    const amountBase = Math.floor(parseFloat(amount.value) * 1_000_000).toString();

    const msg = {
      typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
      value: {
        delegatorAddress: address.value,
        validatorAddress: selectedValidator.value,
        amount: {
          denom: tokenDenom.value,
          amount: amountBase
        }
      }
    };

    const fee = {
      amount: [{ denom: tokenDenom.value, amount: "5000" }],
      gas: "200000"
    };

    const result = await signAndBroadcast(
      chainId,
      [msg],
      fee,
      "Undelegate from RetroChain"
    );

    if (result.code === 0) {
      console.log("Undelegation successful!", result);
      await fetchAll();
      amount.value = "";
      selectedValidator.value = "";
      toast.showSuccess("Undelegation successful! Tokens will be available in 21 days.");
    } else {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }
  } catch (e: any) {
    console.error("Undelegation failed:", e);
    toast.showError(`Undelegation failed: ${e.message}`);
  } finally {
    txLoading.value = false;
  }
};

const formatReward = (amt: number) => {
  return formatAmount(Math.floor(amt).toString(), tokenDenom.value, { minDecimals: 2, maxDecimals: 6 });
};

const copy = async (text: string) => {
  try { 
    await navigator.clipboard?.writeText?.(text);
    toast.showSuccess("Address copied to clipboard!");
  } catch {
    toast.showError("Failed to copy address");
  }
};
</script>

<template>
<div class="space-y-4">
  <!-- DISCLAIMER BANNER -->
  <RcDisclaimer type="info" title="✅ Staking Integration Active">
    <p>
      <strong>Staking functionality is REAL and connected to the blockchain!</strong>
    </p>
    <p class="mt-2">
      All delegation, undelegation, and reward claim transactions are wired to Keplr and will execute on-chain. 
      However, some features may not work until RetroChain is fully deployed with active validators.
    </p>
    <p class="mt-2">
      Once mainnet launches with validators, you'll be able to stake RETRO tokens, earn rewards, and participate in network security.
    </p>
  </RcDisclaimer>

  <!-- Header -->
    <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Staking Dashboard
        </h1>
        <p class="text-sm text-slate-300 mb-4">
          Stake {{ tokenSymbol }} to secure the network and earn rewards
        </p>

        <!-- Network Stats Banner -->
        <div v-if="networkStats" class="mb-4 p-4 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Base APR</div>
              <div class="text-lg font-bold text-cyan-300">{{ networkStats.baseAPR.toFixed(2) }}%</div>
              <div class="text-[10px] text-slate-500">pre-commission</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Effective APR</div>
              <div class="text-lg font-bold text-emerald-300">{{ networkStats.effectiveAPR.toFixed(2) }}%</div>
              <div class="text-[10px] text-slate-500">w/ {{ networkStats.provisionBurnRate.toFixed(1) }}% burn</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Inflation</div>
              <div class="text-lg font-bold text-purple-300">{{ networkStats.inflation }}</div>
              <div class="text-[10px] text-slate-500">annual</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Fee Burn</div>
              <div class="text-lg font-bold text-orange-300">{{ networkStats.feeBurnRate.toFixed(1) }}%</div>
              <div class="text-[10px] text-slate-500">of fees</div>
            </div>
          </div>
        </div>

        <!-- Connect Wallet -->
        <div v-if="!address" class="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div class="flex items-center gap-3">
            <div class="text-3xl">👛</div>
            <div class="flex-1">
              <div class="text-sm font-semibold text-slate-100 mb-1">Connect Your Wallet</div>
              <div class="text-xs text-slate-400">Connect Keplr to view your staking portfolio and delegate</div>
            </div>
            <button v-if="isAvailable" class="btn btn-primary text-xs" @click="handleConnect">
              Connect Keplr
            </button>
            <a v-else href="https://www.keplr.app/download" target="_blank" class="btn text-xs">
              Install Keplr
            </a>
          </div>
        </div>

        <!-- Wallet Connected - Portfolio Summary -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Total Staked</div>
            <div class="text-xl font-bold text-indigo-300">
              {{ formatAmount(totalStaked.toString(), tokenDenom, { minDecimals: 2, maxDecimals: 2 }) }}
            </div>
          </div>
          <div class="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Pending Rewards</div>
            <div class="text-xl font-bold text-emerald-300">
              {{ formatReward(totalRewards) }}
            </div>
            <button v-if="totalRewards > 0" class="btn text-[10px] mt-2" @click="handleClaimRewards()" :disabled="txLoading">
              {{ txLoading ? 'Claiming...' : 'Claim All' }}
            </button>
          </div>
          <div class="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">Unbonding</div>
            <div class="text-xl font-bold text-amber-300">
              {{ formatAmount(totalUnbonding.toString(), tokenDenom, { minDecimals: 2, maxDecimals: 2 }) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div v-if="address" class="flex items-center gap-2 overflow-x-auto">
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'overview' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'overview'"
      >
        📊 Overview
      </button>
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'delegate' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'delegate'"
      >
        ➕ Delegate
      </button>
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'undelegate' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'undelegate'"
      >
        ➖ Undelegate
      </button>
      <button 
        class="btn text-xs whitespace-nowrap"
        :class="activeTab === 'rewards' ? 'border-emerald-400/70 bg-emerald-500/10' : ''"
        @click="activeTab = 'rewards'"
      >
        💰 Rewards
      </button>
    </div>

    <!-- APR & Burn Explanation -->
    <div v-if="networkStats" class="card bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
      <h3 class="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
        <span>📈</span>
        <span>Understanding Staking Returns</span>
      </h3>
      <div class="space-y-2 text-xs text-slate-300">
        <p>
          <strong class="text-cyan-300">Base APR ({{ networkStats.baseAPR.toFixed(2) }}%)</strong> = 
          (Annual Provisions / Bonded Tokens) × (1 - Community Tax of {{ networkStats.communityTax }})
        </p>
        <p>
          <strong class="text-emerald-300">Effective APR ({{ networkStats.effectiveAPR.toFixed(2) }}%)</strong> = 
          Base APR × (1 - Provision Burn Rate of {{ networkStats.provisionBurnRate.toFixed(1) }}%)
        </p>
        <p class="text-slate-400 text-[11px] mt-2">
          💡 <strong>Burn Mechanism:</strong> 
          {{ networkStats.feeBurnRate.toFixed(1) }}% of transaction fees and 
          {{ networkStats.provisionBurnRate.toFixed(1) }}% of minted provisions are burned to control inflation 
          while maintaining high staking rewards. Validator commission (typically 5-10%) further reduces your take-home APR.
        </p>
      </div>
    </div>

    <!-- Overview Tab -->
    <div v-if="address && activeTab === 'overview'" class="space-y-3">
      <div class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">My Delegations</h2>
        
        <div v-if="stakingLoading" class="text-xs text-slate-400">Loading...</div>
        
        <div v-else-if="myDelegations.length === 0" class="text-xs text-slate-400 text-center py-8">
          <div class="text-3xl mb-2">🎯</div>
          <div>No delegations yet</div>
          <div class="text-[11px] mt-1">Start staking to earn rewards!</div>
        </div>

        <table v-else class="table">
          <thead>
            <tr class="text-slate-300 text-xs">
              <th>Validator</th>
              <th class="text-right">Staked</th>
              <th class="text-right">Rewards</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in myDelegations" :key="d.validatorAddress" class="hover:bg-white/5 transition-colors">
              <td class="py-2">
                <div class="text-sm text-slate-100">{{ d.validatorName }}</div>
                <div class="flex items-center gap-2 whitespace-nowrap">
                  <code class="text-[10px] text-slate-500 truncate max-w-[150px] inline-block">{{ d.validatorAddress }}</code>
                  <button class="btn text-[10px]" @click.stop="copy(d.validatorAddress)">Copy</button>
                </div>
              </td>
              <td class="text-right py-2">
                <div class="text-sm text-slate-200">{{ formatAmount(d.amount.toString(), tokenDenom, { minDecimals: 2, maxDecimals: 2 }) }}</div>
              </td>
              <td class="text-right py-2">
                <div class="text-sm text-emerald-300">{{ formatReward(d.reward) }}</div>
              </td>
              <td class="py-2">
                <button 
                  v-if="d.reward > 0" 
                  class="btn text-[10px]" 
                  @click="handleClaimRewards(d.validatorAddress)"
                  :disabled="txLoading"
                >
                  Claim
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Unbonding -->
      <div v-if="unbonding.length > 0" class="card">
        <h2 class="text-sm font-semibold text-slate-100 mb-3">Unbonding Delegations</h2>
        <div class="space-y-2">
          <div v-for="u in unbonding" :key="u.validator_address" class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div v-for="entry in u.entries" :key="entry.creation_height" class="text-xs space-y-1">
              <div class="text-slate-300">
                Amount: <span class="text-amber-300 font-semibold">{{ formatAmount(entry.balance, tokenDenom, { minDecimals: 2 }) }}</span>
              </div>
              <div class="text-slate-400">
                Completes: {{ dayjs(entry.completion_time).fromNow() }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delegate Tab -->
    <div v-if="address && activeTab === 'delegate'" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-3">Delegate Tokens</h2>
      
      <div class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Select Validator</label>
          <select v-model="selectedValidator" class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
            <option value="">Choose a validator...</option>
            <option v-for="v in availableValidators" :key="v.operatorAddress" :value="v.operatorAddress">
              {{ v.description?.moniker || v.operatorAddress.slice(0, 20) }}...
            </option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-2 block">Amount ({{ tokenSymbol }})</label>
          <input 
            v-model="amount" 
            type="number" 
            step="0.000001"
            placeholder="0.000000"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>

        <button 
          class="btn btn-primary w-full"
          @click="handleDelegate"
          :disabled="!selectedValidator || !amount || txLoading"
        >
          {{ txLoading ? 'Processing...' : 'Delegate' }}
        </button>
      </div>
    </div>

    <!-- Undelegate Tab -->
    <div v-if="address && activeTab === 'undelegate'" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-3">Undelegate Tokens</h2>
      
      <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3">
        <div class="text-xs text-amber-300">
          ⚠️ Unbonding takes 21 days. Tokens will not earn rewards during this period.
        </div>
      </div>

      <div class="space-y-3">
        <div>
          <label class="text-xs text-slate-400 mb-2 block">Select Delegation</label>
          <select v-model="selectedValidator" class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm">
            <option value="">Choose a delegation...</option>
            <option v-for="d in myDelegations" :key="d.validatorAddress" :value="d.validatorAddress">
              {{ d.validatorName }} - {{ formatAmount(d.amount.toString(), tokenDenom, { maxDecimals: 2 }) }}
            </option>
          </select>
        </div>

        <div>
          <label class="text-xs text-slate-400 mb-2 block">Amount ({{ tokenSymbol }})</label>
          <input 
            v-model="amount" 
            type="number" 
            step="0.000001"
            placeholder="0.000000"
            class="w-full p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          />
        </div>

        <button 
          class="btn btn-primary w-full"
          @click="handleUndelegate"
          :disabled="!selectedValidator || !amount || txLoading"
        >
          {{ txLoading ? 'Processing...' : 'Undelegate' }}
        </button>
      </div>
    </div>

    <!-- Rewards Tab -->
    <div v-if="address && activeTab === 'rewards'" class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">Rewards Summary</h2>
        <button 
          v-if="totalRewards > 0"
          class="btn btn-primary text-xs" 
          @click="handleClaimRewards()"
          :disabled="txLoading"
        >
          {{ txLoading ? 'Claiming...' : 'Claim All Rewards' }}
        </button>
      </div>

      <div v-if="rewards.length === 0" class="text-xs text-slate-400 text-center py-8">
        <div class="text-3xl mb-2">💰</div>
        <div>No rewards yet</div>
      </div>

      <div v-else class="space-y-2">
        <div v-for="r in rewards" :key="r.validator_address" class="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="text-sm text-slate-100 mb-1">
                {{ validators.find(v => v.operatorAddress === r.validator_address)?.description?.moniker || 'Unknown' }}
              </div>
              <div class="text-xs text-slate-400">
                {{ formatReward(parseFloat(r.reward.find(rw => rw.denom === tokenDenom)?.amount || "0")) }}
              </div>
            </div>
            <button 
              class="btn text-[10px]" 
              @click="handleClaimRewards(r.validator_address)"
              :disabled="txLoading"
            >
              Claim
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Validator List for Non-Connected Users -->
    <div v-if="!address" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-3">Active Validators</h2>
      <div v-if="validatorsLoading" class="text-xs text-slate-400">Loading validators...</div>
      <div v-else class="space-y-2">
        <div 
          v-for="v in availableValidators.slice(0, 5)" 
          :key="v.operatorAddress"
          class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 hover:border-indigo-500/50 transition-all cursor-pointer"
          @click="router.push({ name: 'validators' })"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm text-slate-100">{{ v.description?.moniker || "Validator" }}</div>
              <div class="text-xs text-slate-400">{{ (parseFloat(v.commission.commission_rates.rate) * 100).toFixed(1) }}% commission</div>
            </div>
            <div class="text-xs text-slate-300">
              {{ v.votingPowerPercent.toFixed(2) }}% VP
            </div>
          </div>
        </div>
        <button class="btn text-xs w-full" @click="router.push({ name: 'validators' })">
          View All Validators
        </button>
      </div>
    </div>
  </div>
</template>
