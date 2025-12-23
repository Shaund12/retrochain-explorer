<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import { useNetwork } from "@/composables/useNetwork";

import SwaggerUI from "swagger-ui-dist/swagger-ui-bundle";
import "swagger-ui-dist/swagger-ui.css";

const { restBase } = useNetwork();

const loading = ref(true);
const error = ref<string | null>(null);
const selectedSpec = ref("");

// Hardcoded list of available specs based on public/api-docs contents
const availableSpecs = [
  { label: "Auth", file: "retrochain-auth.swagger.yaml" },
  { label: "Bank", file: "retrochain-bank.swagger.yaml" },
  { label: "Circuit", file: "retrochain-circuit.swagger.yaml" },
  { label: "Consensus", file: "retrochain-consensus.swagger.yaml" },
  { label: "Distribution", file: "retrochain-distribution.swagger.yaml" },
  { label: "Evidence", file: "retrochain-evidence.swagger.yaml" },
  { label: "Governance", file: "retrochain-gov.swagger.yaml" },
  { label: "Group", file: "retrochain-group.swagger.yaml" },
  { label: "Mint", file: "retrochain-mint.swagger.yaml" },
  { label: "NFT", file: "retrochain-nft.swagger.yaml" },
  { label: "Node", file: "retrochain-node.swagger.yaml" },
  { label: "Params", file: "retrochain-params.swagger.yaml" },
  { label: "Slashing", file: "retrochain-slashing.swagger.yaml" },
  { label: "Staking", file: "retrochain-staking.swagger.yaml" },
  { label: "Tendermint", file: "retrochain-tendermint.swagger.yaml" },
  { label: "Transactions", file: "retrochain-tx.swagger.yaml" },
  { label: "Upgrade", file: "retrochain-upgrade.swagger.yaml" },
];

const effectiveRestBase = computed(() => restBase.value || "/api");

const swaggerUrls = availableSpecs.map((s) => ({
  name: s.label,
  url: `/api-docs/${s.file}`,
}));

const defaultSpec = "Bank";

const initSwagger = () => {
  if (!SwaggerUI) throw new Error("Swagger UI not available");
  
  // Clear previous instance if any (though SwaggerUI usually replaces the dom node content)
  const domNode = document.getElementById("swagger-ui");
  if (domNode) domNode.innerHTML = "";

  SwaggerUI({
    dom_id: "#swagger-ui",
    urls: swaggerUrls,
    urlsPrimaryName: defaultSpec,
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
    initSwagger();
    selectedSpec.value = defaultSpec;
  } catch (e: any) {
    error.value = e?.message || String(e);
  } finally {
    loading.value = false;
  }
});
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
      
      <div class="text-sm text-slate-400">
        Use the Swagger UI selector (top-right inside the docs) to switch modules.
      </div>
    </div>

    <RcDisclaimer type="info" title="How this works">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>The swagger specs are served from <code class="text-xs">/api-docs/*.swagger.yaml</code>.</li>
        <li>
          "Try it out" requests are routed through <code class="text-xs">{{ effectiveRestBase }}</code> so dev/prod stay same-origin.
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
