<script setup lang="ts">
import { onMounted, ref } from "vue";
import RcLoadingSpinner from "@/components/RcLoadingSpinner.vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import RcDocsPager from "@/components/RcDocsPager.vue";
import { useApi } from "@/composables/useApi";

const api = useApi();

const loading = ref(true);
const error = ref<string | null>(null);
const height = ref<string | null>(null);

const authParams = ref<Record<string, any> | null>(null);
const stakingPool = ref<Record<string, any> | null>(null);

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    const [latest, authRes, poolRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/auth/v1beta1/params").catch(() => null),
      api.get("/cosmos/staking/v1beta1/pool").catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    authParams.value = authRes?.data?.params ?? null;
    stakingPool.value = poolRes?.data?.pool ?? null;
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-4">
    <RcBackLink />
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">Accounts & Addresses</h1>
      <p class="text-sm text-slate-400 mt-1">
        Address formats, account types, and module accounts explorers commonly surface.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading accounts docs" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load accounts docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Explorer note">
      <p class="text-sm text-slate-300">
        Cosmos chains use bech32 addresses for users and module accounts. The prefix is typically <code>cosmos</code> on RetroChain.
        Valoper addresses use the <code>cosmosvaloper</code> prefix.
      </p>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Common address types</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <div>
            <div class="text-slate-100 font-semibold">User account</div>
            <div class="text-[11px] text-slate-500">Example: <code>cosmos1</code></div>
            <div class="text-[11px] text-slate-500 mt-1">REST: <code>/cosmos/auth/v1beta1/accounts/&lt;address&gt;</code></div>
          </div>
          <div>
            <div class="text-slate-100 font-semibold">Validator operator</div>
            <div class="text-[11px] text-slate-500">Example: <code>cosmosvaloper1</code></div>
            <div class="text-[11px] text-slate-500 mt-1">REST: <code>/cosmos/staking/v1beta1/validators/&lt;valoper&gt;</code></div>
          </div>
          <div>
            <div class="text-slate-100 font-semibold">Consensus public key</div>
            <div class="text-[11px] text-slate-500">Used at consensus layer (Tendermint/CometBFT), not a bech32 address.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Account numbers & sequences</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <p>
            Wallets sign transactions using <strong>account number</strong> and <strong>sequence</strong>. If sequence mismatches,
            transactions fail with an account sequence mismatch error.
          </p>
          <div class="text-[11px] text-slate-500">
            REST: <code>/cosmos/auth/v1beta1/accounts/&lt;address&gt;</code>
          </div>
          <div class="text-[11px] text-slate-500">
            Auth params: <code>/cosmos/auth/v1beta1/params</code>
          </div>
          <div class="text-xs text-slate-400 mt-2">
            Max memo characters (live params): <span class="font-mono text-slate-200">{{ authParams?.max_memo_characters ?? '' }}</span>
          </div>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Module accounts explorers often show</div>
        <div class="mt-2 text-sm text-slate-300">
          <p>
            Cosmos SDK modules use internal module accounts (e.g. <code>fee_collector</code>, <code>distribution</code>, staking pools).
            The exact module account addresses are chain-specific.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Staking pool</div>
              <div class="text-sm text-slate-200">
                Bonded: <span class="font-mono">{{ stakingPool?.bonded_tokens ?? '' }}</span>
              </div>
              <div class="text-sm text-slate-200">
                Not bonded: <span class="font-mono">{{ stakingPool?.not_bonded_tokens ?? '' }}</span>
              </div>
              <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/staking/v1beta1/pool</code></div>
            </div>
            <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Fee collector</div>
              <p class="text-sm text-slate-300">Fees accumulate in the fee collector module account (address varies by chain).</p>
              <div class="text-[11px] text-slate-500 mt-2">
                Explorer strategy: show module account balances by resolving module addresses from chain config/genesis when available.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query auth account &lt;address&gt;
retrochaind query auth params
retrochaind query staking pool</code></pre>
    </div>
  </div>
</template>
