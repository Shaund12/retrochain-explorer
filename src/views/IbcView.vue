<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useIbc } from '@/composables/useIbc';

const { channels, loading, error, fetchChannels, resolvedTrace, resolveDenomTrace, resolveError, resolving } = useIbc();
const denomInput = ref('');

const selectedRoute = ref<'cosmos' | 'osmosis' | 'noble'>('cosmos');
const selectedDirection = ref<'outbound' | 'inbound'>('outbound');

type BridgeAsset = 'RETRO' | 'ATOM' | 'OSMO' | 'WBTC' | 'USDC';
const selectedAsset = ref<BridgeAsset>('RETRO');

const routeOptions = [
  { value: 'cosmos', label: 'Cosmos Hub ↔ Retro' },
  { value: 'osmosis', label: 'Osmosis ↔ Retro' },
  // Noble does not have a direct Retro channel in this app yet; route is via Osmosis
  { value: 'noble', label: 'Noble ↔ Retro (via Osmosis)' }
] as const;

const directionOptions = [
  { value: 'outbound', label: 'Outbound (from Retro)', hint: 'Retro → external chain' },
  { value: 'inbound', label: 'Inbound (to Retro)', hint: 'External chain → Retro' }
] as const;

const assetOptions = [
  { value: 'RETRO', label: 'RETRO' },
  { value: 'ATOM', label: 'ATOM' },
  { value: 'OSMO', label: 'OSMO' },
  { value: 'WBTC', label: 'WBTC' },
  { value: 'USDC', label: 'USDC (Noble)' }
] as const;

// Known routes (configurable via env)
const retroToCosmosChannel = import.meta.env.VITE_IBC_CHANNEL_RETRO_COSMOS || 'channel-0';
const cosmosToRetroChannel = import.meta.env.VITE_IBC_CHANNEL_COSMOS_RETRO || 'channel-1638';
const retroToOsmosisChannel = import.meta.env.VITE_IBC_CHANNEL_RETRO_OSMOSIS || 'channel-1';
const osmosisToRetroChannel = import.meta.env.VITE_IBC_CHANNEL_OSMOSIS_RETRO || 'channel-108593';
const nobleToOsmosisChannel = import.meta.env.VITE_IBC_CHANNEL_NOBLE_OSMOSIS || 'channel-750';
const osmosisToNobleChannel = import.meta.env.VITE_IBC_CHANNEL_OSMOSIS_NOBLE || 'channel-???';

const routes = [
  {
    name: 'Cosmos Hub',
    summary: 'Retro ↔ Cosmos',
    outbound: retroToCosmosChannel,
    inbound: cosmosToRetroChannel,
    note: 'Retro channel then counterparty channel back from Cosmos Hub'
  },
  {
    name: 'Osmosis',
    summary: 'Retro ↔ Osmosis',
    outbound: retroToOsmosisChannel,
    inbound: osmosisToRetroChannel,
    note: 'Direct swap/bridge path via Osmosis core IBC'
  },
  {
    name: 'Noble (via Osmosis)',
    summary: 'Noble ↔ Retro',
    outbound: `${nobleToOsmosisChannel} → ${osmosisToRetroChannel}`,
    inbound: `${retroToOsmosisChannel} → ${osmosisToNobleChannel}`,
    note: 'Two-hop route using Osmosis as the router: Noble↔Osmosis and Osmosis↔Retro'
  }
];

const selectedRouteInfo = () => {
  if (selectedRoute.value === 'cosmos') return routes[0];
  if (selectedRoute.value === 'osmosis') return routes[1];
  return routes[2];
};

const allowedAssetsForRoute = computed<BridgeAsset[]>(() => {
  switch (selectedRoute.value) {
    case 'cosmos':
      return ['RETRO', 'ATOM', 'WBTC'];
    case 'osmosis':
      return ['RETRO', 'ATOM', 'OSMO', 'WBTC', 'USDC'];
    case 'noble':
      return ['USDC'];
    default:
      return ['RETRO'];
  }
});

// Ensure selected asset is valid when route changes
const ensuredSelectedAsset = computed({
  get() {
    if (allowedAssetsForRoute.value.includes(selectedAsset.value)) return selectedAsset.value;
    return allowedAssetsForRoute.value[0];
  },
  set(v: BridgeAsset) {
    selectedAsset.value = v;
  }
});

const copy = async (text?: string | null) => {
  const value = (text || '').trim();
  if (!value) return;
  try {
    await navigator.clipboard?.writeText(value);
  } catch {
    // ignore
  }
};

onMounted(() => {
  fetchChannels(200);
});
</script>

<template>
  <div class="space-y-3">
    <div class="card-soft relative overflow-hidden">
      <div class="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-full blur-3xl"></div>
      <div class="relative">
        <div class="flex items-baseline gap-2 mb-2">
          <h1 class="text-2xl font-bold">
            <span class="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              IBC Overview
            </span>
          </h1>
        </div>
        <p class="text-sm text-slate-300 mb-4">Channels, sequences, and denom trace resolution</p>
        <button class="btn text-xs" :disabled="loading" @click="fetchChannels(200)">
          {{ loading ? 'Loading...' : '↻ Refresh Channels' }}
        </button>
      </div>
    </div>

      <div class="mb-4">
        <label class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Asset</label>
        <select
          v-model="ensuredSelectedAsset"
          class="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
        >
          <option
            v-for="opt in assetOptions.filter((a) => allowedAssetsForRoute.includes(a.value))"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
        <div class="text-[11px] text-slate-500 mt-1">
          Available on this route: {{ allowedAssetsForRoute.join(', ') }}
        </div>
      </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">Route Directory</h2>
        <span class="text-[11px] text-slate-500">Common IBC paths</span>
      </div>

      <div class="grid gap-2 md:grid-cols-2 mb-4">
        <div>
          <label class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Route</label>
          <select
            v-model="selectedRoute"
            class="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          >
            <option v-for="opt in routeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="text-[11px] uppercase tracking-[0.2em] text-slate-500">Direction</label>
          <select
            v-model="selectedDirection"
            class="w-full mt-1 px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
          >
            <option v-for="opt in directionOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <div class="text-[11px] text-slate-500 mt-1">
            {{ directionOptions.find((o) => o.value === selectedDirection)?.hint }}
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Asset</span>
            <code class="text-xs font-mono text-slate-200">{{ ensuredSelectedAsset }}</code>
            <span class="text-[11px] text-slate-500">Shown for routing clarity</span>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ selectedRouteInfo().summary }}</div>
            <div class="text-sm font-semibold text-white">{{ selectedRouteInfo().name }}</div>
            <div class="text-[11px] text-slate-400 mt-1">{{ selectedRouteInfo().note }}</div>
          </div>
        </div>
        <div class="mt-3 grid gap-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs text-slate-400">Channel</span>
            <code class="text-xs font-mono text-slate-200">
              {{ selectedDirection === 'outbound' ? (selectedRouteInfo().outbound || '—') : (selectedRouteInfo().inbound || '—') }}
            </code>
            <button
              class="btn text-[10px]"
              :disabled="!(selectedDirection === 'outbound' ? selectedRouteInfo().outbound : selectedRouteInfo().inbound)"
              @click="copy(selectedDirection === 'outbound' ? selectedRouteInfo().outbound : selectedRouteInfo().inbound)"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <details class="mt-3">
        <summary class="text-xs text-slate-400 cursor-pointer select-none">Show all routes</summary>
        <div class="grid gap-3 md:grid-cols-3 mt-3">
          <article
            v-for="route in routes"
            :key="route.name"
            class="rounded-2xl border border-white/10 bg-slate-900/60 p-4 space-y-2"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs uppercase tracking-[0.2em] text-slate-400">{{ route.summary }}</div>
                <div class="text-sm font-semibold text-white">{{ route.name }}</div>
              </div>
            </div>
            <div class="text-[11px] text-slate-400">{{ route.note }}</div>
            <div class="text-xs text-slate-200 space-y-1">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Outbound</span>
                <code class="font-mono">{{ route.outbound || '—' }}</code>
                <button class="btn text-[10px]" :disabled="!route.outbound" @click="copy(route.outbound)">Copy</button>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Inbound</span>
                <code class="font-mono">{{ route.inbound || '—' }}</code>
                <button class="btn text-[10px]" :disabled="!route.inbound" @click="copy(route.inbound)">Copy</button>
              </div>
            </div>
          </article>
        </div>
      </details>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Channels</div>
        <div class="text-2xl font-bold text-cyan-400">{{ channels.length }}</div>
        <div class="text-xs text-slate-500">Loaded from /ibc/core/channel</div>
      </div>
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Active</div>
        <div class="text-2xl font-bold text-emerald-400">{{ channels.filter(c => c.state === 'STATE_OPEN').length }}</div>
        <div class="text-xs text-slate-500">State = OPEN</div>
      </div>
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Ordering</div>
        <div class="text-2xl font-bold text-indigo-400">{{ channels.filter(c => c.ordering === 'ORDER_UNORDERED').length }}</div>
        <div class="text-xs text-slate-500">Unordered channels</div>
      </div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <p class="text-sm text-rose-300">{{ error }}</p>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">IBC Channels</h2>
        <span v-if="loading" class="text-xs text-slate-400">Loading...</span>
      </div>
      <div v-if="!channels.length && !loading" class="text-sm text-slate-400">No channels found</div>
      <div v-else class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr class="text-xs text-slate-300">
              <th>Channel</th>
              <th>State</th>
              <th>Ordering</th>
              <th>Counterparty</th>
              <th>Connection</th>
              <th class="text-right">Seq Send</th>
              <th class="text-right">Seq Recv</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in channels" :key="c.channelId + c.portId" class="text-xs">
              <td class="font-mono">
                <div>{{ c.channelId }}</div>
                <div class="text-[11px] text-slate-500">{{ c.portId }}</div>
              </td>
              <td>
                <span
                  class="badge text-[10px]"
                  :class="c.state === 'STATE_OPEN' ? 'border-emerald-400/60 text-emerald-200' : 'border-amber-400/60 text-amber-200'"
                >
                  {{ c.state?.replace('STATE_', '') || 'UNKNOWN' }}
                </span>
              </td>
              <td>{{ c.ordering?.replace('ORDER_', '') || 'UNKNOWN' }}</td>
              <td>
                <div class="font-mono">{{ c.counterpartyChannelId || '-' }}</div>
                <div class="text-[11px] text-slate-500">{{ c.counterpartyPortId || '-' }}</div>
              </td>
              <td class="text-[11px] text-slate-400">
                {{ c.connectionHops.join(', ') || '-' }}
              </td>
              <td class="text-right font-mono">{{ c.nextSequenceSend ?? '' }}</td>
              <td class="text-right font-mono">{{ c.nextSequenceRecv ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-sm font-semibold text-slate-100">Resolve IBC Denom</h2>
        <span class="text-[11px] text-slate-400">ibc/&lt;hash&gt; ? base denom + path</span>
      </div>
      <div class="flex flex-wrap gap-2 mb-3">
        <input
          v-model="denomInput"
          type="text"
          placeholder="ibc/XXXX..."
          class="flex-1 min-w-[240px] px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-xs font-mono"
        />
        <button class="btn text-xs" :disabled="resolving" @click="resolveDenomTrace(denomInput)">
          {{ resolving ? 'Resolving...' : 'Resolve' }}
        </button>
      </div>
      <div v-if="resolveError" class="text-sm text-rose-300">{{ resolveError }}</div>
      <div v-else-if="resolvedTrace" class="text-sm text-slate-200 space-y-1">
        <div>Base Denom: <code class="text-[11px]">{{ resolvedTrace.baseDenom }}</code></div>
        <div>Path: <code class="text-[11px]">{{ resolvedTrace.path }}</code></div>
      </div>
    </div>
  </div>
</template>
