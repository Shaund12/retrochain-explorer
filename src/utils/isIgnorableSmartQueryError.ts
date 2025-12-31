export const isIgnorableSmartQueryError = (err: any) => {
  const status = err?.response?.status;
  if (status === 400 || status === 422) return true;

  const msg: string | undefined = err?.response?.data?.message || err?.message;
  if (typeof msg !== "string") return false;

  const lowered = msg.toLowerCase();
  return (
    lowered.includes("unknown variant") ||
    lowered.includes("unknown field") ||
    lowered.includes("error parsing") ||
    lowered.includes("failed to parse") ||
    // BattlePoints contracts on some networks may not include the new stats endpoints yet.
    lowered.includes("battlestats not found")
  );
};
