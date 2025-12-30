import { computed, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { useStorage } from "@vueuse/core";

export type CoingeckoSimplePriceResponse = Record<string, Record<string, number>>;

export type CoingeckoUsdPrices = {
  OSMO?: number;
  ATOM?: number;
  USDC?: number;
  WBTC?: number;
};

export const useCoingeckoUsdPrices = () => {
  const cachedOverrides = useStorage<CoingeckoUsdPrices>("rc:prices:coingecko:usd", {});

  const query = useQuery({
    queryKey: ["prices", "coingecko", "usd"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=osmosis,cosmos,usd-coin,wrapped-bitcoin&vs_currencies=usd",
        { cache: "no-store" }
      );
      return (await res.json()) as CoingeckoSimplePriceResponse;
    },
    staleTime: 5 * 60_000,
    gcTime: 60 * 60_000,
    retry: 0
  });

  const overrides = computed<CoingeckoUsdPrices>(() => {
    const data = query.data.value;
    if (!data) return cachedOverrides.value || {};

    const out: CoingeckoUsdPrices = {};

    const osmo = Number(data?.osmosis?.usd);
    if (Number.isFinite(osmo) && osmo > 0) out.OSMO = osmo;

    const atom = Number(data?.cosmos?.usd);
    if (Number.isFinite(atom) && atom > 0) out.ATOM = atom;

    const usdc = Number(data?.["usd-coin"]?.usd);
    if (Number.isFinite(usdc) && usdc > 0) out.USDC = usdc;

    const wbtc = Number(data?.["wrapped-bitcoin"]?.usd);
    if (Number.isFinite(wbtc) && wbtc > 0) out.WBTC = wbtc;

    return out;
  });

  watch(
    overrides,
    (val) => {
      if (!val) return;
      if (!Object.keys(val).length) return;
      cachedOverrides.value = val;
    },
    { deep: true }
  );

  return {
    ...query,
    overrides
  };
};
