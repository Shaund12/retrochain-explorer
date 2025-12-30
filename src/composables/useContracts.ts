import { ref } from "vue";
import { useApi } from "./useApi";
import { smartQueryContract as smartQueryGet } from "@/utils/wasmSmartQuery";
import { smartQueryContract as smartQueryContractShared } from "@/utils/wasmSmartQuery";
import { base64ToBytes, base64ToString, bytesToHex } from "@/utils/encoding";
import { sha256Bytes } from "@/utils/crypto";
import { defaultParamsSerializer } from "@/utils/pagination";

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

export interface ContractExecutionRecord {
    txhash: string;
    height: number;
    timestamp?: string;
    sender?: string;
    funds: { amount: string; denom: string }[];
    msg: Record<string, any> | string | null;
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

type ExtendedCodeInfo = WasmCodeInfo & { raw?: any };

// Base64/hex helpers are centralized in `src/utils/encoding.ts`.

const decodeBase64Json = (value?: string | null) => {
    if (!value) return null;
    const asString = base64ToString(value);
    try {
        return JSON.parse(asString);
    } catch {
        return asString;
    }
};

const sha256Hex = async (bytes: Uint8Array) => bytesToHex(await sha256Bytes(bytes));

const normalizeHexHash = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const hexCandidate = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;

    if (/^[0-9a-fA-F]+$/.test(hexCandidate)) return hexCandidate.toLowerCase();

    try {
        const bytes = base64ToBytes(trimmed);
        if (bytes.length) return bytesToHex(bytes);
    } catch {
        // ignore
    }
    return undefined;
};

export function useContracts() {
    const api = useApi();
    const codes = ref<WasmCodeInfo[]>([]);
    const contracts = ref<ContractSummary[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const contractInfoCache = new Map<string, any>();
    const codeInfoCache = new Map<string, ExtendedCodeInfo>();
    const contractCodeHashCache = new Map<string, string>();

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
                    dataHash: normalizeHexHash(info?.data_hash) ?? undefined,
                    instantiatePermission: info?.instantiate_permission ?? null
                }))
                .filter((info) => info.codeId.length > 0)
                .sort((a, b) => Number(b.codeId) - Number(a.codeId));

            codes.value = normalizedCodes;
            normalizedCodes.forEach((info) => codeInfoCache.set(info.codeId, { ...info }));

            const collected: ContractSummary[] = [];

            const buildContractSummary = (info: any, fallbackAddress: string, codeId: string): ContractSummary => {
                const address = info?.address || fallbackAddress;
                const labelBase = address ? address.slice(0, 8) : "contract";
                if (info) contractInfoCache.set(address, { ...info, address });

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

                const contractAddresses: string[] = [];
                let nextKey: string | undefined;

                try {
                    while (
                        contractAddresses.length < cfg.contractsPerCode &&
                        collected.length + contractAddresses.length < cfg.maxContracts
                    ) {
                        const res = await api.get(`/cosmwasm/wasm/v1/code/${code.codeId}/contracts`, {
                            params: {
                                "pagination.limit": String(
                                    Math.min(cfg.contractsPerCode - contractAddresses.length, cfg.maxContracts - collected.length)
                                ),
                                ...(nextKey ? { "pagination.key": nextKey } : {}),
                                "pagination.reverse": "true"
                            }
                        });

                        const chunk: string[] = Array.isArray(res.data?.contracts) ? res.data.contracts : [];
                        contractAddresses.push(...chunk);
                        nextKey = res.data?.pagination?.next_key || undefined;
                        if (!nextKey || !chunk.length) break;
                    }
                } catch (contractsErr) {
                    console.warn(`Failed to load contracts for code ${code.codeId}`, contractsErr);
                }

                if (!contractAddresses.length) continue;

                const infoResults = await Promise.allSettled(
                    contractAddresses.map((address) =>
                        api.get(`/cosmwasm/wasm/v1/contract/${address}`).then((res) => ({
                            info: res.data?.contract_info ?? null,
                            address
                        }))
                    )
                );

                infoResults.forEach((result, idx) => {
                    if (collected.length >= cfg.maxContracts) return;
                    const fallbackAddress = contractAddresses[idx];

                    if (result.status === "fulfilled" && result.value.info) {
                        collected.push(buildContractSummary(result.value.info, fallbackAddress, code.codeId));
                        return;
                    }

                    if (fallbackAddress) collected.push(buildContractSummary(null, fallbackAddress, code.codeId));
                });
            }

            contracts.value = collected;

            if (!collected.length) error.value = "No CosmWasm contracts were discovered for the fetched code IDs.";
        } catch (e: any) {
            error.value = e?.response?.data?.message || e?.message || "Failed to load contracts.";
        } finally {
            loading.value = false;
        }
    };

    const getContractInfo = async (address: string) => {
        const key = address?.trim();
        if (!key) throw new Error("Contract address is required.");
        if (contractInfoCache.has(key)) return contractInfoCache.get(key);

        const res = await api.get(`/cosmwasm/wasm/v1/contract/${key}`);
        const info = res.data?.contract_info || null;
        const normalized = info ? { ...info, address: res.data?.address || key } : null;
        if (normalized) contractInfoCache.set(normalized.address, normalized);
        return normalized;
    };

    const getContractCodeHash = async (address: string) => {
        const key = address?.trim();
        if (!key) throw new Error("Contract address is required.");
        if (contractCodeHashCache.has(key)) return contractCodeHashCache.get(key) || null;

        try {
            const res = await api.get(`/cosmwasm/wasm/v1/contract/${key}/code-hash`);
            const hash = res.data?.code_hash || null;
            const normalized = normalizeHexHash(hash);
            const finalHash = normalized || hash;
            if (finalHash) contractCodeHashCache.set(key, finalHash);
            return finalHash;
        } catch (hashErr) {
            const status = (hashErr as any)?.response?.status;
            if (status === 501) {
                contractCodeHashCache.set(key, "");
                return null;
            }
            console.warn("Unable to fetch contract code hash", hashErr);
            return null;
        }
    };

    const getCodeInfo = async (codeId: string | number) => {
        const id = String(codeId);
        if (codeInfoCache.has(id)) return codeInfoCache.get(id);

        const res = await api.get(`/cosmwasm/wasm/v1/code/${id}`);
        const info = res.data?.code_info;
        if (!info) return null;

        let dataHash = normalizeHexHash(info?.data_hash) ?? undefined;
        if (!dataHash && typeof res.data?.data === "string" && res.data.data.length) {
            try {
                const codeBytes = base64ToBytes(res.data.data);
                dataHash = await sha256Hex(codeBytes);
            } catch (err) {
                console.warn("Unable to compute code data hash", err);
            }
        }

        const normalized: ExtendedCodeInfo = {
            codeId: id,
            creator: info?.creator ?? "",
            dataHash,
            instantiatePermission: info?.instantiate_permission ?? null,
            raw: info
        };

        codeInfoCache.set(id, normalized);
        return normalized;
    };

    // Shared canonical smart query helper
    const smartQueryContract = (address: string, message: Record<string, any> | string) => {
        return smartQueryContractShared(api, address, message as any);
    };

    const fetchExecsByEvent = async (event: string, limit: number) => {
        const res = await api.get(`/cosmos/tx/v1beta1/txs`, {
            params: {
                events: event,
                order_by: "ORDER_BY_DESC",
                "pagination.limit": String(limit)
            },
            paramsSerializer: defaultParamsSerializer
        });
        return res.data?.tx_responses ?? [];
    };

    const getContractExecutions = async (address: string, limit = 25): Promise<ContractExecutionRecord[]> => {
        const key = address?.trim();
        if (!key) throw new Error("Contract address is required.");

        try {
            let responses: any[] = [];
            try {
                responses = await fetchExecsByEvent(`message.contract_address='${key}'`, limit);
            } catch (primaryErr) {
                console.warn("Primary contract execution query failed", primaryErr);
            }

            if (!responses.length) {
                try {
                    responses = await fetchExecsByEvent(`wasm._contract_address='${key}'`, limit);
                } catch (secondaryErr) {
                    console.warn("Fallback contract execution query failed", secondaryErr);
                }
            }

            const executions: ContractExecutionRecord[] = [];

            responses.forEach((resp) => {
                const txMsgs: any[] = resp?.tx?.body?.messages ?? [];
                txMsgs.forEach((msg) => {
                    const typeUrl = msg?.["@type"] || msg?.type;
                    if (typeUrl !== "/cosmwasm.wasm.v1.MsgExecuteContract") return;
                    if (msg?.contract !== key) return;

                    let decoded: Record<string, any> | string | null = null;
                    if (typeof msg.msg === "string" && msg.msg.length) decoded = decodeBase64Json(msg.msg);

                    executions.push({
                        txhash: resp?.txhash || "",
                        height: parseInt(resp?.height ?? "0", 10),
                        timestamp: resp?.timestamp,
                        sender: msg?.sender,
                        funds: Array.isArray(msg?.funds) ? msg.funds : [],
                        msg: decoded
                    });
                });
            });

            return executions;
        } catch (err) {
            console.warn("Unable to fetch contract executions", err);
            return [];
        }
    };

    return {
        codes,
        contracts,
        loading,
        error,
        fetchContracts,
        getContractInfo,
        getContractCodeHash,
        getCodeInfo,
        smartQueryContract,
        getContractExecutions
    };
}
