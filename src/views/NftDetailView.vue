<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useNfts } from "@/composables/useNfts";

const route = useRoute();
const router = useRouter();
const { classDetail, tokens, loading, error, fetchDetail } = useNfts();

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

const goBack = () => router.push({ name: "tokens" });
</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-emerald-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-[0.3em] text-indigo-200">NFT Collection</p>
            <h1 class="text-2xl font-semibold text-white mt-1">{{ classDetail?.name || route.params.id }}</h1>
            <p class="text-xs text-slate-400 break-all">{{ classDetail?.id }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="classDetail?.source" class="badge text-[11px]">{{ sourceLabel(classDetail?.source) }}</span>
            <button class="btn text-xs" @click="load">Refresh</button>
            <button class="btn text-xs" @click="goBack">Back to Tokens</button>
          </div>
        </div>
        <p class="text-sm text-slate-300">{{ classDetail?.description || 'No description provided.' }}</p>
        <p v-if="classDetail?.uri" class="text-[11px] text-indigo-300 truncate">{{ classDetail?.uri }}</p>
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
          <span class="text-xs text-slate-400">{{ tokens.length }} found</span>
        </div>
        <div v-if="tokens.length === 0" class="text-xs text-slate-400">No NFTs discovered for this collection.</div>
        <div v-else class="grid gap-3 md:grid-cols-3">
          <article
            v-for="token in tokens"
            :key="token.id"
            class="rounded-2xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2"
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
