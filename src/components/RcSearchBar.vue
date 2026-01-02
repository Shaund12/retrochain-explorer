<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSearch } from "@/composables/useSearch";
import { useToast } from "@/composables/useToast";

const { search, searchAll, results, suggestions, loading, error, loadSuggestions } = useSearch();
const { notify } = useToast();
const router = useRouter();
const route = useRoute();

const query = ref("");
const showDropdown = ref(false);
const showResults = ref(false);

const handleSearch = async () => {
  if (!query.value.trim()) {
    notify("Please enter a search query");
    return;
  }

  showDropdown.value = false;
  showResults.value = false;
  router.replace({ query: { ...route.query, q: query.value } });
  await search(query.value);

  if (error.value) {
    notify(error.value);
  } else if (results.value.length > 1) {
    // Show multi-result dropdown
    showResults.value = true;
  }
};

const handleFocus = () => {
  if (!query.value.trim()) {
    loadSuggestions();
    showDropdown.value = true;
  }
};

const handleBlur = () => {
  // Delay to allow click events on dropdown
  setTimeout(() => {
    showDropdown.value = false;
    showResults.value = false;
  }, 200);
};

const selectResult = (result: any) => {
  router.push(result.route);
  showResults.value = false;
  query.value = "";
};

const selectSuggestion = (suggestion: any) => {
  query.value = suggestion.query;
  handleSearch();
};

const quickSearches = [
  { label: "Latest Block", query: "latest" },
  { label: "Block #1", query: "1" },
  { label: "Recent Transactions", query: "txs" }
];

const selectQuickSearch = (q: string) => {
  const lowered = q.toLowerCase();
  // Direct navigation for known shortcuts
  if (lowered === "latest") {
    router.push({ name: "blocks" });
    return;
  }
  if (lowered === "txs" || lowered === "transactions") {
    router.push({ name: "txs" });
    return;
  }
  if (lowered === "validators") {
    router.push({ name: "validators" });
    return;
  }
  if (lowered === "tokens") {
    router.push({ name: "tokens" });
    return;
  }

  query.value = q;
  handleSearch();
};

watch(query, (newVal) => {
  if (!newVal.trim()) {
    results.value = [];
    showResults.value = false;
  }
});

onMounted(() => {
  const initial = route.query.q as string | undefined;
  if (initial) {
    query.value = String(initial);
    handleSearch();
  }
  loadSuggestions();
});
</script>

<template>
  <div class="relative w-full max-w-2xl z-30">
    <div class="relative">
      <input
        v-model="query"
        type="text"
        placeholder="Search blocks, txs, addresses, contracts, tokens..."
        class="search-input"
        :disabled="loading"
        @keyup.enter="handleSearch"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <button
        class="search-button"
        :disabled="loading"
        @click="handleSearch"
      >
        <span v-if="loading">...</span>
        <span v-else>Search</span>
      </button>
    </div>

    <!-- Multi-entity results dropdown -->
    <div
      v-if="showResults && results.length > 0"
      class="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-emerald-500/40 rounded-xl shadow-2xl z-50 overflow-hidden"
      style="z-index: 60;"
    >
      <div class="p-2">
        <div class="text-xs text-emerald-300 px-2 py-1 uppercase tracking-wider font-semibold flex items-center gap-2">
          <span>??</span>
          <span>{{ results.length }} Result{{ results.length > 1 ? 's' : '' }} Found</span>
        </div>
        <button
          v-for="result in results"
          :key="`${result.type}-${result.value}`"
          class="w-full text-left px-3 py-3 text-sm rounded-lg hover:bg-emerald-500/10 transition-colors border border-transparent hover:border-emerald-500/30"
          @click="selectResult(result)"
        >
          <div class="flex items-start gap-3">
            <div class="text-2xl">{{ result.icon }}</div>
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-white truncate">{{ result.label }}</div>
              <div class="text-xs text-slate-400 mt-0.5">{{ result.description }}</div>
              <div class="text-[10px] text-emerald-300 mt-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 inline-block">
                {{ result.type.toUpperCase() }}
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>

    <!-- Quick search dropdown -->
    <div
      v-if="showDropdown && query.length === 0"
      class="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
      style="z-index: 60;"
    >
      <div class="p-2">
        <div class="text-xs text-slate-400 px-2 py-1 uppercase tracking-wider">
          Quick Search
        </div>
        <button
          v-for="item in quickSearches"
          :key="item.label"
          class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-800 transition-colors text-slate-200"
          @click="selectQuickSearch(item.query)"
        >
          {{ item.label }}
        </button>

        <div v-if="suggestions.length > 0" class="mt-2 border-t border-slate-800 pt-2">
          <div class="text-xs text-slate-400 px-2 py-1 uppercase tracking-wider">
            Recent Searches
          </div>
          <button
            v-for="suggestion in suggestions.filter(s => s.type === 'recent')"
            :key="suggestion.query"
            class="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-800 transition-colors text-slate-200 flex items-center gap-2"
            @click="selectSuggestion(suggestion)"
          >
            <span>{{ suggestion.icon }}</span>
            <span class="truncate">{{ suggestion.label }}</span>
          </button>
        </div>
      </div>
      <div class="border-t border-slate-800 p-3 text-xs text-slate-400">
        <div class="font-semibold mb-1">Search by:</div>
        <ul class="space-y-0.5 list-disc list-inside">
          <li>Block height (e.g., <code class="text-emerald-400">123</code>)</li>
          <li>Transaction hash (64-char hex)</li>
          <li>Address (retro... or cosmos...)</li>
          <li>Contract (verified smart contracts)</li>
          <li>Token (ibc/, factory/, or native denoms)</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-input {
  width: 100%;
  padding: 0.75rem 3.5rem 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 9999px;
  color: #e2e8f0;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.search-input:focus {
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.search-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-input::placeholder {
  color: #64748b;
}

.search-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  border: none;
  border-radius: 9999px;
  cursor: pointer;
  transition: transform 150ms ease, opacity 150ms ease;
  font-size: 1.125rem;
}

.search-button:hover:not(:disabled) {
  transform: translateY(-50%) scale(1.05);
}

.search-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
