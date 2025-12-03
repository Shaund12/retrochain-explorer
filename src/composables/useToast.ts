// src/composables/useToast.ts
import { useToast as useVueToast } from "vue-toastification";

export type ToastType = "success" | "error" | "warning" | "info";

export function useToast() {
  const toast = useVueToast();

  const showSuccess = (message: string, title?: string) => {
    toast.success(title ? `${title}: ${message}` : message, {
      timeout: 5000,
      closeOnClick: true,
      pauseOnFocusLoss: true,
      pauseOnHover: true,
      draggable: true,
      draggablePercent: 0.6,
      showCloseButtonOnHover: false,
      hideProgressBar: false,
      icon: "?",
    });
  };

  const showError = (message: string, title?: string) => {
    toast.error(title ? `${title}: ${message}` : message, {
      timeout: 7000,
      closeOnClick: true,
      pauseOnFocusLoss: true,
      pauseOnHover: true,
      draggable: true,
      icon: "?",
    });
  };

  const showWarning = (message: string, title?: string) => {
    toast.warning(title ? `${title}: ${message}` : message, {
      timeout: 6000,
      closeOnClick: true,
      pauseOnFocusLoss: true,
      pauseOnHover: true,
      draggable: true,
      icon: "??",
    });
  };

  const showInfo = (message: string, title?: string) => {
    toast.info(title ? `${title}: ${message}` : message, {
      timeout: 5000,
      closeOnClick: true,
      pauseOnFocusLoss: true,
      pauseOnHover: true,
      draggable: true,
      icon: "??",
    });
  };

  const showTxSuccess = (txHash: string) => {
    showSuccess(`Transaction successful! Hash: ${txHash.slice(0, 10)}...`, "Success");
  };

  const showTxError = (error: string) => {
    showError(error, "Transaction Failed");
  };

  const showConnecting = () => {
    showInfo("Opening Keplr wallet...", "Connecting");
  };

  const showConnected = (address: string) => {
    showSuccess(`Connected: ${address.slice(0, 10)}...${address.slice(-6)}`, "Wallet Connected");
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

