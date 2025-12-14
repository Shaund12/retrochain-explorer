<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute } from "vue-router";
import { useTxs } from "@/composables/useTxs";
import dayjs from "dayjs";
import { formatCoins } from "@/utils/format";

const { getTx } = useTxs();
const route = useRoute();
const hash = String(route.params.hash);

const loading = ref(false);
const error = ref<string | null>(null);
const tx = ref<any | null>(null);
const viewMode = ref<"pretty" | "raw">("pretty");

const messages = computed(() => {
  return tx.value?.tx?.body?.messages || [];
});

const getMessageType = (msg: any) => {
  const type = msg["@type"] || msg.type || "";
  return type.split(".").pop() || type;
};

const formatAmount = (amount: any) => {
  if (Array.isArray(amount)) {
    return formatCoins(amount, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
  }
  if (amount && typeof amount === "object" && "denom" in amount && "amount" in amount) {
    return formatCoins([amount], { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
  }
  return formatCoins(amount, { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true });
};

const isSuccess = computed(() => {
  return tx.value?.tx_response?.code === 0;
});

const feeString = computed(() => formatCoins(tx.value?.tx?.auth_info?.fee?.amount || [], { minDecimals: 2, maxDecimals: 6, showZerosForIntegers: true }));

const memo = computed(() => tx.value?.tx?.body?.memo || "");

const signers = computed(() => tx.value?.tx?.auth_info?.signer_infos || []);

const txResponse = computed(() => tx.value?.tx_response);
const feeAmounts = computed(() => tx.value?.tx?.auth_info?.fee?.amount ?? []);
const gasLimit = computed(() => {
  const explicit = Number(tx.value?.tx?.auth_info?.fee?.gas_limit ?? 0);
  if (explicit) return explicit;
  return Number(txResponse.value?.gas_wanted ?? 0);
});
const gasUsed = computed(() => Number(txResponse.value?.gas_used ?? 0));
const gasEfficiency = computed(() => {
  if (!gasLimit.value || !gasUsed.value) return null;
  if (gasLimit.value === 0) return null;
  return (gasUsed.value / gasLimit.value) * 100;
});
const gasPrice = computed(() => {
  if (!feeAmounts.value.length || !gasLimit.value) return null;
  const primary = feeAmounts.value[0];
  const price = Number(primary.amount) / gasLimit.value;
  if (!Number.isFinite(price) || price <= 0) return null;
  const precision = price >= 1 ? 2 : price >= 0.01 ? 4 : 6;
  return `${price.toFixed(precision)} ${primary.denom}/gas`;
});
const feePayer = computed(() => tx.value?.tx?.auth_info?.fee?.payer || null);
const feeGranter = computed(() => tx.value?.tx?.auth_info?.fee?.granter || null);

const signerDetails = computed(() => {
  return signers.value.map((info: any, idx: number) => {
    const modeInfo = info.mode_info?.single?.mode || (info.mode_info?.multi ? "MULTI" : "—");
    const pkType = info.public_key?.["@type"] || info.public_key?.type || "—";
    return {
      index: idx + 1,
      sequence: info.sequence ?? "—",
      mode: modeInfo,
      publicKeyType: pkType,
      publicKey: info.public_key?.key || null
    };
  });
});

interface EventAttribute {
  id: string;
  key: string;
  value: string;
}

interface TxEventRow {
  id: string;
  type: string;
  attributes: EventAttribute[];
}

const events = computed<TxEventRow[]>(() => {
  const logs = txResponse.value?.logs;
  if (!Array.isArray(logs)) return [];
  const rows: TxEventRow[] = [];
  logs.forEach((log, logIndex) => {
    const eventList = Array.isArray(log?.events) ? log.events : [];
    eventList.forEach((event: any, eventIndex: number) => {
      const attrs = Array.isArray(event?.attributes) ? event.attributes : [];
      rows.push({
        id: `${logIndex}-${eventIndex}-${event?.type ?? "event"}`,
        type: event?.type || "event",
        attributes: attrs.map((attr: any, attrIndex: number) => ({
          id: `${logIndex}-${eventIndex}-${attrIndex}`,
          key: attr?.key ?? "key",
          value: attr?.value ?? ""
        }))
      });
    });
  });
  return rows;
});

const hasEvents = computed(() => events.value.length > 0);
const rawLog = computed(() => txResponse.value?.raw_log || "");

interface MessageDetail {
  label: string;
  value: string;
}

const shortAddress = (addr?: string, size = 10) => {
  if (!addr) return "—";
  return `${addr.slice(0, size)}…${addr.slice(-6)}`;
};

const formatLabel = (label: string) =>
  label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getMessageSummary = (msg: any): string | null => {
  const type = getMessageType(msg);
  if (type === "MsgSend") {
    return `${formatAmount(msg.amount)} from ${shortAddress(msg.from_address)} → ${shortAddress(msg.to_address)}`;
  }
  if (type === "MsgDelegate") {
    return `${formatAmount(msg.amount)} delegated to ${shortAddress(msg.validator_address)}`;
  }
  if (type === "MsgWithdrawDelegatorReward") {
    return `Claim rewards from ${shortAddress(msg.validator_address)}`;
  }
  if (type === "MsgVote") {
    return `Vote ${msg.option} on proposal #${msg.proposal_id}`;
  }
  return null;
};

const getMessageDetails = (msg: any): MessageDetail[] => {
  const type = getMessageType(msg);
  const base: MessageDetail[] = [];

  if (type === "MsgSend") {
    base.push({ label: "Amount", value: formatAmount(msg.amount) });
    if (msg.from_address) base.push({ label: "From", value: msg.from_address });
    if (msg.to_address) base.push({ label: "To", value: msg.to_address });
    return base;
  }

  if (type === "MsgDelegate" || type === "MsgUndelegate") {
    base.push({ label: "Amount", value: formatAmount(msg.amount) });
    if (msg.delegator_address) base.push({ label: "Delegator", value: msg.delegator_address });
    if (msg.validator_address) base.push({ label: "Validator", value: msg.validator_address });
    return base;
  }

  if (type === "MsgWithdrawDelegatorReward") {
    if (msg.delegator_address) base.push({ label: "Delegator", value: msg.delegator_address });
    if (msg.validator_address) base.push({ label: "Validator", value: msg.validator_address });
    return base;
  }

  const entries = Object.entries(msg || {})
    .filter(([key, value]) => key !== "@type" && typeof value === "string" && value)
    .slice(0, 4)
    .map(([key, value]) => ({ label: formatLabel(key), value: value as string }));

  return entries.length ? entries : base;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard?.writeText?.(text);
    // no toast system wired here; silent success
  } catch {}
};

const downloadJson = (obj: any, filename = "tx.json") => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await getTx(hash);
    tx.value = res;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="space-y-3">
    <!-- Status Banner -->
    <div 
      v-if="tx"
      class="card relative overflow-hidden"
      :class="isSuccess ? 'border-emerald-500/50' : 'border-rose-500/50'"
    >
      <div class="absolute inset-0 opacity-10"
           :class="isSuccess ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gradient-to-r from-rose-500 to-orange-500'"
      ></div>
      <div class="relative flex items-center gap-4">
        <div 
          class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold backdrop-blur-sm"
          :class="isSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-rose-500/20 text-rose-400 border border-rose-500/50'"
        >
          {{ isSuccess ? "OK" : "X" }}
        </div>
        <div class="flex-1">
          <div class="text-lg font-bold" :class="isSuccess ? 'text-emerald-300' : 'text-rose-300'">
            Transaction {{ isSuccess ? "Successful" : "Failed" }}
          </div>
          <div class="text-sm text-slate-400 mt-1 flex items-center gap-2">
            <span>{{ dayjs(tx.tx_response?.timestamp).format("YYYY-MM-DD HH:mm:ss") }}</span>
            <span class="text-xs">|</span>
            <span class="text-xs">{{ dayjs(tx.tx_response?.timestamp).fromNow() }}</span>
          </div>
        </div>
        <div v-if="isSuccess" class="text-right">
          <div class="text-xs text-slate-400 uppercase tracking-wider">Status Code</div>
          <div class="text-2xl font-bold text-emerald-400">0</div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 grid-cols-1 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <div class="card">
        <h1 class="text-sm font-semibold mb-3 text-slate-100">
          Transaction Details
        </h1>
        <div class="mb-3 flex items-center gap-2">
          <button class="btn text-xs sm:text-[12px]" :class="viewMode==='pretty' ? 'border-emerald-400/70 bg-emerald-500/10' : ''" @click="viewMode='pretty'">Pretty</button>
          <button class="btn text-xs sm:text-[12px]" :class="viewMode==='raw' ? 'border-indigo-400/70 bg-indigo-500/10' : ''" @click="viewMode='raw'">Raw JSON</button>
          <button class="btn text-xs sm:text-[12px]" @click="copyToClipboard(JSON.stringify(tx, null, 2))">Copy JSON</button>
          <button class="btn text-xs sm:text-[12px]" @click="downloadJson(tx)">Download</button>
        </div>

        <div v-if="loading" class="text-xs text-slate-400">
          Loading transaction…
        </div>
        <div v-if="error" class="text-xs text-rose-300">
          {{ error }}
        </div>

        <div v-if="tx && viewMode==='pretty'" class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Transaction Hash
              </div>
              <div class="flex items-center gap-2 whitespace-nowrap">
                <code class="text-[11px] break-words sm:break-all text-slate-200 truncate max-w-[240px] sm:max-w-none">{{ hash }}</code>
                <button class="btn text-[10px] sm:text-[11px]" @click="copyToClipboard(hash)">Copy</button>
              </div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Block Height
              </div>
              <div class="text-slate-200">{{ tx.tx_response?.height ?? '—' }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Status Code
              </div>
              <span
                class="badge"
                :class="isSuccess ? 'border-emerald-400/60 text-emerald-200' : 'border-rose-400/60 text-rose-200'"
              >
                {{ tx.tx_response?.code ?? 0 }}
              </span>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Gas (Used / Wanted)
              </div>
              <div class="text-slate-200">
                {{ tx.tx_response?.gas_used ?? '—' }} / {{ tx.tx_response?.gas_wanted ?? '—' }}
              </div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Fee
              </div>
              <div class="text-slate-200">{{ feeString }}</div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                Memo
              </div>
              <div class="text-slate-300 break-words sm:break-all">{{ memo || '—' }}</div>
            </div>
          </div>

          <!-- Messages -->
          <div class="border-t border-slate-800 pt-3">
            <div class="text-sm font-semibold text-slate-100 mb-2">
              Messages ({{ messages.length }})
            </div>
            <div class="space-y-2">
              <div
                v-for="(msg, idx) in messages"
                :key="idx"
                class="p-3 bg-slate-900/60 rounded-lg border border-slate-700"
              >
                <div class="flex items-center justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <span class="badge text-xs border-cyan-400/60 text-cyan-200">
                      {{ getMessageType(msg) }}
                    </span>
                    <span class="text-[11px] text-slate-500">Message #{{ idx + 1 }}</span>
                  </div>
                  <button class="btn text-[10px] sm:text-[11px]" @click="copyToClipboard(JSON.stringify(msg, null, 2))">Copy JSON</button>
                </div>
                <p v-if="getMessageSummary(msg)" class="text-xs text-slate-400 mb-2">
                  {{ getMessageSummary(msg) }}
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div v-for="detail in getMessageDetails(msg)" :key="detail.label + detail.value" class="flex flex-col">
                    <span class="text-slate-500 uppercase tracking-wider">{{ detail.label }}</span>
                    <span class="font-mono break-all text-slate-200">{{ detail.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Events/Logs -->
          <div v-if="hasEvents" class="border-t border-slate-800 pt-3">
            <div class="text-sm font-semibold text-slate-100 mb-2">
              Events ({{ events.length }})
            </div>
            <div class="max-h-80 overflow-auto pr-1 space-y-2">
              <div
                v-for="event in events"
                :key="event.id"
                class="p-3 rounded-lg bg-slate-900/60 border border-slate-800"
              >
                <div class="flex items-center justify-between text-xs mb-2">
                  <span class="text-slate-300 font-semibold">{{ event.type }}</span>
                  <span class="text-[10px] text-slate-500">{{ event.attributes.length }} attrs</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div v-for="attr in event.attributes" :key="attr.id" class="flex flex-col">
                    <span class="text-slate-500 uppercase tracking-wider">{{ attr.key }}</span>
                    <span class="font-mono break-all text-slate-200">{{ attr.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="rawLog" class="border-t border-slate-800 pt-3">
            <div class="text-sm font-semibold text-slate-100 mb-2">
              Raw Log
            </div>
            <pre class="p-3 rounded bg-slate-900/80 overflow-x-auto max-h-40 text-xs">{{ rawLog }}</pre>
          </div>
        </div>

        <!-- Raw JSON full view -->
        <div v-else-if="tx && viewMode==='raw'" class="text-xs">
          <pre class="p-2 rounded bg-slate-900/80 overflow-auto max-h-[60vh]">{{ JSON.stringify(tx, null, 2) }}</pre>
        </div>
        </div>
      </div>

      <div class="flex flex-col gap-3">
        <div class="card">
          <h2 class="text-sm font-semibold mb-2 text-slate-100">
            Execution Metrics
          </h2>
          <div class="space-y-2 text-xs text-slate-300">
            <div class="flex items-center justify-between">
              <span>Gas Used / Limit</span>
              <span class="font-mono text-slate-100">{{ gasUsed ?? '—' }} / {{ gasLimit ?? '—' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>Fee</span>
              <span class="text-slate-100">{{ feeString }}</span>
            </div>
            <div v-if="gasPrice" class="flex items-center justify-between">
              <span>Gas Price</span>
              <span class="font-mono text-slate-100">{{ gasPrice }}</span>
            </div>
            <div v-if="gasEfficiency !== null" class="flex items-center justify-between">
              <span>Efficiency</span>
              <span class="text-emerald-300 font-semibold">{{ gasEfficiency.toFixed(2) }}%</span>
            </div>
            <div v-if="feePayer" class="flex flex-col">
              <span class="text-slate-400">Fee Payer</span>
              <code class="text-[11px] break-all text-slate-200">{{ feePayer }}</code>
            </div>
            <div v-if="feeGranter" class="flex flex-col">
              <span class="text-slate-400">Fee Granter</span>
              <code class="text-[11px] break-all text-slate-200">{{ feeGranter }}</code>
            </div>
            <div v-if="txResponse?.codespace" class="flex items-center justify-between">
              <span>Codespace</span>
              <span class="font-mono text-slate-100">{{ txResponse.codespace }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h2 class="text-sm font-semibold mb-2 text-slate-100">
            Signers
          </h2>
          <div v-if="signerDetails.length === 0" class="text-xs text-slate-400">
            No signer information available
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="signer in signerDetails"
              :key="signer.index"
              class="p-3 rounded-lg bg-slate-900/60 border border-slate-700 text-xs space-y-1"
            >
              <div class="flex items-center justify-between">
                <span class="text-slate-300 font-semibold">Signer #{{ signer.index }}</span>
                <span class="text-[10px] text-slate-500">Sequence {{ signer.sequence }}</span>
              </div>
              <div class="text-slate-400">
                Mode:
                <span class="text-slate-200 font-mono">{{ signer.mode }}</span>
              </div>
              <div class="text-slate-400">
                PubKey Type:
                <span class="text-slate-200">{{ signer.publicKeyType }}</span>
              </div>
              <div v-if="signer.publicKey" class="text-[10px] text-slate-500 break-all">
                Key: {{ signer.publicKey }}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2 class="text-sm font-semibold mb-2 text-slate-100">
            Raw Transaction
          </h2>
          <div v-if="tx" class="text-xs">
            <pre
              class="p-2 rounded bg-slate-900/80 overflow-auto max-h-[50vh]"
            >{{ JSON.stringify(tx, null, 2) }}</pre>
          </div>
          <div v-else-if="loading" class="text-xs text-slate-400">
            Loading...
          </div>
          <div v-else class="text-xs text-slate-400">
            No data
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
