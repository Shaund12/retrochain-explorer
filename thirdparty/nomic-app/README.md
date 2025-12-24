# Nomic App (upstream)

This folder is reserved for the Nomic app source. To pull upstream code as a submodule:

```sh
git submodule add https://github.com/nomic-io/nomic-app thirdparty/nomic-app
cd thirdparty/nomic-app && git checkout main
```

After pulling, integrate into RetroChain Explorer by:
- Updating Nomic chain config to RetroChain (chain ID `retrochain-mainnet`, RPC `/rpc`, REST `/api`).
- Replacing wallet adapters with the existing Keplr-based flow in `src/composables/useKeplr.ts`.
- Mounting the ported UI in `src/views/NomicAppView.vue` and route `/nomic`.
