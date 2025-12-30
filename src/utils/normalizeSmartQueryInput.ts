export type NormalizedSmartQuery = {
  message: Record<string, any> | string;
  migratedText?: string;
};

const decodeBase64ToString = (value: string) => {
  try {
    if (typeof atob === "function") return atob(value);
    const buf = (globalThis as any)?.Buffer?.from(value, "base64");
    return buf ? buf.toString("utf-8") : value;
  } catch {
    return value;
  }
};

export const normalizeSmartQueryInput = (inputText: string): NormalizedSmartQuery => {
  const raw = String(inputText ?? "");

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(err?.message || "Invalid JSON payload");
  }

  let current: any = parsed;

  for (let i = 0; i < 4; i += 1) {
    if (!current || typeof current !== "object" || !("query_msg" in current)) break;

    const inner: any = (current as any).query_msg;

    if (typeof inner === "string" && inner.trim()) {
      const candidate = inner.trim();
      try {
        const decoded = decodeBase64ToString(candidate);
        current = decoded ? JSON.parse(decoded) : JSON.parse(candidate);
      } catch {
        // If it isn't JSON (decoded or raw), return the string as-is (caller may pass base64 directly).
        current = candidate;
      }
    } else {
      current = inner;
    }
  }

  const migratedText = (() => {
    try {
      return typeof current === "string" ? current : JSON.stringify(current, null, 2);
    } catch {
      return undefined;
    }
  })();

  return { message: current, migratedText };
};
