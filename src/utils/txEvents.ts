export type EventAttribute = { key?: string; value?: string };

export const attributesToMap = (attributes: any): Record<string, string> => {
  if (!Array.isArray(attributes)) return {};
  return attributes.reduce((acc: Record<string, string>, curr: EventAttribute) => {
    if (curr?.key) acc[String(curr.key)] = String(curr.value ?? "");
    return acc;
  }, {} as Record<string, string>);
};
