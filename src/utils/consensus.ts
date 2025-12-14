const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

const decodeBase64 = (value: string): Uint8Array | null => {
  try {
    if (typeof atob === "function") {
      const binary = atob(value);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  } catch {}
  return null;
};

/**
 * Normalize a Tendermint consensus address coming from the API into a consistent
 * uppercase hex string so we can match it against derived validator addresses.
 */
export function decodeConsensusAddress(address?: string | null): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const bytes = decodeBase64(trimmed);
  if (bytes && bytes.length) {
    const slice = bytes.length >= 20 ? bytes.slice(0, 20) : bytes;
    return bytesToHex(slice);
  }

  return trimmed.toUpperCase();
}

/**
 * Given a validator consensus public key (base64 wrapped in the object that staking API returns),
 * derive the Tendermint consensus address (first 20 bytes of SHA-256(pubkey bytes)).
 */
export async function deriveConsensusAddressFromPubkey(pubkey: any): Promise<string | null> {
  try {
    const key = pubkey?.key;
    if (!key) return null;

    const bytes = decodeBase64(key);
    if (!bytes) return null;

    const subtle = getSubtleCrypto();
    if (!subtle) return null;

    const hashBuffer = await subtle.digest("SHA-256", bytes);
    const truncated = new Uint8Array(hashBuffer).slice(0, 20);
    return bytesToHex(truncated);
  } catch {
    return null;
  }
}
