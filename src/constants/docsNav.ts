export type DocsNavItem = {
  name: string;
  title: string;
  tag?: string;
};

// Canonical docs order used for:
// - next/previous navigation on each docs page
// - docs hub search/filter
export const DOCS_NAV: DocsNavItem[] = [
  { name: "docs-network", title: "Network Overview", tag: "Network" },
  { name: "docs-tokenomics", title: "Tokenomics (RETRO)", tag: "Economics" },
  { name: "docs-staking", title: "Staking Guide", tag: "Validators" },
  { name: "docs-accounts", title: "Accounts & Addresses", tag: "Accounts" },
  { name: "docs-governance", title: "Governance Guide", tag: "Governance" },
  { name: "docs-modules", title: "Modules", tag: "Modules" },
  { name: "docs-fees", title: "Fees & Gas", tag: "Fees" },
  { name: "docs-fees-flow", title: "Fee Collector Flow", tag: "Fees" },
  { name: "docs-consensus", title: "Consensus & Validator Ops", tag: "Consensus" },
  { name: "docs-validator-uptime", title: "Validator Uptime", tag: "Validators" },
  { name: "docs-contracts", title: "Smart Contracts (CosmWasm)", tag: "Wasm" },
  { name: "docs-ibc", title: "IBC & Denom Traces", tag: "Interchain" },
  { name: "docs-ibc-channels", title: "IBC Channels & Routing", tag: "Interchain" },
  { name: "docs-ibc-packets", title: "IBC Packets & Timeouts", tag: "Interchain" },
  { name: "docs-ibc-assets", title: "IBC Asset Registry", tag: "Interchain" },
  { name: "docs-ibc-relayers", title: "IBC Relayers", tag: "Interchain" }
];
