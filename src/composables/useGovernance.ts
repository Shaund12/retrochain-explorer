import { ref } from "vue";
import { useApi } from "./useApi";

export interface Proposal {
  proposalId: string;
  content: any;
  status: string;
  finalTallyResult: {
    yes: string;
    abstain: string;
    no: string;
    noWithVeto: string;
  };
  submitTime: string;
  depositEndTime: string;
  totalDeposit: Array<{ denom: string; amount: string }>;
  votingStartTime: string;
  votingEndTime: string;
}

export function useGovernance() {
  const api = useApi();
  const proposals = ref<Proposal[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchProposals = async (status?: string) => {
    loading.value = true;
    error.value = null;
    proposals.value = []; // Clear previous data

    try {
      const params: any = {
        "pagination.limit": 50
      };
      
      if (status) {
        params.proposal_status = status;
      }

      const res = await api.get("/cosmos/gov/v1beta1/proposals", { params });
      
      console.log("Governance API Response:", res.data);
      
      const rawProposals = res.data?.proposals || [];
      
      if (rawProposals.length === 0) {
        error.value = "No governance proposals found. Your chain may not have governance enabled yet.";
        return;
      }
      
      proposals.value = rawProposals.map((p: any) => ({
        proposalId: p.proposal_id,
        content: p.content,
        status: p.status,
        finalTallyResult: p.final_tally_result,
        submitTime: p.submit_time,
        depositEndTime: p.deposit_end_time,
        totalDeposit: p.total_deposit,
        votingStartTime: p.voting_start_time,
        votingEndTime: p.voting_end_time
      }));

    } catch (e: any) {
      console.error("Failed to fetch proposals:", e);
      error.value = `Failed to load proposals: ${e?.response?.data?.message || e?.message || String(e)}`;
      proposals.value = []; // Ensure no fake data shows
    } finally {
      loading.value = false;
    }
  };

  const fetchProposalById = async (id: string) => {
    loading.value = true;
    error.value = null;

    try {
      const res = await api.get(`/cosmos/gov/v1beta1/proposals/${id}`);
      return res.data?.proposal || null;
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      return null;
    } finally {
      loading.value = false;
    }
  };

  return {
    proposals,
    loading,
    error,
    fetchProposals,
    fetchProposalById
  };
}
