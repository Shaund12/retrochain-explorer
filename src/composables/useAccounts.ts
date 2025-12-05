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

  // Fetch all accounts with balances
  const fetchAccounts = async (limit = 100) => {
    loading.value = true;
    error.value = null;
    accounts.value = [];

    try {
      // Get latest block to know current height
      const latestRes = await api.get('/cosmos/base/tendermint/v1beta1/blocks/latest');
      const latest = parseInt(latestRes.data?.block?.header?.height ?? "0", 10);

      // Scan recent blocks to find unique addresses
      const addressMap = new Map<string, Set<string>>();
      const scanLimit = Math.min(1000, latest); // Scan last 1000 blocks max
      
      for (let h = latest; h > latest - scanLimit && h > 0; h--) {
        try {
          const bRes = await api.get(`/cosmos/base/tendermint/v1beta1/blocks/${h}`);
          const txs = bRes.data?.block?.data?.txs || [];
          
          for (const txBase64 of txs) {
            try {
              // Decode transaction to find addresses
              const txBytes = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
              const txStr = new TextDecoder().decode(txBytes);
              
              // Extract cosmos addresses using regex
              const matches = txStr.match(/cosmos1[a-z0-9]{38,}/g);
              if (matches) {
                matches.forEach(addr => {
                  if (!addressMap.has(addr)) {
                    addressMap.set(addr, new Set());
                  }
                });
              }
            } catch {}
          }
        } catch {}
        
        // Break if we have enough addresses
        if (addressMap.size >= limit) break;
      }

      // Fetch balances for each address
      const wallets: WalletSummary[] = [];
      let processed = 0;
      
      for (const [address] of addressMap) {
        if (processed >= limit) break;
        
        try {
          const balRes = await api.get(`/cosmos/bank/v1beta1/balances/${address}`);
          const balances = balRes.data?.balances || [];
          
          if (balances.length > 0) {
            const mainBalance = balances[0];
            wallets.push({
              address,
              balance: mainBalance.amount || '0',
              denom: mainBalance.denom || 'uretro'
            });
          } else {
            // Include address even with zero balance
            wallets.push({
              address,
              balance: '0',
              denom: 'uretro'
            });
          }
        } catch {
          // Skip addresses that error
        }
        
        processed++;
      }

      // Sort by balance (descending)
      wallets.sort((a, b) => parseInt(b.balance) - parseInt(a.balance));
      
      accounts.value = wallets;
      totalAccounts.value = addressMap.size;
      error.value = null;
    } catch (e: any) {
      error.value = e?.message ?? String(e);
      accounts.value = [];
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
