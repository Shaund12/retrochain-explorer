import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import { MotionPlugin } from "@vueuse/motion";

// Enable dayjs relative time plugin globally
dayjs.extend(relativeTime);

const origin = typeof window !== "undefined" ? window.location.origin : "";
const chainId = import.meta.env.VITE_CHAIN_ID || "retrochain-mainnet";
const chainName = import.meta.env.VITE_CHAIN_NAME || "RetroChain Mainnet";

const resolveEndpoint = (value: string | undefined | null, fallbackPath: string) => {
  const candidate = value || fallbackPath;
  if (!candidate) return fallbackPath;
  if (candidate.startsWith("http")) return candidate;
  if (!origin) return candidate;
  return `${origin}${candidate.startsWith("/") ? "" : "/"}${candidate}`;
};

const restEndpoint = resolveEndpoint(
  import.meta.env.VITE_REST_API_URL_MAINNET || import.meta.env.VITE_REST_API_URL,
  "/api"
);
const rpcEndpoint = resolveEndpoint(
  import.meta.env.VITE_RPC_URL_MAINNET || import.meta.env.VITE_RPC_URL,
  "/rpc"
);

const retroChain = {
  chain_id: chainId,
  chain_name: chainName,
  apis: {
    rest: [{ address: restEndpoint }],
    rpc: [{ address: rpcEndpoint }]
  },
  bech32_prefix: "cosmos",
  slip44: 118,
  fees: {
    fee_tokens: [
      {
        denom: "uretro",
        fixed_min_gas_price: 0.03,
        low_gas_price: 0.03,
        average_gas_price: 0.035,
        high_gas_price: 0.04
      }
    ]
  }
} as any;

const retroAssets = {
  chain_name: chainName,
  assets: [
    {
      base: "uretro",
      name: "Retro",
      symbol: "RETRO",
      display: "retro",
      denom_units: [
        { denom: "uretro", exponent: 0 },
        { denom: "retro", exponent: 6 }
      ],
      logo_URIs: {},
      description: "RetroChain native token"
    },
    {
      base: "stwbtc",
      name: "stWBTC",
      symbol: "stWBTC",
      display: "stwbtc",
      denom_units: [
        { denom: "stwbtc", exponent: 0 },
        { denom: "wbtc", exponent: 8 }
      ],
      logo_URIs: {},
      description: "Stakeable WBTC on RetroChain"
    }
  ]
} as any;


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

app.use(MotionPlugin);

app.mount("#app");
