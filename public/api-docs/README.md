# RetroChain Swagger Split Pack

This pack splits the Swagger 2.0 spec into smaller module files to avoid YAML parser errors and huge single-file loads.

## Files
- definitions.yaml (shared schemas)
- retrochain-*.swagger.yaml (per-module specs)

## Swagger UI config (dropdown)
```js
SwaggerUIBundle({
  dom_id: '#swagger-ui',
  urls: [
  { url: '/api-docs/retrochain-auth.swagger.yaml', name: 'auth' },
  { url: '/api-docs/retrochain-bank.swagger.yaml', name: 'bank' },
  { url: '/api-docs/retrochain-circuit.swagger.yaml', name: 'circuit' },
  { url: '/api-docs/retrochain-consensus.swagger.yaml', name: 'consensus' },
  { url: '/api-docs/retrochain-distribution.swagger.yaml', name: 'distribution' },
  { url: '/api-docs/retrochain-evidence.swagger.yaml', name: 'evidence' },
  { url: '/api-docs/retrochain-gov.swagger.yaml', name: 'gov' },
  { url: '/api-docs/retrochain-group.swagger.yaml', name: 'group' },
  { url: '/api-docs/retrochain-mint.swagger.yaml', name: 'mint' },
  { url: '/api-docs/retrochain-nft.swagger.yaml', name: 'nft' },
  { url: '/api-docs/retrochain-node.swagger.yaml', name: 'node' },
  { url: '/api-docs/retrochain-params.swagger.yaml', name: 'params' },
  { url: '/api-docs/retrochain-slashing.swagger.yaml', name: 'slashing' },
  { url: '/api-docs/retrochain-staking.swagger.yaml', name: 'staking' },
  { url: '/api-docs/retrochain-tendermint.swagger.yaml', name: 'tendermint' },
  { url: '/api-docs/retrochain-tx.swagger.yaml', name: 'tx' },
  { url: '/api-docs/retrochain-upgrade.swagger.yaml', name: 'upgrade' },
  ],
  urlsPrimaryName: 'bank',
});
```

### Notes
- Each section spec references schemas via `definitions.yaml#/definitions/...`
- Serve all files from the same origin/path (example: `/api-docs/`)
