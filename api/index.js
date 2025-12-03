// Vercel serverless proxy to avoid mixed-content by serving REST via same-origin HTTPS
// This single endpoint handles /api/* by parsing req.url to forward to REST_API_URL

// Simple in-memory cache for recent transactions (persists on warm lambdas)
let RECENT_TXS_CACHE = { ts: 0, data: [], latest: 0 };

async function handleRecentTxs(req, res, base, urlObj) {
  try {
    const now = Date.now();
    const limit = Math.min(parseInt(urlObj.searchParams.get("limit") || "20", 10) || 20, 100);
    const ttlMs = 5000; // 5s CDN/lambda cache

    if (RECENT_TXS_CACHE.data.length >= limit && now - RECENT_TXS_CACHE.ts < ttlMs) {
      res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
      return res.status(200).json({ txs: RECENT_TXS_CACHE.data.slice(0, limit) });
    }

    const latestRes = await fetch(`${base}/cosmos/base/tendermint/v1beta1/blocks/latest`);
    if (!latestRes.ok) throw new Error(`latest block ${latestRes.status}`);
    const latestJson = await latestRes.json();
    const latest = parseInt(latestJson?.block?.header?.height || "0", 10);

    const maxScan = Math.max(limit * 3, 30);
    const collected = [];

    // helper: compute SHA256 hex uppercase from base64
    const { createHash } = await import("node:crypto");
    const hashFromBase64 = (b64) => {
      const buf = Buffer.from(b64, "base64");
      return createHash("sha256").update(buf).digest("hex").toUpperCase();
    };

    // Gentle sequential scan with small concurrency (1) to avoid overloading node
    let scanned = 0;
    for (let h = latest; h > 0 && collected.length < limit && scanned < maxScan; h--) {
      scanned++;
      const b = await fetch(`${base}/cosmos/base/tendermint/v1beta1/blocks/${h}`);
      if (!b.ok) continue;
      const bj = await b.json();
      const blk = bj?.block;
      const txs = blk?.data?.txs || [];
      if (!txs.length) continue;
      const time = blk?.header?.time;
      for (const raw of txs) {
        try {
          const hash = hashFromBase64(raw);
          collected.push({ hash, height: h, timestamp: time });
          if (collected.length >= limit) break;
        } catch {}
      }
    }

    RECENT_TXS_CACHE = { ts: Date.now(), data: collected, latest };
    res.setHeader("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
    return res.status(200).json({ txs: collected.slice(0, limit) });
  } catch (e) {
    return res.status(502).json({ error: "recent-txs error", message: e?.message || String(e) });
  }
}

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

    // Handle aggregator endpoint: /api/recent-txs
    if (subPath === "/recent-txs") {
      return await handleRecentTxs(req, res, base, url);
    }

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
