const bytesToBinaryString = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return binary;
};

export const bytesToBase64 = (bytes: Uint8Array) => {
  if (typeof btoa === "function") {
    return btoa(bytesToBinaryString(bytes));
  }
  const nodeBuffer = (globalThis as any)?.Buffer;
  if (nodeBuffer) return nodeBuffer.from(bytes).toString("base64");
  throw new Error("Base64 encoding is not supported in this environment.");
};

export const base64ToBytes = (value: string) => {
  if (!value) return new Uint8Array();
  if (typeof atob === "function") {
    const binary = atob(value);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const nodeBuffer = (globalThis as any)?.Buffer;
  if (nodeBuffer) {
    const buf = nodeBuffer.from(value, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  throw new Error("Base64 decoding is not supported in this environment.");
};

export const base64ToString = (value: string) => {
  if (!value) return "";
  if (typeof atob === "function") return atob(value);
  const nodeBuffer = (globalThis as any)?.Buffer;
  if (nodeBuffer) return nodeBuffer.from(value, "base64").toString("utf-8");
  return value;
};

export const stringToBase64 = (value: string) => {
  if (typeof btoa === "function") return btoa(value);
  const nodeBuffer = (globalThis as any)?.Buffer;
  if (nodeBuffer) return nodeBuffer.from(value, "utf-8").toString("base64");
  throw new Error("Base64 encoding is not supported in this environment.");
};

export const bytesToHex = (bytes: Uint8Array, opts?: { upper?: boolean }) => {
  const out = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return opts?.upper === false ? out.toLowerCase() : out.toUpperCase();
};
