<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import { useNetwork } from "@/composables/useNetwork";

// swagger-ui-dist does not ship TS types
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SwaggerUI: any = require("swagger-ui-dist/swagger-ui-bundle");
import "swagger-ui-dist/swagger-ui.css";

const { restBase } = useNetwork();

const DOCS_REST_BASE = import.meta.env.VITE_DOCS_REST_BASE || "https://retrochain.ddns.net/api/";
const defaultSpecKey = "bank";

const loading = ref(true);
const error = ref<string | null>(null);
const selectedSpec = ref(defaultSpecKey);

// Hardcoded list of available specs based on public/api-docs contents
const availableSpecs = [
  { key: "auth", label: "Auth", file: "retrochain-auth.swagger.yaml" },
  { key: "bank", label: "Bank", file: "retrochain-bank.swagger.yaml" },
  { key: "circuit", label: "Circuit", file: "retrochain-circuit.swagger.yaml" },
  { key: "consensus", label: "Consensus", file: "retrochain-consensus.swagger.yaml" },
  { key: "distribution", label: "Distribution", file: "retrochain-distribution.swagger.yaml" },
  { key: "evidence", label: "Evidence", file: "retrochain-evidence.swagger.yaml" },
  { key: "governance", label: "Governance", file: "retrochain-gov.swagger.yaml" },
  { key: "group", label: "Group", file: "retrochain-group.swagger.yaml" },
  { key: "mint", label: "Mint", file: "retrochain-mint.swagger.yaml" },
  { key: "nft", label: "NFT", file: "retrochain-nft.swagger.yaml" },
  { key: "node", label: "Node", file: "retrochain-node.swagger.yaml" },
  { key: "params", label: "Params", file: "retrochain-params.swagger.yaml" },
  { key: "slashing", label: "Slashing", file: "retrochain-slashing.swagger.yaml" },
  { key: "staking", label: "Staking", file: "retrochain-staking.swagger.yaml" },
  { key: "tendermint", label: "Tendermint", file: "retrochain-tendermint.swagger.yaml" },
  { key: "tx", label: "Transactions", file: "retrochain-tx.swagger.yaml" },
  { key: "upgrade", label: "Upgrade", file: "retrochain-upgrade.swagger.yaml" },
];

const effectiveRestBase = computed(() => DOCS_REST_BASE || restBase.value || "/api");

// Use the app's base URL (works when deployed under a subpath) for swagger spec files
const baseHref = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const docsBase = `${baseHref}/api-docs`;

const swaggerUrls = availableSpecs.map((s) => ({
  name: s.label,
  key: s.key,
  // Keep URLs relative so $ref: definitions.yaml resolves correctly beside each spec
  url: `${docsBase}/${s.file}`,
}));

const initSwagger = (specKey: string = selectedSpec.value || defaultSpecKey) => {
  if (!SwaggerUI) throw new Error("Swagger UI not available");
  
  // Clear previous instance if any (though SwaggerUI usually replaces the dom node content)
  const domNode = document.getElementById("swagger-ui");
  if (domNode) domNode.innerHTML = "";

  const target = swaggerUrls.find((s) => s.key === specKey) || swaggerUrls.find((s) => s.key === defaultSpecKey) || swaggerUrls[0];

  SwaggerUI({
    dom_id: "#swagger-ui",
    urls: swaggerUrls,
    urlsPrimaryName: target?.name || undefined,
    url: target?.url,
    deepLinking: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    requestInterceptor: (req: any) => {
      // If the spec contains relative server URLs, browser will use origin.
      // Force requests to go through our /api proxy when possible.
      // This keeps same-origin in dev/prod and avoids CORS.
      try {
        if (typeof req?.url === "string" && req.url.startsWith("/")) {
          // Avoid double-prefixing if the spec already includes the base path (e.g. /api)
          if (!req.url.startsWith(effectiveRestBase.value)) {
            req.url = `${effectiveRestBase.value}${req.url}`;
          }
        }
      } catch {
        // ignore
      }
      return req;
    }
  });
};

onMounted(() => {
  loading.value = true;
  error.value = null;
  try {
    selectedSpec.value = defaultSpecKey;
    initSwagger(selectedSpec.value);
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
});

watch(
  () => selectedSpec.value,
  (next) => {
    loading.value = true;
    try {
      initSwagger(next);
    } catch (e: any) {
      error.value = e?.message || String(e);
    } finally {
      loading.value = false;
    }
  }
);
</script>

<template>
  <div class="space-y-4">
    <RcBackLink label="Back" :fallback-to="{ name: 'home' }" />

    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 card">
      <div>
        <h1 class="text-xl font-bold text-slate-50">API Docs (Swagger)</h1>
        <p class="text-sm text-slate-400 mt-1">
          Cosmos SDK REST API reference.
        </p>
      </div>
      
      <div class="flex items-center gap-2">
        <label for="spec" class="text-[11px] uppercase tracking-[0.2em] text-slate-400">Module</label>
        <select
          id="spec"
          v-model="selectedSpec"
          class="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-200 text-sm"
        >
          <option v-for="spec in availableSpecs" :key="spec.key" :value="spec.key">
            {{ spec.label }}
          </option>
        </select>
      </div>
    </div>

    <RcDisclaimer type="info" title="How this works">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>The swagger specs are served from <code class="text-xs">/api-docs/*.swagger.yaml</code>.</li>
        <li>
          "Try it out" requests are routed through <code class="text-xs">{{ effectiveRestBase }}</code> (default <code class="text-xs">https://retrochain.ddns.net/api/</code>).
        </li>
        <li>If your node doesn't expose swagger, this page still works because the specs are bundled with the explorer.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <div class="text-sm text-slate-300">Loading Swagger UI
</div>
    </div>

    <div v-if="error" class="card border-rose-500/50 bg-rose-500/5">
      <div class="text-sm text-rose-200">Failed to load Swagger UI: {{ error }}</div>
    </div>

    <div id="swagger-ui" class="swagger-host card" />
  </div>
</template>

<style scoped>
.swagger-host {
  padding: 0;
}

/* Make swagger match dark UI a bit better */
.swagger-host :deep(.swagger-ui) {
  filter: saturate(0.95);
}

.swagger-host :deep(.swagger-ui .topbar) {
  display: none;
}

.swagger-host :deep(.swagger-ui .info) {
  margin: 0;
}

.swagger-host :deep(.swagger-ui .scheme-container) {
  background: transparent;
  box-shadow: none;
}

.swagger-host :deep(.swagger-ui .opblock) {
  border-radius: 12px;
}
</style>
