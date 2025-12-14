export interface AccountLabelMeta {
  label: string;
  allocation: string;
}

const RAW_LABELS: Record<string, AccountLabelMeta> = {
  "cosmos1fscvf7rphx477z6vd4sxsusm2u8a70kewvc8wy": {
    label: "foundation_validator",
    allocation: "50,000,000 RETRO"
  },
  "cosmos1exqr633rjzls2h4txrpu0cxhnxx0dquylf074x": {
    label: "ecosystem_rewards",
    allocation: "20,000,000 RETRO"
  },
  "cosmos1w506apt4kyq72xgaakwxrvak8w5d94upn3gdf3": {
    label: "liquidity_fund",
    allocation: "10,000,000 RETRO"
  },
  "cosmos1tksjh4tkdjfnwkkwty0wyuy4pv93q5q4lepgrn": {
    label: "community_fund",
    allocation: "7,000,000 RETRO"
  },
  "cosmos1epy8qnuu00w76xvvlt2mc7q8qslhw206vzu5vs": {
    label: "dev_fund",
    allocation: "6,000,000 RETRO"
  },
  "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq": {
    label: "shaun_profit",
    allocation: "5,000,000 RETRO"
  },
  "cosmos1ydn44ufvhddqhxu88m709k46hdm0dfjwm8v0tt": {
    label: "kitty_charity",
    allocation: "2,000,000 RETRO"
  }
};

export const ACCOUNT_LABELS: Record<string, AccountLabelMeta> = Object.fromEntries(
  Object.entries(RAW_LABELS).map(([address, meta]) => [address.toLowerCase(), meta])
);

export function getAccountLabel(address?: string | null): AccountLabelMeta | null {
  if (!address) return null;
  return ACCOUNT_LABELS[address.toLowerCase()] ?? null;
}
