import { ref } from "vue";
import { useApi } from "./useApi";

export interface Proposal {
  proposalId: string;
  content: any;
  status: string;
  finalTallyResult?: {
    yes: string;
    abstain: string;
    no: string;
    noWithVeto: string;
  };
  submitTime?: string;
  depositEndTime?: string;
  totalDeposit?: Array<{ denom: string; amount: string }>;
  votingStartTime?: string;
  votingEndTime?: string;
  title?: string;
  summary?: string;
  messages?: any[];
  metadata?: Record<string, any>;
}

export function useGovernance() {
  const api = useApi();
  const proposals = ref<Proposal[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const govEndpointBases = ["/cosmos/gov/v1", "/cosmos/gov/v1beta1"];

  const requestGov = async (builder: (base: string) => string, config?: any) => {
    let lastError: any = null;
    for (const base of govEndpointBases) {
      try {
        return await api.get(builder(base), config);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404 || status === 501) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  const normalizeProposal = (raw: any): Proposal | null => {
    if (!raw) return null;
    const id = raw.proposal_id ?? raw.id ?? raw.proposalId;
    if (id === undefined || id === null) return null;

    const metadata = (() => {
      if (typeof raw.metadata === "string") {
        try {
          const parsed = JSON.parse(raw.metadata);
          if (parsed && typeof parsed === "object") {
            return parsed as Record<string, any>;
          }
        } catch {}
      } else if (raw.metadata && typeof raw.metadata === "object") {
        return raw.metadata as Record<string, any>;
      }
      return undefined;
    })();

    const tally = raw.final_tally_result ?? raw.finalTallyResult;
    const normalizeTally = (value: any) => String(value ?? "0");

    return {
      proposalId: String(id),
      content: raw.content ?? (Array.isArray(raw.messages) ? raw.messages[0] : null),
      messages: Array.isArray(raw.messages) ? raw.messages : undefined,
      metadata,
      title: raw.title ?? metadata?.title,
      summary: raw.summary ?? metadata?.summary ?? metadata?.description,
      status: raw.status ?? "PROPOSAL_STATUS_UNSPECIFIED",
      finalTallyResult: tally
        ? {
            yes: normalizeTally(tally.yes ?? tally.yes_count),
            abstain: normalizeTally(tally.abstain ?? tally.abstain_count),
            no: normalizeTally(tally.no ?? tally.no_count),
            noWithVeto: normalizeTally(tally.no_with_veto ?? tally.noWithVeto ?? tally.no_with_veto_count)
          }
        : undefined,
      submitTime: raw.submit_time ?? raw.submitTime,
      depositEndTime: raw.deposit_end_time ?? raw.depositEndTime,
      totalDeposit: raw.total_deposit ?? raw.totalDeposit ?? [],
      votingStartTime: raw.voting_start_time ?? raw.votingStartTime,
      votingEndTime: raw.voting_end_time ?? raw.votingEndTime
    };
  };

  const fetchCurrentTally = async (proposalId: string) => {
    try {
      const res = await requestGov((base) => `${base}/proposals/${proposalId}/tally`);
      const tally = res.data?.tally ?? res.data?.tally_result ?? res.data;
      if (!tally) return null;
      return {
        yes: String(tally.yes ?? tally.yes_count ?? "0"),
        abstain: String(tally.abstain ?? tally.abstain_count ?? "0"),
        no: String(tally.no ?? tally.no_count ?? "0"),
        noWithVeto: String(tally.no_with_veto ?? tally.noWithVeto ?? tally.no_with_veto_count ?? "0")
      };
    } catch (err) {
      console.warn(`Failed to fetch tally for proposal ${proposalId}`, err);
      return null;
    }
  };

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
      const res = await requestGov((base) => `${base}/proposals`, { params });
      const rawProposals = Array.isArray(res.data?.proposals)
        ? res.data.proposals
        : res.data?.proposal
        ? [res.data.proposal]
        : [];
      
      if (rawProposals.length === 0) {
        error.value = "No governance proposals found. Your chain may not have governance enabled yet.";
        return;
      }

      let normalized = rawProposals
        .map((p: any) => normalizeProposal(p))
        .filter((p: Proposal | null): p is Proposal => Boolean(p));

      // Pull live tallies for proposals without final results (typically active ones)
      normalized = await Promise.all(
        normalized.map(async (proposal) => {
          if (proposal.finalTallyResult && proposal.status !== "PROPOSAL_STATUS_VOTING_PERIOD") {
            return proposal;
          }
          const tally = await fetchCurrentTally(proposal.proposalId);
          if (tally) {
            proposal.finalTallyResult = tally;
          }
          return proposal;
        })
      );

      proposals.value = normalized;

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
      const res = await requestGov((base) => `${base}/proposals/${id}`);
      return normalizeProposal(res.data?.proposal);
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
