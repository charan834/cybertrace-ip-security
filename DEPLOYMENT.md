# Deploy the existing CYBERTRACE application

The application is a single Node.js service. Express serves both the compiled React frontend and `/api/*`, so frontend and backend use the same origin and no CORS configuration is required. The existing UI and application code do not need changes.

## Render web service

1. Sign in to [Render](https://dashboard.render.com/) and choose **New → Web Service**.
2. Connect GitHub and select `cybertrace-ip-security`, using its published default branch. Leave the root directory empty.
3. Select the Node runtime and a service plan appropriate for your usage.
4. Set **Build Command** to `npm ci --include=dev && npm run build`.
5. Set **Start Command** to `npm start` and **Health Check Path** to `/api/health`.
6. Set the environment variables below through Render's environment settings; never put a private key in the repository.
7. Create the web service. After a successful deployment, open its assigned HTTPS URL and check `/api/health`.

| Environment variable | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `HTTPS_ONLY` | `true` |
| `IP_API_URL` | `https://api.ipdata.co/` |
| `IP_API_KEY` | Your private ipdata key; omit to use clearly labeled demo mode |
| `DEMO_MODE` | `false` for live mode when a key is supplied |
| `CACHE_TTL_SECONDS` | `300` |
| `PROVIDER_TIMEOUT_MS` | `8000` |
| `TRUSTED_PROXY_CIDRS` | Only verified addresses/CIDRs for your actual ingress proxies |

Let the host supply `PORT`; the existing server reads it. Install development dependencies during the build because Vite is required to compile the frontend. Secrets remain in server environment variables; the browser only receives normalized lookup results.

See the official [Render Express deployment guide](https://render.com/docs/deploy-node-express-app) and [web service configuration](https://render.com/docs/web-services).

## Verify visitor detection before enabling live traffic

The application deliberately rejects untrusted forwarding headers. On a managed host, configure `TRUSTED_PROXY_CIDRS` from verified ingress/network information supplied by that host. Do not guess ranges, set a universal trusted range, or trust arbitrary user-supplied forwarding headers.

After configuring the proxy, verify `/api/my-ip` from an external client. It should return the client's public address. If the host cannot provide a safe trust boundary, public-IP search still works, while automatic detection correctly reports `PUBLIC_IP_UNAVAILABLE`. Demo mode returns `ip: null` by design.

Validate the following after deployment:

- `/api/health` returns `success: true` and the expected mode.
- A manual public IPv4/IPv6 lookup returns live provider data when a key is set.
- A private address returns a 422 error, never a fabricated location.
- Maps load with visible attribution; unavailable coordinates/signals remain unavailable.
- Exported reports have the correct live/demo classification.
- Browser assets contain no private API key, and `/api/*` requests use the same HTTPS origin.

## Docker or another Node host

The existing `Dockerfile` builds the frontend and runs the Express server as a non-root user:

```sh
docker build -t cybertrace .
docker run --rm --name cybertrace -p 3000:3000 --env-file .env -e HOST=0.0.0.0 cybertrace
```

For a non-container Node host:

```sh
npm ci --include=dev
npm run build
npm start
```

Use Node.js 22.15 or newer, configure HTTPS and environment secrets through your infrastructure, and set `HOST=0.0.0.0` when required by the host. `.env.example` contains only non-secret defaults; real `.env` files are ignored by both Git and Docker.

## Vercel

This repository currently starts a persistent Express listener and keeps its rate limits/cache in process memory. A Node web service or the provided Docker image preserves this architecture. No Vercel-specific serverless adapter has been added, because this publishing task must preserve the existing application. Do not deploy only the `dist/` directory: doing so would omit the required backend API.

## Operational considerations

The current rate limiter and cache are per process. For multiple replicas, add appropriate shared infrastructure or ingress rate limiting. Choose a map provider/plan suitable for your traffic and comply with its attribution and usage terms. IP geolocation is approximate, reputation can be incomplete, and the local risk score is not proof of device security. The global activity map remains a demo visualization in both modes.
