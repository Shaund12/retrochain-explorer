import axios from "axios";
import { useNetwork } from "./useNetwork";

// Resolve a base URL that avoids mixed content when the app is under HTTPS.
function resolveBaseUrl() {
  const envBase = import.meta.env.VITE_REST_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  // If envBase is a relative path like '/api', make it explicit (origin + path)
  // so it cannot be accidentally resolved against a different base (e.g. '/rpc')
  // when the app is hosted behind nested routes/proxies.
  const absolutize = (base?: string) => {
    if (!base) return base;
    const trimmed = base.trim();
    if (!trimmed) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (typeof window === "undefined") return trimmed;
    const origin = window.location.origin;
    return `${origin}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
  };

  // If we are on HTTPS and the env base is insecure HTTP, force relative '/api'
  if (isHttps) {
    if (!envBase) return "/api";
    const lower = envBase.toLowerCase();
    if (lower.startsWith("http://")) return "/api"; // avoid mixed content
    return absolutize(envBase); // https:// or relative path
  }

  // Non-HTTPS page: use env or default relative path (assumed proxy in front)
  return absolutize(envBase || "/api");
}

const { restBase } = useNetwork();
const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 10000,
  // Avoid axios trying to JSON.parse HTML error pages returned by proxies/SPAs.
  // We'll handle JSON parsing ourselves in the response interceptor.
  transformResponse: [(data) => data]
});

// If a proxy misroutes /api to an HTML page (SPA/NGINX), axios JSON parsing throws
// "Unexpected token '<'". Convert that into a clearer error message.
api.interceptors.response.use(
  (res) => {
    const raw = res?.data;
    // If axios has already given us an object, keep it.
    if (raw && typeof raw === "object") return res;

    if (typeof raw === "string") {
      const trimmed = raw.trim();
      // Detect SPA/proxy fallback HTML.
      if (
        trimmed.startsWith("<") ||
        /^<!doctype\s+html/i.test(trimmed) ||
        /^<html/i.test(trimmed)
      ) {
        const hint = trimmed.slice(0, 140).replace(/\s+/g, " ");
        throw new Error(
          `API returned HTML instead of JSON (proxy/routing issue). Check that /api proxies to the chain REST endpoint. Response starts with: ${hint}`
        );
      }

      // Most Cosmos endpoints are JSON; parse it so existing callers keep working.
      try {
        res.data = JSON.parse(trimmed);
      } catch {
        // leave as string if it isn't JSON
      }
    }

    return res;
  },
  (err) => {
    try {
      const data = err?.response?.data;
      if (typeof data === "string" && data.trim().startsWith("<")) {
        err.message =
          "API returned HTML instead of JSON (proxy/routing issue). Ensure VITE_REST_API_URL points to a Cosmos REST endpoint and that /api is correctly proxied.";
      }
    } catch {}
    return Promise.reject(err);
  }
);

// react to network changes
// Note: axios instance baseURL can be updated
try {
  const stopWatch = (() => {
    const unwatch = (restBase as any).effect?.(() => {
      const next = restBase.value || "/api";
      if (/^https?:\/\//i.test(next)) {
        api.defaults.baseURL = next;
      } else if (typeof window !== "undefined") {
        api.defaults.baseURL = `${window.location.origin}${next.startsWith('/') ? '' : '/'}${next}`;
      } else {
        api.defaults.baseURL = next;
      }
    }) || null;
    return () => unwatch && unwatch();
  })();
} catch {}

export function useApi() {
  return api;
}
