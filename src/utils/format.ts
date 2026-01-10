import { DEFAULT_WBTC_DENOM_ON_COSMOS, DEFAULT_WBTC_IBC_DENOM_ON_RETRO } from "@/constants/tokens";

type DenomMeta = { display: string; decimals: number };

const DENOMS: Record<string, DenomMeta> = {
  uretro: { display: "RETRO", decimals: 6 },
  udretro: { display: "DRETRO", decimals: 6 },
  uatom: { display: "ATOM", decimals: 6 },
  "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2": { display: "ATOM", decimals: 6 }
};

const WBTC_ON_RETRO = import.meta.env.VITE_IBC_DENOM_WBTC_ON_RETRO || DEFAULT_WBTC_IBC_DENOM_ON_RETRO;
const WBTC_ON_COSMOS =
  import.meta.env.VITE_DENOM_WBTC_ON_COSMOS ||
  import.meta.env.VITE_IBC_DENOM_WBTC_ON_COSMOS ||
  DEFAULT_WBTC_DENOM_ON_COSMOS;

if (WBTC_ON_RETRO) {
  DENOMS[WBTC_ON_RETRO] = { display: "WBTC", decimals: 8 };
}

if (WBTC_ON_COSMOS) {
  DENOMS[WBTC_ON_COSMOS] = { display: "WBTC", decimals: 8 };
}

export function getDenomMeta(denom: string): DenomMeta {
  if (denom.startsWith("dex/")) {
    return { display: denom.toUpperCase(), decimals: 0 }; // LP shares are integer units
  }
  return DENOMS[denom] || { display: denom.toUpperCase(), decimals: 0 };
}

function splitAmount(amount: string, decimals: number) {
  if (!/^[0-9]+$/.test(amount)) amount = String(parseInt(amount || "0", 10) || 0);
  const neg = amount.startsWith("-");
  if (neg) amount = amount.slice(1);
  const pad = amount.padStart(decimals + 1, "0");
  const i = pad.length - decimals;
  const intPart = pad.slice(0, i);
  const fracPart = decimals > 0 ? pad.slice(i) : "";
  return { intPart, fracPart, neg };
}

function addThousands(intPart: string) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatNumberSmart(value: string, decimals: number, opts?: { minDecimals?: number; maxDecimals?: number; showZerosForIntegers?: boolean }) {
  const { intPart, fracPart, neg } = splitAmount(value, decimals);
  const minD = opts?.minDecimals ?? 2;
  const maxD = opts?.maxDecimals ?? decimals;
  const showZerosForIntegers = opts?.showZerosForIntegers ?? true;

  const intFmt = addThousands(intPart);
  if (!fracPart || /^0+$/.test(fracPart)) {
    if (!decimals) return (neg ? "-" : "") + intFmt;
    if (showZerosForIntegers) {
      return (neg ? "-" : "") + intFmt + "." + "0".repeat(decimals);
    }
    return (neg ? "-" : "") + intFmt;
  }

  // Trim trailing zeros, keep between minD and maxD
  let trimmed = fracPart.replace(/0+$/, "");
  if (trimmed.length < minD) trimmed = fracPart.slice(0, minD);
  if (trimmed.length > maxD) trimmed = trimmed.slice(0, maxD);
  return (neg ? "-" : "") + intFmt + "." + trimmed;
}

export function formatAmount(amount: string | number, denom: string, opts?: { minDecimals?: number; maxDecimals?: number; showZerosForIntegers?: boolean }) {
  const meta = getDenomMeta(denom);
  const amt = String(amount ?? "0");
  const out = formatNumberSmart(amt, meta.decimals, opts);
  return `${out} ${meta.display}`;
}

export function formatAtomicToDisplay(amount: string | number, denom: string, opts?: { minDecimals?: number; maxDecimals?: number; showZerosForIntegers?: boolean }) {
  const meta = getDenomMeta(denom);
  const amt = String(amount ?? "0");
  return formatNumberSmart(amt, meta.decimals, opts);
}

export function formatCoins(coins: { amount: string; denom: string }[] | undefined | null, opts?: { minDecimals?: number; maxDecimals?: number; showZerosForIntegers?: boolean }) {
  if (!Array.isArray(coins) || coins.length === 0) return "-";
  return coins.map(c => formatAmount(c.amount, c.denom, opts)).join(", ");
}
