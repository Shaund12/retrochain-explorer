import { ref, onMounted, onUnmounted } from "vue";

export function useAutoRefresh(callback: () => void | Promise<void>, intervalMs: number = 5000) {
  const enabled = ref(true);
  const countdown = ref(intervalMs / 1000);
  let intervalId: number | null = null;
  let countdownId: number | null = null;

  const toggle = () => {
    enabled.value = !enabled.value;
    if (enabled.value) {
      start();
    } else {
      stop();
    }
  };

  const start = () => {
    if (intervalId) return;
    
    callback();
    countdown.value = intervalMs / 1000;
    
    intervalId = window.setInterval(() => {
      if (enabled.value) {
        callback();
        countdown.value = intervalMs / 1000;
      }
    }, intervalMs);

    countdownId = window.setInterval(() => {
      if (enabled.value && countdown.value > 0) {
        countdown.value -= 1;
      }
    }, 1000);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (countdownId) {
      clearInterval(countdownId);
      countdownId = null;
    }
  };

  onMounted(() => {
    if (enabled.value) {
      start();
    }
  });

  onUnmounted(() => {
    stop();
  });

  return {
    enabled,
    countdown,
    toggle,
    start,
    stop
  };
}
