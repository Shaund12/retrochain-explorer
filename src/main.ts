import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "vue-sonner/style.css";

// Enable dayjs relative time plugin globally
dayjs.extend(relativeTime);

const app = createApp(App);
app.use(router);

app.mount("#app");
