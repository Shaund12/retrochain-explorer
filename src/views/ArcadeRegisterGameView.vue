<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useToast } from "@/composables/useToast";
import { useNetwork } from "@/composables/useNetwork";
import { useApi } from "@/composables/useApi";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";

const router = useRouter();
const toast = useToast();
const api = useApi();
const { address, connect, signAndBroadcast } = useKeplr();
const { current: network } = useNetwork();

const chainId = computed(() => (network.value === "mainnet" ? "retrochain-mainnet" : "retrochain-devnet-1"));

const loading = ref(false);
const error = ref<string | null>(null);
const params = ref<any | null>(null);
const mode = ref<"form" | "json">("form");
const rawJson = ref<string>("");

const gameId = ref("");
const name = ref("");
const description = ref("");
const genre = ref<string | number>(0);
const creditsPerPlay = ref("1");
const maxPlayers = ref("1");
const multiplayerEnabled = ref(false);
const developer = ref("");
const active = ref(true);
const powerUps = ref("");
const baseDifficulty = ref("1");

const genres = [
  { label: "Unspecified", value: 0 },
  { label: "Shooter", value: 1 },
  { label: "Platformer", value: 2 },
  { label: "Puzzle", value: 3 },
  { label: "Fighting", value: 4 },
  { label: "Racing", value: 5 },
  { label: "Beat 'em Up", value: 6 },
  { label: "Maze", value: 7 },
  { label: "Pinball", value: 8 }
];

const loadParams = async () => {
  try {
    const res = await api.get("/retrochain/arcade/v1/params");
    params.value = res.data?.params ?? res.data ?? null;
  } catch {
    params.value = null;
  }
};

onMounted(async () => {
  await loadParams();
  if (address.value) developer.value = address.value;
});

watch(address, (addr) => {
  if (addr && !developer.value) developer.value = addr;
});

const powerUpsList = computed(() =>
  powerUps.value
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
);

const submit = async () => {
  if (mode.value === "form") {
    if (!gameId.value.trim()) {
      toast.showError("Game ID is required");
      return;
    }
    if (!name.value.trim()) {
      toast.showError("Name is required");
      return;
    }
  }
  try {
    loading.value = true;
    error.value = null;
    if (!address.value) {
      await connect();
      if (!address.value) throw new Error("Connect your wallet to continue");
    }
    if (!developer.value.trim()) {
      developer.value = address.value;
    }

    let msg: any;
    if (mode.value === "json") {
      if (!rawJson.value.trim()) {
        throw new Error("Paste JSON for the message");
      }
      try {
        const parsed = JSON.parse(rawJson.value);
        if (parsed.typeUrl && parsed.value) {
          msg = parsed;
        } else {
          msg = {
            typeUrl: "/retrochain.arcade.v1.MsgRegisterGame",
            value: parsed
          };
        }
      } catch (e: any) {
        throw new Error(`Invalid JSON: ${e?.message || e}`);
      }
    } else {
      msg = {
        typeUrl: "/retrochain.arcade.v1.MsgRegisterGame",
        value: {
          creator: address.value,
          game: {
            gameId: gameId.value.trim(),
            name: name.value.trim(),
            description: description.value.trim(),
            genre: Number(genre.value ?? 0),
            creditsPerPlay: creditsPerPlay.value.trim() || "0",
            maxPlayers: maxPlayers.value.trim() || "1",
            multiplayerEnabled: Boolean(multiplayerEnabled.value),
            developer: developer.value.trim() || address.value,
            active: Boolean(active.value),
            powerUps: powerUpsList.value,
            baseDifficulty: baseDifficulty.value.trim() || "0"
          }
        }
      };
    }

    const fee = { amount: [{ denom: "uretro", amount: "8000" }], gas: "250000" };
    const res = await signAndBroadcast(chainId.value, [msg], fee, "Register game");
    if (res?.code) {
      throw new Error(res?.rawLog || res?.raw_log || `Broadcast failed (code ${res.code})`);
    }
    toast.showSuccess("Game registered successfully");
    router.push({ name: "arcade-games" });
  } catch (e: any) {
    error.value = e?.message || "Failed to register game";
    toast.showError(error.value);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-emerald-600/20 via-indigo-600/15 to-cyan-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-300">
          <button class="text-emerald-200 hover:underline" @click="router.push({ name: 'arcade-games' })">Arcade</button>
          <span class="text-slate-500">/</span>
          <span>Register Game</span>
        </div>
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div class="space-y-2">
            <h1 class="text-3xl font-bold text-white flex items-center gap-2">
              <span>??? Register an Arcade Game</span>
              <span class="text-sm text-emerald-200">MsgRegisterGame</span>
            </h1>
            <p class="text-sm text-slate-300 max-w-3xl">
              Broadcast <code class="text-emerald-200">/retrochain.arcade.v1.MsgRegisterGame</code> with full game metadata. Genres map to enums (0-8) and amounts use uint64 strings.
            </p>
            <div class="flex flex-wrap gap-2 text-[11px] text-slate-200">
              <span class="badge border-emerald-400/60 text-emerald-200 bg-emerald-500/10">REST: /retrochain/arcade/v1/games/{game_id}</span>
              <span class="badge border-cyan-400/60 text-cyan-200 bg-cyan-500/10">Params: /retrochain/arcade/v1/params</span>
              <span class="badge border-amber-400/60 text-amber-200 bg-amber-500/10">Broadcast: signAndBroadcast</span>
            </div>
            <div class="flex gap-2 text-xs text-slate-200">
              <button class="btn btn-xs" :class="mode === 'form' ? 'btn-primary' : ''" @click="mode = 'form'">Form mode</button>
              <button class="btn btn-xs" :class="mode === 'json' ? 'btn-primary' : ''" @click="mode = 'json'">JSON mode</button>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-200 shadow-inner min-w-[260px]">
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Quick enums</div>
            <ul class="mt-1 space-y-1 text-[11px] text-slate-200">
              <li v-for="g in genres" :key="g.value">{{ g.value }} · {{ g.label }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <RcDisclaimer v-if="error" type="warning" title="Registration failed">
      <p>{{ error }}</p>
    </RcDisclaimer>

    <div v-if="mode === 'form'" class="grid gap-3 lg:grid-cols-3">
      <div class="card space-y-3 border border-emerald-400/40 bg-emerald-500/5">
        <div class="text-[11px] uppercase tracking-wider text-emerald-200">Identity</div>
        <label class="text-[11px] text-slate-400">Game ID</label>
        <input v-model="gameId" class="input" placeholder="avoidtheretro" />
        <label class="text-[11px] text-slate-400">Name</label>
        <input v-model="name" class="input" placeholder="Avoid The Retro" />
        <label class="text-[11px] text-slate-400">Description</label>
        <textarea v-model="description" class="input min-h-[90px]" placeholder="Describe your game" />
        <div class="space-y-2">
          <label class="text-[11px] text-slate-400">Genre</label>
          <select v-model="genre" class="input">
            <option v-for="g in genres" :key="g.value" :value="g.value">{{ g.value }} · {{ g.label }}</option>
          </select>
        </div>
      </div>

      <div class="card space-y-3 border border-cyan-400/40 bg-cyan-500/5">
        <div class="text-[11px] uppercase tracking-wider text-cyan-200">Gameplay & Limits</div>
        <label class="text-[11px] text-slate-400">Credits per play (uint64 string)</label>
        <input v-model="creditsPerPlay" class="input" placeholder="1" />
        <label class="text-[11px] text-slate-400">Max players (uint64 string)</label>
        <input v-model="maxPlayers" class="input" placeholder="1" />
        <label class="text-[11px] text-slate-400">Base difficulty (uint64 string)</label>
        <input v-model="baseDifficulty" class="input" placeholder="1" />
        <div class="flex items-center gap-2 text-sm text-slate-200">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="multiplayerEnabled" />
            <span>Multiplayer enabled</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="active" />
            <span>Active</span>
          </label>
        </div>
      </div>

      <div class="card space-y-3 border border-amber-400/40 bg-amber-500/5">
        <div class="text-[11px] uppercase tracking-wider text-amber-200">Developer & Extras</div>
        <label class="text-[11px] text-slate-400">Developer address (owner)</label>
        <input v-model="developer" class="input" placeholder="your bech32 address" />
        <label class="text-[11px] text-slate-400">Power-ups (comma separated)</label>
        <input v-model="powerUps" class="input" placeholder="shield,speed" />
        <div class="text-[11px] text-slate-500">Parsed: {{ powerUpsList.join(", ") || '—' }}</div>
        <div class="text-[11px] text-slate-500">Fee: 8000 uretro · Gas: 250000</div>
        <div class="text-[11px] text-slate-500">Params: {{ params ? 'loaded' : 'unavailable' }}</div>
      </div>
    </div>

    <div v-else class="card space-y-3 border border-indigo-400/40 bg-indigo-500/5">
      <div class="flex items-center justify-between">
        <div class="text-[11px] uppercase tracking-wider text-indigo-200">Raw JSON</div>
        <button class="btn btn-xs" @click="rawJson = JSON.stringify({ typeUrl: '/retrochain.arcade.v1.MsgRegisterGame', value: { creator: address.value || '<your-wallet>', game: { gameId: 'avoidtheretro', name: 'Avoid the Retro', description: 'Pizza run between floors. Dodge the Retros. Make deliveries.', genre: 2, creditsPerPlay: '1', maxPlayers: '1', multiplayerEnabled: false, developer: address.value || '<your-wallet>', active: true, powerUps: [], baseDifficulty: '1' } } }, null, 2)">
          Paste sample
        </button>
      </div>
      <p class="text-xs text-slate-300">Provide the full message object or just the value; typeUrl will default if missing.</p>
      <textarea v-model="rawJson" class="input min-h-[260px] font-mono text-[12px]" placeholder='{"typeUrl":"/retrochain.arcade.v1.MsgRegisterGame","value":{...}}'></textarea>
    </div>

    <div class="card flex items-center gap-3 flex-wrap">
      <button class="btn btn-primary" :disabled="loading" @click="submit">{{ loading ? 'Submitting…' : 'Register Game' }}</button>
      <button class="btn" :disabled="loading" @click="router.push({ name: 'arcade-games' })">Cancel</button>
      <span v-if="loading" class="flex items-center gap-2 text-sm text-slate-400">
        <RcLoadingSpinner size="sm" />
        <span>Broadcasting transaction…</span>
      </span>
    </div>
  </div>
</template>
