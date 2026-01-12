<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, useAttrs } from "vue";
import { useToast } from "@/composables/useToast";
import { useKeplr } from "@/composables/useKeplr";
import { useNetwork } from "@/composables/useNetwork";
import { useAccount } from "@/composables/useAccount";
import { formatAmount } from "@/utils/format";
import { getTokenMeta } from "@/constants/tokens";

defineOptions({ inheritAttrs: false });

declare global {
  interface Window {
    keplr?: any;
    leap?: any;
    cosmostation?: {
      providers?: {
        keplr?: any;
      };
    };
  }
}

const toast = useToast();
const { isAvailable, connect, connecting, address } = useKeplr();
const { restBase, rpcBase } = useNetwork();
const { balances, loading: accountLoading, load } = useAccount();
const attrs = useAttrs();

const showModal = ref(false);
const installUrl = "https://www.keplr.app/download";
const chainId = import.meta.env.VITE_CHAIN_ID || "retrochain-mainnet";
const chainName = import.meta.env.VITE_CHAIN_NAME || "RetroChain Mainnet";

const origin = typeof window !== "undefined" ? window.location.origin : "";
const resolveEndpoint = (value: string | undefined | null, fallbackPath: string) => {
  const candidate = value || fallbackPath;
  if (!candidate) return fallbackPath;
  if (candidate.startsWith("http")) return candidate;
  if (!origin) return candidate;
  return `${origin}${candidate.startsWith("/") ? "" : "/"}${candidate}`;
};

const restDisplay = computed(() => resolveEndpoint(restBase.value, "/api"));
const rpcDisplay = computed(() => resolveEndpoint(rpcBase.value, "/rpc"));

const detectedWalletName = computed(() => {
  if (keplrDetected.value) return "Keplr";
  if (leapDetected.value) return "Leap";
  if (cosmoDetected.value) return "Cosmostation";
  return "Keplr";
});

const buttonAttrs = computed(() => {
  const { class: _class, ...rest } = attrs;
  return rest;
});

const externalClass = computed(() => attrs.class);

const keplrDetected = computed(() => typeof window !== "undefined" && !!window.keplr);
const leapDetected = computed(() => typeof window !== "undefined" && !!window.leap);
const cosmoDetected = computed(() => typeof window !== "undefined" && !!window.cosmostation?.providers?.keplr);

const walletStatuses = computed(() => [
  { name: "Keplr", icon: "🪐", detected: keplrDetected.value, primary: true },
  { name: "Leap", icon: "🦘", detected: leapDetected.value },
  { name: "Cosmostation", icon: "🚀", detected: cosmoDetected.value }
]);

const buttonLabel = computed(() => {
  if (connecting.value) return "Connecting…";
  if (address.value) return "Wallet Connected";
  if (!isAvailable.value) return `Install ${detectedWalletName.value}`;
  return "Connect Wallet";
});

const buttonSubtext = computed(() => {
  if (address.value) {
    return `${address.value.slice(0, 10)}…${address.value.slice(-6)}`;
  }
  return "Keplr • Leap • Cosmostation";
});

const WBTC_IBC_DENOMS = ["ibc/CF57A83CED6CEC7D706631B5DC53ABC21B7EDA7DF7490732B4361E6D5DD19C73"]; // 8 decimals
const wbtcDenomSet = new Set(WBTC_IBC_DENOMS.map((d) => d.toLowerCase()));

const wbtcEntry = computed(() => balances.value.find((b) => wbtcDenomSet.has(b.denom.toLowerCase())));
const wbtcBalanceDisplay = computed(() => {
  if (!wbtcEntry.value) return null;
  return formatAmount(wbtcEntry.value.amount, wbtcEntry.value.denom, {
    minDecimals: 2,
    maxDecimals: 8,
    showZerosForIntegers: false
  });
});
const wbtcMeta = computed(() => (wbtcEntry.value ? getTokenMeta(wbtcEntry.value.denom) : null));

watch(
  address,
  async (addr) => {
    if (addr) {
      await load(addr);
    } else {
      balances.value = [];
    }
  },
  { immediate: true }
);

const steps = computed(() => [
  { title: `Install ${detectedWalletName.value}`, detail: "Browser extension or mobile app", action: () => window.open(installUrl, "_blank") },
  { title: "Add RetroChain", detail: "Chain suggestion handles RPC/REST endpoints" },
  { title: "Approve Connection", detail: "Unlock wallet and approve access" }
]);

const previousOverflow = ref<string | null>(null);
const restoreBodyOverflow = () => {
  if (typeof document === "undefined") return;
  document.body.style.overflow = previousOverflow.value ?? "";
  previousOverflow.value = null;
};

watch(showModal, (open) => {
  if (typeof document === "undefined") return;
  if (open) {
    previousOverflow.value = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else {
    restoreBodyOverflow();
  }
});

watch(address, (val) => {
  if (val) {
    showModal.value = false;
  }
});

const closeModal = () => {
  showModal.value = false;
};

const openModal = () => {
  showModal.value = true;
};

const handleConnect = async () => {
  if (!isAvailable.value) {
    window.open(installUrl, "_blank");
    return;
  }
  try {
    await connect();
    toast.showSuccess("Wallet connected");
    showModal.value = false;
  } catch (err: any) {
    toast.showTxError(err?.message || "Unable to connect Keplr");
  } finally {
    restoreBodyOverflow();
  }
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && showModal.value) {
    showModal.value = false;
  }
};

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown);
  restoreBodyOverflow();
});
</script>

<template>
  <div class="inline-block">
    <button
      v-bind="buttonAttrs"
      type="button"
      @click="openModal"
      :disabled="connecting"
      :class="[
        'w-full rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-600/80 to-emerald-600/80 px-4 py-2 text-left text-white shadow-lg shadow-cyan-500/30 transition hover:from-cyan-500 hover:to-emerald-500 disabled:cursor-wait',
        externalClass
      ]"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wider text-white/80">{{ buttonLabel }}</p>
          <p class="text-[11px] text-white/60">{{ buttonSubtext }}</p>
        </div>
         <span class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-lg">🔐</span>
      </div>
    </button>

    <teleport to="body">
      <transition name="fade">
        <div
          v-if="showModal"
          class="fixed inset-0 z-[1000] overflow-y-auto bg-black/70"
        >
          <div class="flex min-h-full items-start justify-center px-4 py-6 sm:items-center sm:px-6 sm:py-10">
            <div class="max-w-3xl w-full rounded-3xl border border-white/10 bg-[rgba(7,10,24,0.98)] shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">
            <div class="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-5">
              <div>
                <p class="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Wallet Center</p>
                <h2 class="mt-1 text-2xl font-semibold text-white">Connect to RetroChain</h2>
                <p class="text-sm text-slate-400">Securely connect Keplr (or any compatible wallet) to manage assets, stake, and bridge.</p>
              </div>
              <button type="button" class="text-slate-400 hover:text-white" @click="closeModal">
                <span class="sr-only">Close</span>
                ×
              </button>
            </div>

            <div class="grid gap-6 px-6 py-6 lg:grid-cols-2">
              <div class="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-slate-300">Wallet Detection</p>
                <ul class="mt-3 space-y-3">
                  <li
                    v-for="entry in walletStatuses"
                    :key="entry.name"
                    class="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2"
                    :class="entry.detected ? 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20' : 'bg-white/5 text-slate-400'"
                  >
                    <div class="flex items-center gap-2 text-sm font-medium">
                      <span>{{ entry.icon }}</span>
                      <span>{{ entry.name }}</span>
                      <span v-if="entry.primary" class="text-[10px] uppercase tracking-wider" :class="entry.detected ? 'text-emerald-200' : 'text-slate-400'">Preferred</span>
                    </div>
                    <span class="text-[11px] font-semibold" :class="entry.detected ? 'text-emerald-200' : 'text-slate-400'">
                      {{ entry.detected ? 'Ready' : 'Not detected' }}
                    </span>
                  </li>
                </ul>
                <div class="mt-3 rounded-xl border border-white/5 bg-white/5 p-3 text-[11px] text-slate-300">
                  Tip: If Keplr isn’t detected, open the extension once and refresh this page.
                </div>
              </div>

              <div class="rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/90 to-slate-800/60 p-4">
                <p class="text-xs font-semibold uppercase tracking-widest text-slate-300">RetroChain Endpoint Preview</p>
                <dl class="mt-3 space-y-2 text-sm">
                  <div class="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                    <dt class="text-[11px] uppercase tracking-widest text-slate-400">Chain</dt>
                    <dd class="text-white">{{ chainName }} <span class="text-xs text-slate-400">({{ chainId }})</span></dd>
                  </div>
                  <div class="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                    <dt class="text-[11px] uppercase tracking-widest text-slate-400">REST</dt>
                    <dd class="font-mono text-xs text-emerald-200">{{ restDisplay }}</dd>
                  </div>
                  <div class="rounded-xl border border-white/5 bg-black/30 px-3 py-2">
                    <dt class="text-[11px] uppercase tracking-widest text-slate-400">RPC</dt>
                    <dd class="font-mono text-xs text-cyan-200">{{ rpcDisplay }}</dd>
                  </div>
                </dl>
                <div v-if="address" class="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-3 space-y-2">
                  <div>
                    <p class="text-[11px] uppercase tracking-widest text-emerald-200">Connected Address</p>
                    <p class="font-mono text-xs text-white break-all">{{ address }}</p>
                  </div>
                  <div class="grid gap-2 text-xs text-slate-200">
                    <div class="flex items-center justify-between">
                      <span class="text-slate-400">Balances</span>
                      <span v-if="accountLoading" class="text-[10px] text-slate-500">Syncing…</span>
                    </div>
                    <div class="flex items-center justify-between" v-if="wbtcBalanceDisplay">
                      <span class="flex items-center gap-1">
                        <span>{{ wbtcMeta?.icon ?? "\uD83D\uDFE0" }}</span>
                        <span>{{ wbtcMeta?.symbol ?? "WBTC" }}</span>
                      </span>
                      <span class="font-mono">{{ wbtcBalanceDisplay }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="px-6 pb-6">
              <div class="grid gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 md:grid-cols-3">
                <div v-for="step in steps" :key="step.title" class="rounded-xl border border-white/5 bg-black/20 p-3 text-sm text-slate-300">
                  <p class="text-xs font-semibold uppercase tracking-widest text-white">{{ step.title }}</p>
                  <p class="text-[12px] text-slate-400">{{ step.detail }}</p>
                </div>
              </div>

              <div class="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="flex-1 min-w-[200px] rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 transition hover:from-cyan-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="connecting"
                  @click="handleConnect"
                >
                  {{ address ? 'Reconnect Wallet' : `Connect with ${detectedWalletName}` }}
                </button>
                <a
                  :href="installUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex min-w-[160px] items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-white/30"
                >
                  Install {{ detectedWalletName }}
                </a>
                <button type="button" class="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 hover:text-white" @click="closeModal">
                  Cancel
                </button>
              </div>
              <p class="mt-4 text-[11px] text-slate-500">
                RetroChain Explorer never stores your private keys. Connections happen locally inside Keplr or other supported wallets.
              </p>
            </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
