<script setup lang="ts">
import { computed } from "vue";

const iframeSrc = computed(() => {
  // Expect built Nomic app to be placed at /nomic-app/index.html (copied from thirdparty build output)
  return "/nomic-app/index.html";
});
</script>

<template>
  <div class="px-4 py-6 text-slate-200">
    <div class="glass-card border border-white/10 p-6">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p class="text-[11px] uppercase tracking-[0.35em] text-indigo-300">Nomic App Port</p>
          <h1 class="text-2xl font-semibold text-white">Nomic App on RetroChain</h1>
          <p class="mt-2 text-sm text-slate-300">
            This view hosts the Nomic app port. Build the upstream app (env <code class="font-mono">retro</code>) and copy the
            output to <code class="font-mono">public/nomic-app</code> so it loads below.
          </p>
        </div>
        <a href="https://github.com/nomic-io/nomic-app" target="_blank" rel="noreferrer" class="text-xs text-indigo-200 hover:text-white">Upstream Repo ?</a>
      </div>

      <div class="mt-4 text-xs text-slate-300 space-y-2">
        <div class="font-semibold text-slate-100">Build steps (once):</div>
        <ol class="list-decimal list-inside space-y-1">
          <li>Install deps: <code class="font-mono">cd thirdparty/nomic-app && npm install</code></li>
          <li>Build for RetroChain: <code class="font-mono">NEXT_PUBLIC_APP_ENV=retro npm run build</code></li>
          <li>Copy output (Nx default): <code class="font-mono">cp -r dist/apps/app ../../public/nomic-app</code></li>
        </ol>
        <p>Then reload this page; the embedded app will be served from <code class="font-mono">/nomic-app/index.html</code>.</p>
      </div>

      <div class="mt-6 rounded-2xl border border-white/10 bg-black/40 p-2">
        <iframe
          :src="iframeSrc"
          class="w-full h-[75vh] rounded-xl border border-white/5 bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer"
        >
        </iframe>
      </div>
    </div>
  </div>
</template>
