<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useKeplr } from "@/composables/useKeplr";
import { useContracts } from "@/composables/useContracts";

const router = useRouter();
const { address, connect, signAndBroadcast } = useKeplr();
const { smartQueryContract } = useContracts();

const contractAddress = ref<string>(import.meta.env.VITE_BATTLEPOINTS_CONTRACT || "");
const cw20Address = ref<string>(import.meta.env.VITE_BATTLEPOINTS_CW20 || "");
const cw721Address = ref<string>(import.meta.env.VITE_BATTLEPOINTS_CW721 || "");

const loading = ref(false);
const error = ref<string | null>(null);
const points = ref<number | null>(null);

type ShopItem = {
  item_id: string;
  name?: string;
  description?: string;
  price_points?: number;
  art_style?: string;
  palette?: string;
  image?: string;
  token_uri?: string;
  enabled?: boolean;
};

const shopLoading = ref(false);
const buyLoading = ref<string | null>(null);
const items = ref<ShopItem[]>([]);
const svgPreviewByItemId = ref<Record<string, string>>({});

const hasWallet = computed(() => Boolean(address.value));

const hasContract = computed(() => Boolean(contractAddress.value.trim()));

const canBuy = computed(() => hasWallet.value && hasContract.value && items.value.length > 0);

const load = async () => {
  error.value = null;
  points.value = null;

  const addr = contractAddress.value.trim();
  if (!addr) {
    error.value = "BattlePoints contract address is not configured. Set VITE_BATTLEPOINTS_CONTRACT.";
    return;
  }

  if (!address.value) {
    return;
  }

  loading.value = true;
  try {
    const res: any = await smartQueryContract(addr, { points: { player: address.value } });
    // support either { points: <u64> } or { total: <u64> }
    const val = (res?.points ?? res?.total ?? res?.value) as any;
    const n = Number(val);
    points.value = Number.isFinite(n) ? n : 0;
  } catch (e: any) {
    error.value = e?.message || "Failed to query battle points.";
  } finally {
    loading.value = false;
  }
};

const loadShop = async () => {
  error.value = null;
  items.value = [];
  svgPreviewByItemId.value = {};

  const addr = contractAddress.value.trim();
  if (!addr) {
    error.value = "BattlePoints contract address is not configured. Set VITE_BATTLEPOINTS_CONTRACT.";
    return;
  }

  shopLoading.value = true;
  try {
    const res: any = await smartQueryContract(addr, { shop_items: { start_after: null, limit: 50 } });
    const list = (res?.items ?? res?.shop_items ?? res ?? []) as any[];
    items.value = Array.isArray(list) ? list : [];

    const enabled = items.value.filter((i) => i && (i.enabled ?? true) !== false);
    await Promise.all(
      enabled.slice(0, 6).map(async (i) => {
        const id = i?.item_id;
        if (!id) return;

        // Prefer contract-provided image (preview-ready contracts return data:image/svg+xml;base64,...)
        const direct = (i as any)?.image;
        if (typeof direct === "string" && direct.startsWith("data:image/svg+xml")) {
          svgPreviewByItemId.value = { ...svgPreviewByItemId.value, [id]: direct };
          return;
        }
        try {
          const svgRes: any = await smartQueryContract(addr, { svg_image: { item_id: id } });
          const svg = svgRes?.svg ?? svgRes?.image ?? svgRes?.data;
          if (typeof svg === "string" && svg.trim().startsWith("<svg")) {
            svgPreviewByItemId.value = { ...svgPreviewByItemId.value, [id]: svg };
          }
        } catch {
          // preview is optional; ignore
        }
      })
    );
  } catch (e: any) {
    error.value = e?.message || "Failed to query shop items.";
  } finally {
    shopLoading.value = false;
  }
};

const buyItem = async (item: ShopItem) => {
  error.value = null;
  const addr = contractAddress.value.trim();
  if (!addr) {
    error.value = "BattlePoints contract address is not configured.";
    return;
  }

  if (!address.value) {
    await connect();
  }
  if (!address.value) return;

  const itemId = item.item_id;
  if (!itemId) {
    error.value = "Invalid shop item.";
    return;
  }

  buyLoading.value = itemId;
  try {
    if (typeof TextEncoder === "undefined") {
      throw new Error("TextEncoder is unavailable in this environment.");
    }
    const msg = {
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: {
        sender: address.value,
        contract: addr,
        msg: new TextEncoder().encode(JSON.stringify({ buy_nft: { item_id: itemId } })),
        funds: []
      }
    };

    const fee = "auto" as any;
    const res: any = await signAndBroadcast("retrochain-mainnet", [msg], fee, "Buy NFT with Battle Points");
    if (res?.code && Number(res.code) !== 0) {
      throw new Error(res?.rawLog || res?.raw_log || "Transaction failed");
    }

    await load();
    await loadShop();
  } catch (e: any) {
    error.value = e?.message || "Buy failed.";
  } finally {
    buyLoading.value = null;
  }
};

onMounted(async () => {
  await load();
  await loadShop();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div class="text-sm uppercase tracking-[0.2em] text-indigo-200">Battle Points</div>
        <h1 class="text-2xl font-bold text-white mt-1">Points + NFT Store</h1>
        <p class="text-sm text-slate-300 mt-1">View your points and browse store items.</p>
      </div>
      <div class="flex gap-2 flex-wrap justify-end">
        <button class="btn text-xs" @click="router.push({ name: 'arcade' })">← Back to Arcade</button>
        <button class="btn btn-primary text-xs" :disabled="loading || shopLoading" @click="() => Promise.all([load(), loadShop()])">
          {{ loading || shopLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="card border border-emerald-500/40 bg-emerald-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">My Battle Points</div>
        <div class="text-3xl font-extrabold text-white mt-1">
          <span v-if="!hasWallet" class="text-slate-400">Connect Keplr</span>
          <span v-else-if="loading" class="text-slate-300">…</span>
          <span v-else>{{ (points ?? 0).toLocaleString() }}</span>
        </div>
        <div class="text-xs text-slate-400 mt-1" v-if="contractAddress">
          Contract: <code class="font-mono">{{ contractAddress }}</code>
        </div>
      </div>

      <div class="card border border-indigo-500/40 bg-indigo-500/10">
        <div class="text-[11px] uppercase tracking-wider text-slate-300">Store</div>
        <div class="text-sm text-slate-200 mt-1">Spend points to mint on-chain SVG NFTs.</div>
        <div class="text-xs text-slate-400 mt-2" v-if="!hasWallet">Connect Keplr to buy.</div>
        <div class="text-xs text-slate-400 mt-2" v-else-if="shopLoading">Loading items…</div>
        <div class="text-xs text-slate-400 mt-2" v-else-if="items.length === 0">No store items returned by the contract.</div>
      </div>
    </div>

    <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3" v-if="items.length">
      <div
        v-for="it in items"
        :key="it.item_id"
        class="card border border-white/10 bg-slate-900/60"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-white truncate">{{ it.name || it.item_id }}</div>
            <div class="text-[11px] text-slate-400" v-if="it.description">{{ it.description }}</div>
            <div class="text-[11px] text-slate-400 mt-1" v-if="it.art_style || it.palette">
              <span v-if="it.art_style">Style: <span class="text-slate-200">{{ it.art_style }}</span></span>
              <span v-if="it.art_style && it.palette"> · </span>
              <span v-if="it.palette">Palette: <span class="text-slate-200">{{ it.palette }}</span></span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[11px] uppercase tracking-wider text-slate-400">Price</div>
            <div class="text-lg font-bold text-emerald-200">{{ Number(it.price_points || 0).toLocaleString() }}</div>
          </div>
        </div>

        <div class="mt-3 rounded-lg bg-black/30 border border-white/10 overflow-hidden" v-if="svgPreviewByItemId[it.item_id]">
          <img
            v-if="String(svgPreviewByItemId[it.item_id]).startsWith('data:image')"
            :src="svgPreviewByItemId[it.item_id]"
            :alt="it.name || it.item_id"
            class="w-full h-auto block"
          />
          <div v-else class="w-full" v-html="svgPreviewByItemId[it.item_id]" />
        </div>

        <div class="mt-3 flex items-center justify-between gap-2">
          <div class="text-[11px] text-slate-400">
            <span v-if="it.enabled === false" class="text-amber-200">Disabled</span>
            <span v-else>Ready</span>
          </div>
          <button
            class="btn btn-xs"
            :class="(it.enabled ?? true) !== false && canBuy && (points ?? 0) >= Number(it.price_points || 0) ? 'btn-primary' : ''"
            :disabled="(it.enabled ?? true) === false || !hasWallet || buyLoading === it.item_id || (points ?? 0) < Number(it.price_points || 0)"
            @click="buyItem(it)"
          >
            <span v-if="buyLoading === it.item_id">Buying…</span>
            <span v-else-if="!hasWallet">Connect</span>
            <span v-else-if="(points ?? 0) < Number(it.price_points || 0)">Need {{ Number(it.price_points || 0).toLocaleString() }}</span>
            <span v-else>Buy</span>
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-sm font-semibold text-slate-100">Contracts</h2>
        <span class="text-[11px] text-slate-400">Configured via env vars</span>
      </div>

      <div class="grid gap-3 md:grid-cols-3">
        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">BattlePoints</div>
          <input
            v-model="contractAddress"
            type="text"
            class="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-xs font-mono"
            placeholder="VITE_BATTLEPOINTS_CONTRACT"
          />
          <div class="mt-2 text-[11px]" :class="hasContract ? 'text-emerald-200' : 'text-amber-200'">
            {{ hasContract ? 'Ready' : 'Missing address' }}
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">CW20 Battle Points</div>
          <input
            v-model="cw20Address"
            type="text"
            class="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-xs font-mono"
            placeholder="VITE_BATTLEPOINTS_CW20"
          />
          <div class="mt-2 text-[11px] text-slate-500">Minter: BattlePoints contract</div>
        </div>

        <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div class="text-[11px] uppercase tracking-wider text-slate-500">CW721 Collection</div>
          <input
            v-model="cw721Address"
            type="text"
            class="mt-2 w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-xs font-mono"
            placeholder="VITE_BATTLEPOINTS_CW721"
          />
          <div class="mt-2 text-[11px] text-slate-500">Minter: BattlePoints contract</div>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border border-rose-500/30 bg-rose-500/5 text-rose-200 text-sm">{{ error }}</div>
  </div>
</template>
