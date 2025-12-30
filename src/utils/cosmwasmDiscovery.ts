type ApiLike = {
  get: (url: string, config?: any) => Promise<any>;
};

const defaultParamsSerializer = (params: Record<string, any>) => {
  const search = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((entry) => search.append(key, entry));
    else search.append(key, value);
  });
  return search.toString();
};

export const fetchCodeInfos = async (api: ApiLike, opts?: { limit?: number; paramsSerializer?: (params: any) => string }) => {
  try {
    const res = await api.get("/cosmwasm/wasm/v1/code", {
      params: {
        "pagination.limit": String(opts?.limit ?? 100)
      },
      paramsSerializer: opts?.paramsSerializer ?? defaultParamsSerializer
    });
    return Array.isArray(res.data?.code_infos) ? (res.data.code_infos as any[]) : [];
  } catch (err) {
    console.warn("Failed to fetch code infos", err);
    return [];
  }
};

export const fetchContractsForCode = async (
  api: ApiLike,
  codeId: string,
  opts?: { limit?: number; reverse?: boolean; paramsSerializer?: (params: any) => string }
) => {
  try {
    const res = await api.get(`/cosmwasm/wasm/v1/code/${codeId}/contracts`, {
      params: {
        "pagination.limit": String(opts?.limit ?? 50),
        "pagination.reverse": String(opts?.reverse ?? true)
      },
      paramsSerializer: opts?.paramsSerializer ?? defaultParamsSerializer
    });
    return Array.isArray(res.data?.contracts) ? (res.data.contracts as string[]) : [];
  } catch (err) {
    console.warn(`Failed to fetch contracts for code ${codeId}`, err);
    return [];
  }
};
