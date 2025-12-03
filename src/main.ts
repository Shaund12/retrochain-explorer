import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

// Enable dayjs relative time plugin globally
dayjs.extend(relativeTime);

const app = createApp(App);
app.use(router);

// Toast configuration with dark theme
app.use(Toast, {
  transition: "Vue-Toastification__bounce",
  maxToasts: 5,
  newestOnTop: true,
  position: "top-right",
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: "button",
  icon: true,
  rtl: false,
  toastClassName: "custom-toast",
  bodyClassName: ["custom-toast-body"],
});

app.mount("#app");
