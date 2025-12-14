import { fromBech32, toBech32 } from "@cosmjs/encoding";

export interface AccountLabelMeta {
  id: string;
  label: string;
  description: string;
  icon: string;
}

const RAW_LABELS: Record<string, AccountLabelMeta> = {
  "cosmos1fscvf7rphx477z6vd4sxsusm2u8a70kewvc8wy": {
    id: "foundation_validator",
    label: "Foundation Validator",
    description: "RetroChain Foundation's guardian validator that keeps mainnet blocks flowing 24/7.",
    icon: "🛡️"
  },
  "cosmos1exqr633rjzls2h4txrpu0cxhnxx0dquylf074x": {
    id: "ecosystem_rewards",
    label: "Ecosystem Rewards",
    description: "Grant pool that jump-starts builders, hackathons, and long-term contributors.",
    icon: "🎁"
  },
  "cosmos1w506apt4kyq72xgaakwxrvak8w5d94upn3gdf3": {
    id: "liquidity_fund",
    label: "Liquidity Fund",
    description: "Provisioning desk for RetroChain DEX pairs, market makers, and cross-chain bridges.",
    icon: "💧"
  },
  "cosmos1tksjh4tkdjfnwkkwty0wyuy4pv93q5q4lepgrn": {
    id: "community_fund",
    label: "Community Fund",
    description: "DAO-controlled treasury for governance proposals, retroactive rewards, and partnerships.",
    icon: "🌐"
  },
  "cosmos1epy8qnuu00w76xvvlt2mc7q8qslhw206vzu5vs": {
    id: "dev_fund",
    label: "Core Dev Fund",
    description: "Fuel for protocol upgrades, audits, and the RetroChain core engineering team.",
    icon: "🧰"
  },
  "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq": {
    id: "dev_profit",
    label: "Dev Profit",
    description: "Core team profit wallet covering infra, validator ops, and high-impact ecosystem pushes.",
    icon: "🚀"
  },
  "cosmos1ydn44ufvhddqhxu88m709k46hdm0dfjwm8v0tt": {
    id: "kitty_charity",
    label: "Kitty Charity",
    description: "Community kitty fund sponsoring shelters, meme contests, and feel-good grants.",
    icon: "🐾"
  },
  "cosmos1fl48vsnmsdzcv85q5d2q4z5ajdha8yu34mf0eh": {
    id: "community_pool",
    label: "Community Pool",
    description: "Chain-wide treasury that accumulates inflation and community-tax funds for governance controlled spending.",
    icon: "🏛️"
  },
  "cosmos1f05vqgh9ufgfykn3g8zx45j273x0kxaj23akuz": {
    id: "ibc_relayer",
    label: "IBC Relayer",
    description: "Primary IBC relayer hot wallet moving packets between RetroChain and partner zones.",
    icon: "🔁"
  },
  "cosmos1jv65s3grqf6v6jl3dp4t6c9t9rk99cd88lyufl": {
    id: "staking_rewards_vault",
    label: "Staking Rewards Vault",
    description: "Primary accumulation vault where network staking rewards are swept before distribution.",
    icon: "🏦"
  }
};

export const ACCOUNT_LABELS: Record<string, AccountLabelMeta> = Object.fromEntries(
  Object.entries(RAW_LABELS).map(([address, meta]) => [address.toLowerCase(), meta])
);

export function getAccountLabel(address?: string | null): AccountLabelMeta | null {
  if (!address) return null;

  const candidates: string[] = [];
  const lower = address.toLowerCase();
  candidates.push(lower);

  try {
    const decoded = fromBech32(address);
    const accountAddr = toBech32("cosmos", decoded.data).toLowerCase();
    if (!candidates.includes(accountAddr)) {
      candidates.push(accountAddr);
    }
  } catch {
    // not bech32, ignore
  }

  for (const candidate of candidates) {
    const meta = ACCOUNT_LABELS[candidate];
    if (meta) return meta;
  }

  return null;
}
