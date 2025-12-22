<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RcDisclaimer from "@/components/RcDisclaimer.vue";
import RcBackLink from "@/components/RcBackLink.vue";
import { useNetwork } from "@/composables/useNetwork";

const { restBase } = useNetwork();

const swaggerCssUrl = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
const swaggerJsUrl = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";

const loading = ref(true);
const error = ref<string | null>(null);

const specUrl = computed(() => {
  // Serve the spec from our own origin so it works in prod and dev.
  return "/swagger/cosmos-sdk-swagger.yaml";
});

const effectiveRestBase = computed(() => restBase.value || "/api");

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-swagger='${src}']`) as HTMLScriptElement | null;
    if (existing) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.swagger = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });

const loadCss = (href: string) => {
  const existing = document.querySelector(`link[data-swagger='${href}']`) as HTMLLinkElement | null;
  if (existing) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  l.dataset.swagger = href;
  document.head.appendChild(l);
};

const initSwagger = () => {
  const w = window as any;
  const SwaggerUIBundle = w.SwaggerUIBundle;
  if (!SwaggerUIBundle) throw new Error("Swagger UI not available");

  SwaggerUIBundle({
    dom_id: "#swagger-ui",
    url: specUrl.value,
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
          req.url = `${effectiveRestBase.value}${req.url}`;
        }
      } catch {
        // ignore
      }
      return req;
    }
  });
};

onMounted(async () => {
  try {
    loadCss(swaggerCssUrl);
    await loadScript(swaggerJsUrl);
    initSwagger();
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

    <div class="card">
      <h1 class="text-xl font-bold text-slate-50">API Docs (Swagger)</h1>
      <p class="text-sm text-slate-400 mt-1">
        Cosmos SDK REST API reference powered by Swagger UI.
      </p>
    </div>

    <RcDisclaimer type="info" title="How this works">
      <ul class="text-sm text-slate-300 list-disc list-inside space-y-1">
        <li>The swagger spec is served from <code class="text-xs">{{ specUrl }}</code>.</li>
        <li>
          "Try it out" requests are routed through <code class="text-xs">{{ effectiveRestBase }}</code> so dev/prod stay same-origin.
        </li>
        <li>If your node doesn't expose swagger, this page still works because the spec is bundled with the explorer.</li>
      </ul>
    </RcDisclaimer>

    <div v-if="loading" class="card">
      <div class="text-sm text-slate-300">Loading Swagger UI…</div>
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
