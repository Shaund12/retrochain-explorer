// src/utils/wasmSmartQuery.ts
type SmartQueryInput =
    | Record<string, any>
    | string
    | { query_msg: string }
    | { query_msg: Record<string, any> };

const bytesToBase64 = (bytes: Uint8Array) => {
    if (typeof btoa === "function") {
        let binary = "";
        bytes.forEach((b) => (binary += String.fromCharCode(b)));
        return btoa(binary);
    }
    const nodeBuffer = (globalThis as any)?.Buffer;
    if (nodeBuffer) return nodeBuffer.from(bytes).toString("base64");
    throw new Error("Base64 encoding is not supported in this environment.");
};

const encodeJsonToBase64 = (payload: Record<string, any> | string) => {
    const json = typeof payload === "string" ? payload : JSON.stringify(payload);
    if (typeof TextEncoder !== "undefined") {
        const encoder = new TextEncoder();
        return bytesToBase64(encoder.encode(json));
    }
    const nodeBuffer = (globalThis as any)?.Buffer;
    if (nodeBuffer) return nodeBuffer.from(json, "utf-8").toString("base64");
    throw new Error("TextEncoder is not available to encode query payload.");
};

// Decode helper: returns JSON if it is JSON, else returns string.
// (If you already have decodeBase64Json in useContracts.ts, you can import that instead)
const base64ToString = (value: string) => {
    if (!value) return "";
    if (typeof atob === "function") return atob(value);
    const nodeBuffer = (globalThis as any)?.Buffer;
    if (nodeBuffer) return nodeBuffer.from(value, "base64").toString("utf-8");
    return value;
};

export const decodeBase64Json = (value?: any) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    const asString = base64ToString(value);
    try {
        return JSON.parse(asString);
    } catch {
        return asString;
    }
};

export const buildSmartQueryBase64 = (message: SmartQueryInput): string => {
    const msgAny: any = message;

    // Case 3: already a REST wrapper with base64 string.
    if (msgAny && typeof msgAny === "object" && typeof msgAny.query_msg === "string") {
        return msgAny.query_msg.trim();
    }

    // Case 2: wrapper with inner object -> unwrap.
    const rawQuery =
        msgAny && typeof msgAny === "object" && msgAny.query_msg && typeof msgAny.query_msg === "object"
            ? msgAny.query_msg
            : message;

    // Case 4: raw string passed in.
    if (typeof rawQuery === "string") {
        const trimmed = rawQuery.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return encodeJsonToBase64(trimmed);
        }
        // assume base64 already
        return trimmed;
    }

    // Case 1: raw object.
    return encodeJsonToBase64(rawQuery as Record<string, any>);
};

export const smartQueryContract = async (
    api: { get: (url: string) => Promise<any> },
    address: string,
    message: SmartQueryInput
) => {
    const key = address?.trim();
    if (!key) throw new Error("Contract address is required.");

    const queryB64 = buildSmartQueryBase64(message);
    const encodedPath = encodeURIComponent(queryB64);

    const res = await api.get(`/cosmwasm/wasm/v1/contract/${key}/smart/${encodedPath}`);

    const data = res?.data;
    const payload = data?.data ?? data?.smart_response?.data;

    // If the API returns HTML (usually proxy misconfig / SPA fallback), fail with a clearer error.
    if (typeof payload === "string") {
        const trimmed = payload.trim();
        if (trimmed.startsWith("<") || /^<!doctype\s+html/i.test(trimmed) || /^<html/i.test(trimmed)) {
            const hint = trimmed.slice(0, 120).replace(/\s+/g, " ");
            throw new Error(
                `Smart query returned HTML instead of JSON/base64. Check REST base URL/proxy and CosmWasm endpoints. Response starts with: ${hint}`
            );
        }
    }

    return decodeBase64Json(payload);
};
