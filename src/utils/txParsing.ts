export type TxDirection = "in" | "out" | "self";

export type Transfer = {
  amount: number;
  denom: string;
  direction: TxDirection;
};

export type Coin = { amount: string; denom: string };

export type ArcadeReward = {
  amount: number;
  sessionId?: string;
  player?: string;
  gameId?: string;
  msgIndex?: string;
};

export const extractMessageTypes = (txResponse: any): string[] => {
  const messages: any[] | undefined = txResponse?.tx?.body?.messages;
  if (!Array.isArray(messages)) return [];
  return messages
    .map((msg) => msg?.["@type"] || msg?.type || "")
    .filter((type: string) => typeof type === "string" && type.length > 0);
};

export const aggregateTransferTotals = (logs: any[] | undefined | null): Coin[] => {
  if (!Array.isArray(logs)) return [];
  const totals = new Map<string, bigint>();

  logs.forEach((log) => {
    const events: any[] = log?.events || [];
    events.forEach((evt) => {
      if (evt?.type !== "transfer") return;
      const attrs: any[] = evt.attributes || [];
      attrs.forEach((a) => {
        const key = String(a?.key || "").toLowerCase();
        if (key !== "amount") return;
        const value = String(a?.value || "");
        value
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .forEach((p) => {
            const match = p.match(/^(-?\d+)([a-zA-Z\/]+)$/);
            if (!match) return;
            const amt = BigInt(match[1]);
            const denom = match[2];
            const prev = totals.get(denom) ?? 0n;
            totals.set(denom, prev + amt);
          });
      });
    });
  });

  return Array.from(totals.entries()).map(([denom, amount]) => ({ denom, amount: amount.toString() }));
};

export const aggregateArcadeRewards = (resp: any): ArcadeReward[] => {
  const collectEvents = (): any[] => {
    const topLevel = Array.isArray(resp?.events) ? resp.events : [];
    const fromLogs = Array.isArray(resp?.logs)
      ? resp.logs.flatMap((log: any) => Array.isArray(log?.events) ? log.events : [])
      : [];
    return [...topLevel, ...fromLogs];
  };

  const events = collectEvents();
  if (!events.length) return [];

  const rewards: ArcadeReward[] = [];

  events.forEach((ev) => {
    if (ev?.type !== "arcade.reward_distributed") return;
    const attrs: any[] = Array.isArray(ev?.attributes) ? ev.attributes : [];
    const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
      if (curr?.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    const amount = Number(map.reward_amount ?? map.amount ?? map.tokens_burned);
    if (!Number.isFinite(amount)) return;

    rewards.push({
      amount,
      sessionId: map.session_id,
      player: map.player,
      gameId: map.game_id,
      msgIndex: map.msg_index
    });
  });

  return rewards;
};

export const aggregateBurnTotals = (resp: any): Coin[] => {
  const events: any[] = Array.isArray(resp?.events) ? resp.events : [];
  if (!events.length) return [];
  const totals = new Map<string, bigint>();
  const burnMsgIndices = new Set<string>();

  const add = (amount: string, denom: string) => {
    if (!amount || !denom) return;
    try {
      const big = BigInt(amount);
      totals.set(denom, (totals.get(denom) ?? 0n) + big);
    } catch {}
  };

  const parseAmountDenom = (raw?: string) => {
    if (!raw || typeof raw !== "string") return null;
    const match = raw.match(/^(-?\d+)([a-zA-Z\/:]+)$/);
    if (!match) return null;
    return { amount: match[1], denom: match[2] };
  };

  events.forEach((ev) => {
    const attrs: any[] = Array.isArray(ev?.attributes) ? ev.attributes : [];
    const map = attrs.reduce((acc: Record<string, string>, curr: any) => {
      if (curr?.key) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (ev?.type === "burn") {
      const parsed = parseAmountDenom(map.amount);
      if (parsed) add(parsed.amount, parsed.denom);
      if (map.msg_index) burnMsgIndices.add(map.msg_index);
      return;
    }

    if (map.tokens_burned) {
      if (map.msg_index && burnMsgIndices.has(map.msg_index)) return;
      const denom = map.denom || "uretro";
      add(map.tokens_burned, denom);
    }
  });

  return Array.from(totals.entries()).map(([denom, amount]) => ({ denom, amount: amount.toString() }));
};

export const parseTransfers = (logsOrEvents: any, address: string): Transfer[] => {
  if (!logsOrEvents) return [];
  const addr = address.toLowerCase();
  const transfers: Transfer[] = [];

  // Normalize into an array of objects with "events" arrays.
  let logs: any[] = [];

  // If a full tx_response was passed, prefer its logs, then events fallback.
  if (logsOrEvents?.txhash && Array.isArray(logsOrEvents.logs)) {
    logs = logsOrEvents.logs as any[];
    if ((!logs || !logs.length) && Array.isArray(logsOrEvents.events)) {
      logs = [{ events: logsOrEvents.events }];
    }
  } else if (Array.isArray(logsOrEvents) && logsOrEvents.length && logsOrEvents[0]?.events) {
    logs = logsOrEvents as any[];
  } else if (Array.isArray(logsOrEvents) && logsOrEvents.length && logsOrEvents[0]?.type && logsOrEvents[0]?.attributes) {
    logs = [{ events: logsOrEvents }];
  } else if (Array.isArray(logsOrEvents) && !logsOrEvents.length) {
    logs = [];
  }

  if (!Array.isArray(logs)) return [];

  logs.forEach((log) => {
    const events: any[] = log?.events || [];
    events.forEach((evt) => {
      if (evt?.type !== "transfer") return;
      const attrs: any[] = evt.attributes || [];
      const senders: string[] = [];
      const recipients: string[] = [];
      const amounts: string[] = [];

      attrs.forEach((a) => {
        const key = String(a?.key || "").toLowerCase();
        const value = String(a?.value || "");
        if (key === "sender") senders.push(value);
        if (key === "recipient") recipients.push(value);
        if (key === "amount") amounts.push(value);
      });

      const maxLen = Math.max(senders.length, recipients.length, amounts.length);
      for (let i = 0; i < maxLen; i++) {
        const sender = (senders[i] || "").toLowerCase();
        const recipient = (recipients[i] || "").toLowerCase();
        const rawAmount = amounts[i] || amounts[amounts.length - 1] || "";
        if (!rawAmount) continue;

        const parts = rawAmount
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);

        parts.forEach((p) => {
          const match = p.match(/^(\d+)([a-zA-Z/]+)$/);
          if (!match) return;
          const amt = Number(match[1]);
          const denom = match[2];
          const involvedSender = sender === addr;
          const involvedRecipient = recipient === addr;
          if (!involvedSender && !involvedRecipient) return;
          const direction: TxDirection = involvedSender && involvedRecipient ? "self" : involvedRecipient ? "in" : "out";
          transfers.push({ amount: amt, denom, direction });
        });
      }
    });
  });

  return transfers;
};

export const txContainsAddress = (txResponse: any, address: string) => {
  const addrLower = address.toLowerCase();
  const inspect = (value: any) => {
    if (value === null || value === undefined) return false;
    try {
      return JSON.stringify(value).toLowerCase().includes(addrLower);
    } catch {
      return false;
    }
  };

  return inspect(txResponse?.tx?.body?.messages) || inspect(txResponse?.logs) || inspect(txResponse?.tx?.auth_info?.signer_infos);
};

export const buildSummaryFromResponse = <TSummary extends { hash: string; height: number; timestamp?: string; arcadeRewards?: ArcadeReward[] }>(
  resp: any,
  fallback: { hash: string; height: number; timestamp?: string },
  build: (base: {
    hash: string;
    height: number;
    codespace?: string;
    code?: number;
    gasWanted?: string;
    gasUsed?: string;
    timestamp?: string;
    messageTypes: string[];
    valueTransfers: Coin[];
    fees: Coin[];
    burns: Coin[];
    arcadeRewards: ArcadeReward[];
  }) => TSummary
): TSummary => {
  return build({
    hash: resp?.txhash || fallback.hash,
    height: parseInt(resp?.height ?? String(fallback.height), 10),
    codespace: resp?.codespace,
    code: resp?.code,
    gasWanted: resp?.gas_wanted,
    gasUsed: resp?.gas_used,
    timestamp: resp?.timestamp || fallback.timestamp,
    messageTypes: extractMessageTypes(resp),
    valueTransfers: aggregateTransferTotals(resp?.logs),
    fees: resp?.tx?.auth_info?.fee?.amount || [],
    burns: aggregateBurnTotals(resp),
    arcadeRewards: aggregateArcadeRewards(resp)
  });
};
