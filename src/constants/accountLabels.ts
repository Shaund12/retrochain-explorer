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
    label: "Foundation Security Bond",
    description: "Target: 10,000,000.000000 RETRO (~10.11%). Bonded stake for chain stability—not a spendable treasury.",
    icon: "🛡️"
  },
  "cosmos1exqr633rjzls2h4txrpu0cxhnxx0dquylf074x": {
    id: "ecosystem_rewards",
    label: "Community Distribution Reserve",
    description: "Target: 35,000,000.000000 RETRO (~35.39%). Airdrops, incentive campaigns, retroactive rewards, quests, builder rewards.",
    icon: "🎁"
  },
  "cosmos1w506apt4kyq72xgaakwxrvak8w5d94upn3gdf3": {
    id: "liquidity_fund",
    label: "Liquidity & Market Ops",
    description: "Target: 10,000,000.000000 RETRO (~10.11%). DEX liquidity seeding, market-making support, bridge/LP programs.",
    icon: "💧"
  },
  "cosmos1tksjh4tkdjfnwkkwty0wyuy4pv93q5q4lepgrn": {
    id: "community_fund",
    label: "Partnerships & Ecosystem Growth",
    description: "Target: 8,721,193.994610 RETRO (~8.82%). Integrations, partner zones, relayer/infra incentives, bizdev programs.",
    icon: "🌐"
  },
  "cosmos1epy8qnuu00w76xvvlt2mc7q8qslhw206vzu5vs": {
    id: "dev_fund",
    label: "Protocol R&D + Audits",
    description: "Target: 8,000,000.000000 RETRO (~8.09%). Audits, protocol upgrades, security work, core engineering.",
    icon: "🧰"
  },
  "cosmos1us0jjdd5dj0v499g959jatpnh6xuamwhwdrrgq": {
    id: "dev_profit",
    label: "Ops & Team Vesting",
    description: "Target: 6,000,000.000000 RETRO (~6.07%). Team/ops allocation framed as vesting + runway.",
    icon: "🛰️"
  },
  "cosmos1ydn44ufvhddqhxu88m709k46hdm0dfjwm8v0tt": {
    id: "kitty_charity",
    label: "Public Goods & Charity",
    description: "Target: 1,007,310.758033 RETRO (~1.02%). Community kitty for shelters, public goods, and feel-good grants.",
    icon: "🐾"
  },
  "cosmos1fl48vsnmsdzcv85q5d2q4z5ajdha8yu34mf0eh": {
    id: "community_pool",
    label: "DAO Treasury",
    description: "Target: 20,000,000.000000 RETRO (~20.22%). Governance-controlled treasury—serious funds with on-chain approvals.",
    icon: "🏛️"
  },
  "cosmos1f05vqgh9ufgfykn3g8zx45j273x0kxaj23akuz": {
    id: "ibc_relayer",
    label: "IBC Relayer Hot Wallet",
    description: "Target: 4,998.572638 RETRO (~0.01%). Hot wallet for packet fees and relays between partner zones.",
    icon: "🔁"
  },
  "cosmos1jv65s3grqf6v6jl3dp4t6c9t9rk99cd88lyufl": {
    id: "staking_rewards_vault",
    label: "Commission Sweep (Auto)",
    description: "Target: 162,508.513858 RETRO (~0.16%). Automated commission sweep/routing wallet—not user staking rewards.",
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
