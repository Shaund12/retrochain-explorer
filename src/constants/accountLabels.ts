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
    icon: "???"
  },
  "cosmos1exqr633rjzls2h4txrpu0cxhnxx0dquylf074x": {
    id: "ecosystem_rewards",
    label: "Ecosystem Rewards",
    description: "Grant pool that jump-starts builders, hackathons, and long-term contributors.",
    icon: "??"
  },
  "cosmos1w506apt4kyq72xgaakwxrvak8w5d94upn3gdf3": {
    id: "liquidity_fund",
    label: "Liquidity Fund",
    description: "Provisioning desk for RetroChain DEX pairs, market makers, and cross-chain bridges.",
    icon: "??"
  },
  "cosmos1tksjh4tkdjfnwkkwty0wyuy4pv93q5q4lepgrn": {
    id: "community_fund",
    label: "Community Fund",
    description: "DAO-controlled treasury for governance proposals, retroactive rewards, and partnerships.",
    icon: "??"
  },
  "cosmos1epy8qnuu00w76xvvlt2mc7q8qslhw206vzu5vs": {
    id: "dev_fund",
    label: "Core Dev Fund",
    description: "Fuel for protocol upgrades, audits, and the RetroChain core engineering team.",
    icon: "??"
  },
  "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq": {
    id: "shaun_profit",
    label: "Shaun Treasury",
    description: "Shaun's personal war chest used for infra, validators, and guerrilla marketing stunts.",
    icon: "??"
  },
  "cosmos1ydn44ufvhddqhxu88m709k46hdm0dfjwm8v0tt": {
    id: "kitty_charity",
    label: "Kitty Charity",
    description: "Community kitty fund sponsoring shelters, meme contests, and feel-good grants.",
    icon: "??"
  }
};

export const ACCOUNT_LABELS: Record<string, AccountLabelMeta> = Object.fromEntries(
  Object.entries(RAW_LABELS).map(([address, meta]) => [address.toLowerCase(), meta])
);

export function getAccountLabel(address?: string | null): AccountLabelMeta | null {
  if (!address) return null;
  return ACCOUNT_LABELS[address.toLowerCase()] ?? null;
}
