import { ref } from "vue";
import { useApi } from "./useApi";

export interface WasmCodeInfo {
  codeId: string;
  creator: string;
  dataHash?: string;
  instantiatePermission?: Record<string, any> | null;
}

export interface ContractSummary {
  address: string;
  label: string;
  codeId: string;
  creator: string;
  admin: string | null;
  createdHeight?: string;
  createdTxIndex?: string;
  ibcPortId?: string;
}

interface FetchOptions {
  maxCodes: number;
  maxContracts: number;
  contractsPerCode: number;
}

const DEFAULT_FETCH_OPTIONS: FetchOptions = {
  maxCodes: 30,
  maxContracts: 60,
  contractsPerCode: 10
};

export function useContracts() {
  const api = useApi();
  const codes = ref<WasmCodeInfo[]>([]);
  const contracts = ref<ContractSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchContracts = async (options?: Partial<FetchOptions>) => {
    const cfg: FetchOptions = { ...DEFAULT_FETCH_OPTIONS, ...(options || {}) };
    loading.value = true;
    error.value = null;
    codes.value = [];
    contracts.value = [];

    try {
      const codeRes = await api.get("/cosmwasm/wasm/v1/code", {
        params: { "pagination.limit": String(cfg.maxCodes) }
      });

      const rawCodes: any[] = Array.isArray(codeRes.data?.code_infos) ? codeRes.data.code_infos : [];
      if (!rawCodes.length) {
        error.value = "No CosmWasm code artifacts found on this chain.";
        return;
      }

      const normalizedCodes: WasmCodeInfo[] = rawCodes
        .map((info) => ({
          codeId: String(info?.code_id ?? info?.id ?? ""),
          creator: info?.creator ?? "",
          dataHash: info?.data_hash ?? undefined,
          instantiatePermission: info?.instantiate_permission ?? null
        }))
        .filter((info) => info.codeId.length > 0)
        .sort((a, b) => Number(b.codeId) - Number(a.codeId));

      codes.value = normalizedCodes;

      const collected: ContractSummary[] = [];

      const buildContractSummary = (
        info: any,
        fallbackAddress: string,
        codeId: string
      ): ContractSummary => {
        const address = info?.address || fallbackAddress;
        const labelBase = address ? address.slice(0, 8) : "contract";
        return {
          address,
          label: info?.label || `Contract ${labelBase}…`,
          codeId: String(info?.code_id ?? codeId),
          creator: info?.creator ?? "",
          admin: info?.admin ?? null,
          createdHeight: info?.created?.block_height,
          createdTxIndex: info?.created?.tx_index,
          ibcPortId: info?.ibc_port_id ?? undefined
        };
      };

      for (const code of normalizedCodes) {
        if (collected.length >= cfg.maxContracts) break;

        let contractAddresses: string[] = [];
        try {
          const contractsRes = await api.get(`/cosmwasm/wasm/v1/code/${code.codeId}/contracts`, {
            params: {
              "pagination.limit": String(Math.min(cfg.contractsPerCode, cfg.maxContracts - collected.length))
            }
          });
          contractAddresses = Array.isArray(contractsRes.data?.contracts) ? contractsRes.data.contracts : [];
        } catch (contractsErr) {
          console.warn(`Failed to load contracts for code ${code.codeId}`, contractsErr);
          continue;
        }

        if (!contractAddresses.length) continue;

        const infoResults = await Promise.allSettled(
          contractAddresses.map((address) => api.get(`/cosmwasm/wasm/v1/contract/${address}`))
        );

        for (const result of infoResults) {
          if (collected.length >= cfg.maxContracts) break;
          if (result.status !== "fulfilled") continue;

          const info = result.value.data?.contract_info;
          if (!info?.address) continue;

          collected.push({
            address: info.address,
            label: info.label || `Contract ${info.address.slice(0, 8)}`,
            codeId: String(info.code_id ?? code.codeId),
            creator: info.creator ?? "",
            admin: info.admin ?? null,
            createdHeight: info.created?.block_height,
            createdTxIndex: info.created?.tx_index,
            ibcPortId: info.ibc_port_id ?? undefined
          });
        }
      }

      contracts.value = collected;

      if (!collected.length) {
        error.value = "No CosmWasm contracts were discovered for the fetched code IDs.";
      }
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || "Failed to load contracts.";
    } finally {
      loading.value = false;
    }
  };

  return {
    codes,
    contracts,
    loading,
    error,
    fetchContracts
  };
}
