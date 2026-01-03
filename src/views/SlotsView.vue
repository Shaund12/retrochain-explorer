<script setup lang="ts">
import { computed, ref } from "vue";
import dayjs from "dayjs";

const retroSlotsUrl = "https://retrochain.ddns.net/slots/slots/";

// Placeholder demo data for slots stats/leaderboards. Wire to real API when available.
const stats = ref({
  totalSpins: 12450,
  totalPayout: 482_300,
  rtp: 94.8,
  activeMachines: 4,
  jackpotPool: 12_345
});

const recentWins = ref([
  { player: "retro1abcd...123", amount: 320, machine: "RetroSlots", time: dayjs().subtract(5, "minute").fromNow() },
  { player: "retro1pqrs...789", amount: 145, machine: "Cosmic 7s", time: dayjs().subtract(21, "minute").fromNow() },
  { player: "retro1wxyz...456", amount: 88, machine: "Neon Reels", time: dayjs().subtract(1, "hour").fromNow() }
]);

const leaderboard = ref([
  { rank: 1, player: "retro1alpha...xyz", spins: 1220, winnings: 7800 },
  { rank: 2, player: "retro1beta...uvw", spins: 1084, winnings: 6400 },
  { rank: 3, player: "retro1gamma...rst", spins: 940, winnings: 5120 },
  { rank: 4, player: "retro1delta...opq", spins: 820, winnings: 4010 },
  { rank: 5, player: "retro1omega...lmn", spins: 710, winnings: 2985 }
]);

const machines = ref([
  {
    id: "retroslots",
    name: "RetroSlots (Official)",
    theme: "Arcade Classic",
    rtp: 95.2,
    volatility: "Medium",
    status: "Live",
    link: retroSlotsUrl
  },
  {
    id: "cosmic7s",
    name: "Cosmic 7s",
    theme: "Space",
    rtp: 94.1,
    volatility: "High",
    status: "Live",
    link: null
  },
  {
    id: "neonreels",
    name: "Neon Reels",
    theme: "Cyber",
    rtp: 93.8,
    volatility: "Low",
    status: "Coming Soon",
    link: null
  }
]);

const totalMachinesLive = computed(() => machines.value.filter((m) => m.status === "Live").length);
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
        <p class="text-xs uppercase tracking-wider text-emerald-200">Total Spins</p>
        <p class="text-3xl font-bold text-white mt-1">{{ stats.totalSpins.toLocaleString() }}</p>
        <p class="text-[11px] text-emerald-200/70">Across all slots machines</p>
      </div>
      <div class="card border border-amber-500/40 bg-amber-500/5">
        <p class="text-xs uppercase tracking-wider text-amber-200">Total Payout</p>
        <p class="text-3xl font-bold text-white mt-1">{{ stats.totalPayout.toLocaleString() }} RETRO</p>
        <p class="text-[11px] text-amber-200/70">Lifetime payouts</p>
      </div>
      <div class="card border border-cyan-500/40 bg-cyan-500/5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-wider text-cyan-200">RTP</p>
            <p class="text-3xl font-bold text-white mt-1">{{ stats.rtp.toFixed(1) }}%</p>
            <p class="text-[11px] text-cyan-200/70">Return-to-player (global)</p>
          </div>
          <div class="text-right text-xs text-slate-300">
            <p>Live Machines: <span class="font-semibold text-white">{{ totalMachinesLive }}</span></p>
            <p>Jackpot Pool: <span class="font-semibold text-amber-200">{{ stats.jackpotPool.toLocaleString() }} RETRO</span></p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-3 lg:grid-cols-3">
      <div class="card lg:col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white flex items-center gap-2"><span>??</span><span>Leaderboard</span></h2>
          <span class="text-[11px] text-slate-400">Top players by winnings</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Rank</th>
                <th>Player</th>
                <th>Spins</th>
                <th>Winnings (RETRO)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in leaderboard" :key="entry.rank" class="text-sm">
                <td class="font-semibold text-emerald-200">#{{ entry.rank }}</td>
                <td class="font-mono text-xs text-slate-300">{{ entry.player }}</td>
                <td class="text-slate-100">{{ entry.spins.toLocaleString() }}</td>
                <td class="text-emerald-200 font-semibold">{{ entry.winnings.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white flex items-center gap-2"><span>??</span><span>Recent Wins</span></h2>
          <span class="text-[11px] text-slate-400">Live sample</span>
        </div>
        <div class="space-y-2 text-sm">
          <div v-for="win in recentWins" :key="win.player + win.time" class="p-3 rounded-lg bg-white/5 border border-white/10">
            <div class="flex items-center justify-between text-xs text-slate-400">
              <span>{{ win.time }}</span>
              <span class="text-emerald-200">{{ win.machine }}</span>
            </div>
            <div class="font-mono text-slate-200 truncate">{{ win.player }}</div>
            <div class="text-sm font-semibold text-emerald-300">+{{ win.amount.toLocaleString() }} RETRO</div>
          </div>
        </div>
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
            <span>RTP: <span class="font-semibold text-white">{{ machine.rtp.toFixed(1) }}%</span></span>
            <span>Volatility: <span class="font-semibold text-white">{{ machine.volatility }}</span></span>
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
            <span v-else class="text-[11px] text-slate-500">Soon</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
