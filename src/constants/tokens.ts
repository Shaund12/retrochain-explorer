export type TokenAccent = "emerald" | "violet" | "sky" | "amber" | "slate";

export const DEFAULT_WBTC_IBC_DENOM_ON_RETRO =
  "ibc/CF57A83CED6CEC7D706631B5DC53ABC21B7EDA7DF7490732B4361E6D5DD19C73";
export const DEFAULT_WBTC_DENOM_ON_COSMOS = "cwbtc";

export interface TokenMeta {
  denom: string;
  symbol: string;
  name: string;
  chain: string;
  icon: string;
  decimals: number;
  accent: TokenAccent;
  description?: string;
  logo?: string;
}

const RAW_TOKEN_META: Record<string, TokenMeta> = {
  uretro: {
    denom: "uretro",
    symbol: "RETRO",
    name: "RetroChain Native",
    chain: "RetroChain Mainnet",
    icon: "f3ae",
    icon: "🎮",
    decimals: 6,
    accent: "emerald",
    description: "Primary staking and gas token for RetroChain.",
    logo: "/RCIcon.svg"
  },
  udretro: {
    denom: "udretro",
    symbol: "DRETRO",
    name: "RetroChain Devnet",
    chain: "RetroChain Devnet",
    icon: "f3ae",
    icon: "🎮",
    decimals: 6,
    accent: "sky",
    description: "Testnet variant of RETRO for dev deployments.",
    logo: "/RCIcon.svg"
  },
  uatom: {
    denom: "uatom",
    symbol: "ATOM",
    name: "Cosmos Hub",
    chain: "Cosmos Hub (base denom)",
    icon: "2609",
    icon: "⚛️",
    decimals: 6,
    accent: "violet",
    description: "Native staking token of the Cosmos Hub."
  },
  "ibc/27394fb092d2eccd56123c74f36e4c1f926001ceada9ca97ea622b25f41e5eb2": {
    denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2",
    symbol: "ATOM",
    name: "Cosmos Hub",
    chain: "Cosmos Hub (IBC)",
    icon: "⚛️",
    decimals: 6,
    accent: "violet",
    description: "IBC-transferred ATOM routed through channel-0.",
    logo: "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png"
  },
  "ibc/atom": {
    denom: "ibc/atom",
    symbol: "ATOM",
    name: "Cosmos Hub",
    chain: "Cosmos Hub (IBC alias)",
    icon: "⚛️",
    decimals: 6,
    accent: "violet",
    description: "Alias used before the canonical ATOM denom hash is available.",
    logo: "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png"
  },
  [DEFAULT_WBTC_IBC_DENOM_ON_RETRO.toLowerCase()]: {
    denom: DEFAULT_WBTC_IBC_DENOM_ON_RETRO,
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    chain: "Osmosis ? RetroChain",
    icon: "₿",
    decimals: 8,
    accent: "amber",
    description: "Wrapped Bitcoin bridged over IBC from Osmosis into RetroChain.",
    logo: "https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png"
  },
  [DEFAULT_WBTC_DENOM_ON_COSMOS]: {
    denom: DEFAULT_WBTC_DENOM_ON_COSMOS,
    symbol: "WBTC",
    name: "Wrapped Bitcoin (Cosmos)",
    chain: "Cosmos Hub / Noble",
    icon: "₿",
    decimals: 8,
    accent: "amber",
    description: "Base denom for Wrapped Bitcoin on Cosmos-connected zones.",
    logo: "https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png"
  },
  "ibc/99b00614ddbe6189aa03b77066ff8eb3f93680bd790c43cf56096b7f23542015": {
    denom: "ibc/99B00614DDBE6189AA03B77066FF8EB3F93680BD790C43CF56096B7F23542015",
    symbol: "WBTC",
    name: "Wrapped Bitcoin (IBC)",
    chain: "Cosmos Hub via IBC",
    icon: "₿",
    decimals: 8,
    accent: "amber",
    description: "IBC hash for Wrapped Bitcoin when routed through Cosmos Hub bridges.",
    logo: "https://assets.coingecko.com/coins/images/7598/thumb/wrapped_bitcoin_wbtc.png"
  },
  uusdc: {
    denom: "uusdc",
    symbol: "USDC",
    name: "USD Coin",
    chain: "Noble USDC",
    icon: "f4b5",
    icon: "💵",
    decimals: 6,
    accent: "amber",
    description: "Native USDC issued on the Noble chain."
  },
  "ibc/usdc": {
    denom: "ibc/usdc",
    symbol: "USDC",
    name: "USD Coin",
    chain: "IBC Stablecoin",
    icon: "f4b5",
    icon: "💵",
    decimals: 6,
    accent: "amber",
    description: "USDC bridged in over IBC."
  },
  "factory/cosmos1fscvf7rphx477z6vd4sxsusm2u8a70kewvc8wy/retroarcade": {
    denom: "factory/cosmos1fscvf7rphx477z6vd4sxsusm2u8a70kewvc8wy/retroarcade",
    symbol: "RETROARCADE",
    name: "RetroArcade",
    chain: "RetroArcade Factory",
    icon: "f3b2",
    icon: "🎰",
    decimals: 6,
    accent: "violet",
    description: "RetroArcade Factory token",
    logo: "https://retrochain.ddns.net/RCIcon.svg"
  }
};

const TOKEN_META: Record<string, TokenMeta> = Object.entries(RAW_TOKEN_META).reduce(
  (acc, [key, value]) => {
    acc[key.toLowerCase()] = value;
    return acc;
  },
  {} as Record<string, TokenMeta>
);

const FALLBACK_META: TokenMeta = {
  denom: "unknown",
  symbol: "ASSET",
  name: "Custom Asset",
  chain: "Unknown chain",
  icon: "💎",
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
