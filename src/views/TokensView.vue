<script setup lang="ts">
import { computed, onMounted } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import { useAssets, type BankToken, type Cw20Token } from "@/composables/useAssets";
import type { TokenAccent } from "@/constants/tokens";

const { bankTokens, ibcTokens, cw20Tokens, nftClasses, loading, error, fetchAssets } = useAssets();

onMounted(() => {
  fetchAssets();
});

const nativeTokens = computed(() => bankTokens.value.filter((token) => !token.isFactory));
const factoryTokens = computed(() => bankTokens.value.filter((token) => token.isFactory));

const stats = computed(() => ({
  native: nativeTokens.value.length,
  factory: factoryTokens.value.length,
  ibc: ibcTokens.value.length,
  cw20: cw20Tokens.value.length,
  nft: nftClasses.value.length
}));

const tokenTypeLabel = (token: { isFactory: boolean }) => (token.isFactory ? "Factory" : "Native");

const accentBg: Record<TokenAccent, string> = {
  emerald: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/40",
  violet: "bg-violet-500/15 text-violet-200 border border-violet-400/40",
  sky: "bg-sky-500/15 text-sky-200 border border-sky-400/40",
  amber: "bg-amber-500/15 text-amber-200 border border-amber-400/40",
  slate: "bg-slate-500/15 text-slate-200 border border-slate-400/40"
};

const tokenAvatarClass = (token: BankToken) => accentBg[token.tokenMeta?.accent ?? "slate"];

const tokenAvatarText = (token: BankToken) => {
  const raw = token?.tokenMeta?.symbol || token?.tokenMeta?.name || token?.denom || "ASSET";
  const source = typeof raw === "string" && raw.length ? raw : "ASSET";
  return source.slice(0, 4).toUpperCase();
};

const formatCw20Supply = (token: Cw20Token) => {
  const decimals = Number(token.decimals ?? 6);
  const divisor = Math.pow(10, Math.max(decimals, 0));
  const amount = Number(token.totalSupply) / (divisor || 1);
  if (!Number.isFinite(amount)) {
    return `${token.totalSupply} ${token.symbol}`;
  }
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.min(6, Math.max(decimals, 0))
  })} ${token.symbol}`;
};

</script>

<template>
  <div class="space-y-4">
    <div class="card relative overflow-hidden">
      <div class="absolute inset-0 bg-gradient-to-r from-indigo-700/20 via-purple-600/20 to-emerald-500/20 blur-3xl"></div>
      <div class="relative flex flex-col gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.35em] text-emerald-200">Asset Registry</p>
          <h1 class="text-3xl font-bold text-white mt-2 flex items-center gap-3">
            <span>RetroChain Tokens &amp; Collections</span>
            <span class="text-2xl">🪙</span>
          </h1>
          <p class="text-sm text-slate-300 mt-2 max-w-3xl">
            Live inventory of fungible tokens, IBC routes, and NFT classes observed on RetroChain. All data is queried directly from
            on-chain modules via the REST API.
          </p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3">
            <p class="text-emerald-200 uppercase tracking-wider">Native Tokens</p>
            <p class="text-2xl font-bold text-white">{{ stats.native }}</p>
          </div>
          <div class="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3">
            <p class="text-cyan-200 uppercase tracking-wider">Factory Tokens</p>
            <p class="text-2xl font-bold text-white">{{ stats.factory }}</p>
          </div>
          <div class="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3">
            <p class="text-indigo-200 uppercase tracking-wider">IBC Assets</p>
            <p class="text-2xl font-bold text-white">{{ stats.ibc }}</p>
          </div>
          <div class="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-3">
            <p class="text-fuchsia-200 uppercase tracking-wider">CW20 Tokens</p>
            <p class="text-2xl font-bold text-white">{{ stats.cw20 }}</p>
          </div>
          <div class="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p class="text-amber-200 uppercase tracking-wider">NFT Collections</p>
            <p class="text-2xl font-bold text-white">{{ stats.nft }}</p>
          </div>
        </div>
      </div>
    </div>

    <RcDisclaimer type="warning" title="On-chain data only">
      <p>
        This registry surfaces assets indexed by the bank, IBC transfer, and NFT modules. Tokens that have never minted supply or NFT
        classes without metadata may not appear until they exist on-chain.
      </p>
    </RcDisclaimer>

    <div v-if="error" class="card border border-rose-500/30 bg-rose-500/5 text-rose-200 text-sm">
      {{ error }}
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Syncing token registry…" />
    </div>

    <template v-else>
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">Native &amp; Factory Tokens</h2>
          <button class="btn text-xs" @click="fetchAssets">Refresh</button>
        </div>
        <div v-if="bankTokens.length === 0" class="text-xs text-slate-400">No fungible tokens discovered yet.</div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Asset</th>
                <th>Denom</th>
                <th>Supply</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="token in bankTokens" :key="token.denom" class="text-sm">
                <td class="py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-10 rounded-2xl flex items-center justify-center font-semibold text-xs uppercase shadow-lg overflow-hidden"
                      :class="tokenAvatarClass(token)"
                    >
                      <img
                        v-if="token.tokenMeta?.logo"
                        :src="token.tokenMeta.logo"
                        :alt="`${token.tokenMeta?.symbol || token.tokenMeta?.name || token.denom} logo`"
                        class="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                      <span v-else>
                        {{ tokenAvatarText(token) }}
                      </span>
                    </div>
                    <div>
                      <p class="font-semibold text-white">{{ token.tokenMeta?.symbol || token.denom?.toUpperCase() }}</p>
                      <p class="text-xs text-slate-400">{{ token.tokenMeta?.name || token.denom }}</p>
                    </div>
                  </div>
                </td>
                <td class="font-mono text-xs text-slate-300">{{ token.denom }}</td>
                <td class="text-slate-100">{{ token.displayAmount }}</td>
                <td>
                  <span
                    class="badge text-[11px]"
                    :class="token.isFactory ? 'border-cyan-400/60 text-cyan-200' : 'border-emerald-400/60 text-emerald-200'"
                  >
                    {{ tokenTypeLabel(token) }}
                  </span>
                </td>
                <td class="text-xs text-slate-400">{{ token.tokenMeta?.description || token.metadata?.description || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card" v-if="cw20Tokens.length">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">CW20 Tokens</h2>
          <span class="text-xs text-slate-400">Discovered via smart contract queries</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Token</th>
                <th>Contract</th>
                <th>Total Supply</th>
                <th>Decimals</th>
                <th>Code ID</th>
                <th>Minter</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="token in cw20Tokens" :key="token.address" class="text-sm">
                <td class="py-3">
                  <div class="font-semibold text-white">{{ token.symbol }}</div>
                  <div class="text-xs text-slate-400">{{ token.name }}</div>
                </td>
                <td class="font-mono text-xs text-slate-300 break-all">{{ token.address }}</td>
                <td class="text-slate-100">{{ formatCw20Supply(token) }}</td>
                <td class="text-slate-300">{{ token.decimals }}</td>
                <td class="text-slate-300">{{ token.codeId }}</td>
                <td class="text-xs text-slate-400">{{ token.minter || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">IBC Tokens</h2>
          <span class="text-xs text-slate-400">Path &amp; source chain are derived from denom traces.</span>
        </div>
        <div v-if="ibcTokens.length === 0" class="text-xs text-slate-400">No inbound IBC assets detected.</div>
        <div v-else class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr class="text-xs text-slate-400">
                <th>Asset</th>
                <th>Base Denom</th>
                <th>IBC Path</th>
                <th>Supply</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="token in ibcTokens" :key="token.denom" class="text-sm">
                <td>
                  <div class="flex items-center gap-3">
                    <div
                      class="h-10 w-10 rounded-2xl flex items-center justify-center font-semibold text-xs uppercase shadow-lg overflow-hidden"
                      :class="tokenAvatarClass(token)"
                    >
                      <img
                        v-if="token.tokenMeta?.logo"
                        :src="token.tokenMeta.logo"
                        :alt="`${token.tokenMeta?.symbol || token.tokenMeta?.name || token.denom} logo`"
                        class="h-8 w-8 object-contain"
                        loading="lazy"
                      />
                      <span v-else>
                        {{ tokenAvatarText(token) }}
                      </span>
                    </div>
                    <div>
                      <p class="font-semibold text-white">{{ token.tokenMeta?.symbol || token.denom?.toUpperCase() }}</p>
                      <p class="text-xs text-slate-400">{{ token.denom }}</p>
                    </div>
                  </div>
                </td>
                <td class="text-xs text-slate-300">{{ token.baseDenom || '—' }}</td>
                <td class="text-xs text-slate-400 font-mono">{{ token.tracePath || '—' }}</td>
                <td class="text-slate-100">{{ token.displayAmount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-white">NFT Collections</h2>
          <span class="text-xs text-slate-400">ICS-721 classes indexed from the NFT module.</span>
        </div>
        <div v-if="nftClasses.length === 0" class="text-xs text-slate-400">No NFT classes have been registered yet.</div>
        <div v-else class="grid gap-3 md:grid-cols-2">
          <article
            v-for="cls in nftClasses"
            :key="cls.id"
            class="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-sm font-semibold text-white">{{ cls.name }}</p>
                <p class="text-[11px] text-slate-400">{{ cls.id }}</p>
              </div>
              <span class="badge text-[10px]" v-if="cls.symbol">{{ cls.symbol }}</span>
            </div>
            <p class="text-xs text-slate-300 min-h-[40px]">
              {{ cls.description || 'No description provided.' }}
            </p>
            <p v-if="cls.uri" class="text-[11px] text-indigo-300 truncate mt-2">{{ cls.uri }}</p>
          </article>
        </div>
      </div>
    </template>
  </div>
</template>
