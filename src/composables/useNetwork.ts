import { ref, computed } from "vue";

type Network = "mainnet";

function resolveInitialNetwork(): Network {
  return "mainnet";
}

function deriveWebsocketUrl(httpUrl?: string | null) {
  if (!httpUrl) return undefined;
  const trimmed = httpUrl.trim();
  if (!trimmed) return undefined;

  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return undefined;
  }

  const normalized = trimmed.replace(/^http/i, "ws").replace(/\/+$/, "");
  return `${normalized}/websocket`;
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

  const rpcWsBase = computed(() => {
    return (
      import.meta.env.VITE_RPC_WS_URL_MAINNET ||
      import.meta.env.VITE_RPC_WS_URL ||
      deriveWebsocketUrl(rpcBase.value)
    );
  });

  return { current, setNetwork, restBase, rpcBase, rpcWsBase };
}
