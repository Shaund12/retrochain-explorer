<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { useTxs } from "@/composables/useTxs";
import { getTokenMeta } from "@/constants/tokens";
import dayjs from "dayjs";
import { formatCoins } from "@/utils/format";
import { useQuery } from "@tanstack/vue-query";
import { shortenMiddle } from "@/utils/stringFormat";

const { getTx } = useTxs();
const route = useRoute();
const hash = String(route.params.hash);

const tx = ref<any | null>(null);
const viewMode = ref<"pretty" | "raw">("pretty");

const { data, isPending, error } = useQuery({
  queryKey: ["tx", hash],
  queryFn: () => getTx(hash),
  enabled: Boolean(hash),
  staleTime: 30_000
});

const loading = computed(() => isPending.value);

// Keep existing code working by mirroring query data into local `tx` ref
computed(() => {
  tx.value = data.value ?? null;
  return tx.value;
});

const messages = computed(() => {
  return tx.value?.tx?.body?.messages || [];
});

const priceOverrides = ref<Record<string, number>>({});
const priceLookup = computed(() => {
  const hints: Record<string, number | undefined> = {
    USDC: 1,
    ATOM: Number(import.meta.env.VITE_PRICE_ATOM_USD ?? "0") || 10,
    WBTC: Number(import.meta.env.VITE_PRICE_WBTC_USD ?? "0") || 40000
  };
  return { ...hints, ...priceOverrides.value };
});

const fetchLivePrices = async () => {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=osmosis,cosmos,usd-coin,wrapped-bitcoin&vs_currencies=usd",
      { cache: "no-store" }
    );
    const data = await res.json();
    const overrides: Record<string, number> = {};
    const osmo = Number(data?.osmosis?.usd);
    if (Number.isFinite(osmo) && osmo > 0) overrides.OSMO = osmo;
    const atom = Number(data?.cosmos?.usd);
    if (Number.isFinite(atom) && atom > 0) overrides.ATOM = atom;
    const usdc = Number(data?.["usd-coin"]?.usd);
    if (Number.isFinite(usdc) && usdc > 0) overrides.USDC = usdc;
    const wbtc = Number(data?.["wrapped-bitcoin"]?.usd);
    if (Number.isFinite(wbtc) && wbtc > 0) overrides.WBTC = wbtc;
    priceOverrides.value = overrides;
  } catch (err) {
    console.warn("Failed to fetch live prices", err);
  }
};

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

const shortAddress = (addr?: string, size = 10) => shortenMiddle(addr, { head: size, tail: 6, delimiter: "…" });

const isAccountAddress = (val?: string | null) => {
  if (!val) return false;
  return /^(cosmos1|retro1)[0-9a-z]{20,}$/i.test(val);
};

const accountLink = (addr?: string | null) => (addr ? { name: "account", params: { address: addr } } : null);

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

const parseAmountDenom = (raw?: string | null) => {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.match(/^(-?\d+)([a-zA-Z\/:].+)$/);
  if (!match) return null;
  return { amount: match[1], denom: match[2] };
};

const formatTokenAmount = (rawAmount: string, denom: string) => {
  const meta = getTokenMeta(denom);
  const decimals = typeof meta.decimals === "number" ? meta.decimals : 6;
  const int = BigInt(rawAmount);
  const divisor = 10n ** BigInt(Math.max(decimals, 0));
  const whole = Number(int) / Math.pow(10, decimals);
  const formatted = Number.isFinite(whole)
    ? whole.toLocaleString(undefined, { minimumFractionDigits: Math.min(2, decimals), maximumFractionDigits: Math.min(6, decimals) })
    : rawAmount;
  return `${formatted} ${meta.symbol || denom.toUpperCase()}`;
};

const formatUsd = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const USD_PRICE_HINTS: Record<string, number | undefined> = {
  USDC: 1,
  ATOM: Number(import.meta.env.VITE_PRICE_ATOM_USD ?? "0") || 10,
  WBTC: Number(import.meta.env.VITE_PRICE_WBTC_USD ?? "0") || 40000
};

const getUsdEstimate = (rawAmount: string | undefined | null, denom: string | undefined | null): number | null => {
  if (!rawAmount || !denom) return null;
  const meta = getTokenMeta(denom);
  const normalizeSymbol = (val?: string | null) => {
    if (!val) return undefined;
    const clean = val.replace(/^ibc\//i, "");
    return clean.replace(/^u/, "").toUpperCase();
  };
  const symbol = normalizeSymbol(meta.symbol) || normalizeSymbol((meta as any)?.display) || normalizeSymbol((meta as any)?.name) || normalizeSymbol(denom);
  const hint = symbol ? priceLookup.value[symbol] ?? USD_PRICE_HINTS[symbol] : undefined;
  if (!hint || hint <= 0) return null;
  const decimals = typeof meta.decimals === "number" ? meta.decimals : 6;
  const num = Number(rawAmount) / Math.pow(10, decimals);
  if (!Number.isFinite(num)) return null;
  return num * hint;
};

const decodeBase64Json = (data?: string) => {
  if (!data) return null;
  try {
    const text = atob(data);
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const transferEvents = computed(() => {
  const logs = txResponse.value?.logs;
  if (!Array.isArray(logs)) return [] as any[];
  const transfers: {
    sender?: string | null;
    recipient?: string | null;
    amount?: string | null;
    denom?: string | null;
    formatted?: string;
    meta?: ReturnType<typeof getTokenMeta>;
    usd?: number | null;
  }[] = [];

  const pushTransfer = (amount: string, denom: string, sender?: string | null, recipient?: string | null) => {
    const meta = getTokenMeta(denom);
    const usd = getUsdEstimate(amount, denom);
    transfers.push({
      sender: sender || null,
      recipient: recipient || null,
      amount,
      denom,
      formatted: formatTokenAmount(amount, denom),
      meta,
      usd
    });
  };

  logs.forEach((log) => {
    const evs = Array.isArray(log?.events) ? log.events : [];
    evs.forEach((ev: any) => {
      if (ev?.type !== "transfer") return;
      const attrs = Array.isArray(ev?.attributes) ? ev.attributes : [];
      const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
        if (curr?.key) acc[curr.key] = curr.value;
        return acc;
      }, {} as Record<string, string>);
      const parsed = parseAmountDenom(map.amount);
      if (!parsed) return;
      pushTransfer(parsed.amount, parsed.denom, map.sender, map.recipient || map.receiver);
    });
  });

  const responseEvents = Array.isArray(txResponse.value?.events) ? txResponse.value?.events : [];
  responseEvents.forEach((ev: any) => {
    const attrs = Array.isArray(ev?.attributes) ? ev.attributes : [];
    const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
      if (curr?.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (ev?.type === "transfer") {
      const parsed = parseAmountDenom(map.amount);
      if (parsed) pushTransfer(parsed.amount, parsed.denom, map.sender, map.recipient || map.receiver);
      return;
    }

    if (ev?.type === "fungible_token_packet") {
      const denom = map.denom;
      const amt = map.amount;
      if (denom && amt) {
        pushTransfer(amt, denom, map.sender, map.receiver || map.recipient);
        return;
      }
      const parsed = parseAmountDenom(map.amount);
      if (parsed) pushTransfer(parsed.amount, parsed.denom, map.sender, map.receiver || map.recipient);
    }
  });

  const deduped: typeof transfers = [];
  const seen: Record<string, number> = {};

  transfers.forEach((tr) => {
    const symbol = tr.meta?.symbol || tr.denom || "denom";
    const key = `${symbol}-${tr.amount || "amt"}-${tr.recipient || "to"}`;
    const existingIdx = seen[key];
    if (existingIdx === undefined) {
      seen[key] = deduped.length;
      deduped.push(tr);
      return;
    }
    const existing = deduped[existingIdx];
    const preferNew = (!existing.meta?.logo && tr.meta?.logo) || (!existing.meta?.symbol && tr.meta?.symbol) || (!!tr.usd && !existing.usd);
    if (preferNew) {
      deduped[existingIdx] = tr;
    }
  });

  return deduped;
});

const burnEvents = computed(() => {
  const responseEvents = Array.isArray(txResponse.value?.events) ? txResponse.value?.events : [];
  const burns: {
    amount: string;
    denom: string;
    burner?: string | null;
    formatted?: string;
    usd?: number | null;
    source?: string | null;
    msgIndex?: string | null;
  }[] = [];
  const burnMsgIndices = new Set<string>();

  const pushBurn = (amount: string, denom: string, burner?: string | null, source?: string | null, msgIndex?: string | null) => {
    const formatted = formatTokenAmount(amount, denom);
    const usd = getUsdEstimate(amount, denom);
    burns.push({ amount, denom, burner: burner || null, formatted, usd, source: source || null, msgIndex: msgIndex || null });
  };

  responseEvents.forEach((ev: any) => {
    const attrs = Array.isArray(ev?.attributes) ? ev.attributes : [];
    const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
      if (curr?.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (ev?.type === "burn") {
      const parsed = parseAmountDenom(map.amount);
      if (parsed) {
        pushBurn(parsed.amount, parsed.denom, map.burner || map.sender, ev?.type, map.msg_index);
        if (map.msg_index) burnMsgIndices.add(map.msg_index);
      }
      return;
    }

    if (map.tokens_burned) {
      if (map.msg_index && burnMsgIndices.has(map.msg_index)) return;
      pushBurn(map.tokens_burned, map.denom || "uretro", map.burner || map.player || map.sender, ev?.type, map.msg_index);
      return;
    }
  });

  const deduped: typeof burns = [];
  const seen: Record<string, boolean> = {};

  burns.forEach((b) => {
    const key = `${b.amount}-${b.denom}-${b.burner || ""}-${b.msgIndex || ""}`;
    if (seen[key]) return;
    seen[key] = true;
    deduped.push(b);
  });

  return deduped;
});

const ibcPackets = computed(() => {
  const responseEvents = Array.isArray(txResponse.value?.events) ? txResponse.value?.events : [];
  const packets: {
    type: string;
    sequence?: string;
    source?: string;
    dest?: string;
    amount?: string;
    denom?: string;
    sender?: string;
    receiver?: string;
    decoded?: any;
    meta?: ReturnType<typeof getTokenMeta>;
    formatted?: string;
    usd?: number | null;
  }[] = [];

  responseEvents.forEach((ev: any) => {
    if (ev?.type !== "recv_packet" && ev?.type !== "write_acknowledgement" && ev?.type !== "fungible_token_packet") return;
    const attrs = Array.isArray(ev?.attributes) ? ev.attributes : [];
    const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
      if (curr?.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const decoded = decodeBase64Json(map.packet_data_base64);
    const jsonFromHex = (() => {
      if (!map.packet_data_hex) return null;
      try {
        const bytes = map.packet_data_hex.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [];
        const text = String.fromCharCode(...bytes);
        return JSON.parse(text);
      } catch {
        return null;
      }
    })();

    const decodedData = decoded || jsonFromHex;
    const amount = decodedData?.amount || map.amount;
    const denom = decodedData?.denom || map.denom;
    const sender = decodedData?.sender || map.sender;
    const receiver = decodedData?.receiver || map.recipient;

    const meta = denom ? getTokenMeta(denom) : undefined;
    const formatted = amount && denom ? formatTokenAmount(amount, denom) : undefined;
    const usd = getUsdEstimate(amount, denom);

    packets.push({
      type: ev?.type,
      sequence: map.packet_sequence,
      source: map.packet_src_channel ? `${map.packet_src_port || "transfer"}/${map.packet_src_channel}` : undefined,
      dest: map.packet_dst_channel ? `${map.packet_dst_port || "transfer"}/${map.packet_dst_channel}` : undefined,
      amount,
      denom,
      sender,
      receiver,
      decoded: decodedData,
      meta,
      formatted,
      usd
    });
  });

  return packets;
});

const copyToClipboard = async (text: string) => toastCopy(text, "Copied");

const downloadJson = (obj: any, filename = "tx.json") => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

fetchLivePrices();
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

        <div v-if="ibcPackets.length" class="card">
          <h2 class="text-sm font-semibold mb-2 text-slate-100">IBC Packet Data</h2>
          <div class="space-y-2 text-xs text-slate-300">
            <div
              v-for="(pkt, i) in ibcPackets"
              :key="`${pkt.type}-${pkt.sequence}-${i}`"
              class="p-3 rounded-lg bg-slate-900/60 border border-indigo-500/30"
            >
              <div class="flex items-center justify-between mb-1">
                <div class="text-slate-100 font-semibold">{{ pkt.type }} · Seq {{ pkt.sequence || '—' }}</div>
                <span class="badge text-[10px] border-indigo-400/60 text-indigo-200">IBC</span>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-400">
                <div v-if="pkt.amount && pkt.denom">
                  <span class="text-slate-500">Amount</span>
                  <div class="font-mono break-all text-slate-200">{{ pkt.amount }} {{ pkt.denom }}</div>
                </div>
                <div v-if="pkt.usd !== null && pkt.usd !== undefined">
                  <span class="text-slate-500">USD (est.)</span>
                  <div class="text-emerald-300 font-semibold">≈ {{ formatUsd(pkt.usd) }}</div>
                </div>
                <div v-if="pkt.sender">
                  <span class="text-slate-500">Sender</span>
                  <div class="font-mono break-all text-slate-200">
                    <RouterLink
                      v-if="isAccountAddress(pkt.sender)"
                      :to="accountLink(pkt.sender)"
                      class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                    >
                      <span>{{ shortAddress(pkt.sender, 12) }}</span>
                      <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                    </RouterLink>
                    <span v-else>{{ pkt.sender }}</span>
                  </div>
                </div>
                <div v-if="pkt.receiver">
                  <span class="text-slate-500">Receiver</span>
                  <div class="font-mono break-all text-slate-200">
                    <RouterLink
                      v-if="isAccountAddress(pkt.receiver)"
                      :to="accountLink(pkt.receiver)"
                      class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                    >
                      <span>{{ shortAddress(pkt.receiver, 12) }}</span>
                      <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                    </RouterLink>
                    <span v-else>{{ pkt.receiver }}</span>
                  </div>
                </div>
                <div v-if="pkt.source || pkt.dest">
                  <span class="text-slate-500">Path</span>
                  <div class="font-mono break-all text-slate-200">{{ pkt.source || '—' }} → {{ pkt.dest || '—' }}</div>
                </div>
                <div v-if="pkt.decoded" class="sm:col-span-2">
                  <span class="text-slate-500">Decoded Data</span>
                  <pre class="mt-1 p-2 rounded bg-slate-900/80 overflow-auto max-h-32 text-[10px]">{{ JSON.stringify(pkt.decoded, null, 2) }}</pre>
                </div>
              </div>
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
          {{ (error as any)?.message ?? String(error) }}
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
                <button class="btn text-[10px] sm:text-[11px]" @click="shareLink()">Share</button>
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
                    <span class="font-mono break-all text-slate-200">
                      <RouterLink
                        v-if="isAccountAddress(detail.value)"
                        :to="accountLink(detail.value)"
                        class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                      >
                        <span>{{ shortAddress(detail.value, 12) }}</span>
                        <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                      </RouterLink>
                      <span v-else>{{ detail.value }}</span>
                    </span>
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
        <div v-if="burnEvents.length" class="card">
          <h2 class="text-sm font-semibold mb-2 text-slate-100 flex items-center gap-2">
            <span>🔥</span>
            <span>RETRO Burned</span>
          </h2>
          <div class="space-y-2 text-xs text-slate-300">
            <div
              v-for="(burn, i) in burnEvents"
              :key="`${burn.denom}-${burn.amount}-${i}`"
              class="p-3 rounded-lg bg-slate-900/60 border border-rose-500/30"
            >
              <div class="flex items-center justify-between mb-1 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-lg">🔥</span>
                  <div class="text-slate-100 font-semibold truncate">{{ burn.formatted || `${burn.amount} ${burn.denom}` }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="burn.usd !== null && burn.usd !== undefined" class="text-[11px] text-emerald-300 font-semibold">≈ {{ formatUsd(burn.usd) }}</span>
                  <span class="badge text-[10px] border-rose-400/60 text-rose-200">{{ burn.denom?.toUpperCase() }}</span>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-400">
                <div v-if="burn.burner">
                  <span class="text-slate-500">Burner</span>
                  <div class="font-mono break-all text-slate-200">
                    <RouterLink
                      v-if="isAccountAddress(burn.burner)"
                      :to="accountLink(burn.burner)"
                      class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                    >
                      <span>{{ shortAddress(burn.burner, 12) }}</span>
                      <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                    </RouterLink>
                    <span v-else>{{ burn.burner }}</span>
                  </div>
                </div>
                <div v-if="burn.source || burn.msgIndex">
                  <span class="text-slate-500">Source</span>
                  <div class="font-mono break-all text-slate-200">
                    {{ burn.source || 'event' }}
                    <span v-if="burn.msgIndex" class="text-slate-500"> · msg {{ burn.msgIndex }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="transferEvents.length" class="card">
          <h2 class="text-sm font-semibold mb-2 text-slate-100">Transfers</h2>
          <div class="space-y-2 text-xs text-slate-300">
            <div
              v-for="(tr, i) in transferEvents"
              :key="`${tr.denom}-${tr.amount}-${i}`"
              class="p-3 rounded-lg bg-slate-900/60 border border-slate-700"
            >
              <div class="flex items-center justify-between mb-1 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <img v-if="tr.meta?.logo" :src="tr.meta.logo" alt="" class="w-6 h-6 rounded-full border border-white/10" />
                  <div class="text-slate-100 font-semibold truncate">{{ tr.formatted || `${tr.amount} ${tr.denom}` }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="tr.usd !== null && tr.usd !== undefined" class="text-[11px] text-emerald-300 font-semibold">≈ {{ formatUsd(tr.usd) }}</span>
                  <span class="badge text-[10px]" :class="tr.meta?.accent === 'amber' ? 'border-amber-400/60 text-amber-200' : 'border-slate-400/60 text-slate-200'">
                    {{ tr.meta?.symbol || tr.denom?.toUpperCase() }}
                  </span>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-400">
                <div v-if="tr.sender">
                  <span class="text-slate-500">From</span>
                  <div class="font-mono break-all text-slate-200">
                    <RouterLink
                      v-if="isAccountAddress(tr.sender)"
                      :to="accountLink(tr.sender)"
                      class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                    >
                      <span>{{ shortAddress(tr.sender, 12) }}</span>
                      <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                    </RouterLink>
                    <span v-else>{{ tr.sender }}</span>
                  </div>
                </div>
                <div v-if="tr.recipient">
                  <span class="text-slate-500">To</span>
                  <div class="font-mono break-all text-slate-200">
                    <RouterLink
                      v-if="isAccountAddress(tr.recipient)"
                      :to="accountLink(tr.recipient)"
                      class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                    >
                      <span>{{ shortAddress(tr.recipient, 12) }}</span>
                      <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                    </RouterLink>
                    <span v-else>{{ tr.recipient }}</span>
                  </div>
                </div>
                <div>
                  <span class="text-slate-500">Denom</span>
                  <div class="font-mono break-all text-slate-200">{{ tr.denom }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
              <code class="text-[11px] break-all text-slate-200">
                <RouterLink
                  v-if="isAccountAddress(feePayer)"
                  :to="accountLink(feePayer)"
                  class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                >
                  <span>{{ shortAddress(feePayer, 12) }}</span>
                  <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                </RouterLink>
                <span v-else>{{ feePayer }}</span>
              </code>
            </div>
            <div v-if="feeGranter" class="flex flex-col">
              <span class="text-slate-400">Fee Granter</span>
              <code class="text-[11px] break-all text-slate-200">
                <RouterLink
                  v-if="isAccountAddress(feeGranter)"
                  :to="accountLink(feeGranter)"
                  class="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                >
                  <span>{{ shortAddress(feeGranter, 12) }}</span>
                  <span class="text-[10px] px-1 rounded border border-emerald-400/40 bg-emerald-500/10">View</span>
                </RouterLink>
                <span v-else>{{ feeGranter }}</span>
              </code>
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
