import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";

// Enable dayjs relative time plugin globally
dayjs.extend(relativeTime);

const app = createApp(App);
app.use(router);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

app.use(VueQueryPlugin, { queryClient });

app.mount("#app");
