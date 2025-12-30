throw new Error(
  "`api/index.js` was a Vercel serverless proxy. This project is deployed behind nginx, so /api should be proxied by nginx (see nginx-explorer.conf). Remove this file if you are no longer using Vercel."
);
