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

export function useApi() {
  return api;
}
