import { ref } from "vue";
import { useApi } from "./useApi";
import { decodeConsensusAddress, deriveConsensusAddressFromPubkey } from "@/utils/consensus";
import { getAccountLabel, type AccountLabelMeta } from "@/constants/accountLabels";

export interface BlockSummary {
  height: number;
  hash: string;
  time: string;
  txs: number;
  proposerAddress?: string;
  proposerConsensusHex?: string | null;
  proposerOperator?: string;
  proposerMoniker?: string;
  proposerLabel?: AccountLabelMeta | null;
  gasWanted?: number;
  gasUsed?: number;
  gasUtilization?: number | null;
}

interface ValidatorLookupMeta {
  operatorAddress: string;
  moniker: string;
  label: AccountLabelMeta | null;
}

export function useBlocks() {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const blocks = ref<BlockSummary[]>([]);

  // Helper: fetch a single block by height (used by detail + list)
  const fetchByHeight = async (height: number) => {
    const res = await api.get(
      `/cosmos/base/tendermint/v1beta1/blocks/${height}`
    );
    return res.data;
  };

  // Fetch latest N blocks by walking down from latest height
  const fetchLatest = async (limit = 20) => {
    loading.value = true;
    error.value = null;

    try {
      // 1) Get latest block so we know the tip height
      const latestRes = await api.get(
        "/cosmos/base/tendermint/v1beta1/blocks/latest"
      );
      const latestBlock = latestRes.data?.block;
      if (!latestBlock) {
        throw new Error("Latest block not found");
      }

      const latestHeight = parseInt(latestBlock.header.height ?? "0", 10);
      if (!latestHeight || Number.isNaN(latestHeight)) {
        throw new Error("Invalid latest block height");
      }

      // 2) Decide which heights to fetch
      const heights: number[] = [];
      for (
        let h = latestHeight;
        h > 0 && heights.length < limit;
        h -= 1
      ) {
        heights.push(h);
      }

      // 3) Fetch each block in parallel
      const results = await Promise.all(
        heights.map((h) =>
          api
            .get(`/cosmos/base/tendermint/v1beta1/blocks/${h}`)
            .then((r) => ({ height: h, data: r.data }))
        )
      );

      // 4) Fetch validator metadata for proposer lookups
      let validatorLookup: Record<string, ValidatorLookupMeta> = {};
      try {
        const validatorRes = await api.get("/cosmos/staking/v1beta1/validators", {
          params: { status: "BOND_STATUS_BONDED", "pagination.limit": 300 }
        });
        const vals: any[] = validatorRes.data?.validators ?? [];
        const derived = await Promise.all(
          vals.map(async (v) => {
            const consensusHex = await deriveConsensusAddressFromPubkey(v.consensus_pubkey);
            if (!consensusHex) return null;
            return {
              consensusHex,
              operatorAddress: v.operator_address,
              moniker: v.description?.moniker || "Validator",
              label: getAccountLabel(v.operator_address)
            } as { consensusHex: string; operatorAddress: string; moniker: string; label: AccountLabelMeta | null };
          })
        );

        validatorLookup = derived.reduce<Record<string, ValidatorLookupMeta>>((map, entry) => {
          if (!entry) return map;
          map[entry.consensusHex] = {
            operatorAddress: entry.operatorAddress,
            moniker: entry.moniker,
            label: entry.label ?? null
          };
          return map;
        }, {});
      } catch (validatorErr) {
        console.warn("Validator lookup failed", validatorErr);
      }

      // 5) Pull gas stats per block (only when txs exist)
      const heightsWithTxs = results
        .filter((entry) => (entry.data.block?.data?.txs?.length ?? 0) > 0)
        .map((entry) => entry.height);

      const gasStatsMap = new Map<number, { gasWanted: number; gasUsed: number }>();
      if (heightsWithTxs.length) {
        const gasStats = await Promise.all(
          heightsWithTxs.map(async (h) => {
            try {
              const txRes = await api.get(`/cosmos/tx/v1beta1/txs`, {
                params: { events: `tx.height='${h}'`, "pagination.limit": 200 }
              });
              const responses: any[] = txRes.data?.tx_responses ?? [];
              const stats = responses.reduce(
                (acc, resp) => {
                  acc.gasWanted += Number(resp.gas_wanted ?? 0);
                  acc.gasUsed += Number(resp.gas_used ?? 0);
                  return acc;
                },
                { gasWanted: 0, gasUsed: 0 }
              );
              return { height: h, ...stats };
            } catch (gasErr) {
              console.warn(`Failed to fetch gas stats for block ${h}`, gasErr);
              return { height: h, gasWanted: 0, gasUsed: 0 };
            }
          })
        );

        gasStats.forEach((entry) => {
          gasStatsMap.set(entry.height, { gasWanted: entry.gasWanted, gasUsed: entry.gasUsed });
        });
      }

      // 6) Map into BlockSummary[]
      blocks.value = results.map((entry) => {
        const blk = entry.data.block;
        const header = blk?.header ?? {};
        const proposerConsensusHex = decodeConsensusAddress(header.proposer_address);
        const lookup = proposerConsensusHex ? validatorLookup[proposerConsensusHex] : undefined;
        const gasStats = gasStatsMap.get(entry.height);

        const gasWanted = gasStats?.gasWanted;
        const gasUsed = gasStats?.gasUsed;
        const hasGasStats = typeof gasWanted === "number" && typeof gasUsed === "number";
        const gasUtilization = hasGasStats && gasWanted > 0 ? gasUsed / gasWanted : null;

        return {
          height: entry.height,
          hash: entry.data.block_id?.hash ?? "",
          time: header.time ?? "",
          txs: blk?.data?.txs?.length ?? 0,
          proposerAddress: header.proposer_address ?? undefined,
          proposerConsensusHex,
          proposerOperator: lookup?.operatorAddress,
          proposerMoniker: lookup?.moniker,
          proposerLabel: lookup?.label ?? null,
          gasWanted,
          gasUsed,
          gasUtilization
        } as BlockSummary;
      });
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      blocks.value = [];
    } finally {
      loading.value = false;
    }
  };

  return {
    blocks,
    loading,
    error,
    fetchLatest,
    fetchByHeight
  };
}
