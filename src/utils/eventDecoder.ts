/**
 * Event Decoder Utilities for Transaction Events
 * Blockscout-style event pretty-printing and decoding
 */

export interface DecodedEvent {
  type: string;
  category: "transfer" | "delegation" | "contract" | "ibc" | "governance" | "burn" | "reward" | "other";
  icon: string;
  title: string;
  description: string;
  attributes: Array<{
    key: string;
    value: string;
    formatted?: string;
    link?: { name: string; params: Record<string, any> };
  }>;
  importance: "high" | "medium" | "low";
}

/**
 * Decode and categorize transaction events for better UX
 */
export function decodeEvent(event: { type: string; attributes: Array<{ key: string; value: string }> }): DecodedEvent {
  const type = event.type || "unknown";
  const attrs = event.attributes || [];
  
  const getAttr = (key: string) => attrs.find((a) => a.key === key)?.value;
  
  // Transfer events
  if (type === "transfer" || type === "coin_received" || type === "coin_spent") {
    return {
      type,
      category: "transfer",
      icon: "??",
      title: type === "coin_received" ? "Coins Received" : type === "coin_spent" ? "Coins Spent" : "Transfer",
      description: `${getAttr("amount") || "N/A"} transferred`,
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value),
        link: isAddress(a.value) ? { name: "account", params: { address: a.value } } : undefined
      })),
      importance: "high"
    };
  }
  
  // Delegation events
  if (type === "delegate" || type === "unbond" || type === "redelegate") {
    return {
      type,
      category: "delegation",
      icon: "??",
      title: type === "delegate" ? "Delegation" : type === "unbond" ? "Unbonding" : "Redelegation",
      description: `Staking operation: ${type}`,
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value),
        link: isValidatorAddress(a.value) 
          ? { name: "validators", params: {} }
          : isAddress(a.value) 
            ? { name: "account", params: { address: a.value } }
            : undefined
      })),
      importance: "high"
    };
  }
  
  // Reward events
  if (type === "withdraw_rewards" || type === "withdraw_commission") {
    return {
      type,
      category: "reward",
      icon: "??",
      title: type === "withdraw_commission" ? "Commission Withdrawn" : "Rewards Claimed",
      description: `${getAttr("amount") || "N/A"} claimed`,
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value)
      })),
      importance: "medium"
    };
  }
  
  // Burn events
  if (type === "burn" || type.includes("burn")) {
    return {
      type,
      category: "burn",
      icon: "??",
      title: "Token Burn",
      description: `${getAttr("amount") || getAttr("tokens_burned") || "N/A"} burned`,
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value)
      })),
      importance: "high"
    };
  }
  
  // IBC events
  if (type.includes("packet") || type.includes("ibc") || type === "recv_packet" || type === "fungible_token_packet") {
    return {
      type,
      category: "ibc",
      icon: "??",
      title: "IBC Transfer",
      description: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value)
      })),
      importance: "high"
    };
  }
  
  // Contract events
  if (type === "execute" || type === "instantiate" || type === "wasm" || type.startsWith("wasm-")) {
    return {
      type,
      category: "contract",
      icon: "??",
      title: "Smart Contract",
      description: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value),
        link: isContractAddress(a.value) 
          ? { name: "contract-detail", params: { address: a.value } }
          : isAddress(a.value)
            ? { name: "account", params: { address: a.value } }
            : undefined
      })),
      importance: "high"
    };
  }
  
  // Governance events
  if (type === "proposal_vote" || type === "submit_proposal" || type === "proposal_deposit") {
    return {
      type,
      category: "governance",
      icon: "???",
      title: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      description: `Governance action: ${type}`,
      attributes: attrs.map((a) => ({
        key: a.key,
        value: a.value,
        formatted: formatAttributeValue(a.key, a.value)
      })),
      importance: "medium"
    };
  }
  
  // Default/other events
  return {
    type,
    category: "other",
    icon: "??",
    title: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: `Event: ${type}`,
    attributes: attrs.map((a) => ({
      key: a.key,
      value: a.value,
      formatted: formatAttributeValue(a.key, a.value),
      link: isAddress(a.value) ? { name: "account", params: { address: a.value } } : undefined
    })),
    importance: "low"
  };
}

/**
 * Format attribute values for better display
 */
function formatAttributeValue(key: string, value: string): string {
  // Amount formatting
  if (key === "amount" || key.includes("amount")) {
    const match = value.match(/^(\d+)([a-z][a-z0-9/]+)$/i);
    if (match) {
      const amount = match[1];
      const denom = match[2];
      // Simple formatting - could be enhanced with token metadata
      if (denom.startsWith("u")) {
        const num = Number(amount) / 1_000_000;
        return `${num.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${denom.slice(1).toUpperCase()}`;
      }
      return `${Number(amount).toLocaleString()} ${denom}`;
    }
  }
  
  // Address shortening
  if (isAddress(value)) {
    return `${value.slice(0, 12)}...${value.slice(-6)}`;
  }
  
  // Base64 decoding attempt
  if (key.includes("data") && value.length > 20 && /^[A-Za-z0-9+/=]+$/.test(value)) {
    try {
      const decoded = atob(value);
      if (decoded.length < 100) return decoded;
      return `${decoded.slice(0, 50)}... (decoded)`;
    } catch {
      return value;
    }
  }
  
  return value;
}

function isAddress(value: string): boolean {
  return /^(cosmos1|retro1|cosmosvaloper1|retrovaloper1)[a-z0-9]{38,}$/i.test(value);
}

function isValidatorAddress(value: string): boolean {
  return /^(cosmosvaloper1|retrovaloper1)[a-z0-9]{38,}$/i.test(value);
}

function isContractAddress(value: string): boolean {
  return /^(cosmos1|retro1)[a-z0-9]{38,}$/i.test(value) && value.length >= 45;
}

/**
 * Group events by category for organized display
 */
export function groupEventsByCategory(events: DecodedEvent[]): Record<string, DecodedEvent[]> {
  const grouped: Record<string, DecodedEvent[]> = {
    transfer: [],
    delegation: [],
    contract: [],
    ibc: [],
    governance: [],
    burn: [],
    reward: [],
    other: []
  };
  
  events.forEach((event) => {
    grouped[event.category].push(event);
  });
  
  return grouped;
}

/**
 * Get color class for event category
 */
export function getCategoryColor(category: DecodedEvent["category"]): string {
  const colors: Record<DecodedEvent["category"], string> = {
    transfer: "emerald",
    delegation: "indigo",
    contract: "purple",
    ibc: "cyan",
    governance: "amber",
    burn: "rose",
    reward: "pink",
    other: "slate"
  };
  return colors[category] || "slate";
}
