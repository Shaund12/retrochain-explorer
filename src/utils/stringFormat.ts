export type ShortenOptions = {
  head?: number;
  tail?: number;
  delimiter?: string;
};

export const safeTrim = (value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

export const shortenMiddle = (value?: string | null, options: ShortenOptions = {}): string => {
  const trimmed = safeTrim(value);
  if (!trimmed) return "?";

  const head = options.head ?? 6;
  const tail = options.tail ?? 6;
  const delimiter = options.delimiter ?? "?";

  if (trimmed.length <= head + tail + delimiter.length) return trimmed;
  return `${trimmed.slice(0, head)}${delimiter}${trimmed.slice(-tail)}`;
};
