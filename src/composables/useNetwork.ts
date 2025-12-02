import { ref, computed } from "vue";

type Network = "testnet" | "mainnet";

function resolveInitialNetwork(): Network {
  try {
    const saved = (typeof window !== "undefined"
      ? (localStorage.getItem("rc.network") as Network | null)
      : null) as Network | null;
    if (saved === "mainnet" || saved === "testnet") return saved;
  } catch {}
  const envDefault = (import.meta.env.VITE_DEFAULT_NETWORK as string | undefined)?.toLowerCase();
  return envDefault === "mainnet" ? "mainnet" : "testnet";
}

const current = ref<Network>(resolveInitialNetwork());

export function useNetwork() {
  const setNetwork = (net: Network) => {
    current.value = net;
    try { localStorage.setItem("rc.network", net); } catch {}
  };

  const restBase = computed(() => {
    if (current.value === "mainnet") {
      return import.meta.env.VITE_REST_API_URL_MAINNET || import.meta.env.VITE_REST_API_URL || "/api";
    }
    return import.meta.env.VITE_REST_API_URL_TESTNET || import.meta.env.VITE_REST_API_URL || "/api";
  });

  const rpcBase = computed(() => {
    if (current.value === "mainnet") {
      return import.meta.env.VITE_RPC_URL_MAINNET || import.meta.env.VITE_RPC_URL || "/rpc";
    }
    return import.meta.env.VITE_RPC_URL_TESTNET || import.meta.env.VITE_RPC_URL || "/rpc";
  });

  return { current, setNetwork, restBase, rpcBase };
}
