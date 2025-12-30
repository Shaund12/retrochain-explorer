<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { useContracts } from "@/composables/useContracts";
import type { ContractExecutionRecord } from "@/composables/useContracts";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import { useNetwork } from "@/composables/useNetwork";

const route = useRoute();
const router = useRouter();
const { getContractInfo, getCodeInfo, getContractCodeHash, smartQueryContract, getContractExecutions } = useContracts();
const { address: walletAddress, connect, signAndBroadcast } = useKeplr();
const toast = useToast();
const { copyToClipboard } = toast;
const { current: network, restBase } = useNetwork();

const contractAddress = computed(() => String(route.params.address || ""));

const loading = ref(false);
const error = ref<string | null>(null);
const contractInfo = ref<any | null>(null);
const codeInfo = ref<any | null>(null);
const contractCodeHash = ref<string | null>(null);

const smartQueryInput = ref('{\n  "contract_info": {}\n}');
const smartQueryResult = ref<string | null>(null);
const smartQueryError = ref<string | null>(null);
const smartQueryBusy = ref(false);

const executeMsgInput = ref('{\n  "transfer": {\n    "recipient": "",\n    "amount": "1"\n  }\n}');
const executeFunds = ref("");
const executeMemo = ref("");
const executeBusy = ref(false);
const executeError = ref<string | null>(null);
const lastTxHash = ref<string | null>(null);
const executionHistory = ref<ContractExecutionRecord[]>([]);

const hasStorage = typeof localStorage !== "undefined";
const storageKey = (suffix: string) => `rc-contract-${contractAddress.value || "unknown"}-${suffix}`;

const CW20_TEMPLATES = [
  { label: "General · Contract info", payload: '{ "contract_info": {} }' },
  { label: "CW20 · Token info", payload: '{ "token_info": {} }' },
  { label: "CW20 · Balance", payload: '{ "balance": { "address": "" } }' },
  { label: "CW20 · Allowance", payload: '{ "allowance": { "owner": "", "spender": "" } }' }
];

const CW721_TEMPLATES = [
  { label: "General · Contract info", payload: '{ "contract_info": {} }' },
  { label: "CW721 · Num tokens", payload: '{ "num_tokens": {} }' },
  { label: "CW721 · All tokens", payload: '{ "all_tokens": { "limit": 10 } }' },
  { label: "CW721 · NFT info", payload: '{ "nft_info": { "token_id": "" } }' },
  { label: "CW721 · Owner of", payload: '{ "owner_of": { "token_id": "" } }' }
];

const contractFlavor = ref<"unknown" | "cw20" | "cw721">("unknown");

const queryTemplates = computed(() => {
  if (contractFlavor.value === "cw721") return CW721_TEMPLATES;
  return CW20_TEMPLATES;
});

const chainId = computed(() => (network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"));
const feeDenom = computed(() => (network.value === "mainnet" ? "uretro" : "udretro"));

const codeDownloadUrl = computed(() => {
  if (!contractInfo.value?.code_id) return null;
  const base = (restBase.value || "").replace(/\/$/, "");
  return `${base}/cosmwasm/wasm/v1/code/${contractInfo.value.code_id}`;
});

const normalizeHex = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;
  return /^[0-9a-fA-F]+$/.test(hex) ? hex.toLowerCase() : "";
};

const formatHash = (value?: string | null) => {
  if (!value) return "";
  const normalized = normalizeHex(value);
  if (normalized) {
    return `0x${normalized}`;
  }
  return value;
};

const normalizedContractHash = computed(() => normalizeHex(contractCodeHash.value));
const normalizedCodeHash = computed(() => normalizeHex(codeInfo.value?.dataHash));

const contractHashDisplay = computed(() => formatHash(contractCodeHash.value));
const codeHashDisplay = computed(() => formatHash(codeInfo.value?.dataHash));

const verificationStatus = computed(() => {
  if (!normalizedContractHash.value || !normalizedCodeHash.value) return "unknown";
  return normalizedContractHash.value === normalizedCodeHash.value ? "verified" : "mismatch";
});

const verificationLabel = computed(() => {
  if (verificationStatus.value === "verified") return "Verified";
  if (verificationStatus.value === "mismatch") return "Mismatch";
  return "Awaiting hash";
});

const verificationBadgeClass = computed(() => {
  if (verificationStatus.value === "verified") return "border-emerald-400/60 text-emerald-200";
  if (verificationStatus.value === "mismatch") return "border-rose-400/60 text-rose-200";
  return "border-slate-600/60 text-slate-300";
});

const detectedExecuteFunctions = computed(() => {
  const set = new Set<string>();
  executionHistory.value.forEach((entry) => {
    if (entry.msg && typeof entry.msg === "object" && !Array.isArray(entry.msg)) {
      const key = Object.keys(entry.msg)[0];
      if (key) set.add(key);
    }
  });
  return Array.from(set);
});

const executionTemplates = computed(() => {
  const map = new Map<string, Record<string, any>>();
  for (const entry of executionHistory.value) {
    if (entry.msg && typeof entry.msg === "object" && !Array.isArray(entry.msg)) {
      const key = Object.keys(entry.msg)[0];
      if (key && !map.has(key)) {
        map.set(key, entry.msg);
      }
    }
  }
  return Array.from(map.entries()).map(([fn, sample]) => ({ fn, sample }));
});

const selectedExecTemplate = ref<string>("");

const applyExecutionTemplate = () => {
  const found = executionTemplates.value.find((tpl) => tpl.fn === selectedExecTemplate.value);
  if (!found) return;
  try {
    executeMsgInput.value = JSON.stringify(found.sample, null, 2);
  } catch {
    executeMsgInput.value = JSON.stringify(found.sample);
  }
};

const loadPersistedInputs = () => {
  if (!hasStorage) return;
  const savedQuery = localStorage.getItem(storageKey("smartQuery"));
  const savedExec = localStorage.getItem(storageKey("execMsg"));
  const savedFunds = localStorage.getItem(storageKey("execFunds"));
  const savedMemo = localStorage.getItem(storageKey("execMemo"));
  if (savedQuery) smartQueryInput.value = savedQuery;
  if (savedExec) executeMsgInput.value = savedExec;
  if (savedFunds) executeFunds.value = savedFunds;
  if (savedMemo) executeMemo.value = savedMemo;
};

const topFunctionName = (msg: ContractExecutionRecord["msg"]) => {
  if (msg && typeof msg === "object" && !Array.isArray(msg)) {
    const key = Object.keys(msg)[0];
    return key || "execute";
  }
  if (typeof msg === "string" && msg.trim()) {
    return msg.trim().slice(0, 48);
  }
  return "execute";
};

const formatExecutionMsg = (msg: ContractExecutionRecord["msg"]) => {
  if (!msg) return "";
  try {
    return typeof msg === "string" ? msg : JSON.stringify(msg, null, 2);
  } catch {
    return String(msg);
  }
};

const formatTimestamp = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const shortAddr = (value?: string) => {
  if (!value) return "";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}${value.slice(-6)}`;
};

const hasAdmin = computed(() => Boolean(contractInfo.value?.admin));
const createdHeight = computed(() => contractInfo.value?.created?.block_height);
const createdTxIndex = computed(() => contractInfo.value?.created?.tx_index);

const copy = async (value?: string | null) => {
  if (!value) return;
  await copyToClipboard(value, "Copied");
};

const applyTemplate = (payload: string) => {
  smartQueryInput.value = payload;
  smartQueryResult.value = null;
  smartQueryError.value = null;
};

const parseFunds = (value: string) => {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [amount, denom] = chunk.split(/\s+/);
      if (!amount || !denom) {
        throw new Error("Use the format '12345 uretro' for funds (comma separated). ");
      }
      return { amount, denom };
    });
};

const runSmartQuery = async () => {
  smartQueryError.value = null;
  smartQueryResult.value = null;
  smartQueryBusy.value = true;
  try {
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(smartQueryInput.value);
    } catch (jsonErr: any) {
      throw new Error(jsonErr?.message || "Invalid JSON payload");
    }

    // Users sometimes paste REST wrapper payloads:
    //  - {"query_msg": { ... }}
    //  - {"query_msg": "<base64>"}
    // The explorer expects the raw contract QueryMsg object here.
    const unwrapQueryMsg = (input: any): any => {
      let current = input;
      // unwrap up to a few layers to avoid infinite loops
      for (let i = 0; i < 4; i += 1) {
        if (!current || typeof current !== "object" || !("query_msg" in current)) return current;
        const inner = (current as any).query_msg;
        if (typeof inner === "string" && inner.trim()) {
          const candidate = inner.trim();
          try {
            const decoded = typeof atob === "function"
              ? atob(candidate)
              : (globalThis as any)?.Buffer?.from(candidate, "base64")?.toString("utf-8");
            // If base64 decode produced something parseable, use it; otherwise try parsing as raw JSON string.
            current = decoded ? JSON.parse(decoded) : JSON.parse(candidate);
          } catch {
            // Can't parse further; return the string.
            return candidate;
          }
        } else {
          current = inner;
        }
      }
      return current;
    };

    parsed = unwrapQueryMsg(parsed);
    const result = await smartQueryContract(contractAddress.value, parsed);
    smartQueryResult.value = JSON.stringify(result, null, 2);
    if (hasStorage) {
      localStorage.setItem(storageKey("smartQuery"), smartQueryInput.value);
    }
  } catch (err: any) {
    smartQueryError.value = err?.message ?? String(err);
  } finally {
    smartQueryBusy.value = false;
  }
};

const executeMessage = async () => {
  executeError.value = null;
  lastTxHash.value = null;
  if (!contractAddress.value) {
    executeError.value = "Missing contract address.";
    return;
  }
  try {
    if (!walletAddress.value) {
      await connect();
    }
    if (!walletAddress.value) {
      throw new Error("Connect your wallet first.");
    }
    let parsedMsg: Record<string, any>;
    try {
      parsedMsg = JSON.parse(executeMsgInput.value);
    } catch (jsonErr: any) {
      throw new Error(jsonErr?.message || "Execution message must be valid JSON.");
    }
    const funds = parseFunds(executeFunds.value);
    const encoder = new TextEncoder();
    const execMsg = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: MsgExecuteContract.fromPartial({
        sender: walletAddress.value,
        contract: contractAddress.value,
        msg: encoder.encode(JSON.stringify(parsedMsg)),
        funds
      })
    };
    const fee = {
      amount: [{ denom: feeDenom.value, amount: "8000" }],
      gas: "280000"
    };
    executeBusy.value = true;
    const result = await signAndBroadcast(chainId.value, [execMsg], fee, executeMemo.value || `Execute ${contractAddress.value}`);
    if (result.code !== 0) {
      throw new Error(result.rawLog || "Execution failed");
    }
    if (hasStorage) {
      localStorage.setItem(storageKey("execMsg"), executeMsgInput.value);
      localStorage.setItem(storageKey("execFunds"), executeFunds.value);
      localStorage.setItem(storageKey("execMemo"), executeMemo.value);
    }
    lastTxHash.value = result.transactionHash || null;
    toast.showTxSuccess(result.transactionHash || "Execution broadcasted");
  } catch (err: any) {
    const message = err?.message ?? String(err);
    executeError.value = message;
    toast.showTxError(message);
  } finally {
    executeBusy.value = false;
  }
};

const loadDetails = async () => {
  const addr = contractAddress.value;
  if (!addr) {
    error.value = "Contract address is required.";
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const info = await getContractInfo(addr);
    contractInfo.value = info;

    // Best-effort contract flavor detection for smart-query templates.
    // CW721 supports contract_info but NOT token_info.
    // CW20 supports token_info.
    contractFlavor.value = "unknown";
    try {
      const cw20Probe = await smartQueryContract(addr, { token_info: {} });
      if (cw20Probe) contractFlavor.value = "cw20";
    } catch (probeErr: any) {
      const msg = probeErr?.response?.data?.message || probeErr?.message || "";
      const lowered = String(msg).toLowerCase();
      if (lowered.includes("unknown variant") && lowered.includes("token_info")) {
        contractFlavor.value = "cw721";
      }
    }

    const [hash, executions, codeDetails] = await Promise.all([
      getContractCodeHash(addr),
      getContractExecutions(addr, 40),
      info?.code_id ? getCodeInfo(info.code_id) : Promise.resolve(null)
    ]);

    executionHistory.value = executions;
    codeInfo.value = codeDetails;
    if (hash) {
      contractCodeHash.value = hash;
    } else if (codeDetails?.dataHash) {
      contractCodeHash.value = codeDetails.dataHash;
    } else {
      contractCodeHash.value = null;
    }
  } catch (err: any) {
    error.value = err?.message ?? String(err);
  } finally {
    loading.value = false;
  }
};

onMounted(loadDetails);
watch(
  () => contractAddress.value,
  () => {
    loadDetails();
    loadPersistedInputs();
  }
);

onMounted(() => {
  loadPersistedInputs();
});
</script>

<template>
  <div class="space-y-4">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs uppercase tracking-[0.35em] text-indigo-300">Contract</p>
        <h1 class="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
          {{ contractInfo?.label || 'Smart Contract' }}
        </h1>
        <p class="text-xs text-slate-400 font-mono break-all mt-1">{{ contractAddress }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn text-xs" @click="router.push({ name: 'contracts' })">? Back to registry</button>
        <button class="btn text-xs" :disabled="loading" @click="loadDetails">{{ loading ? 'Refreshing' : 'Refresh' }}</button>
      </div>
    </header>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/10 text-sm text-rose-100">
      {{ error }}
    </div>

    <div v-else>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article class="card-soft border border-emerald-500/30 bg-emerald-500/5">
          <div class="text-[11px] uppercase tracking-wider text-emerald-200">Code ID</div>
          <div class="text-3xl font-semibold text-white">{{ contractInfo?.code_id || '' }}</div>
          <p v-if="codeDownloadUrl" class="text-[11px] text-emerald-300 underline cursor-pointer" @click="window.open(codeDownloadUrl, '_blank')">
            Download artifact
          </p>
        </article>
        <article class="card-soft border border-indigo-500/30 bg-indigo-500/5">
          <div class="text-[11px] uppercase tracking-wider text-indigo-200">Admin</div>
          <div class="text-sm font-semibold text-white break-all" v-if="hasAdmin">{{ contractInfo?.admin }}</div>
          <div class="text-sm text-slate-500" v-else>None</div>
        </article>
        <article class="card-soft border border-cyan-500/30 bg-cyan-500/5">
          <div class="text-[11px] uppercase tracking-wider text-cyan-200">Creator</div>
          <div class="text-sm font-semibold text-white break-all">{{ contractInfo?.creator || '' }}</div>
        </article>
        <article class="card-soft border border-amber-500/30 bg-amber-500/5">
          <div class="text-[11px] uppercase tracking-wider text-amber-200">Created</div>
          <div class="text-sm text-white">
            <span v-if="createdHeight">Block #{{ createdHeight }}</span>
            <span v-else></span>
          </div>
          <p v-if="createdTxIndex" class="text-[11px] text-amber-200">tx #{{ createdTxIndex }}</p>
        </article>
      </div>

      <div v-if="loading" class="card text-sm text-slate-400">Loading contract details</div>

      <div v-else class="space-y-4">
        <div class="grid gap-4 lg:grid-cols-2">
          <section class="card space-y-2">
            <h2 class="text-sm font-semibold text-slate-100">Metadata</h2>
            <div class="text-xs text-slate-300 space-y-2">
              <div class="flex items-start justify-between gap-3">
                <span class="text-slate-500 uppercase tracking-wider">IBC Port</span>
                <span class="font-mono text-right break-all">{{ contractInfo?.ibc_port_id || '' }}</span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <span class="text-slate-500 uppercase tracking-wider">Label</span>
                <span class="font-mono text-right break-all">{{ contractInfo?.label || '' }}</span>
              </div>
              <div class="flex items-start justify-between gap-3">
                <span class="text-slate-500 uppercase tracking-wider">Address</span>
                <span class="font-mono text-right break-all">
                  {{ contractInfo?.address || contractAddress }}
                  <button class="btn text-[10px] ml-2" @click="copy(contractInfo?.address || contractAddress)">Copy</button>
                </span>
              </div>
            </div>
          </section>

          <section class="card space-y-2">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-100">Verification</h2>
              <span class="badge text-[10px]" :class="verificationBadgeClass">{{ verificationLabel }}</span>
            </div>
            <div class="text-xs text-slate-300 space-y-2">
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Contract hash</div>
                <div class="font-mono break-all">{{ contractHashDisplay }}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Code data hash</div>
                <div class="font-mono break-all">{{ codeHashDisplay }}</div>
              </div>
              <div>
                <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Instantiate permission</div>
                <pre v-if="codeInfo?.instantiatePermission" class="bg-slate-900/80 rounded p-2 overflow-x-auto">{{ JSON.stringify(codeInfo.instantiatePermission, null, 2) }}</pre>
                <span v-else class="text-slate-500"></span>
              </div>
            </div>
          </section>
        </div>

        <section class="card space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold text-slate-100">Detected execute functions</h2>
              <p class="text-[11px] text-slate-500">Derived from on-chain transaction history</p>
            </div>
            <span class="badge text-[10px] border-indigo-400/60 text-indigo-200">{{ executionHistory.length }} calls</span>
          </div>
          <div v-if="detectedExecuteFunctions.length" class="flex flex-wrap gap-2">
            <span
              v-for="fn in detectedExecuteFunctions"
              :key="fn"
              class="badge text-[11px] border-emerald-400/60 text-emerald-200"
            >
              {{ fn }}
            </span>
          </div>
          <p v-else class="text-[11px] text-slate-500">No execute messages observed yet for this contract.</p>

          <div v-if="executionHistory.length" class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr class="text-xs text-slate-400">
                  <th>Function</th>
                  <th>Sender</th>
                  <th>Height</th>
                  <th>Tx</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in executionHistory.slice(0, 10)" :key="record.txhash + record.height">
                  <td class="text-xs text-slate-200">
                    <details class="group">
                      <summary class="cursor-pointer text-emerald-200 hover:text-emerald-100 flex items-center gap-1 text-xs">
                        {{ topFunctionName(record.msg) }}
                      </summary>
                      <pre class="mt-1 p-2 bg-slate-900/70 rounded text-[11px] whitespace-pre-wrap break-words">{{ formatExecutionMsg(record.msg) }}</pre>
                    </details>
                  </td>
                  <td class="text-xs text-slate-300 font-mono">{{ shortAddr(record.sender) }}</td>
                  <td class="text-xs text-slate-300">{{ record.height.toLocaleString() }}</td>
                  <td class="text-xs text-indigo-300">
                    <router-link class="underline" :to="{ name: 'tx-detail', params: { hash: record.txhash } }">
                      {{ shortAddr(record.txhash) }}
                    </router-link>
                  </td>
                  <td class="text-[11px] text-slate-400">{{ formatTimestamp(record.timestamp) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="grid gap-4 lg:grid-cols-2">
          <section class="card space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-slate-100">Smart query</h2>
                <p class="text-[11px] text-slate-500">Run read-only contract queries</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="template in queryTemplates.value"
                  :key="template.label"
                  class="btn text-[10px]"
                  @click="applyTemplate(template.payload)"
                >
                  {{ template.label }}
                </button>
              </div>
            </div>
            <textarea
              v-model="smartQueryInput"
              class="w-full min-h-[160px] rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-mono p-3"
            ></textarea>
            <button class="btn btn-primary w-full" :disabled="smartQueryBusy" @click="runSmartQuery">
              {{ smartQueryBusy ? 'Querying' : 'Run query' }}
            </button>
            <p v-if="smartQueryError" class="text-xs text-rose-300">{{ smartQueryError }}</p>
            <div v-if="smartQueryResult" class="text-xs">
              <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Result</div>
              <pre class="bg-slate-900/80 rounded p-3 overflow-auto max-h-[260px]">{{ smartQueryResult }}</pre>
            </div>
          </section>

          <section class="card space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-sm font-semibold text-slate-100">Execute message</h2>
                <p class="text-[11px] text-slate-500">Requires Keplr wallet</p>
              </div>
              <button v-if="!walletAddress" class="btn text-[10px]" @click="connect">Connect Keplr</button>
            </div>
            <div v-if="executionTemplates.length" class="grid gap-2 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <label class="text-[11px] uppercase tracking-wider text-slate-500">Observed functions</label>
                <select
                  v-model="selectedExecTemplate"
                  class="w-full rounded bg-slate-900/70 border border-slate-800 text-xs px-3 py-2"
                >
                  <option value="">Select a function</option>
                  <option v-for="tpl in executionTemplates" :key="tpl.fn" :value="tpl.fn">
                    {{ tpl.fn }}
                  </option>
                </select>
              </div>
              <div class="flex items-end">
                <button class="btn text-[10px] w-full" :disabled="!selectedExecTemplate" @click="applyExecutionTemplate">
                  Load sample payload
                </button>
              </div>
            </div>
            <textarea
              v-model="executeMsgInput"
              class="w-full min-h-[160px] rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-mono p-3"
            ></textarea>
            <div class="grid gap-2 sm:grid-cols-2">
              <div>
                <label class="text-[11px] uppercase tracking-wider text-slate-500">Funds (optional)</label>
                <input
                  v-model="executeFunds"
                  placeholder="1000000 uretro, 500000 uatom"
                  class="w-full px-3 py-2 rounded bg-slate-900/70 border border-slate-800 text-xs font-mono"
                />
              </div>
              <div>
                <label class="text-[11px] uppercase tracking-wider text-slate-500">Memo</label>
                <input
                  v-model="executeMemo"
                  class="w-full px-3 py-2 rounded bg-slate-900/70 border border-slate-800 text-xs"
                />
              </div>
            </div>
            <button class="btn btn-primary w-full" :disabled="executeBusy" @click="executeMessage">
              {{ executeBusy ? 'Broadcasting' : 'Execute' }}
            </button>
            <p v-if="executeError" class="text-xs text-rose-300">{{ executeError }}</p>
            <div v-if="lastTxHash" class="text-xs text-emerald-300 flex items-center gap-2">
              <span>Tx hash:</span>
              <router-link class="underline" :to="{ name: 'tx-detail', params: { hash: lastTxHash } }">{{ lastTxHash }}</router-link>
            </div>
          </section>
        </div>

        <section class="card">
          <h2 class="text-sm font-semibold text-slate-100 mb-2">Raw data</h2>
          <div class="grid gap-3 lg:grid-cols-2 text-xs">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Contract info</div>
              <pre class="p-3 rounded bg-slate-900/80 overflow-auto max-h-[320px]">{{ JSON.stringify(contractInfo, null, 2) }}</pre>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Code info</div>
              <pre class="p-3 rounded bg-slate-900/80 overflow-auto max-h-[320px]">{{ JSON.stringify(codeInfo?.raw || codeInfo, null, 2) }}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
