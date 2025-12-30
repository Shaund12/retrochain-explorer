import { base64ToBytes, bytesToHex } from "@/utils/encoding";

export type HashVerification = "verified" | "mismatch" | "unknown";

export const normalizeHex = (value?: string | null) => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;
  return /^[0-9a-fA-F]+$/.test(hex) ? hex.toLowerCase() : "";
};

export const formatHash = (value?: string | null) => {
  if (!value) return "";
  const normalized = normalizeHex(value);
  if (normalized) return `0x${normalized}`;
  return value;
};

export const normalizeHashFromHexOrBase64 = (value?: string | null) => {
  const normalized = normalizeHex(value);
  if (normalized) return normalized;

  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const bytes = base64ToBytes(trimmed);
    if (bytes.length) {
      // bytesToHex defaults to uppercase; normalize to lowercase for comparisons.
      return String(bytesToHex(bytes)).toLowerCase();
    }
  } catch {
    // ignore
  }

  return undefined;
};

export const compareHashes = (contractHash?: string | null, codeHash?: string | null): HashVerification => {
  const a = normalizeHex(contractHash);
  const b = normalizeHex(codeHash);
  if (!a || !b) return "unknown";
  return a === b ? "verified" : "mismatch";
};
