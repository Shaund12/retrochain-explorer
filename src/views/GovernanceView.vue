<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useGovernance } from "@/composables/useGovernance";
import type { Proposal } from "@/composables/useGovernance";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const { proposals, loading, error, fetchProposals } = useGovernance();
const activeProposal = ref<Proposal | null>(null);
const isModalOpen = ref(false);

onMounted(() => {
  fetchProposals();
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

const formatTime = (time?: string) => {
  if (!time) return "-";
  return dayjs(time).fromNow();
};

const getProposalTitle = (proposal: Proposal) => {
  const typeName = proposal.content?.["@type"]?.split(".").pop();
  return proposal.title || proposal.metadata?.title || proposal.content?.title || typeName || `Proposal #${proposal.proposalId}`;
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

const voteCategories = [
  { key: "yes", label: "Yes", bar: "bg-emerald-500", text: "text-emerald-300" },
  { key: "no", label: "No", bar: "bg-rose-500", text: "text-rose-300" },
  { key: "noWithVeto", label: "Veto", bar: "bg-amber-500", text: "text-amber-300" },
  { key: "abstain", label: "Abstain", bar: "bg-slate-500", text: "text-slate-400" }
] as const;
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-50">Governance</h1>
        <p class="text-sm text-slate-400 mt-1">
          On-chain proposals and voting
        </p>
      </div>
      <button class="btn text-xs" @click="fetchProposals()" :disabled="loading">
        {{ loading ? "Loading..." : "Refresh" }}
      </button>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div v-if="loading && proposals.length === 0" class="card">
      <p class="text-sm text-slate-400">Loading proposals...</p>
    </div>

    <div v-else-if="proposals.length > 0" class="space-y-3">
      <div
        v-for="proposal in proposals"
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

