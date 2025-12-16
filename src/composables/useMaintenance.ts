import { ref, computed } from 'vue';

const parseFeatures = (raw?: string): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0);
};

// Maintenance mode configuration from environment variables
const MAINTENANCE_MODE = ref(import.meta.env.VITE_MAINTENANCE_MODE === 'true');
const MAINTENANCE_MESSAGE = ref(import.meta.env.VITE_MAINTENANCE_MESSAGE || '?? System Upgrade in Progress');
const MAINTENANCE_DETAILS = ref(import.meta.env.VITE_MAINTENANCE_DETAILS || 'RetroChain is currently undergoing scheduled maintenance. We\'ll be back online shortly!');
const MAINTENANCE_ETA = ref(import.meta.env.VITE_MAINTENANCE_ETA || 'Expected completion: ~30 minutes');
const MAINTENANCE_FEATURES = ref<string[]>(parseFeatures(import.meta.env.VITE_MAINTENANCE_FEATURES));

export function useMaintenance() {
  const isMaintenanceMode = computed(() => MAINTENANCE_MODE.value);
  const message = computed(() => MAINTENANCE_MESSAGE.value);
  const details = computed(() => MAINTENANCE_DETAILS.value);
  const eta = computed(() => MAINTENANCE_ETA.value);

  const features = computed(() => MAINTENANCE_FEATURES.value);

  const enableMaintenance = (msg?: string, detailsText?: string, etaText?: string, featureList?: string[]) => {
    MAINTENANCE_MODE.value = true;
    if (msg) MAINTENANCE_MESSAGE.value = msg;
    if (detailsText) MAINTENANCE_DETAILS.value = detailsText;
    if (etaText) MAINTENANCE_ETA.value = etaText;
    if (featureList) {
      MAINTENANCE_FEATURES.value = featureList.filter((feature) => feature.trim().length > 0);
    }
  };

  const disableMaintenance = () => {
    MAINTENANCE_MODE.value = false;
  };

  return {
    isMaintenanceMode,
    message,
    details,
    eta,
    features,
    enableMaintenance,
    disableMaintenance
  };
}

