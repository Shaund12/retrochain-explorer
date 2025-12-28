// src/composables/useToast.ts
import { toast } from "vue-sonner";
import { h } from "vue";

// vue-sonner expects `icon` to be a VNode/Component in some versions.
// Return a real VNode to prevent emoji strings being treated as invalid tag names.
const iconVNode = (emoji: string) => () => h("span", { class: "rc-toast-icon" }, emoji);

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
      icon: iconVNode("✅"),
      ...defaultOpts,
    });
  };

  const showError = (message: string, title?: string) => {
    toast.error(title || "Error", {
      description: message,
      icon: iconVNode("⛔"),
      ...defaultOpts,
      duration: 7000,
    });
  };

  const showWarning = (message: string, title?: string) => {
    toast(title || "Heads up", {
      description: message,
      icon: iconVNode("⚠️"),
      ...defaultOpts,
      duration: 6500,
      class: "rc-toast-warning",
    });
  };

  const showInfo = (message: string, title?: string) => {
    toast.info(title || "Notice", {
      description: message,
      icon: iconVNode("ℹ️"),
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
      icon: iconVNode("🔌"),
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

  const copyToClipboard = async (text: string, label = "Copied") => {
    try {
      await navigator.clipboard?.writeText?.(text);
      showSuccess(label, "Copied");
      return true;
    } catch {
      showError("Unable to copy to clipboard", "Copy failed");
      return false;
    }
  };

  const shareLink = async (url?: string, label = "Link copied") => {
    const link = url || (typeof window !== "undefined" ? window.location.href : "");
    if (!link) return false;
    return copyToClipboard(link, label);
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
    copyToClipboard,
    shareLink,
  };
}

