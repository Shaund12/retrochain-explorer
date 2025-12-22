This folder is unused in production.

The explorer-hosted Swagger/OpenAPI spec is served from:
  /api-docs/cosmos-sdk-swagger.yaml

Reason: the production nginx config serves /api-docs/ as static files, while /swagger/* may be proxied.
