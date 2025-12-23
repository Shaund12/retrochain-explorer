<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useGovernance } from "@/composables/useGovernance";
import type { Proposal } from "@/composables/useGovernance";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { proposals, loading, error, fetchProposals } = useGovernance();
const activeProposal = ref<Proposal | null>(null);
const isModalOpen = ref(false);
const statusFilter = ref("all");
const searchTerm = ref("");
const hideDuplicates = ref(true);
const statusParam = computed(() => {
  if (statusFilter.value === "voting") return "PROPOSAL_STATUS_VOTING_PERIOD";
  if (statusFilter.value === "deposit") return "PROPOSAL_STATUS_DEPOSIT_PERIOD";
  if (statusFilter.value === "passed") return "PROPOSAL_STATUS_PASSED";
  if (statusFilter.value === "rejected") return "PROPOSAL_STATUS_REJECTED";
  if (statusFilter.value === "failed") return "PROPOSAL_STATUS_FAILED";
  if (statusFilter.value === "closed") return undefined; // show all then filter locally
  if (statusFilter.value === "active") return undefined; // fetch all, filter client-side
  return undefined;
});

onMounted(() => {
  fetchProposals();
});

// Refetch when backend-friendly filter changes (others are client-only)
watch(statusParam, (val) => {
  fetchProposals(val);
});

const openProposalModal = (proposal: Proposal) => {
  activeProposal.value = proposal;
  isModalOpen.value = true;
};

const closeProposalModal = () => {
  isModalOpen.value = false;
  activeProposal.value = null;
};

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { text: string; class: string }> = {
    PROPOSAL_STATUS_VOTING_PERIOD: { text: "Voting", class: "border-emerald-400/60 text-emerald-200" },
    PROPOSAL_STATUS_DEPOSIT_PERIOD: { text: "Deposit", class: "border-amber-400/60 text-amber-200" },
    PROPOSAL_STATUS_PASSED: { text: "Passed", class: "border-cyan-400/60 text-cyan-200" },
    PROPOSAL_STATUS_REJECTED: { text: "Rejected", class: "border-rose-400/60 text-rose-200" },
    PROPOSAL_STATUS_FAILED: { text: "Failed", class: "border-rose-400/60 text-rose-200" }
  };
  return statusMap[status] || { text: status, class: "border-slate-400/60 text-slate-300" };
};

const statusGroups: Record<string, string[]> = {
  all: [],
  active: ["PROPOSAL_STATUS_VOTING_PERIOD", "PROPOSAL_STATUS_DEPOSIT_PERIOD"],
  voting: ["PROPOSAL_STATUS_VOTING_PERIOD"],
  deposit: ["PROPOSAL_STATUS_DEPOSIT_PERIOD"],
  passed: ["PROPOSAL_STATUS_PASSED"],
  rejected: ["PROPOSAL_STATUS_REJECTED"],
  failed: ["PROPOSAL_STATUS_FAILED"],
  closed: ["PROPOSAL_STATUS_PASSED", "PROPOSAL_STATUS_REJECTED", "PROPOSAL_STATUS_FAILED"]
};

const formatTime = (time?: string) => {
  if (!time) return "-";
  return dayjs(time).fromNow();
};

const getProposalTitle = (proposal: Proposal) => {
  const typeName = proposal.content?.["@type"]?.split(".").pop();
  return proposal.title || proposal.metadata?.title || proposal.content?.title || typeName || `Proposal #${proposal.proposalId}`;
};

const getProposalKind = (proposal: Proposal) => {
  const typeName = proposal.content?.["@type"]?.split(".").pop() || "Proposal";
  return typeName.replace(/Proposal/gi, "").replace(/Msg/gi, " ").trim() || "Governance";
};

const getProposalSummary = (proposal: Proposal) => {
  return (
    proposal.summary ||
    proposal.metadata?.summary ||
    proposal.metadata?.description ||
    proposal.content?.description ||
    "No description available"
  );
};

const formatExactTime = (time?: string) => {
  if (!time) return "-";
  return dayjs(time).format("YYYY-MM-DD HH:mm:ss");
};

const calcTallyPercentages = (proposal: Proposal) => {
  const tally = proposal.finalTallyResult;
  if (!tally) {
    return { yes: 0, no: 0, noWithVeto: 0, abstain: 0 };
  }

  const toNumber = (value?: string) => {
    const parsed = Number(value ?? "0");
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const yes = toNumber(tally.yes);
  const no = toNumber(tally.no);
  const veto = toNumber(tally.noWithVeto);
  const abstain = toNumber(tally.abstain);
  const total = yes + no + veto + abstain;
  if (total === 0) {
    return { yes: 0, no: 0, noWithVeto: 0, abstain: 0 };
  }

  return {
    yes: (yes / total) * 100,
    no: (no / total) * 100,
    noWithVeto: (veto / total) * 100,
    abstain: (abstain / total) * 100
  };
};

const formatVoteCount = (value?: string) => {
  const number = Number(value ?? "0");
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("en-US").format(Math.floor(number));
};

const formatCountdown = (time?: string) => {
  if (!time) return null;
  const diff = dayjs(time).diff(dayjs(), "second");
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
};

const voteCategories = [
  { key: "yes", label: "Yes", bar: "bg-emerald-500", text: "text-emerald-300" },
  { key: "no", label: "No", bar: "bg-rose-500", text: "text-rose-300" },
  { key: "noWithVeto", label: "Veto", bar: "bg-amber-500", text: "text-amber-300" },
  { key: "abstain", label: "Abstain", bar: "bg-slate-500", text: "text-slate-400" }
] as const;

const duplicateMap = computed(() => {
  const map = new Map<string, number>();
  proposals.value.forEach((p) => {
    const title = getProposalTitle(p).toLowerCase().trim();
    const summary = getProposalSummary(p).toLowerCase().trim();
    const key = `${title}|${summary}`;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
});

const isDuplicate = (proposal: Proposal) => {
  const title = getProposalTitle(proposal).toLowerCase().trim();
  const summary = getProposalSummary(proposal).toLowerCase().trim();
  const key = `${title}|${summary}`;
  return (duplicateMap.value.get(key) || 0) > 1;
};

const duplicateGroups = computed(() => {
  const groups = new Map<string, Proposal[]>();
  proposals.value.forEach((p) => {
    const title = getProposalTitle(p).toLowerCase().trim();
    const summary = getProposalSummary(p).toLowerCase().trim();
    const key = `${title}|${summary}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });
  return Array.from(groups.entries())
    .map(([key, list]) => ({ key, list }))
    .filter((g) => g.list.length > 1)
    .sort((a, b) => b.list.length - a.list.length);
});

const filteredProposals = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  const allowed = statusGroups[statusFilter.value] || [];

  return [...proposals.value]
    .filter((p) => {
      if (allowed.length && !allowed.includes(p.status)) return false;
      if (hideDuplicates.value && isDuplicate(p)) return false;
      if (!term) return true;
      const title = getProposalTitle(p).toLowerCase();
      const summary = getProposalSummary(p).toLowerCase();
      return (
        title.includes(term) ||
        summary.includes(term) ||
        p.proposalId.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => Number(b.proposalId) - Number(a.proposalId));
});

const stats = computed(() => {
  const total = proposals.value.length;
  const voting = proposals.value.filter((p) => p.status === "PROPOSAL_STATUS_VOTING_PERIOD").length;
  const deposit = proposals.value.filter((p) => p.status === "PROPOSAL_STATUS_DEPOSIT_PERIOD").length;
  const passed = proposals.value.filter((p) => p.status === "PROPOSAL_STATUS_PASSED").length;
  const rejected = proposals.value.filter((p) => p.status === "PROPOSAL_STATUS_REJECTED").length;
  return { total, voting, deposit, passed, rejected };
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-50">Governance</h1>
        <p class="text-sm text-slate-400 mt-1">
          On-chain proposals and voting
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <select
          v-model="statusFilter"
          class="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="voting">Voting</option>
          <option value="deposit">Deposit</option>
          <option value="passed">Passed</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
          <option value="closed">Closed</option>
        </select>
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search proposals..."
          class="px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <label class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 cursor-pointer">
          <input type="checkbox" v-model="hideDuplicates" class="w-4 h-4 rounded border-slate-600 bg-slate-900/80 text-rose-400 focus:ring-rose-400" />
          <span class="text-[11px]">Hide duplicates</span>
        </label>
        <button class="btn text-xs" @click="fetchProposals(statusParam || undefined)" :disabled="loading">
          {{ loading ? "Loading..." : "Refresh" }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div class="card-soft border border-emerald-500/30 bg-emerald-500/5">
        <div class="text-[11px] uppercase tracking-widest text-emerald-200">Total</div>
        <div class="text-2xl font-semibold text-white">{{ stats.total }}</div>
        <div class="text-[11px] text-slate-400">All proposals</div>
      </div>
      <div class="card-soft border border-indigo-500/30 bg-indigo-500/5">
        <div class="text-[11px] uppercase tracking-widest text-indigo-200">Voting</div>
        <div class="text-2xl font-semibold text-white">{{ stats.voting }}</div>
        <div class="text-[11px] text-slate-400">In voting period</div>
      </div>
      <div class="card-soft border border-amber-500/30 bg-amber-500/5">
        <div class="text-[11px] uppercase tracking-widest text-amber-200">Deposit</div>
        <div class="text-2xl font-semibold text-white">{{ stats.deposit }}</div>
        <div class="text-[11px] text-slate-400">Collecting deposits</div>
      </div>
      <div class="card-soft border border-cyan-500/30 bg-cyan-500/5">
        <div class="text-[11px] uppercase tracking-widest text-cyan-200">Passed</div>
        <div class="text-2xl font-semibold text-white">{{ stats.passed }}</div>
        <div class="text-[11px] text-slate-400">Approved on-chain</div>
      </div>
      <div class="card-soft border border-rose-500/30 bg-rose-500/5">
        <div class="text-[11px] uppercase tracking-widest text-rose-200">Rejected</div>
        <div class="text-2xl font-semibold text-white">{{ stats.rejected }}</div>
        <div class="text-[11px] text-slate-400">Did not pass</div>
      </div>
    </div>

    <div v-if="duplicateGroups.length" class="card border border-rose-500/30 bg-rose-500/5">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-rose-100">Duplicate clusters</h2>
        <span class="text-[11px] text-rose-200">{{ duplicateGroups.length }} groups</span>
      </div>
      <div class="space-y-3 text-xs text-slate-100">
        <div v-for="group in duplicateGroups" :key="group.key" class="p-3 rounded-lg bg-slate-900/60 border border-rose-500/30">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div class="font-semibold text-rose-100">{{ getProposalTitle(group.list[0]) }}</div>
            <span class="badge text-[10px] border-rose-400/60 text-rose-200">{{ group.list.length }} copies</span>
          </div>
          <div class="text-[11px] text-slate-400 line-clamp-2 mb-2">{{ getProposalSummary(group.list[0]) }}</div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="p in group.list"
              :key="p.proposalId"
              class="btn text-[10px]"
              @click="openProposalModal(p)"
            >
              #{{ p.proposalId }} · {{ getStatusBadge(p.status).text }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && filteredProposals.length === 0" class="card">
      <p class="text-sm text-slate-400">Loading proposals...</p>
    </div>

    <div v-else-if="filteredProposals.length > 0" class="space-y-3">
      <div
        v-for="proposal in filteredProposals"
        :key="proposal.proposalId"
        class="card hover:border-emerald-500/50 transition-all cursor-pointer"
        @click="openProposalModal(proposal)"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-mono text-slate-400">
                #{{ proposal.proposalId }}
              </span>
              <span
                class="badge text-xs"
                :class="getStatusBadge(proposal.status).class"
              >
                {{ getStatusBadge(proposal.status).text }}
              </span>
              <span v-if="isDuplicate(proposal)" class="badge text-[10px] border-rose-400/60 text-rose-200">
                Duplicate
              </span>
              <span class="badge text-[10px] border-cyan-400/50 text-cyan-100">
                {{ getProposalKind(proposal) }}
              </span>
              <span v-if="proposal.votingEndTime" class="text-[11px] text-slate-500">
                 Ends {{ formatTime(proposal.votingEndTime) }}
              </span>
            </div>
            
            <h3 class="text-base font-semibold text-slate-100 mb-1">
              {{ getProposalTitle(proposal) }}
            </h3>
            
            <p class="text-sm text-slate-300 mb-3 line-clamp-2">
              {{ getProposalSummary(proposal) }}
            </p>

            <div class="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div>
                <span class="text-slate-500">Submit:</span>
                {{ formatTime(proposal.submitTime) }}
              </div>
              <div v-if="proposal.votingStartTime">
                <span class="text-slate-500">Voting:</span>
                {{ formatTime(proposal.votingStartTime) }}
              </div>
              <div v-if="proposal.votingEndTime">
                <span class="text-slate-500">Ends:</span>
                {{ formatTime(proposal.votingEndTime) }}
                <span v-if="proposal.votingEndTime" class="ml-2 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] text-emerald-200">
                  {{ formatCountdown(proposal.votingEndTime) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Tally visualization -->
          <div v-if="proposal.finalTallyResult" class="flex flex-col gap-1 min-w-[160px]">
            <div class="text-xs text-slate-400 mb-1">Votes</div>
            <div class="space-y-1">
              <div
                v-for="category in voteCategories"
                :key="category.key"
                class="flex items-center gap-2"
              >
                <div class="w-12 text-[10px]" :class="category.text">
                  {{ category.label }}
                </div>
                <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    class="h-full"
                    :class="category.bar"
                    :style="{ width: `${calcTallyPercentages(proposal)[category.key]}%` }"
                  ></div>
                </div>
                <div class="w-12 text-right text-[10px] text-slate-400">
                  {{ calcTallyPercentages(proposal)[category.key].toFixed(1) }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="card">
      <div class="text-center py-8">
        <div class="text-4xl mb-3"></div>
        <p class="text-sm text-slate-400 mb-2">No governance proposals found</p>
        <p class="text-xs text-slate-500">
          Proposals will appear here once created via the CLI
        </p>
      </div>
    </div>
  </div>

  <div v-if="isModalOpen && activeProposal" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-slate-950/80" @click="closeProposalModal"></div>
    <div class="relative w-full max-w-2xl mx-4 bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-xs font-mono text-slate-500 mb-1">Proposal #{{ activeProposal.proposalId }}</div>
          <h2 class="text-xl font-semibold text-slate-100 mb-2">
            {{ getProposalTitle(activeProposal) }}
          </h2>
          <p class="text-sm text-slate-300 whitespace-pre-line">
            {{ getProposalSummary(activeProposal) }}
          </p>
        </div>
        <button class="btn text-xs" @click="closeProposalModal">Close</button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-xs text-slate-400">
        <div>
          <div class="text-slate-500">Status</div>
          <div class="text-slate-200 mt-1">{{ getStatusBadge(activeProposal.status).text }}</div>
        </div>
        <div>
          <div class="text-slate-500">Voting Start</div>
          <div class="text-slate-200 mt-1">{{ formatExactTime(activeProposal.votingStartTime) }}</div>
        </div>
        <div>
          <div class="text-slate-500">Voting End</div>
          <div class="text-slate-200 mt-1">{{ formatExactTime(activeProposal.votingEndTime) }}</div>
        </div>
        <div>
          <div class="text-slate-500">Submission</div>
          <div class="text-slate-200 mt-1">{{ formatExactTime(activeProposal.submitTime) }}</div>
        </div>
      </div>

      <div v-if="activeProposal.finalTallyResult" class="mt-6">
        <div class="text-sm font-semibold text-slate-200 mb-3">Vote Breakdown</div>
        <div class="space-y-2">
          <div
            v-for="category in voteCategories"
            :key="category.key"
            class="flex items-center justify-between text-sm"
          >
            <div :class="category.text">{{ category.label }}</div>
            <div class="flex items-center gap-3">
              <span class="text-slate-400">{{ formatVoteCount(activeProposal.finalTallyResult?.[category.key]) }}</span>
              <span class="text-slate-500">
                {{ calcTallyPercentages(activeProposal)[category.key].toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
        <div class="p-3 rounded-lg bg-slate-800/40 border border-slate-700">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Type</div>
          <div class="text-slate-200 font-semibold">{{ getProposalKind(activeProposal) }}</div>
        </div>
        <div class="p-3 rounded-lg bg-slate-800/40 border border-slate-700">
          <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Voting Ends In</div>
          <div class="text-emerald-300 font-semibold">{{ formatCountdown(activeProposal.votingEndTime) || 'Ended' }}</div>
        </div>
      </div>

      <div v-if="activeProposal.messages?.length" class="mt-6">
        <div class="text-sm font-semibold text-slate-200 mb-2">Messages</div>
        <div class="space-y-2">
          <div
            v-for="(msg, idx) in activeProposal.messages"
            :key="idx"
            class="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-300"
          >
            <div class="text-[10px] text-slate-500 mb-1">{{ msg["@type"] || msg.type || 'Msg' }}</div>
            <pre class="whitespace-pre-wrap break-words">{{ JSON.stringify(msg, null, 2) }}</pre>
          </div>
        </div>
      </div>

      <div v-if="isDuplicate(activeProposal)" class="mt-4 p-3 rounded-lg border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
        This proposal appears to be a duplicate of another submission (same title/summary).
      </div>

      <div v-if="activeProposal.totalDeposit?.length" class="mt-6">
        <div class="text-sm font-semibold text-slate-200 mb-2">Deposits</div>
        <div class="space-y-1 text-xs text-slate-300">
          <div v-for="(coin, idx) in activeProposal.totalDeposit" :key="idx" class="flex items-center justify-between">
            <span class="font-mono">{{ coin.amount }} {{ coin.denom }}</span>
            <span class="text-slate-500">on-chain</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

