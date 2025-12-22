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
const baseTxConfig = ref<Record<string, any> | null>(null);

const load = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [latest, authRes, baseTxRes] = await Promise.all([
      api.get("/cosmos/base/tendermint/v1beta1/blocks/latest").catch(() => null),
      api.get("/cosmos/auth/v1beta1/params").catch(() => null),
      api.get("/cosmos/tx/v1beta1/config").catch(() => null)
    ]);

    height.value = latest?.data?.block?.header?.height ?? null;
    authParams.value = authRes?.data?.params ?? null;
    baseTxConfig.value = baseTxRes?.data?.config ?? null;
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
      <h1 class="text-xl font-bold text-slate-50">Fees & Gas</h1>
      <p class="text-sm text-slate-400 mt-1">
        How transaction fees work on RetroChain, why minimum gas prices vary by RPC provider, and explorer best practices.
      </p>
      <div v-if="height" class="mt-3 text-[11px] text-slate-500">
        Data as of height <span class="font-mono text-slate-300">{{ height }}</span>
      </div>
    </div>

    <div v-if="loading" class="card">
      <RcLoadingSpinner size="md" text="Loading fees & gas docs…" />
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load fees & gas docs: {{ error }}</div>
    </div>

    <RcDisclaimer type="info" title="Key idea">
      <p class="text-sm text-slate-300">
        On Cosmos SDK chains, a transaction fee is typically <code>gas_used × gas_price</code> (denominated in <code>uretro</code>).
        The chain does not enforce a universal gas price—nodes can reject transactions below their configured
        <code>minimum-gas-prices</code>.
      </p>
    </RcDisclaimer>

    <div v-if="!loading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Fee basics</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <p>
            When you submit a transaction, you provide:
            <strong>gas limit</strong> and <strong>fee</strong> (or gas price).
          </p>
          <ul class="list-disc list-inside space-y-1">
            <li><strong>Gas</strong> is a unit of computation.</li>
            <li><strong>Fee</strong> is paid in <code>uretro</code> and can be burned/redistributed depending on enabled modules.</li>
            <li><strong>Out of gas</strong> occurs when gas wanted is too low; tx fails but fees may still be charged.</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="text-xs uppercase tracking-wider text-slate-400">Minimum gas prices</div>
        <div class="mt-2 space-y-2 text-sm text-slate-300">
          <p>
            <code>minimum-gas-prices</code> is a node operator setting (in <code>app.toml</code>), not a consensus param.
            Different API providers may require different minimums.
          </p>
          <p class="text-xs text-slate-500">
            Explorer UX recommendation: show “fees depend on RPC” and provide a conservative default gas price tier.
          </p>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Live chain config (best-effort)</div>
        <div class="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Auth params</div>
            <div>Max memo chars: <span class="font-mono text-slate-200">{{ authParams?.max_memo_characters ?? '—' }}</span></div>
            <div>Tx sig limit: <span class="font-mono text-slate-200">{{ authParams?.tx_sig_limit ?? '—' }}</span></div>
            <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/auth/v1beta1/params</code></div>
          </div>
          <div class="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
            <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">Tx config</div>
            <div>Enabled sign modes: <span class="font-mono text-slate-200">{{ baseTxConfig?.enabled_sign_modes?.length ?? '—' }}</span></div>
            <div class="text-[11px] text-slate-500 mt-2">REST: <code>/cosmos/tx/v1beta1/config</code></div>
          </div>
        </div>
      </div>

      <div class="card md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-400">Explorer implementation notes</div>
        <ul class="list-disc list-inside text-sm text-slate-300 space-y-1 mt-2">
          <li>Parse tx results for <code>gas_wanted</code> and <code>gas_used</code>.</li>
          <li>Display fee amounts using denom metadata (6 decimals for RETRO).</li>
          <li>Show “effective fee” = fee / gas_used (when gas_used is non-zero).</li>
          <li>Make it clear when fees are estimated vs paid (simulations can differ from execution).</li>
        </ul>
      </div>
    </div>

    <div v-if="!loading" class="card">
      <h2 class="text-sm font-semibold text-slate-100 mb-2">How to verify (CLI)</h2>
      <pre class="text-[11px] bg-slate-950/60 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-200"><code>retrochaind query auth params
retrochaind query tx config
retrochaind tx bank send ... --gas auto --gas-adjustment 1.3 --fees 5000uretro</code></pre>
    </div>
  </div>
</template>
