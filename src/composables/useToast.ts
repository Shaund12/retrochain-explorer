// src/composables/useToast.ts
import { toast } from "vue-sonner";

// vue-sonner expects `icon` to be a VNode/Component in some versions.
// Passing a plain string like "?" can be treated as a tag name (invalid), causing createElement errors.
const iconVNode = (emoji: string) => () => emoji;

export type ToastType = "success" | "error" | "warning" | "info";

const defaultOpts = {
  position: "top-right" as const,
  closeButton: true,
  richColors: true,
};

export function useToast() {
  const showSuccess = (message: string, title?: string) => {
    toast.success(title || "Success", {
      description: message,
      icon: iconVNode("?"),
      ...defaultOpts,
    });
  };

  const showError = (message: string, title?: string) => {
    toast.error(title || "Error", {
      description: message,
      icon: iconVNode("?"),
      ...defaultOpts,
      duration: 7000,
    });
  };

  const showWarning = (message: string, title?: string) => {
    toast(title || "Heads up", {
      description: message,
      icon: iconVNode("??"),
      ...defaultOpts,
      duration: 6500,
      class: "rc-toast-warning",
    });
  };

  const showInfo = (message: string, title?: string) => {
    toast.info(title || "Notice", {
      description: message,
      icon: iconVNode("??"),
      ...defaultOpts,
    });
  };

  const showTxSuccess = (txHash: string) => {
    const short = txHash ? `${txHash.slice(0, 10)}...` : "Transaction";
    showSuccess(`Transaction successful! Hash: ${short}`, "Success");
  };

  const showTxError = (error: string) => {
    showError(error || "Transaction failed", "Transaction Failed");
  };

  const showConnecting = () => {
    toast.loading("Opening Keplr wallet...", {
      description: "Awaiting wallet approval",
      icon: iconVNode("??"),
      ...defaultOpts,
      duration: 3000,
    });
  };

  const showConnected = (address: string) => {
    const short = address ? `${address.slice(0, 10)}...${address.slice(-6)}` : "Wallet";
    showSuccess(`Connected: ${short}`, "Wallet Connected");
  };

  const notify = (message: string) => {
    showInfo(message);
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showTxSuccess,
    showTxError,
    showConnecting,
    showConnected,
    notify,
  };
}

