import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";
import HomeView from "@/views/HomeView.vue";
import BlocksView from "@/views/BlocksView.vue";
import BlockDetailView from "@/views/BlockDetailView.vue";
import TxsView from "@/views/TxsView.vue";
import TxDetailView from "@/views/TxDetailView.vue";
import AccountView from "@/views/AccountView.vue";
import AccountsView from "@/views/AccountsView.vue";
import ValidatorsView from "@/views/ValidatorsView.vue";
import GovernanceView from "@/views/GovernanceView.vue";
import StakingView from "@/views/StakingView.vue";
import BtcStakeView from "@/views/BtcStakeView.vue";
import BuyView from "@/views/BuyView.vue";
import IbcInfoView from "@/views/DexView.vue";
import ArcadeView from "@/views/ArcadeView.vue";
import TokenomicsView from "@/views/TokenomicsView.vue";
import DocsTokenomicsView from "@/views/DocsTokenomicsView.vue";
import DocsNetworkOverviewView from "@/views/DocsNetworkOverviewView.vue";
import DocsStakingGuideView from "@/views/DocsStakingGuideView.vue";
import DocsIbcGuideView from "@/views/DocsIbcGuideView.vue";
import DocsAccountsView from "@/views/DocsAccountsView.vue";
import DocsGovernanceView from "@/views/DocsGovernanceView.vue";
import DocsModulesView from "@/views/DocsModulesView.vue";
import DocsFeesAndGasView from "@/views/DocsFeesAndGasView.vue";
import DocsSmartContractsView from "@/views/DocsSmartContractsView.vue";
import DocsConsensusOpsView from "@/views/DocsConsensusOpsView.vue";
import DocsIbcChannelsView from "@/views/DocsIbcChannelsView.vue";
import DocsIbcPacketsView from "@/views/DocsIbcPacketsView.vue";
import DocsIbcAssetRegistryView from "@/views/DocsIbcAssetRegistryView.vue";
import DocsIbcRelayersView from "@/views/DocsIbcRelayersView.vue";
import DocsFeeCollectorFlowView from "@/views/DocsFeeCollectorFlowView.vue";
import DocsValidatorUptimeView from "@/views/DocsValidatorUptimeView.vue";
import TokensView from "@/views/TokensView.vue";
import NftDetailView from "@/views/NftDetailView.vue";
import ContractsView from "@/views/ContractsView.vue";
import ContractDetailView from "@/views/ContractDetailView.vue";
import NotFoundView from "@/views/NotFoundView.vue";
import ApiTestView from "@/views/ApiTestView.vue";
import LegalView from "@/views/LegalView.vue";
import ChangelogView from "@/views/ChangelogView.vue";
import EcosystemWalletsView from "@/views/EcosystemWalletsView.vue";
import IbcView from "@/views/IbcView.vue";
import DocsHubView from "@/views/DocsHubView.vue";
import SwaggerDocsView from "@/views/SwaggerDocsView.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: HomeView, meta: { title: "Home" } },
  { path: "/blocks", name: "blocks", component: BlocksView, meta: { title: "Blocks" } },
  { path: "/blocks/:height", name: "block-detail", component: BlockDetailView, props: true, meta: { title: "Block" } },
  { path: "/txs", name: "txs", component: TxsView, meta: { title: "Transactions" } },
  { path: "/txs/:hash", name: "tx-detail", component: TxDetailView, props: true, meta: { title: "Transaction" } },
  { path: "/account/:address?", name: "account", component: AccountView, props: true, meta: { title: "Account" } },
  { path: "/accounts", name: "accounts", component: AccountsView },
  { path: "/accounts/ecosystem", name: "ecosystem-accounts", component: EcosystemWalletsView },
  { path: "/ibc", name: "ibc", component: IbcView },
  { path: "/docs", name: "docs", component: DocsHubView },
  { path: "/api", name: "api", component: SwaggerDocsView },
  { path: "/validators", name: "validators", component: ValidatorsView },
  { path: "/governance", name: "governance", component: GovernanceView },
  { path: "/staking", name: "staking", component: StakingView },
  { path: "/staking/wbtc", name: "btc-stake", component: BtcStakeView },
  { path: "/buy", name: "buy", component: BuyView },
  { path: "/ibc-info", name: "ibc-info", component: IbcInfoView },
  { path: "/arcadedash", name: "arcade", component: ArcadeView },
  { path: "/arcade", redirect: { name: "arcade" } },
  { path: "/tokens", name: "tokens", component: TokensView },
  { path: "/nft/:id", name: "nft-detail", component: NftDetailView, props: true },
  { path: "/tokenomics", name: "tokenomics", component: TokenomicsView },
  { path: "/docs/tokenomics", name: "docs-tokenomics", component: DocsTokenomicsView },
  { path: "/docs/network", name: "docs-network", component: DocsNetworkOverviewView },
  { path: "/docs/staking", name: "docs-staking", component: DocsStakingGuideView },
  { path: "/docs/ibc", name: "docs-ibc", component: DocsIbcGuideView },
  { path: "/docs/accounts", name: "docs-accounts", component: DocsAccountsView },
  { path: "/docs/governance", name: "docs-governance", component: DocsGovernanceView },
  { path: "/docs/modules", name: "docs-modules", component: DocsModulesView },
  { path: "/docs/fees", name: "docs-fees", component: DocsFeesAndGasView },
  { path: "/docs/contracts", name: "docs-contracts", component: DocsSmartContractsView },
  { path: "/docs/consensus", name: "docs-consensus", component: DocsConsensusOpsView },
  { path: "/docs/ibc-channels", name: "docs-ibc-channels", component: DocsIbcChannelsView },
  { path: "/docs/ibc-packets", name: "docs-ibc-packets", component: DocsIbcPacketsView },
  { path: "/docs/ibc-assets", name: "docs-ibc-assets", component: DocsIbcAssetRegistryView },
  { path: "/docs/ibc-relayers", name: "docs-ibc-relayers", component: DocsIbcRelayersView },
  { path: "/docs/fees-flow", name: "docs-fees-flow", component: DocsFeeCollectorFlowView },
  { path: "/docs/validator-uptime", name: "docs-validator-uptime", component: DocsValidatorUptimeView },
  { path: "/contracts", name: "contracts", component: ContractsView, meta: { title: "Contracts" } },
  { path: "/contracts/:address", name: "contract-detail", component: ContractDetailView, props: true, meta: { title: "Contract" } },
  { path: "/changelog", name: "changelog", component: ChangelogView },
  { path: "/legal", name: "legal", component: LegalView },
  { path: "/api-test", name: "api-test", component: ApiTestView },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView, meta: { title: "Not Found" } }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.afterEach((to) => {
  const base = "RetroChain Explorer";
  const title = (to.meta?.title as string | undefined) || "";
  if (to.name === "tx-detail" && typeof to.params.hash === "string") {
    document.title = `${base} · 🔎 Tx ${to.params.hash.slice(0, 10)}…`;
    return;
  }
  if (to.name === "block-detail" && to.params.height) {
    document.title = `${base} · 🧱 Block #${String(to.params.height)}`;
    return;
  }
  if (to.name === "account" && typeof to.params.address === "string") {
    document.title = `${base} · 👤 Account ${to.params.address.slice(0, 10)}…`;
    return;
  }
  if (to.name === "contract-detail" && typeof to.params.address === "string") {
    document.title = `${base} · 📄 Contract ${to.params.address.slice(0, 10)}…`;
    return;
  }
  document.title = title ? `${base} · ${title}` : base;
});

export default router;
