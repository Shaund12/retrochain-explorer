import axios from "axios";

// Choose a base URL that won't trigger mixed-content when the site is served over HTTPS.
// If running on HTTPS and no explicit HTTPS API is provided, fall back to a same-origin
// relative path that can be proxied (e.g., via Vite dev proxy or a reverse proxy in prod).
const inferredHttpsSafeBase =
  typeof window !== "undefined" && window.location.protocol === "https:" ? "/api" : "http://localhost:1317";

const apiBaseURL = import.meta.env.VITE_REST_API_URL || inferredHttpsSafeBase;

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 10000
});

export function useApi() {
  return api;
}
