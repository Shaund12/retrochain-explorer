# Copilot Usage Notes

## Release Checklist

Always gate every release behind an updated `CHANGELOG.md` entry.
1. Summarize the work shipped (features, improvements, fixes, ops) with accurate dates.
2. Link the summary back to the supporting markdown specs (e.g., `REAL_TRANSACTIONS.md`, `MAINNET_LIVE_UPDATE.md`).
3. Do not mark a release complete until `CHANGELOG.md` reflects the change set.

Keeping the changelog current ensures the automated agents, human reviewers, and downstream users know exactly what shipped in each deployment cycle.