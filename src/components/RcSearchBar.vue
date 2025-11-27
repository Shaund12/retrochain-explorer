<script setup lang="ts">
import { ref } from "vue";
import { useSearch } from "@/composables/useSearch";
import { useToast } from "@/composables/useToast";

const { search, loading, error } = useSearch();
const { notify } = useToast();

const query = ref("");
const showDropdown = ref(false);

const handleSearch = async () => {
  if (!query.value.trim()) {
    notify("Please enter a search query");
    return;
  }
  
  showDropdown.value = false;
  await search(query.value);
  
  if (error.value) {
    notify(error.value);
  }
};

const handleFocus = () => {
  showDropdown.value = true;
};

const handleBlur = () => {
  // Delay to allow click events on dropdown
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
};

const quickSearches = [
  { label: "Latest Block", query: "latest" },
  { label: "Block #1", query: "1" },
  { label: "Recent Transactions", query: "txs" }
];

const selectQuickSearch = (q: string) => {
  query.value = q;
  handleSearch();
};
</script>

<template>
  <div class="relative w-full max-w-2xl">
    <div class="relative">
      <input
        v-model="query"
        type="text"
        placeholder="Search by block height, tx hash, or address..."
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

    <!-- Quick search dropdown -->
    <div
      v-if="showDropdown && query.length === 0"
      class="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden"
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
      </div>
      <div class="border-t border-slate-800 p-3 text-xs text-slate-400">
        <div class="font-semibold mb-1">Search by:</div>
        <ul class="space-y-0.5 list-disc list-inside">
          <li>Block height (e.g., <code class="text-emerald-400">123</code>)</li>
          <li>Transaction hash (64-char hex)</li>
          <li>Address (retro... or retrovaloper...)</li>
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
