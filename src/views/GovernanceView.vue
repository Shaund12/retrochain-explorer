<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useGovernance } from "@/composables/useGovernance";
import type { Proposal } from "@/composables/useGovernance";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const router = useRouter();
const { proposals, loading, error, fetchProposals } = useGovernance();

onMounted(() => {
  fetchProposals();
});

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
          <div v-if="proposal.finalTallyResult" class="flex flex-col gap-1 min-w-[120px]">
            <div class="text-xs text-slate-400 mb-1">Votes</div>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <div class="w-12 text-[10px] text-emerald-300">Yes</div>
                <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-500" style="width: 0%"></div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-12 text-[10px] text-rose-300">No</div>
                <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-rose-500" style="width: 0%"></div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-12 text-[10px] text-amber-300">Veto</div>
                <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-amber-500" style="width: 0%"></div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-12 text-[10px] text-slate-400">Abstain</div>
                <div class="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-slate-500" style="width: 0%"></div>
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
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

