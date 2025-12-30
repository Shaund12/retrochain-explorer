import { sha256 } from "@cosmjs/crypto";

export const sha256Bytes = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle && typeof subtle.digest === "function") {
    // Ensure we pass an ArrayBuffer (not ArrayBufferLike) to satisfy stricter TS libs.
    const copy = new Uint8Array(bytes);
    const digest = await subtle.digest("SHA-256", copy.buffer);
    return new Uint8Array(digest);
  }
  return sha256(bytes);
};

export const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
  const { bytesToHex } = await import("@/utils/encoding");
  const digest = await sha256Bytes(bytes);
  return bytesToHex(digest);
};
