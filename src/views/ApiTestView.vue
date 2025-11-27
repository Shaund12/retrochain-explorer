<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "@/composables/useApi";

const api = useApi();
const testResults = ref<any>({});
const testing = ref(false);

const testEndpoint = async (name: string, url: string) => {
  try {
    const res = await api.get(url);
    testResults.value[name] = {
      status: "? Success",
      data: res.data,
      error: null
    };
  } catch (e: any) {
    testResults.value[name] = {
      status: "? Failed",
      data: null,
      error: e?.response?.data || e?.message || String(e)
    };
  }
};

const runTests = async () => {
  testing.value = true;
  testResults.value = {};
  
  await testEndpoint("Node Info", "/cosmos/base/tendermint/v1beta1/node_info");
  await testEndpoint("Latest Block", "/cosmos/base/tendermint/v1beta1/blocks/latest");
  await testEndpoint("Validators", "/cosmos/staking/v1beta1/validators?status=BOND_STATUS_BONDED");
  await testEndpoint("Governance", "/cosmos/gov/v1beta1/proposals");
  await testEndpoint("Transactions", "/cosmos/tx/v1beta1/txs?pagination.limit=5");
  
  testing.value = false;
};

onMounted(() => {
  runTests();
});
</script>

<template>
  <div class="space-y-4">
    <div class="card">
      <h1 class="text-xl font-bold text-slate-50 mb-2">API Endpoint Test</h1>
      <p class="text-sm text-slate-400 mb-4">
        Testing all Cosmos SDK REST API endpoints
      </p>
      <button class="btn btn-primary text-sm" @click="runTests" :disabled="testing">
        {{ testing ? "Testing..." : "Run Tests Again" }}
      </button>
    </div>

    <div v-if="testing" class="card">
      <p class="text-sm text-slate-400">Running tests...</p>
    </div>

    <div v-for="(result, name) in testResults" :key="name" class="card">
      <div class="flex items-start justify-between mb-2">
        <h2 class="text-sm font-semibold text-slate-100">{{ name }}</h2>
        <span 
          class="text-xs"
          :class="result.status.includes('Success') ? 'text-emerald-400' : 'text-rose-400'"
        >
          {{ result.status }}
        </span>
      </div>
      
      <div v-if="result.error" class="text-xs text-rose-300 mb-2">
        <strong>Error:</strong> {{ JSON.stringify(result.error, null, 2) }}
      </div>
      
      <div v-if="result.data" class="text-xs">
        <details>
          <summary class="cursor-pointer text-cyan-400 hover:text-cyan-300">
            View Response Data
          </summary>
          <pre class="mt-2 p-2 rounded bg-slate-900/80 overflow-x-auto max-h-96 text-[10px]">{{ JSON.stringify(result.data, null, 2) }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>
