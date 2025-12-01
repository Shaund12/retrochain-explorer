// Vercel serverless proxy to avoid mixed-content by serving REST via same-origin HTTPS
// This single endpoint handles /api/* by parsing req.url to forward to REST_API_URL

export default async function handler(req, res) {
  // CORS headers (safe for same-origin; useful for external testing)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const base = process.env.REST_API_URL || process.env.VITE_REST_API_URL || "http://localhost:1317";

  try {
    // req.url starts with /api...
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const subPath = url.pathname.replace(/^\/api/, "") || "";
    const query = url.search || "";
    const targetUrl = `${base}${subPath}${query}`;

    const hopByHop = new Set([
      "connection",
      "keep-alive",
      "proxy-authenticate",
      "proxy-authorization",
      "te",
      "trailers",
      "transfer-encoding",
      "upgrade",
      "host"
    ]);

    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => !hopByHop.has(String(k).toLowerCase()))
    );

    const init = {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : req,
      redirect: "manual"
    };

    const response = await fetch(targetUrl, init);
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return;
      res.setHeader(key, value);
    });

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(502).json({ error: "Proxy error", message: err?.message || String(err) });
  }
}
