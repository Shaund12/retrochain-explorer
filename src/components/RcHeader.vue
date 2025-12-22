<template>
  <header class="border-b border-white/5 backdrop-blur-xl bg-[rgba(10,14,39,0.95)] sticky top-0 z-50 shadow-lg shadow-black/20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Logo -->
      <button
        class="flex items-center gap-3 group transition-all"
        @click="router.push({ name: 'home' })"
      >
        <img
          src="/RCIcon.svg"
          alt="RetroChain"
          class="h-10 w-10 rounded-lg shadow-lg shadow-indigo-500/40 group-hover:shadow-indigo-500/70 group-hover:scale-105 transition-all object-contain"
        />
        <div class="flex items-center gap-2">
          <div class="font-bold text-base bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            RetroChain
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-400/60 text-emerald-300 bg-emerald-500/10">
            MAINNET
          </span>
        </div>
      </button>

      <!-- Navigation -->
      <nav class="hidden lg:flex items-center gap-1">
        <template v-for="item in navItems" :key="item.label">
          <a
            v-if="!isGroup(item)"
            @click.prevent="router.push(item.to)"
            class="px-4 h-16 flex items-center text-sm font-medium transition-colors cursor-pointer relative"
            :class="isLinkActive(item.to) ? 'text-white' : 'text-slate-400 hover:text-white'"
          >
            {{ item.label }}
            <div
              v-if="isLinkActive(item.to)"
              class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
            ></div>
          </a>

          <div
            v-else
            class="relative"
            @mouseenter="openDropdownMenu(item.label)"
            @mouseleave="scheduleDropdownClose"
          >
            <button
              type="button"
              class="px-4 h-16 flex items-center gap-1 text-sm font-medium transition-colors cursor-pointer"
              :class="groupActive(item) ? 'text-white' : 'text-slate-400 hover:text-white'"
            >
              <span>{{ item.label }}</span>
              <svg
                class="w-3 h-3 transition-transform"
                :class="openDropdown === item.label || groupActive(item) ? 'rotate-180 text-white' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-show="openDropdown === item.label"
              class="absolute left-0 top-full mt-2 w-56 rounded-2xl border border-white/10 bg-[rgba(10,14,39,0.98)] shadow-2xl shadow-black/40 py-2"
              @mouseenter="clearDropdownTimer()"
              @mouseleave="scheduleDropdownClose"
            >
              <button
                v-for="link in item.items"
                :key="link.label"
                type="button"
                @click.prevent="router.push(link.to); openDropdown = null;"
                class="w-full px-4 py-2 text-left text-sm flex items-center justify-between transition-colors"
                :class="isLinkActive(link.to) ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'"
              >
                <span>{{ link.label }}</span>
                <span v-if="isLinkActive(link.to)" class="text-[10px] text-emerald-300">Active</span>
              </button>
            </div>
          </div>
        </template>
      </nav>

      <!-- Wallet Connection -->
      <div class="flex items-center gap-3">
        <div class="hidden lg:block relative">
          <button
            class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] border transition-all"
            :class="holidayButtonClass"
            @click="showHolidayMenu = !showHolidayMenu"
          >
            <span>{{ holidayIcon }}</span>
            <span>{{ holidayLabel }}</span>
          </button>
          <div
            v-if="showHolidayMenu"
            class="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[rgba(10,14,39,0.98)] shadow-2xl shadow-black/40 py-2 z-50"
          >
            <button
              v-for="option in holidayOptions"
              :key="option.value"
              class="w-full px-4 py-2 text-left text-sm transition-colors"
              :class="holidayMode === option.value ? 'text-white bg-white/5' : 'text-slate-300 hover:text-white hover:bg-white/5'"
              @click="$emit('set-holiday-mode', option.value); showHolidayMenu = false"
            >
              <span class="mr-2">{{ option.icon }}</span>{{ option.label }}
            </button>
            <div v-if="activeHoliday === 'christmas'" class="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500">Snow Level</div>
            <div v-if="activeHoliday === 'christmas'" class="px-3 pb-2 flex gap-2">
              <button
                v-for="level in ['light','medium','blizzard']"
                :key="level"
                class="flex-1 px-2 py-1 rounded-lg border text-[11px]"
                :class="snowLevel === level ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-slate-300 hover:border-emerald-300/50 hover:text-white'"
                @click="$emit('set-snow-level', level); showHolidayMenu = false"
              >
                {{ level.charAt(0).toUpperCase() + level.slice(1) }}
              </button>
            </div>
          </div>
        </div>
        <div class="hidden lg:block w-[260px]">
          <RcAddKeplrButton class="w-full" />
        </div>

        <button
          v-if="address"
          class="flex items-center gap-3 px-3 sm:px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-white/10 hover:border-emerald-300/40 hover:from-emerald-500/20 hover:to-cyan-500/20 text-white transition-all shadow-lg shadow-emerald-500/10"
          @click="disconnect"
        >
          <div class="hidden sm:flex flex-col text-left">
            <span class="text-[10px] uppercase tracking-[0.25em] text-emerald-200/80">RETRO Balance</span>
            <span class="text-sm font-semibold text-white">
              <span v-if="accountLoading">Syncing…</span>
              <span v-else>{{ walletBalance }}</span>
            </span>
            <div v-if="atomWalletBalance" class="text-[11px] text-cyan-200 flex items-center gap-1 mt-0.5">
              <span>{{ atomMeta?.icon ?? "⚛️" }}</span>
              <span>{{ atomWalletBalance }}</span>
            </div>
            <div v-if="wbtcWalletBalance" class="text-[11px] text-amber-200 flex items-center gap-1 mt-0.5">
              <span>{{ wbtcMeta?.icon ?? "🟠" }}</span>
              <span>{{ wbtcWalletBalance }}</span>
            </div>
          </div>
          <div class="sm:hidden text-[11px] font-semibold text-emerald-200">
            <span v-if="accountLoading">Syncing…</span>
            <span v-else>{{ walletBalance }}</span>
            <div v-if="atomWalletBalance" class="text-[10px] text-cyan-200 flex items-center gap-1">
              <span>{{ atomMeta?.icon ?? "⚛️" }}</span>
              <span>{{ atomWalletBalance }}</span>
            </div>
            <div v-if="wbtcWalletBalance" class="text-[10px] text-amber-200 flex items-center gap-1">
              <span>{{ wbtcMeta?.icon ?? "🟠" }}</span>
              <span>{{ wbtcWalletBalance }}</span>
            </div>
          </div>
          <div class="hidden sm:block h-8 w-px bg-white/10"></div>
          <div class="text-left">
            <p class="font-mono text-xs">{{ shortAddress }}</p>
            <p class="text-[10px] text-emerald-300 flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Disconnect
            </p>
          </div>
        </button>

        <!-- Mobile menu button -->
        <button
          class="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!mobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div
      v-if="mobileMenuOpen"
      class="lg:hidden border-t border-white/5 bg-[rgba(10,14,39,0.98)]"
    >
      <nav class="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">
        <template v-for="item in navItems" :key="item.label">
          <button
            v-if="!isGroup(item)"
            type="button"
            @click.prevent="router.push(item.to); closeMobileMenu();"
            class="px-4 py-3 text-sm font-medium transition-all text-left rounded-lg"
            :class="isLinkActive(item.to) ? 'text-white bg-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'"
          >
            {{ item.label }}
          </button>

          <div v-else class="border border-white/5 rounded-xl overflow-hidden">
            <button
              type="button"
              class="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-left text-slate-100"
              @click="toggleMobileGroup(item.label)"
            >
              <span>{{ item.label }}</span>
              <svg
                class="w-4 h-4 transition-transform"
                :class="expandedMobileGroups[item.label] ? 'rotate-180' : ''"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div v-show="expandedMobileGroups[item.label]" class="bg-white/5 border-t border-white/5 flex flex-col">
              <button
                v-for="link in item.items"
                :key="link.label"
                type="button"
                @click.prevent="router.push(link.to); closeMobileMenu();"
                class="px-6 py-2 text-sm text-left transition-colors"
                :class="isLinkActive(link.to) ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/10'"
              >
                {{ link.label }}
              </button>
            </div>
          </div>
        </template>
        <div class="mt-3 px-4">
          <button
            class="w-full mb-2 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-[11px] border transition-all"
            :class="holidayButtonClass"
            @click="showHolidayMenuMobile = !showHolidayMenuMobile"
          >
            <span>{{ holidayIcon }}</span>
            <span>{{ holidayLabel }}</span>
          </button>
          <div v-if="showHolidayMenuMobile" class="border border-white/10 rounded-xl overflow-hidden bg-white/5">
            <button
              v-for="option in holidayOptions"
              :key="option.value"
              class="w-full px-4 py-2 text-left text-sm"
              :class="holidayMode === option.value ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/5'"
              @click="$emit('set-holiday-mode', option.value); showHolidayMenuMobile = false"
            >
              <span class="mr-2">{{ option.icon }}</span>{{ option.label }}
            </button>
            <div v-if="activeHoliday === 'christmas'" class="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wider text-slate-500">Snow Level</div>
            <div v-if="activeHoliday === 'christmas'" class="px-3 pb-3 grid grid-cols-3 gap-2">
              <button
                v-for="level in ['light','medium','blizzard']"
                :key="level"
                class="px-2 py-1 rounded-lg border text-[11px]"
                :class="snowLevel === level ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-slate-300 hover:border-emerald-300/50 hover:text-white'"
                @click="$emit('set-snow-level', level); showHolidayMenuMobile = false"
              >
                {{ level.charAt(0).toUpperCase() + level.slice(1) }}
              </button>
            </div>
          </div>
          <RcAddKeplrButton class="w-full inline-flex justify-center" />
        </div>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, defineProps, defineEmits } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useAccount } from "@/composables/useAccount";
import { useNetwork } from "@/composables/useNetwork";
import { formatAmount } from "@/utils/format";
import RcAddKeplrButton from "@/components/RcAddKeplrButton.vue";
import { getTokenMeta } from "@/constants/tokens";

const props = defineProps<{ holidayMode?: string; activeHoliday?: string; snowLevel?: string }>();
const emit = defineEmits(["set-holiday-mode", "set-snow-level"]);

const holidayMode = computed(() => props.holidayMode || "auto");
const activeHoliday = computed(() => props.activeHoliday || "off");
const snowLevel = computed(() => props.snowLevel || "medium");

const showHolidayMenu = ref(false);
const showHolidayMenuMobile = ref(false);

const holidayOptions = [
  { value: "auto", label: "Auto", icon: "⏱️" },
  { value: "off", label: "Off", icon: "🚫" },
  { value: "christmas", label: "Christmas", icon: "🎄" },
  { value: "halloween", label: "Halloween", icon: "🎃" },
  { value: "thanksgiving", label: "Thanksgiving", icon: "🦃" },
  { value: "easter", label: "Easter", icon: "🥚" }
];

const holidayIcon = computed(() => {
  switch (activeHoliday.value) {
    case "christmas":
      return "🎄";
    case "halloween":
      return "🎃";
    case "thanksgiving":
      return "🦃";
    case "easter":
      return "🥚";
    default:
      return "⏱️";
  }
});

const holidayLabel = computed(() => {
  if (holidayMode.value === "auto") return "Holiday Auto";
  if (holidayMode.value === "off") return "Holiday Off";
  return holidayMode.value.charAt(0).toUpperCase() + holidayMode.value.slice(1);
});

const holidayButtonClass = computed(() =>
  activeHoliday.value && activeHoliday.value !== "off"
    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
    : "border-indigo-400/60 text-slate-200 hover:text-white hover:border-indigo-300/80"
);

const route = useRoute();
const router = useRouter();
const { address, disconnect } = useKeplr();
const mobileMenuOpen = ref(false);
const { balances, loading: accountLoading, load } = useAccount();
const { current: network } = useNetwork();

watch(
  address,
  (addr) => {
    if (addr) {
      load(addr);
    } else {
      balances.value = [];
    }
  },
  { immediate: true }
);

watch(
  () => route.name,
  () => {
    openDropdown.value = null;
  }
);

const walletDenom = computed(() => (network.value === "mainnet" ? "uretro" : "udretro"));

const ATOM_IBC_DENOMS = [
  "ibc/27394fb092d2eccd56123c74f36e4c1f926001ceada9ca97ea622b25f41e5eb2",
  "ibc/atom"
];
const atomDenomSet = new Set(ATOM_IBC_DENOMS.map((d) => d.toLowerCase()));

const WBTC_IBC_DENOMS = [
  "ibc/CF57A83CED6CEC7D706631B5DC53ABC21B7EDA7DF7490732B4361E6D5DD19C73"
];
const wbtcDenomSet = new Set(WBTC_IBC_DENOMS.map((d) => d.toLowerCase()));

const walletBalance = computed(() => {
  const denom = walletDenom.value;
  const entry = balances.value.find((b) => b.denom === denom);
  if (!entry) return "0.00 RETRO";
  return formatAmount(entry.amount, denom, { minDecimals: 2, maxDecimals: 2, showZerosForIntegers: false });
});

const atomBalanceEntry = computed(() => balances.value.find((b) => atomDenomSet.has(b.denom.toLowerCase())));

const atomWalletBalance = computed(() => {
  if (!atomBalanceEntry.value) return null;
  return formatAmount(atomBalanceEntry.value.amount, atomBalanceEntry.value.denom, {
    minDecimals: 2,
    maxDecimals: 4,
    showZerosForIntegers: false
  });
});

const atomMeta = computed(() => {
  if (!atomBalanceEntry.value) return null;
  return getTokenMeta(atomBalanceEntry.value.denom);
});

const wbtcBalanceEntry = computed(() => balances.value.find((b) => wbtcDenomSet.has(b.denom.toLowerCase())));

const wbtcWalletBalance = computed(() => {
  if (!wbtcBalanceEntry.value) return null;
  return formatAmount(wbtcBalanceEntry.value.amount, wbtcBalanceEntry.value.denom, {
    minDecimals: 2,
    maxDecimals: 8,
    showZerosForIntegers: false
  });
});

const wbtcMeta = computed(() => {
  if (!wbtcBalanceEntry.value) return null;
  return getTokenMeta(wbtcBalanceEntry.value.denom);
});

interface NavLink {
  label: string;
  to: { name: string; params?: Record<string, any> };
}

interface NavGroup {
  label: string;
  items: NavLink[];
}

type NavItem = NavLink | NavGroup;

const navItems: NavItem[] = [
  { label: "Overview", to: { name: "home" } },
  {
    label: "Network",
    items: [
      { label: "Blocks", to: { name: "blocks" } },
      { label: "Transactions", to: { name: "txs" } },
      { label: "Accounts", to: { name: "accounts" } },
      { label: "Ecosystem Wallets", to: { name: "ecosystem-accounts" } },
      { label: "Validators", to: { name: "validators" } },
      { label: "Contracts", to: { name: "contracts" } }
    ]
  },
  {
    label: "Economy",
    items: [
      { label: "Tokens", to: { name: "tokens" } },
      { label: "Tokenomics", to: { name: "tokenomics" } },
      { label: "Docs", to: { name: "docs" } },
      { label: "DEX", to: { name: "dex" } },
      { label: "Buy", to: { name: "buy" } }
    ]
  },
  {
    label: "Participation",
    items: [
      { label: "Staking", to: { name: "staking" } },
      { label: "Stake WBTC", to: { name: "btc-stake" } },
      { label: "Governance", to: { name: "governance" } },
      { label: "Account", to: { name: "account" } }
    ]
  }
];

const currentRouteName = computed(() => route.name as string | undefined);

const isLinkActive = (to: NavLink["to"]) => currentRouteName.value === to.name;

const isGroup = (item: NavItem): item is NavGroup => (item as NavGroup).items !== undefined;

const groupActive = (group: NavGroup) => group.items.some((link) => isLinkActive(link.to));

const openDropdown = ref<string | null>(null);
const dropdownCloseTimer = ref<number | null>(null);
const expandedMobileGroups = ref<Record<string, boolean>>({});

const toggleMobileGroup = (label: string) => {
  expandedMobileGroups.value = {
    ...expandedMobileGroups.value,
    [label]: !expandedMobileGroups.value[label]
  };
};

const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
  expandedMobileGroups.value = {};
};

const clearDropdownTimer = () => {
  if (dropdownCloseTimer.value !== null) {
    window.clearTimeout(dropdownCloseTimer.value);
    dropdownCloseTimer.value = null;
  }
};

const openDropdownMenu = (label: string) => {
  clearDropdownTimer();
  openDropdown.value = label;
};

const scheduleDropdownClose = () => {
  clearDropdownTimer();
  dropdownCloseTimer.value = window.setTimeout(() => {
    openDropdown.value = null;
  }, 150);
};

onBeforeUnmount(() => {
  clearDropdownTimer();
});

const shortAddress = computed(() => {
  if (!address.value) return "";
  return `${address.value.slice(0, 8)}...${address.value.slice(-4)}`;
});
</script>
