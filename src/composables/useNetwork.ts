import { ref, computed } from "vue";

type Network = "mainnet";

function resolveInitialNetwork(): Network {
  return "mainnet";
}

const current = ref<Network>(resolveInitialNetwork());

export function useNetwork() {
  const setNetwork = (net: Network) => {
    current.value = net;
  };

  const restBase = computed(() => {
    return import.meta.env.VITE_REST_API_URL_MAINNET || import.meta.env.VITE_REST_API_URL || "/api";
  });

  const rpcBase = computed(() => {
    return import.meta.env.VITE_RPC_URL_MAINNET || import.meta.env.VITE_RPC_URL || "/rpc";
  });

  return { current, setNetwork, restBase, rpcBase };
}
