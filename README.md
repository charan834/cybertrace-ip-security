# CYBERTRACE

Intelligent IP Security & Geolocation Intelligence Platform. A responsive React SOC console with an Express backend, server-side ipdata integration, interactive approximate geolocation, transparent scoring, printable reports, and isolated demo mode.

## Quick start

Requires Node.js 22.15+ and npm.

```powershell
cd C:\Users\dharm\cybertrace
npm install
Copy-Item .env.example .env
npm run dev
```

Open **http://localhost:3000**. Without a key, the app works in DEMO MODE. Linux/macOS: use `cp .env.example .env`. For repeatable installs after the first installation, use `npm ci` with the included lockfile.

## Provider configuration

Create an API key with [ipdata](https://ipdata.co/) and set these server-only variables in `.env`:

```dotenv
IP_API_KEY=your_private_ipdata_key
IP_API_URL=https://api.ipdata.co/
```

Restart the server. The adapter implements ipdata's response schema and `api-key` authentication. `IP_API_URL` is an administrator-controlled ipdata-compatible HTTPS endpoint, not a generic adapter for unrelated providers. Never put private credentials in `VITE_*` variables. VPN signals depend on your subscription; missing fields stay unavailable. See [response fields](https://docs.ipdata.co/docs/all-response-fields) and [threat detection](https://docs.ipdata.co/docs/proxy-tor-and-threat-detection).

| Variable              | Default                  | Purpose                                                                   |
| --------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `IP_API_KEY`          | empty                    | Private server credential; empty selects demo                             |
| `IP_API_URL`          | `https://api.ipdata.co/` | HTTPS provider base URL                                                   |
| `DEMO_MODE`           | `false`                  | `true` explicitly selects demo even with a key                            |
| `HOST`                | `127.0.0.1`              | Bind address; use `0.0.0.0` in containers                                 |
| `PORT`                | `3000`                   | HTTP port                                                                 |
| `TRUSTED_PROXY_CIDRS` | empty                    | Comma-separated exact proxy addresses/CIDRs                               |
| `CACHE_TTL_SECONDS`   | `300`                    | In-memory lookup cache lifetime                                           |
| `PROVIDER_TIMEOUT_MS` | `8000`                   | Provider request timeout                                                  |
| `HTTPS_ONLY`          | `false`                  | Set true behind production HTTPS; enables CSP upgrade requests            |
| `VITE_MAP_TILE_URL`   | OSM standard tile URL    | Public browser tile URL, compiled at build time; also used for server CSP |

## Project structure

```text
cybertrace/
├── backend/
│   ├── app.js                    # Security headers, rate limiting, API routes
│   ├── server.js                 # Express + Vite dev / static production server
│   ├── models/intelligence.js    # Response normalization, scoring rules
│   ├── services/intelligence.js  # Provider adapter, cache, sample fixture
│   └── utils/ip.js               # Strict public IPv4/IPv6 validation
├── frontend/
│   ├── main.jsx
│   ├── pages/App.jsx             # Dashboard, search, reports, dialogs
│   ├── components/WorldMap.jsx   # Natural Earth map / abstract demo network
│   ├── components/GeoMap.jsx     # Lazy interactive Leaflet map
│   ├── components/UI.jsx        # Accessible reusable controls
│   └── styles/app.css            # Responsive SOC theme, animation, print styles
├── public/favicon.svg
├── tests/security.test.js
├── tests/browser/dashboard.spec.js
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── index.html
├── package.json
├── package-lock.json
├── playwright.config.js
├── vite.config.js
└── README.md
```

## Visitor detection and trust boundary

The frontend calls `GET /api/health`, then `GET /api/my-ip`, then the combined intelligence endpoint. Express uses the TCP socket address by default. Forwarded headers are ignored unless the immediate proxy and relevant chain match the explicit `TRUSTED_PROXY_CIDRS`. Configure exact proxy IPs or appropriately narrow CIDRs; never trust all addresses or arbitrary forwarded headers. The last untrusted hop is used as the client address. The ingress proxy should overwrite untrusted incoming forwarding headers.

On localhost the client is loopback, so live automatic public detection returns `PUBLIC_IP_UNAVAILABLE`; use a public IP search. The server does not substitute its own egress IP. In a deployed direct connection, a publicly routable socket address works automatically. In demo mode `/api/my-ip` deliberately returns `ip: null` and never mixes a visitor's address with sample intelligence.

## API reference

All endpoints return JSON. Intelligence responses include `success`, `mode`, `ip`, `provider`, `fetchedAt`, `analyzedAt`, and `cached`. Enriched fields are included only when supplied by the provider. Protocol version is derived from the validated address. Scores are explicitly local calculations.

| Method | Endpoint                              | Response                                                      |
| ------ | ------------------------------------- | ------------------------------------------------------------- |
| GET    | `/api/health`                         | Backend availability, mode, last provider status and UTC time |
| GET    | `/api/my-ip`                          | Validated public visitor IP; null in demo                     |
| GET    | `/api/ip-intelligence?ip=8.8.8.8`     | Combined identity, network, geolocation, threat and risk      |
| GET    | `/api/geolocation?ip=8.8.8.8`         | Available location fields, accuracy label and metadata        |
| GET    | `/api/threat-intelligence?ip=8.8.8.8` | Available boolean signals and local scoring result            |

IPv6 query example: `/api/ip-intelligence?ip=2606%3A4700%3A4700%3A%3A1111`.

```json
{
  "success": false,
  "error": {
    "code": "PRIVATE_NETWORK_ADDRESS",
    "message": "This address is private, reserved, or not publicly routable and cannot normally be geolocated through public IP intelligence services."
  }
}
```

Errors: 400 invalid/missing IP; 422 private/reserved IP or unavailable visitor public IP; 429 app or provider rate limit; 502 provider failure, malformed or mismatched response; 503 credentials/subscription error or busy service; 504 timeout. No upstream response bodies, secrets or stack traces are exposed. Unknown API routes return JSON 404.

## Demo behavior

No key (or `DEMO_MODE=true`) selects one wholly fictional TEST-NET-3 fixture: `203.0.113.42`, Example Transit Network, and a sample San Francisco map location. These are examples, not a claim about a real IP. A valid public search demonstrates the flow but always returns the same visibly labeled sample record; it never attaches fictitious details to the searched address. Invalid/private input is still rejected. Reports include the demo classification. Provider failures in live mode display errors; they never silently fall back to sample data.

The global activity visualization always uses nine illustrative nodes and eight animated routes. It is not a live threat feed in either mode. Pause control and reduced-motion support are included.

## Transparent score

Local heuristic v1 starts at 100 and requires all five explicit boolean signals:

| Signal present | Deduction |
| -------------- | --------: |
| Known attacker |        45 |
| Known abuser   |        30 |
| Tor            |        10 |
| Proxy          |        10 |
| VPN            |         5 |

LOW: 85–100; MEDIUM: 60–84; HIGH: 30–59; CRITICAL: 0–29. Missing any signal gives **INSUFFICIENT DATA / UNKNOWN**, never a made-up score. Negative reports retain baseline points, not proof of protection. VPN, proxy and Tor use is not inherently malicious. Datacenter and hosting flags do not deduct points. The interface exposes contributing factors and the formula. A complete sample fixture calculates 95; the UI never hard-codes a score.

## Reports and privacy

Export downloads an `IP INTELLIGENCE REPORT` as JSON containing the displayed data, available threat information, risk rules, timestamps, source, cache status and accuracy disclaimer. Print uses a dedicated print stylesheet and your browser's Print / Save as PDF dialog. Export and print do not contact another service.

IP-based geolocation is approximate and may identify an ISP, gateway or city/region rather than the exact device location. No GPS, camera, microphone, filesystem, Wi-Fi credentials, browsing history, device discovery, or port scanning is accessed. Permissions Policy disables geolocation, camera and microphone.

Live requests disclose the requested IP to ipdata. The map provider receives the browser IP and requested map tiles. No search history, user accounts or analytics are stored by this app. Memory caching retains up to 500 results; expired entries are not served and are overwritten or evicted (process restart clears all). Reverse-proxy and provider logs are outside this app's control. Review and configure your deployment logging/retention policy. Hostname, ISP, postal, currency, and security fields may be absent, and bot detection remains unavailable because this adapter does not infer it from datacenter status.

## Maps

The approximate location map uses Leaflet and OpenStreetMap standard tiles with visible attribution. It loads only when the section is near the viewport. Missing coordinates display an unavailable state, not invented coordinates. Tile failures show a warning while coordinates remain available. World geometry comes from the `world-atlas` package (Natural Earth); its routes are illustrations.

Follow the [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/): no bulk/offline downloads, preserve referrer and caching headers, retain attribution. OSM tiles have no service guarantee. For substantial production traffic, configure a suitable licensed provider, update attribution in `GeoMap.jsx` to meet its requirements, and rebuild. Use the same map URL environment setting at build and runtime to align CSP.

## Testing

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Backend tests cover strict IP parsing, private/special ranges, incomplete signals, scoring weights, zero coordinates, demo isolation, provider credentials/errors/timeouts, caching, concurrent request coalescing, proxy spoofing protection, endpoints, and security headers. Browser tests cover desktop/mobile layouts, IPv4/IPv6 search, private/invalid input, demo reporting, scoring dialog, animation control, and horizontal overflow. E2E tests require demo mode; ensure no live key or set `DEMO_MODE=true`. Screenshots are written to `test-results/`.

If Chromium downloads are unavailable and Chrome is already installed, use `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e` in PowerShell (or `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` on Linux/macOS).

Verified locally: production build, all 11 backend tests, all 4 browser tests against the production server, desktop/mobile visual review, and an axe WCAG A/AA scan with no detected violations. The browser suite also checks partial live-shaped responses, unknown risk, unavailable coordinates, and IPv6 layout. Provider error/response cases use controlled test responses; a real paid API key and externally deployed visitor flow have not been verified. The Docker recipe is supplied but has not been executed here. Automated accessibility checks do not replace a full manual audit.

## Production

```sh
npm ci
npm run build
npm start
```

Or use Docker:

```sh
docker build -t cybertrace .
docker run --rm --name cybertrace -p 3000:3000 --env-file .env -e HOST=0.0.0.0 cybertrace
```

Deploy the Node service behind HTTPS on a host supporting long-running Node applications. Set secrets through your host's environment manager. Set `NODE_ENV=production`, `HOST=0.0.0.0` as appropriate, and `HTTPS_ONLY=true` when HTTPS is terminated upstream. Configure narrow `TRUSTED_PROXY_CIDRS` based on your actual infrastructure. Serve only via your trusted ingress if using forwarded headers. Use `/api/health` for process health checks; `providerStatus` records the last lookup result, not guaranteed current provider availability.

The server uses Helmet/CSP, safe JSON errors, strict public-IP validation, a 40 request/minute/client limiter, 8-second provider timeout, 25 concurrent unique-request cap, request coalescing, a bounded 5-minute memory cache, and graceful shutdown. API responses use `Cache-Control: no-store` to prevent downstream caching of client-specific results. App rate limits/cache are per process; for multiple replicas, deploy a shared rate-limit/cache store or ingress limits. Configure provider quotas and infrastructure monitoring before exposing high-traffic production service. This project has no login/tenant isolation; its public lookup API is intentional.

Do not treat the local score as a certified security assessment or use it alone for enforcement decisions. Provider data freshness and plan coverage vary. A production provider key and deployed public client connection are required to verify live visitor enrichment end to end.
