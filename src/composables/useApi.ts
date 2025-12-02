import axios from "axios";

// Resolve a base URL that avoids mixed content when the app is under HTTPS.
function resolveBaseUrl() {
  const envBase = import.meta.env.VITE_REST_API_URL as string | undefined;
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";

  // If we are on HTTPS and the env base is insecure HTTP, force relative '/api'
  if (isHttps) {
    if (!envBase) return "/api";
    const lower = envBase.toLowerCase();
    if (lower.startsWith("http://")) return "/api"; // avoid mixed content
    return envBase; // https:// or relative path
  }

  // Non-HTTPS page: use env or default relative path (assumed proxy in front)
  return envBase || "/api";
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 10000
});

// Intercept requests: if running behind proxy and url starts with a REST root segment
// (e.g. /cosmos, /ibc, /retrochain) but not already prefixed with /api, add /api.
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const isHttps = window.location.protocol === 'https:';
    const u = config.url || '';
    const needsPrefix =
      isHttps &&
      (u.startsWith('/cosmos') || u.startsWith('/retrochain') || u.startsWith('/ibc')) &&
      !u.startsWith('/api/');
    if (needsPrefix) {
      config.url = '/api' + u; // prefix
    }
  }
  return config;
});

export function useApi() {
  return api;
}
