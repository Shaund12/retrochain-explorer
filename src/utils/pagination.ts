export type ParamsSerializer = (params: Record<string, any>) => string;

export const defaultParamsSerializer: ParamsSerializer = (params) => {
  const search = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = (params as any)[key];
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((entry) => search.append(key, entry));
    else search.append(key, value);
  });
  return search.toString();
};

export type PaginatedResponse<T> = {
  items: T[];
  nextKey?: string;
};

type ApiLike = {
  get: (url: string, config?: any) => Promise<any>;
};

export const fetchPaginated = async <T>(
  api: ApiLike,
  path: string,
  dataKey: string,
  opts?: { limit?: number; paramsSerializer?: ParamsSerializer }
): Promise<PaginatedResponse<T>> => {
  const items: T[] = [];
  let nextKey: string | undefined;

  do {
    const res = await api.get(path, {
      params: {
        "pagination.limit": String(opts?.limit ?? 200),
        ...(nextKey ? { "pagination.key": nextKey } : {})
      },
      paramsSerializer: opts?.paramsSerializer ?? defaultParamsSerializer
    });

    const chunk: T[] = res.data?.[dataKey] ?? [];
    items.push(...chunk);
    nextKey = res.data?.pagination?.next_key || undefined;
  } while (nextKey);

  return { items };
};
