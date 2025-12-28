<script setup lang="ts">
import { RouterView } from "vue-router";
import RcHeader from "@/components/RcHeader.vue";
import RcMaintenanceBanner from "@/components/RcMaintenanceBanner.vue";
import { useNetwork } from "@/composables/useNetwork";
import { useChainInfo } from "@/composables/useChainInfo";
import { computed, onMounted, ref } from "vue";
import { Toaster } from "vue-sonner";

const { restBase, rpcBase } = useNetwork();
const { info, refresh } = useChainInfo();

type HolidayMode = "auto" | "off" | "christmas" | "halloween" | "thanksgiving" | "easter";
const holidayMode = ref<HolidayMode>("off");
type SnowLevel = "light" | "medium" | "blizzard";
const snowLevel = ref<SnowLevel>("medium");

const STORAGE_KEYS = {
  holidayMode: "retrochain.holidayMode",
  snowLevel: "retrochain.snowLevel"
} as const;

const safeRead = (key: string) => {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeWrite = (key: string, value: string) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const isOnline = computed(() => !!info.value.latestBlockHeight);
const displayRpc = computed(() => rpcBase.value || import.meta.env.VITE_RPC_URL || "/rpc");
const displayRest = computed(() => restBase.value || import.meta.env.VITE_REST_API_URL || "/api");

const detectHolidayForDate = (date: Date): HolidayMode => {
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate();

  // Christmas season: Dec 1-31
  if (m === 12) return "christmas";

  // Halloween: October
  if (m === 10) return "halloween";

  // Thanksgiving (US): 4th Thursday of November
  if (m === 11) {
    const firstDay = new Date(date.getFullYear(), 10, 1); // Nov 1
    const firstThursday = 1 + ((11 - firstDay.getDay()) % 7); // day of month of first Thursday
    const thanksgiving = firstThursday + 21; // 4th Thursday
    if (d >= thanksgiving - 3 && d <= thanksgiving + 3) return "thanksgiving";
  }

  // Easter (approx): first Sunday of April window
  if (m === 3 || m === 4) {
    const easterStart = new Date(date.getFullYear(), 3, 1); // April 1
    const day = easterStart.getDay();
    const firstSunday = day === 0 ? 1 : 8 - day;
    if (m === 4 && d >= firstSunday - 3 && d <= firstSunday + 7) return "easter";
  }

  return "off";
};

const activeHoliday = computed<HolidayMode>(() => {
  if (holidayMode.value === "auto") {
    return detectHolidayForDate(new Date());
  }
  return holidayMode.value;
});

const themeClass = computed(() => {
  switch (activeHoliday.value) {
    case "christmas":
      return "festive-bg";
    case "halloween":
      return "halloween-bg";
    case "thanksgiving":
      return "fall-bg";
    case "easter":
      return "easter-bg";
    default:
      return "";
  }
});

const holidayDisplay = computed(() => {
  switch (activeHoliday.value) {
    case "christmas":
      return { label: "Christmas Cheer", emoji: "🎄" };
    case "halloween":
      return { label: "Spooky Halloween", emoji: "🎃" };
    case "thanksgiving":
      return { label: "Harvest Thanks", emoji: "🦃" };
    case "easter":
      return { label: "Easter Bloom", emoji: "🐣" };
    default:
      return null;
  }
});

const setHolidayMode = (mode: HolidayMode) => {
  holidayMode.value = mode;
  safeWrite(STORAGE_KEYS.holidayMode, mode);
};

const setSnowLevel = (level: SnowLevel) => {
  snowLevel.value = level;
  safeWrite(STORAGE_KEYS.snowLevel, level);
};

onMounted(() => {
  const storedMode = safeRead(STORAGE_KEYS.holidayMode) as HolidayMode | null;
  if (storedMode && ["auto", "off", "christmas", "halloween", "thanksgiving", "easter"].includes(storedMode)) {
    holidayMode.value = storedMode;
  }
  const storedSnow = safeRead(STORAGE_KEYS.snowLevel) as SnowLevel | null;
  if (storedSnow && ["light", "medium", "blizzard"].includes(storedSnow)) {
    snowLevel.value = storedSnow;
  }
  refresh();
});
</script>

<template>
<div class="min-h-screen flex flex-col" :class="themeClass">
  <!-- Toaster -->
  <Toaster
    position="top-right"
    theme="dark"
    rich-colors
    close-button
    duration="5200"
    offset="12px"
    :icons="{
      success: () => '✅',
      info: () => 'ℹ️',
      warning: () => '⚠️',
      error: () => '⛔',
      loading: () => '🔌'
    }"
  />
  <div v-if="activeHoliday === 'christmas'" class="festive-snow" :class="`snow-${snowLevel}`" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'christmas'" class="festive-lights" aria-hidden="true">
    <span v-for="n in 32" :key="n" class="bulb" :style="{ '--i': n }"></span>
  </div>
  <div v-if="activeHoliday === 'christmas'" class="festive-ornaments" aria-hidden="true">
    <span v-for="n in 12" :key="`orn-${n}`" class="ornament" :style="{ '--i': n }"></span>
  </div>
  <div v-if="activeHoliday === 'christmas'" class="festive-sparkles" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'halloween'" class="spooky-bats" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'halloween'" class="pumpkin-glow" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'thanksgiving'" class="fall-leaves" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'thanksgiving'" class="thankful-glow" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'easter'" class="easter-eggs" aria-hidden="true"></div>
  <div v-if="activeHoliday === 'easter'" class="easter-confetti" aria-hidden="true"></div>
  <div v-if="holidayDisplay" class="holiday-banner">
    <span class="text-xl">{{ holidayDisplay.emoji }}</span>
    <span class="font-semibold">{{ holidayDisplay.label }}</span>
    <span class="text-sm text-slate-200/80">Seasonal magic is ON</span>
  </div>
  <RcMaintenanceBanner />
  <RcHeader
    :holiday-mode="holidayMode"
    :active-holiday="activeHoliday"
    :snow-level="snowLevel"
    @set-holiday-mode="setHolidayMode"
    @set-snow-level="setSnowLevel"
  />
  <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 relative z-10">
    <RouterView />
  </main>
    <footer class="border-t border-indigo-500/20 relative z-10 backdrop-blur-sm bg-[rgba(10,14,39,0.6)] footer-aurora overflow-hidden">
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="footer-cta card-like mb-8">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-indigo-200">Stay connected</div>
            <h3 class="text-lg font-semibold text-white mt-1">RetroChain community updates & tooling drops</h3>
            <p class="text-sm text-slate-300/90 mt-1">Join the builders, validators, and IBC explorers keeping RetroChain vibrant.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="https://discord.gg/h89FnjjnrD" target="_blank" class="btn btn-primary text-xs">💬 Join Discord</a>
            <a href="https://github.com/Shaund12/RetroChain/issues" target="_blank" class="btn text-xs">🐛 File Feedback</a>
            <a href="/changelog" class="btn text-xs">🗒️ View Changelog</a>
          </div>
        </div>
        <!-- Main Footer Content -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <!-- Brand Section -->
          <div class="col-span-1">
            <div class="flex items-center gap-3 mb-4">
              <div class="h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center shadow-lg">
                <img src="@/assets/RCIcon.svg" alt="RetroChain" class="w-full h-full object-cover" />
              </div>
              <div>
                <div class="font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                  <span v-if="activeHoliday !== 'off'">🎀</span>
                  <span>RetroChain</span>
                  <span v-if="activeHoliday !== 'off'">🎀</span>
                </div>
                <div class="text-[10px] text-slate-500 uppercase tracking-wider">
                  Arcade Explorer
                </div>
              </div>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              The most beautiful blockchain explorer for RetroChain. Built with Vue 3, TypeScript, and love for the Cosmos ecosystem.
            </p>
          </div>

          <!-- Quick Links -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Explorer</h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a href="/" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Dashboard
                </a>
              </li>
              <li>
                <a href="/blocks" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Blocks
                </a>
              </li>
              <li>
                <a href="/txs" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Transactions
                </a>
              </li>
              <li>
                <a href="/validators" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Validators
                </a>
              </li>
              <li>
                <a href="/governance" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Governance
                </a>
              </li>
            </ul>
          </div>

          <!-- Resources -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Resources</h3>
            <ul class="space-y-2 text-sm">
              <li>
                <a href="https://docs.cosmos.network" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Cosmos Docs
                </a>
              </li>
              <li>
                <a href="https://github.com/cosmos/cosmos-sdk" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Cosmos SDK
                </a>
              </li>
              <li>
                <a href="https://github.com/ignite/cli" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Ignite CLI
                </a>
              </li>
              <li>
                <a href="/api-test" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> API Test
                </a>
              </li>
              <li>
                <a href="/changelog" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Changelog
                </a>
              </li>
              <li>
                <a href="/legal" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span></span> Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>

          <!-- Community -->
          <div>
            <h3 class="text-sm font-semibold text-slate-300 mb-4 uppercase tracking-wider">Community</h3>
            <ul class="space-y-2 text-sm mb-4">
              <li>
                <a href="https://discord.gg/h89FnjjnrD" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>💬</span> Discord
                </a>
              </li>
              <li>
                <a href="https://github.com/Shaund12/RetroChain" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>💻</span> GitHub
                </a>
              </li>
              <li>
                <a href="https://x.com/RetroChainInfo" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>🐦</span> Twitter / X
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/retrochaininfo/" target="_blank" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>📸</span> Instagram
                </a>
              </li>
              <li>
                <a href="mailto:retrochaininfo@gmail.com" class="text-slate-400 hover:text-indigo-400 transition-colors flex items-center gap-2">
                  <span>✉️</span> Contact
                </a>
              </li>
            </ul>
            
            <!-- Network Status -->
            <div class="p-3 rounded-lg bg-gradient-to-br border" :class="isOnline ? 'from-emerald-500/10 to-cyan-500/10 border-emerald-500/20' : 'from-rose-500/10 to-orange-500/10 border-rose-500/20'">
              <div class="flex items-center gap-2 text-xs">
                <span class="w-2 h-2 rounded-full" :class="isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
                <span class="font-medium" :class="isOnline ? 'text-emerald-300' : 'text-rose-300'">
                  {{ isOnline ? 'Network Online' : 'Network Offline' }}
                </span>
              </div>
              <div class="text-[10px] text-slate-400 mt-1 space-y-0.5">
                <div>REST: {{ displayRest }}</div>
                <div>RPC: {{ displayRpc }}</div>
                <div v-if="isOnline" class="text-emerald-400">Block #{{ info.latestBlockHeight }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom Bar -->
        <div class="pt-6 border-t border-indigo-500/20">
          <div class="flex flex-col md:flex-row items-center justify-between gap-4">
            <div class="text-xs text-slate-500 text-center md:text-left">
              <div class="mb-1">
                Built with ❤️ for the Cosmos ecosystem
              </div>
              <div>
                (c) 2024 RetroChain Explorer - 
                <a href="https://github.com/cosmos/cosmos-sdk/blob/main/LICENSE" target="_blank" class="hover:text-indigo-400 transition-colors">
                  Apache 2.0 License
                </a>
                · <a href="mailto:retrochaininfo@gmail.com" class="hover:text-indigo-400 transition-colors">retrochaininfo@gmail.com</a>
              </div>
            </div>
            
            <!-- Tech Stack Badges -->
            <div class="flex items-center gap-2 flex-wrap justify-center">
              <span class="badge text-[10px]">Vue 3</span>
              <span class="badge text-[10px]">TypeScript</span>
              <span class="badge text-[10px]">Vite</span>
              <span class="badge text-[10px]">Cosmos SDK</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.festive-bg {
  background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.08), transparent 35%),
              radial-gradient(circle at 80% 10%, rgba(236, 72, 153, 0.08), transparent 35%),
              radial-gradient(circle at 50% 80%, rgba(16, 185, 129, 0.08), transparent 40%),
              #060818;
}

.festive-snow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(2px 2px at 20% 30%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(2px 2px at 40% 70%, rgba(255, 255, 255, 0.7), transparent),
    radial-gradient(3px 3px at 80% 40%, rgba(255, 255, 255, 0.6), transparent),
    radial-gradient(2px 2px at 60% 20%, rgba(255, 255, 255, 0.6), transparent);
  animation: snow 10s linear infinite;
  z-index: 5;
}

@keyframes snow {
  0% { transform: translateY(-10px); }
  100% { transform: translateY(20px); }
}

.snow-light { opacity: 0.6; animation-duration: 14s; }
.snow-medium { opacity: 0.8; animation-duration: 10s; }
.snow-blizzard { opacity: 1; animation-duration: 6s; filter: drop-shadow(0 0 6px rgba(255,255,255,0.3)); }

.festive-lights {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(32, 1fr);
  gap: 8px;
  padding: 6px 12px;
  z-index: 6;
  pointer-events: none;
}

.bulb {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, #f87171, #fcd34d, #34d399, #60a5fa);
  animation: twinkle 1.6s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.05s);
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
}

@keyframes twinkle {
  0%, 100% { opacity: 0.6; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-1px); }
}

.festive-ornaments {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.festive-sparkles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(2px 2px at 10% 20%, rgba(255, 255, 255, 0.8), transparent),
    radial-gradient(3px 3px at 30% 50%, rgba(236, 72, 153, 0.6), transparent),
    radial-gradient(2px 2px at 70% 30%, rgba(129, 140, 248, 0.7), transparent),
    radial-gradient(3px 3px at 85% 60%, rgba(16, 185, 129, 0.6), transparent);
  animation: sparkles 6s ease-in-out infinite;
  z-index: 4;
}

@keyframes sparkles {
  0%, 100% { opacity: 0.5; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-6px); }
}

.ornament {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.7), transparent 45%),
              radial-gradient(circle at 70% 70%, rgba(0,0,0,0.15), transparent 55%),
              var(--color, #fbbf24);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.25);
  animation: float 6s ease-in-out infinite;
  top: calc((var(--i) * 7%) + 4%);
  left: calc((var(--i) * 8%) % 90%);
  --color: hsl(calc(var(--i) * 30), 80%, 60%);
}

@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
  50% { transform: translateY(-10px) scale(1.08); opacity: 1; }
}

.halloween-bg {
  background: radial-gradient(circle at 20% 20%, rgba(249, 115, 22, 0.12), transparent 35%),
              radial-gradient(circle at 80% 10%, rgba(217, 70, 239, 0.12), transparent 35%),
              #0b0a13;
}

.spooky-bats {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(2px 2px at 20% 30%, rgba(255, 255, 255, 0.15), transparent),
    radial-gradient(2px 2px at 60% 10%, rgba(255, 255, 255, 0.12), transparent);
  mask-image: radial-gradient(circle at 50% 50%, black 60%, transparent 90%);
  animation: bats 8s linear infinite;
  z-index: 4;
}

@keyframes bats {
  0% { background-position: 0 0, 0 0; }
  100% { background-position: 40px 60px, -40px 30px; }
}

.pumpkin-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 40% 30%, rgba(249, 115, 22, 0.25), transparent 45%),
              radial-gradient(circle at 70% 60%, rgba(234, 179, 8, 0.18), transparent 55%);
  filter: blur(8px);
  z-index: 3;
}

.fall-bg {
  background: radial-gradient(circle at 30% 20%, rgba(245, 158, 11, 0.14), transparent 40%),
              radial-gradient(circle at 70% 30%, rgba(249, 115, 22, 0.12), transparent 40%),
              #0b0a13;
}

.fall-leaves {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(3px 3px at 20% 10%, rgba(251, 146, 60, 0.6), transparent),
    radial-gradient(3px 3px at 60% 30%, rgba(234, 179, 8, 0.6), transparent),
    radial-gradient(4px 4px at 80% 15%, rgba(244, 63, 94, 0.5), transparent);
  animation: leaves 12s linear infinite;
  z-index: 4;
}

@keyframes leaves {
  0% { transform: translateY(-10px); }
  100% { transform: translateY(30px); }
}

.thankful-glow {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(circle at 25% 25%, rgba(251, 146, 60, 0.18), transparent 40%),
              radial-gradient(circle at 75% 45%, rgba(244, 63, 94, 0.14), transparent 45%);
  filter: blur(8px);
  z-index: 3;
}

.easter-bg {
  background: radial-gradient(circle at 20% 30%, rgba(94, 234, 212, 0.12), transparent 35%),
              radial-gradient(circle at 70% 20%, rgba(244, 114, 182, 0.12), transparent 35%),
              #0b0a13;
}

.easter-eggs {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(8px 10px at 15% 20%, rgba(94, 234, 212, 0.5), transparent),
    radial-gradient(8px 10px at 45% 25%, rgba(244, 114, 182, 0.5), transparent),
    radial-gradient(8px 10px at 75% 30%, rgba(129, 140, 248, 0.5), transparent);
  animation: eggs 9s ease-in-out infinite;
  z-index: 4;
}

@keyframes eggs {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.easter-confetti {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    radial-gradient(2px 2px at 10% 20%, rgba(244, 114, 182, 0.8), transparent),
    radial-gradient(2px 2px at 40% 40%, rgba(129, 140, 248, 0.8), transparent),
    radial-gradient(2px 2px at 70% 25%, rgba(52, 211, 153, 0.8), transparent),
    radial-gradient(3px 3px at 85% 55%, rgba(236, 72, 153, 0.7), transparent);
  animation: confetti 7s ease-in-out infinite;
  z-index: 4;
}

@keyframes confetti {
  0%, 100% { opacity: 0.5; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(-8px); }
}

.holiday-banner {
  position: sticky;
  top: 0;
  z-index: 40;
  margin: 0.5rem auto;
  max-width: 72rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  backdrop-filter: blur(8px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.25);
}

.festive-bg .holiday-banner { border-color: rgba(16, 185, 129, 0.4); box-shadow: 0 10px 30px rgba(16,185,129,0.25); }
.halloween-bg .holiday-banner { border-color: rgba(249, 115, 22, 0.4); box-shadow: 0 10px 30px rgba(249,115,22,0.25); }
.fall-bg .holiday-banner { border-color: rgba(244, 114, 182, 0.35); box-shadow: 0 10px 30px rgba(244,114,182,0.2); }
.easter-bg .holiday-banner { border-color: rgba(94, 234, 212, 0.35); box-shadow: 0 10px 30px rgba(94,234,212,0.2); }

.footer-aurora::before,
.footer-aurora::after {
  content: "";
  position: absolute;
  inset: -40% -10%;
  background: radial-gradient(circle at 20% 20%, rgba(99, 102, 241, 0.25), transparent 40%),
              radial-gradient(circle at 80% 0%, rgba(236, 72, 153, 0.2), transparent 35%),
              radial-gradient(circle at 50% 100%, rgba(16, 185, 129, 0.2), transparent 50%);
  filter: blur(60px);
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
}

.footer-aurora::after {
  inset: -30% -20%;
  background: radial-gradient(circle at 70% 30%, rgba(56, 189, 248, 0.25), transparent 45%),
              radial-gradient(circle at 30% 80%, rgba(244, 114, 182, 0.2), transparent 40%);
}

.card-like {
  position: relative;
  z-index: 1;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 12, 30, 0.7);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}
</style>
