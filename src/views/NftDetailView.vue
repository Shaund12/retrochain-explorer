<script setup lang="ts">
import { onMounted, watch, computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useNfts } from "@/composables/useNfts";

const route = useRoute();
const router = useRouter();
const { classDetail, tokens, loading, error, fetchDetail } = useNfts();
const searchTerm = ref("");
const withImagesOnly = ref(false);
const selectedToken = ref<any | null>(null);
const showTokenModal = ref(false);

const load = () => {
  const id = route.params.id as string;
  if (id) {
    fetchDetail(id);
  }
};

onMounted(load);

watch(
  () => route.params.id,
  () => load()
);

const sourceLabel = (source?: string) => {
  if (source === "cw721") return "CW721";
  if (source === "ics721") return "ICS-721";
  if (source === "nft-module") return "x/nft";
  return source || "NFT";
};

const heroToken = computed(() => tokens.value.find((t) => t.image) || tokens.value[0]);

const filteredTokens = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  return tokens.value
    .filter((t) => {
      if (withImagesOnly.value && !t.image) return false;
      if (!term) return true;
      return (
        (t.name || "").toLowerCase().includes(term) ||
        (t.id || "").toLowerCase().includes(term) ||
        (t.description || "").toLowerCase().includes(term)
      );
    })
    .sort((a, b) => (a.name || a.id || "").localeCompare(b.name || b.id || ""));
});

const copy = async (value?: string) => {
  if (!value) return;
  try {
    await navigator.clipboard?.writeText?.(value);
  } catch {}
};

const openTokenModal = (token: any) => {
  selectedToken.value = token;
  showTokenModal.value = true;
};

const closeTokenModal = () => {
  showTokenModal.value = false;
  selectedToken.value = null;
};

const goBack = () => router.push({ name: "tokens" });
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-emerald-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-4">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-[0.3em] text-indigo-200">NFT Collection</p>
            <div class="flex items-center gap-3 flex-wrap">
              <h1 class="text-2xl font-semibold text-white">{{ classDetail?.name || route.params.id }}</h1>
              <span v-if="classDetail?.source" class="badge text-[11px]">{{ sourceLabel(classDetail?.source) }}</span>
              <span v-if="classDetail?.symbol" class="badge text-[11px] border-indigo-400/60 text-indigo-200">{{ classDetail?.symbol }}</span>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-slate-400 break-all flex-wrap">
              <code class="font-mono">{{ classDetail?.id }}</code>
              <button class="btn text-[10px]" @click="copy(classDetail?.id)">Copy</button>
              <a v-if="classDetail?.uri" :href="classDetail?.uri" target="_blank" class="btn text-[10px]">Open URI</a>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn text-xs" @click="load">Refresh</button>
            <button class="btn text-xs" @click="goBack">Back to Tokens</button>
          </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-3">
          <div class="lg:col-span-2 p-3 rounded-xl border border-white/10 bg-white/5 flex gap-3">
            <div class="w-28 h-28 rounded-xl bg-slate-950/40 border border-slate-700 overflow-hidden flex items-center justify-center">
              <img
                v-if="heroToken?.image"
                :src="heroToken.image"
                :alt="heroToken?.name || heroToken?.id"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-slate-500 text-xs">Preview</span>
            </div>
            <div class="space-y-2 flex-1 min-w-0">
              <p class="text-sm text-slate-300 line-clamp-3">{{ classDetail?.description || 'No description provided.' }}</p>
              <p v-if="classDetail?.uri" class="text-[11px] text-indigo-300 truncate">{{ classDetail?.uri }}</p>
              <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div class="p-2 rounded-lg bg-slate-900/60 border border-slate-700">
                  <div class="uppercase tracking-widest text-slate-500">Tokens</div>
                  <div class="text-white text-lg font-semibold">{{ tokens.length }}</div>
                </div>
                <div class="p-2 rounded-lg bg-slate-900/60 border border-slate-700">
                  <div class="uppercase tracking-widest text-slate-500">Images</div>
                  <div class="text-white text-lg font-semibold">{{ tokens.filter(t => t.image).length }}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="p-3 rounded-xl border border-white/10 bg-slate-950/60 text-xs text-slate-300 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] uppercase tracking-wider text-slate-500">Search</span>
              <label class="inline-flex items-center gap-2 text-[11px] text-slate-400">
                <input type="checkbox" v-model="withImagesOnly" class="w-4 h-4 rounded border-slate-600 bg-slate-900/80 text-emerald-400 focus:ring-emerald-400" />
                Images only
              </label>
            </div>
            <input
              v-model="searchTerm"
              type="text"
              placeholder="Filter by name, id, description"
              class="w-full px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-100 text-sm"
            />
            <div class="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 flex items-center gap-2">
              <span class="text-lg">?</span>
              <div>
                <div class="text-[11px] uppercase tracking-widest">Pro tip</div>
                <div>Click any NFT card to view full metadata</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <RcDisclaimer type="info" title="NFT discovery">
      <p>Collections are fetched from x/nft (ICS-721) and CW721 contracts. Only the first 50 NFTs are shown for contract collections.</p>
    </RcDisclaimer>

    <div v-if="error" class="card border border-rose-500/30 bg-rose-500/5 text-rose-200 text-sm">{{ error }}</div>
    <div v-else-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading collection…" />
    </div>

    <template v-else>
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">Minted NFTs</h2>
          <span class="text-xs text-slate-400">Filtered {{ filteredTokens.length }} / {{ tokens.length }}</span>
        </div>
        <div v-if="filteredTokens.length === 0" class="text-xs text-slate-400">No NFTs match the current filters.</div>
        <div v-else class="grid gap-3 md:grid-cols-3">
          <article
            v-for="token in filteredTokens"
            :key="token.id"
            class="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 hover:border-emerald-400/50 hover:-translate-y-[1px] transition cursor-pointer"
            @click="openTokenModal(token)"
          >
            <div class="aspect-square w-full rounded-xl overflow-hidden bg-black/30 flex items-center justify-center">
              <img
                v-if="token.image"
                :src="token.image"
                :alt="token.name || token.id"
                class="h-full w-full object-cover"
                loading="lazy"
              />
              <span v-else class="text-slate-500 text-xs">No image</span>
            </div>
            <div class="space-y-1">
              <p class="text-sm font-semibold text-white">{{ token.name || token.id }}</p>
              <p class="text-[11px] text-slate-400 break-all">{{ token.id }}</p>
              <p class="text-xs text-slate-300 min-h-[36px]">{{ token.description || '—' }}</p>
              <p v-if="token.uri" class="text-[11px] text-indigo-300 truncate">{{ token.uri }}</p>
            </div>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>
