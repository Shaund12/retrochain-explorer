<script setup lang="ts">
import { ref } from "vue";

const retroSlotsUrl = "https://retrochain.ddns.net/slots/slots/";

// Live data should come from the on-chain slots/randomness module.
// Until wired, show only the real RetroSlots entry and empty states.
const stats = ref<{ totalSpins?: number; totalPayout?: number; rtp?: number; jackpotPool?: number } | null>(null);
const recentWins = ref<any[]>([]);
const leaderboard = ref<any[]>([]);
const machines = ref([
  {
    id: "retroslots",
    name: "RetroSlots (Official)",
    theme: "Arcade Classic",
    status: "Live",
    link: retroSlotsUrl
  }
]);
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-purple-600/20 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.35em] text-emerald-200">Slots & Randomness</p>
            <h1 class="text-3xl font-bold text-white mt-1 flex items-center gap-3">
              <span>RetroChain Slots Dash</span>
              <span class="text-2xl">??</span>
            </h1>
            <p class="text-sm text-slate-300 mt-2 max-w-3xl">
              Live view of the slots and randomness module. Track spins, payouts, RTP, and leaderboard rankings across all slots machines.
            </p>
            <div class="flex flex-wrap gap-2 mt-3 text-[11px]">
              <span class="badge border-emerald-500/40 text-emerald-200 bg-emerald-500/10">?? Chain randomness</span>
              <span class="badge border-purple-500/40 text-purple-200 bg-purple-500/10">?? RetroSlots ready</span>
              <span class="badge border-cyan-500/40 text-cyan-200 bg-cyan-500/10">?? Leaderboards</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <a
              :href="retroSlotsUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="btn text-sm flex items-center gap-2 border-emerald-400/60 bg-emerald-500/10 text-emerald-100"
            >
              <span>Play RetroSlots</span>
              <span class="text-lg">??</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
      <div class="card border border-emerald-500/40 bg-emerald-500/5">
        <p class="text-xs uppercase tracking-wider text-emerald-200">On-chain feed</p>
        <p class="text-3xl font-bold text-white mt-1">Pending</p>
        <p class="text-[11px] text-emerald-200/70">Slots module metrics will appear once wired</p>
      </div>
      <div class="card border border-amber-500/40 bg-amber-500/5">
        <p class="text-xs uppercase tracking-wider text-amber-200">Payouts</p>
        <p class="text-3xl font-bold text-white mt-1">—</p>
        <p class="text-[11px] text-amber-200/70">Pulls directly from chain data</p>
      </div>
      <div class="card border border-cyan-500/40 bg-cyan-500/5">
        <p class="text-xs uppercase tracking-wider text-cyan-200">RTP / Randomness</p>
        <p class="text-3xl font-bold text-white mt-1">—</p>
        <p class="text-[11px] text-cyan-200/70">Displayed when randomness feed is live</p>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white flex items-center gap-2"><span>??</span><span>Leaderboard</span></h2>
          <span class="text-[11px] text-slate-400">Awaiting on-chain feed</span>
        </div>
        <div class="text-sm text-slate-400">Leaderboard will populate from the slots module once connected.</div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white flex items-center gap-2"><span>??</span><span>Recent Wins</span></h2>
          <span class="text-[11px] text-slate-400">Awaiting live feed</span>
        </div>
        <div class="text-sm text-slate-400">Recent wins will appear here once the randomness/slots module feed is wired.</div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-white flex items-center gap-2"><span>??</span><span>Slots Machines</span></h2>
        <span class="text-[11px] text-slate-400">Randomness-backed machines</span>
      </div>
      <div class="grid gap-3 md:grid-cols-3">
        <div
          v-for="machine in machines"
          :key="machine.id"
          class="p-4 rounded-2xl border border-white/10 bg-white/5 flex flex-col gap-2"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold text-white">{{ machine.name }}</p>
              <p class="text-[11px] text-slate-400">{{ machine.theme }}</p>
            </div>
            <span
              class="badge text-[11px]"
              :class="machine.status === 'Live' ? 'border-emerald-400/60 text-emerald-200' : 'border-amber-400/60 text-amber-200'"
            >
              {{ machine.status }}
            </span>
          </div>
          <div class="text-xs text-slate-300 flex items-center justify-between">
            <span>Live data will display once connected</span>
          </div>
          <div class="flex items-center justify-between mt-2">
            <span class="text-[11px] text-slate-400">Chain-secured randomness</span>
            <a
              v-if="machine.link"
              :href="machine.link"
              target="_blank"
              rel="noopener noreferrer"
              class="btn text-xs"
            >Play</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
