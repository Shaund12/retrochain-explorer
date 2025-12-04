import { ref, computed } from 'vue';

// Maintenance mode configuration from environment variables
const MAINTENANCE_MODE = ref(import.meta.env.VITE_MAINTENANCE_MODE === 'true');
const MAINTENANCE_MESSAGE = ref(import.meta.env.VITE_MAINTENANCE_MESSAGE || '?? System Upgrade in Progress');
const MAINTENANCE_DETAILS = ref(import.meta.env.VITE_MAINTENANCE_DETAILS || 'RetroChain is currently undergoing scheduled maintenance. We\'ll be back online shortly!');
const MAINTENANCE_ETA = ref(import.meta.env.VITE_MAINTENANCE_ETA || 'Expected completion: ~30 minutes');

export function useMaintenance() {
  const isMaintenanceMode = computed(() => MAINTENANCE_MODE.value);
  const message = computed(() => MAINTENANCE_MESSAGE.value);
  const details = computed(() => MAINTENANCE_DETAILS.value);
  const eta = computed(() => MAINTENANCE_ETA.value);

  const enableMaintenance = (msg?: string, detailsText?: string, etaText?: string) => {
    MAINTENANCE_MODE.value = true;
    if (msg) MAINTENANCE_MESSAGE.value = msg;
    if (detailsText) MAINTENANCE_DETAILS.value = detailsText;
    if (etaText) MAINTENANCE_ETA.value = etaText;
  };

  const disableMaintenance = () => {
    MAINTENANCE_MODE.value = false;
  };

  return {
    isMaintenanceMode,
    message,
    details,
    eta,
    enableMaintenance,
    disableMaintenance
  };
}

