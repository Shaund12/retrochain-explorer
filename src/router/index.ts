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
import DexView from "@/views/DexView.vue";
import TokenomicsView from "@/views/TokenomicsView.vue";
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

const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: HomeView },
  { path: "/blocks", name: "blocks", component: BlocksView },
  { path: "/blocks/:height", name: "block-detail", component: BlockDetailView, props: true },
  { path: "/txs", name: "txs", component: TxsView },
  { path: "/txs/:hash", name: "tx-detail", component: TxDetailView, props: true },
  { path: "/account/:address?", name: "account", component: AccountView, props: true },
  { path: "/accounts", name: "accounts", component: AccountsView },
  { path: "/accounts/ecosystem", name: "ecosystem-accounts", component: EcosystemWalletsView },
  { path: "/ibc", name: "ibc", component: IbcView },
  { path: "/validators", name: "validators", component: ValidatorsView },
  { path: "/governance", name: "governance", component: GovernanceView },
  { path: "/staking", name: "staking", component: StakingView },
  { path: "/staking/wbtc", name: "btc-stake", component: BtcStakeView },
  { path: "/buy", name: "buy", component: BuyView },
  { path: "/dex", name: "dex", component: DexView },
  { path: "/tokens", name: "tokens", component: TokensView },
  { path: "/nft/:id", name: "nft-detail", component: NftDetailView, props: true },
  { path: "/tokenomics", name: "tokenomics", component: TokenomicsView },
  { path: "/contracts", name: "contracts", component: ContractsView },
  { path: "/contracts/:address", name: "contract-detail", component: ContractDetailView, props: true },
  { path: "/changelog", name: "changelog", component: ChangelogView },
  { path: "/legal", name: "legal", component: LegalView },
  { path: "/api-test", name: "api-test", component: ApiTestView },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
