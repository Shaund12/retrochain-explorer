import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import * as path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Frontend base URLs can be relative (e.g. '/api', '/rpc') when running behind nginx.
  // The Vite dev server proxy, however, needs a real upstream target.
  const restTarget =
    env.VITE_REST_PROXY_TARGET ||
    (env.VITE_REST_API_URL && /^https?:\/\//i.test(env.VITE_REST_API_URL)
      ? env.VITE_REST_API_URL
      : "http://localhost:1317");
  const rpcTarget =
    env.VITE_RPC_PROXY_TARGET ||
    (env.VITE_RPC_URL && /^https?:\/\//i.test(env.VITE_RPC_URL)
      ? env.VITE_RPC_URL
      : "http://localhost:26657");
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src")
      }
    },
    server: {
      port: 5173,
      host: "0.0.0.0",
      allowedHosts: ["retrochain.ddns.net"],
      proxy: {
        // Proxy REST API to avoid mixed content during development
        "/api": {
          target: restTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Origin", "*");
            });
          }
        },
        // Proxy RPC endpoint for transaction signing
        "/rpc": {
          target: rpcTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (p) => p.replace(/^\/rpc/, ""),
          ws: true, // Enable WebSocket support
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("Origin", "*");
            });
          }
        }
      }
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
      allowedHosts: ["retrochain.ddns.net"]
    }
  };
});
