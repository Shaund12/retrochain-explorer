import { ref } from 'vue';
import { useApi } from './useApi';

export interface WalletSummary {
  address: string;
  balance: string;
  denom: string;
  txCount?: number;
}

export function useAccounts() {
  const api = useApi();
  const accounts = ref<WalletSummary[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalAccounts = ref(0);

  const resolveAccountAddress = (account: any): string | null => {
    if (!account) return null;
    if (typeof account.address === "string" && account.address.length) {
      return account.address;
    }
    if (account.base_account) {
      return resolveAccountAddress(account.base_account);
    }
    if (account.base_vesting_account?.base_account) {
      return resolveAccountAddress(account.base_vesting_account.base_account);
    }
    return null;
  };

  const pickPrimaryBalance = (balances: any[]) => {
    if (!Array.isArray(balances) || balances.length === 0) {
      return { denom: "uretro", amount: "0" };
    }
    const preferred = balances.find((b: any) => b.denom === "uretro") || balances[0];
    return {
      denom: preferred?.denom ?? "uretro",
      amount: preferred?.amount ?? "0"
    };
  };

  // Fetch all accounts with balances
  const fetchAccounts = async (limit = 100) => {
    loading.value = true;
    error.value = null;
    accounts.value = [];
    totalAccounts.value = 0;

    const wallets: WalletSummary[] = [];
    const seen = new Set<string>();
    const normalizedLimit = Math.max(1, limit);
    let nextKey: string | undefined;
    let reportedTotal: number | null = null;

    try {
      while (wallets.length < normalizedLimit) {
        const remaining = normalizedLimit - wallets.length;
        const pageLimit = Math.min(remaining, 100); // avoid oversized responses

        const params: Record<string, string> = {
          "pagination.limit": String(pageLimit),
          "pagination.count_total": "true"
        };
        if (nextKey) {
          params["pagination.key"] = nextKey;
        }

        const res = await api.get(`/cosmos/auth/v1beta1/accounts`, { params });
        const pagination = res.data?.pagination ?? {};

        if (reportedTotal === null) {
          const totalRaw = pagination.total;
          const parsed = typeof totalRaw === "string"
            ? parseInt(totalRaw, 10)
            : typeof totalRaw === "number"
              ? totalRaw
              : NaN;
          reportedTotal = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        }

        const list: any[] = res.data?.accounts ?? [];
        if (!list.length) break;

        const addresses = list
          .map(resolveAccountAddress)
          .filter((addr): addr is string => !!addr && !seen.has(addr));

        addresses.forEach(addr => seen.add(addr));

        if (!addresses.length) {
          nextKey = pagination.next_key;
          if (!nextKey) break;
          continue;
        }

        const balanceResults = await Promise.allSettled(
          addresses.map(addr => api.get(`/cosmos/bank/v1beta1/balances/${addr}`))
        );

        for (let i = 0; i < addresses.length && wallets.length < normalizedLimit; i++) {
          const address = addresses[i];
          const result = balanceResults[i];

          if (result.status === "fulfilled") {
            const primary = pickPrimaryBalance(result.value.data?.balances || []);
            wallets.push({
              address,
              balance: primary.amount,
              denom: primary.denom
            });
          } else {
            wallets.push({ address, balance: "0", denom: "uretro" });
          }
        }

        nextKey = pagination.next_key;
        if (!nextKey) break;
      }

      wallets.sort((a, b) => parseInt(b.balance) - parseInt(a.balance));

      accounts.value = wallets;
      totalAccounts.value = reportedTotal ?? wallets.length;
      error.value = null;
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      accounts.value = [];
      totalAccounts.value = 0;
    } finally {
      loading.value = false;
    }
  };

  return {
    accounts,
    loading,
    error,
    totalAccounts,
    fetchAccounts
  };
}

