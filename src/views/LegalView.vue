<script setup lang="ts">
import RcDisclaimer from "@/components/RcDisclaimer.vue";

const lastUpdated = "January 12, 2025";

interface Section {
  title: string;
  description: string;
  bullets: string[];
}

const sections: Section[] = [
  {
    title: "1. Acceptance of Terms",
    description:
      "By accessing or using the RetroChain Explorer (the \"Service\"), you acknowledge that you have read, understand, and agree to be bound by these Terms and any additional policies referenced herein.",
    bullets: [
      "If you do not agree to these Terms, you must immediately discontinue use of the Service.",
      "We may update these Terms at any time with or without notice. Continued use constitutes acceptance of the revised Terms.",
      "These Terms govern only the Explorer UI and related APIsnot the RetroChain blockchain protocol itself."
    ]
  },
  {
    title: "2. Eligibility & User Obligations",
    description:
      "You represent and warrant that you are legally permitted to use blockchain software and that you are responsible for ensuring compliance with local laws.",
    bullets: [
      "You are at least 18 years of age, or the legal age of majority in your jurisdiction.",
      "You are not located in, or a citizen or resident of, a jurisdiction in which the use of this Service is prohibited by applicable law, rule or regulation.",
      "You will only use the Service for lawful purposes and in accordance with all applicable laws and regulations."
    ]
  },
  {
    title: "3. Non-Custodial & Wallet Responsibility",
    description:
      "RetroChain Explorer is a non-custodial interface. You remain fully responsible for managing your wallets, private keys, seed phrases, security hardware, and any approvals you sign.",
    bullets: [
      "We never request or store your private keys or seed phrases.",
      "You must verify all transaction details, fees, and recipient addresses directly in your wallet before signing.",
      "If you lose access to your wallet or sign a malicious transaction, we cannot assist with recovery or reversal."
    ]
  },
  {
    title: "4. Risk Disclosure",
    description:
      "Blockchain networks, smart contracts, bridges, and third-party integrations carry inherent risk, including but not limited to bugs, downtime, or permanent loss of funds.",
    bullets: [
      "RetroChain mainnet is experimentalexpect upgrades, validator rotations, and RPC changes without notice.",
      "On-chain transactions are irreversible and may fail due to gas limits, fee volatility, or sequence mismatches.",
      "Cross-chain bridges, DEX modules, and arcade features are provided on an \"as-is\" basis with no warranty of availability."
    ]
  },
  {
    title: "5. No Financial, Tax, or Legal Advice",
    description:
      "Content surfaced by the Service (APIs, dashboards, analytics) is informational only and should not be interpreted as investment, legal, or tax advice.",
    bullets: [
      "Always conduct your own research before interacting with smart contracts or tokens.",
      "Consult qualified professionals for personalized advice.",
      "Historical performance, charts, and metrics do not guarantee future results."
    ]
  },
  {
    title: "6. Prohibited Conduct",
    description:
      "You agree not to engage in activity that compromises the integrity, security, or availability of the Service or the RetroChain network.",
    bullets: [
      "No fraud, market manipulation, money laundering, or sanctions evasion.",
      "No automated scraping, penetration testing, or load testing without prior written consent.",
      "No uploading of malicious code, exploits, or attempts to gain unauthorized access to infrastructure."
    ]
  },
  {
    title: "7. Third-Party Services & Links",
    description:
      "The Explorer surfaces links to wallets, bridges, DEXes, and analytics providers that are not operated by RetroChain.",
    bullets: [
      "We do not endorse or assume responsibility for third-party services, contracts, or content.",
      "Your interactions with third-party services are solely between you and the applicable provider.",
      "Any issues or losses resulting from third-party integrations must be resolved directly with that provider."
    ]
  },
  {
    title: "8. Limitation of Liability & Disclaimer",
    description:
      "To the maximum extent permitted by law, RetroChain contributors, maintainers, and affiliates will not be liable for any direct, indirect, incidental, special, consequential, or exemplary damages arising from your use of the Service.",
    bullets: [
      "The Service is provided on an \"as-is\" and \"as-available\" basis without warranties of any kind.",
      "We do not guarantee uninterrupted access, accurate data, or error-free code.",
      "You assume full responsibility for any loss of funds, opportunity cost, or compliance obligations."
    ]
  }
];

const contactEmail = "legal@retrochain.dev";
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-2">
      <p class="text-xs text-slate-400">Last updated: {{ lastUpdated }}</p>
      <h1 class="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        Terms &amp; Conditions
      </h1>
      <p class="text-sm text-slate-300">
        This page summarizes the legal terms that govern your use of the RetroChain Explorer UI, APIs, and related tooling.
      </p>
    </div>

    <RcDisclaimer type="danger" title="Legal &amp; Risk Disclosure">
      <p>
        RetroChain Explorer is an experimental interface for interacting with an experimental Cosmos SDK chain. You remain solely
        responsible for wallet security, transaction review, and regulatory compliance in your jurisdiction.
      </p>
      <p class="mt-2">
        Nothing on this site constitutes investment, financial, tax, or legal advice. Use of the Service signifies your agreement to these
        Terms and all updates published on this page.
      </p>
    </RcDisclaimer>

    <section
      v-for="section in sections"
      :key="section.title"
      class="card">
      <h2 class="text-lg font-semibold text-slate-100 mb-2">{{ section.title }}</h2>
      <p class="text-sm text-slate-300 mb-3">{{ section.description }}</p>
      <ul class="list-disc list-inside space-y-2 text-sm text-slate-400">
        <li v-for="item in section.bullets" :key="item">{{ item }}</li>
      </ul>
    </section>

    <div class="card">
      <h2 class="text-base font-semibold text-slate-100 mb-2">Contact &amp; Notices</h2>
      <p class="text-sm text-slate-300">
        Questions about these Terms or requests for additional permissions can be sent to
        <a :href="`mailto:${contactEmail}`" class="text-indigo-300 hover:text-indigo-200 underline-offset-2 hover:underline">
          {{ contactEmail }}
        </a>.
        Only inquiries related to legal or compliance topics will receive a response.
      </p>
    </div>
  </div>
</template>
