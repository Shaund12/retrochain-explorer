export type TokenAccent = "emerald" | "violet" | "sky" | "amber" | "slate";

export interface TokenMeta {
  denom: string;
  symbol: string;
  name: string;
  chain: string;
  icon: string;
  decimals: number;
  accent: TokenAccent;
  description?: string;
}

const TOKEN_META: Record<string, TokenMeta> = {
  uretro: {
    denom: "uretro",
    symbol: "RETRO",
    name: "RetroChain Native",
    chain: "RetroChain Mainnet",
    icon: "??",
    decimals: 6,
    accent: "emerald",
    description: "Primary staking and gas token for RetroChain."
  },
  udretro: {
    denom: "udretro",
    symbol: "DRETRO",
    name: "RetroChain Devnet",
    chain: "RetroChain Devnet",
    icon: "??",
    decimals: 6,
    accent: "sky",
    description: "Testnet variant of RETRO for dev deployments."
  },
  uatom: {
    denom: "uatom",
    symbol: "ATOM",
    name: "Cosmos Hub",
    chain: "Cosmos Hub (base denom)",
    icon: "??",
    decimals: 6,
    accent: "violet",
    description: "Native staking token of the Cosmos Hub."
  },
  "ibc/27394fb092d2eccd56123c74f36e4c1f926001ceada9ca97ea622b25f41e5eb2": {
    denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
    symbol: "ATOM",
    name: "Cosmos Hub",
    chain: "Cosmos Hub (IBC)",
    icon: "??",
    decimals: 6,
    accent: "violet",
    description: "IBC-transferred ATOM routed through channel-0."
  },
  "ibc/atom": {
    denom: "ibc/atom",
    symbol: "ATOM",
    name: "Cosmos Hub",
    chain: "Cosmos Hub (IBC alias)",
    icon: "??",
    decimals: 6,
    accent: "violet",
    description: "Alias used before the canonical ATOM denom hash is available."
  },
  uusdc: {
    denom: "uusdc",
    symbol: "USDC",
    name: "USD Coin",
    chain: "Noble USDC",
    icon: "??",
    decimals: 6,
    accent: "amber",
    description: "Native USDC issued on the Noble chain."
  },
  "ibc/usdc": {
    denom: "ibc/usdc",
    symbol: "USDC",
    name: "USD Coin",
    chain: "IBC Stablecoin",
    icon: "??",
    decimals: 6,
    accent: "amber",
    description: "USDC bridged in over IBC."
  }
};

const FALLBACK_META: TokenMeta = {
  denom: "unknown",
  symbol: "ASSET",
  name: "Custom Asset",
  chain: "Unknown chain",
  icon: "??",
  decimals: 6,
  accent: "slate",
  description: "Unregistered denomination"
};

const toKey = (denom: string) => (denom || "").toLowerCase();

export function getTokenMeta(denom: string | undefined | null): TokenMeta {
  if (!denom) {
    return FALLBACK_META;
  }
  const key = toKey(denom);
  return TOKEN_META[key] ?? {
    ...FALLBACK_META,
    denom,
    symbol: denom.toUpperCase(),
    name: denom.toUpperCase(),
    description: `Unrecognized denom ${denom}`
  };
}
