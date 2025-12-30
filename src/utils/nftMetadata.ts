const decodeBase64ToString = (value: string) => {
  try {
    if (typeof atob === "function") return atob(value);
    const buf = (globalThis as any)?.Buffer?.from(value, "base64");
    return buf ? buf.toString("utf-8") : value;
  } catch {
    return value;
  }
};

export const normalizeNftImageUri = (value?: string): string | undefined => {
  if (!value || typeof value !== "string") return undefined;
  const v = value.trim().replace(/\s+/g, " ");
  const lower = v.toLowerCase();

  // Never treat JSON data URIs as images.
  if (lower.startsWith("data:application/json")) return undefined;

  // If contract already provides base64 SVG data URI, keep as-is.
  if (lower.startsWith("data:image/svg+xml;base64,")) return v;

  // Some NFT metadata uses data:image/svg+xml,<svg ...> (NOT base64). This must be URL-encoded.
  if (lower.startsWith("data:image/svg+xml,")) {
    const raw = v.slice("data:image/svg+xml,".length);
    if (/%[0-9a-f]{2}/i.test(raw)) return v; // already encoded
    return `data:image/svg+xml,${encodeURIComponent(raw)}`;
  }

  return v;
};

export const parseTokenUriMetadata = async (uri: string): Promise<Record<string, any> | null> => {
  if (!uri) return null;
  try {
    const lower = uri.toLowerCase();

    if (lower.startsWith("data:application/json;base64,")) {
      const b64 = uri.split(",", 2)[1] || "";
      const json = decodeBase64ToString(b64);
      return JSON.parse(json);
    }

    if (lower.startsWith("data:application/json;utf8,")) {
      const encoded = uri.split(",", 2)[1] || "";
      return JSON.parse(decodeURIComponent(encoded));
    }

    if (lower.startsWith("data:application/json,")) {
      const encoded = uri.split(",", 2)[1] || "";
      return JSON.parse(decodeURIComponent(encoded));
    }

    const res = await fetch(uri);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};
