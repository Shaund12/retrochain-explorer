import { computed } from "vue";
import { useChain } from "@cosmos-kit/vue";

const CHAIN_ID = import.meta.env.VITE_CHAIN_ID || "retrochain-mainnet";

export function useWalletKit() {
  const chain = useChain(CHAIN_ID as string);

  const address = computed(() => (chain?.address as string | undefined) ?? null);
  const walletName = computed(() => chain?.wallet?.prettyName ?? chain?.wallet?.walletName ?? null);
  const status = computed(() => chain?.status);
  const isConnected = computed(() => !!chain?.isWalletConnected);

  const connect = async () => {
    await chain?.connect?.();
  };

  const disconnect = async () => {
    await chain?.disconnect?.();
  };

  return {
    address,
    walletName,
    status,
    isConnected,
    connect,
    disconnect,
    openView: chain?.openView,
    chain
  };
}
