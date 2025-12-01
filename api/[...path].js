// Vercel serverless proxy to avoid mixed-content by serving REST via same-origin HTTPS
// Usage: frontend calls /api/<rest-path>, this function forwards to REST_API_URL

export default async function handler(req, res) {
  // Allow CORS (mostly harmless for same-origin, useful for external callers)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const base = process.env.REST_API_URL || process.env.VITE_REST_API_URL || "http://localhost:1317";

  try {
    // req.query.path is an array for [...path]
    const pathParts = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    const subPath = pathParts.length ? `/${pathParts.join('/')}` : '';

    const qsIndex = req.url.indexOf("?");
    const query = qsIndex >= 0 ? req.url.substring(qsIndex) : "";

    const targetUrl = `${base}${subPath}${query}`;

    // Build headers, excluding hop-by-hop ones
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
      // Only pass body for methods that can have one
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : req,
      // Do not follow redirects automatically to propagate status
      redirect: "manual"
    };

    const response = await fetch(targetUrl, init);

    // Pipe through status and headers
    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-encoding") return; // avoid double-encoding issues
      res.setHeader(key, value);
    });

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(502).json({ error: "Proxy error", message: err?.message || String(err) });
  }
}
