import { ref, computed } from "vue";
import { useApi } from "./useApi";
import { useTxs } from "./useTxs";

export interface GasStats {
  averageGasPrice: number;
  medianGasPrice: number;
  minGasPrice: number;
  maxGasPrice: number;
  averageGasUsed: number;
  totalGasWanted: number;
  totalGasUsed: number;
  gasEfficiency: number;
  recentTxCount: number;
  timestamp: number;
}

export interface GasPriceRecommendation {
  slow: number;
  average: number;
  fast: number;
  instant: number;
}

export interface GasHistoryPoint {
  timestamp: number;
  avgPrice: number;
  avgUsed: number;
  txCount: number;
}

/**
 * Gas Tracker composable for monitoring network gas prices and usage
 * Blockscout-style gas analytics
 */
export function useGasTracker() {
  const api = useApi();
  const { searchRecent } = useTxs();

  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentStats = ref<GasStats | null>(null);
  const history = ref<GasHistoryPoint[]>([]);
  const recommendations = ref<GasPriceRecommendation | null>(null);

  /**
   * Parse gas price from transaction
   */
  const parseGasPrice = (tx: any): number | null => {
    const fee = tx?.tx?.auth_info?.fee;
    const gasLimit = Number(fee?.gas_limit ?? 0);
    const feeAmounts = fee?.amount ?? [];

    if (!gasLimit || gasLimit === 0 || !feeAmounts.length) return null;

    // Get primary fee amount (usually first in array)
    const primaryFee = feeAmounts[0];
    if (!primaryFee || !primaryFee.amount) return null;

    const feeAmount = Number(primaryFee.amount);
    if (!Number.isFinite(feeAmount) || feeAmount <= 0) return null;

    // Calculate gas price (fee amount / gas limit)
    return feeAmount / gasLimit;
  };

  /**
   * Parse gas used from transaction
   */
  const parseGasUsed = (tx: any): { wanted: number; used: number } | null => {
    const wanted = Number(tx?.tx_response?.gas_wanted ?? 0);
    const used = Number(tx?.tx_response?.gas_used ?? 0);

    if (!Number.isFinite(wanted) || !Number.isFinite(used)) return null;

    return { wanted, used };
  };

  /**
   * Calculate statistics from recent transactions
   */
  const calculateStats = (txs: any[]): GasStats => {
    const gasPrices: number[] = [];
    const gasUsedAmounts: number[] = [];
    let totalWanted = 0;
    let totalUsed = 0;

    txs.forEach((tx) => {
      const price = parseGasPrice(tx);
      if (price !== null) gasPrices.push(price);

      const gas = parseGasUsed(tx);
      if (gas) {
        gasUsedAmounts.push(gas.used);
        totalWanted += gas.wanted;
        totalUsed += gas.used;
      }
    });

    // Calculate averages
    const avgPrice = gasPrices.length
      ? gasPrices.reduce((sum, p) => sum + p, 0) / gasPrices.length
      : 0;

    const avgUsed = gasUsedAmounts.length
      ? gasUsedAmounts.reduce((sum, u) => sum + u, 0) / gasUsedAmounts.length
      : 0;

    // Calculate median price
    const sortedPrices = [...gasPrices].sort((a, b) => a - b);
    const medianPrice = sortedPrices.length
      ? sortedPrices[Math.floor(sortedPrices.length / 2)]
      : 0;

    // Calculate efficiency
    const efficiency = totalWanted > 0 ? (totalUsed / totalWanted) * 100 : 0;

    return {
      averageGasPrice: avgPrice,
      medianGasPrice: medianPrice,
      minGasPrice: gasPrices.length ? Math.min(...gasPrices) : 0,
      maxGasPrice: gasPrices.length ? Math.max(...gasPrices) : 0,
      averageGasUsed: avgUsed,
      totalGasWanted: totalWanted,
      totalGasUsed: totalUsed,
      gasEfficiency: efficiency,
      recentTxCount: txs.length,
      timestamp: Date.now()
    };
  };

  /**
   * Calculate recommended gas prices based on recent network activity
   */
  const calculateRecommendations = (txs: any[]): GasPriceRecommendation => {
    const gasPrices = txs
      .map(parseGasPrice)
      .filter((p): p is number => p !== null)
      .sort((a, b) => a - b);

    if (gasPrices.length === 0) {
      // Default recommendations if no data
      return {
        slow: 0.025,
        average: 0.05,
        fast: 0.1,
        instant: 0.15
      };
    }

    // Calculate percentiles
    const percentile = (arr: number[], p: number) => {
      const index = Math.floor(arr.length * p);
      return arr[Math.min(index, arr.length - 1)];
    };

    return {
      slow: percentile(gasPrices, 0.25), // 25th percentile
      average: percentile(gasPrices, 0.5), // 50th percentile (median)
      fast: percentile(gasPrices, 0.75), // 75th percentile
      instant: percentile(gasPrices, 0.95) // 95th percentile
    };
  };

  /**
   * Fetch current gas statistics
   */
  const fetchCurrentStats = async (limit = 100) => {
    loading.value = true;
    error.value = null;

    try {
      const txs = await searchRecent(limit);

      if (!txs || txs.length === 0) {
        throw new Error("No recent transactions available");
      }

      currentStats.value = calculateStats(txs);
      recommendations.value = calculateRecommendations(txs);
    } catch (err: any) {
      error.value = err?.message || "Failed to fetch gas statistics";
      console.error("Gas tracker error:", err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Fetch historical gas data (last N hours)
   */
  const fetchHistory = async (hours = 24, intervalMinutes = 60) => {
    loading.value = true;
    error.value = null;

    try {
      const points: GasHistoryPoint[] = [];
      const now = Date.now();
      const msPerInterval = intervalMinutes * 60 * 1000;

      // For simplicity, we'll fetch recent txs and group them
      // In production, this should query by time ranges
      const txs = await searchRecent(1000);

      // Group transactions by time intervals
      const intervalBuckets = new Map<number, any[]>();

      txs.forEach((tx) => {
        const timestamp = new Date(tx.tx_response?.timestamp).getTime();
        if (!timestamp || Number.isNaN(timestamp)) return;

        const intervalKey = Math.floor(timestamp / msPerInterval) * msPerInterval;
        if (!intervalBuckets.has(intervalKey)) {
          intervalBuckets.set(intervalKey, []);
        }
        intervalBuckets.get(intervalKey)!.push(tx);
      });

      // Calculate stats for each interval
      Array.from(intervalBuckets.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([timestamp, intervalTxs]) => {
          const gasPrices = intervalTxs
            .map(parseGasPrice)
            .filter((p): p is number => p !== null);

          const gasUsed = intervalTxs
            .map((tx) => parseGasUsed(tx)?.used)
            .filter((u): u is number => u !== null);

          if (gasPrices.length > 0) {
            points.push({
              timestamp,
              avgPrice: gasPrices.reduce((sum, p) => sum + p, 0) / gasPrices.length,
              avgUsed: gasUsed.length
                ? gasUsed.reduce((sum, u) => sum + u, 0) / gasUsed.length
                : 0,
              txCount: intervalTxs.length
            });
          }
        });

      history.value = points;
    } catch (err: any) {
      error.value = err?.message || "Failed to fetch gas history";
      console.error("Gas history error:", err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * Format gas price for display
   */
  const formatGasPrice = (price: number, decimals = 4): string => {
    if (!Number.isFinite(price) || price === 0) return "0";
    return price.toFixed(decimals);
  };

  /**
   * Estimate transaction cost in native token
   */
  const estimateCost = (gasLimit: number, gasPrice: number): number => {
    return gasLimit * gasPrice;
  };

  /**
   * Get gas price category label
   */
  const getGasPriceLabel = (price: number): string => {
    if (!recommendations.value) return "Unknown";

    const { slow, average, fast } = recommendations.value;

    if (price <= slow) return "Slow";
    if (price <= average) return "Average";
    if (price <= fast) return "Fast";
    return "Instant";
  };

  /**
   * Get color class for gas price
   */
  const getGasPriceColor = (price: number): string => {
    if (!recommendations.value) return "slate";

    const { slow, average, fast } = recommendations.value;

    if (price <= slow) return "emerald";
    if (price <= average) return "cyan";
    if (price <= fast) return "amber";
    return "rose";
  };

  // Computed: Gas efficiency status
  const efficiencyStatus = computed(() => {
    if (!currentStats.value) return null;

    const eff = currentStats.value.gasEfficiency;
    if (eff >= 80) return { label: "Excellent", color: "emerald", icon: "?" };
    if (eff >= 60) return { label: "Good", color: "cyan", icon: "??" };
    if (eff >= 40) return { label: "Fair", color: "amber", icon: "??" };
    return { label: "Low", color: "rose", icon: "?" };
  });

  // Computed: Network congestion level
  const congestionLevel = computed(() => {
    if (!currentStats.value || !recommendations.value) return null;

    const avgPrice = currentStats.value.averageGasPrice;
    const fastPrice = recommendations.value.fast;

    if (avgPrice <= recommendations.value.slow) {
      return { label: "Low", color: "emerald", icon: "??" };
    }
    if (avgPrice <= recommendations.value.average) {
      return { label: "Moderate", color: "cyan", icon: "??" };
    }
    if (avgPrice <= fastPrice) {
      return { label: "High", color: "amber", icon: "??" };
    }
    return { label: "Very High", color: "rose", icon: "??" };
  });

  return {
    // State
    loading,
    error,
    currentStats,
    history,
    recommendations,

    // Actions
    fetchCurrentStats,
    fetchHistory,

    // Utilities
    formatGasPrice,
    estimateCost,
    getGasPriceLabel,
    getGasPriceColor,

    // Computed
    efficiencyStatus,
    congestionLevel
  };
}
