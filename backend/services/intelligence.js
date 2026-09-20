import { ApiError, publicIP } from "../utils/ip.js";
import { normalizeProvider } from "../models/intelligence.js";
// Fictional fixture on TEST-NET-3; never attached to a searched or visitor IP.
export const DEMO_FIXTURE = {
  ip: "203.0.113.42",
  country_name: "United States",
  country_code: "US",
  region: "California",
  city: "San Francisco",
  postal: "94105",
  latitude: 37.7749,
  longitude: -122.4194,
  time_zone: { name: "America/Los_Angeles" },
  currency: { code: "USD" },
  asn: {
    asn: "AS64500",
    name: "Example Transit Network",
    route: "203.0.113.0/24",
    type: "isp",
  },
  company: { name: "Example Network, Inc." },
  hostname: "gateway.example.net",
  threat: {
    is_proxy: false,
    is_vpn: true,
    is_tor: false,
    is_datacenter: false,
    is_known_attacker: false,
    is_known_abuser: false,
    is_threat: false,
  },
};
export function createIntelligenceService(config, fetcher = fetch) {
  const cache = new Map(),
    pending = new Map();
  let lastProviderStatus = "not_checked";
  async function lookup(input) {
    const ip = publicIP(input);
    if (config.demo)
      return {
        ...normalizeProvider(DEMO_FIXTURE, DEMO_FIXTURE.ip),
        mode: "demo",
        provider: "Fictional demonstration fixture",
        fetchedAt: new Date().toISOString(),
        cached: false,
      };
    const existing = cache.get(ip);
    if (existing && existing.expires > Date.now())
      return { ...existing.data, cached: true };
    if (pending.has(ip)) return pending.get(ip);
    if (pending.size >= 25)
      throw new ApiError(
        503,
        "SERVICE_BUSY",
        "The intelligence service is busy. Please try again shortly.",
      );
    const job = (async () => {
      try {
        const url = new URL(
          encodeURIComponent(ip),
          config.url.endsWith("/") ? config.url : `${config.url}/`,
        );
        url.searchParams.set("api-key", config.key);
        const response = await fetcher(url, {
          signal: AbortSignal.timeout(config.timeout),
          redirect: "error",
          headers: { Accept: "application/json" },
        });
        if (response.status === 429)
          throw new ApiError(
            429,
            "PROVIDER_RATE_LIMIT",
            "The intelligence provider quota has been reached. Please try again later.",
          );
        if ([401, 403].includes(response.status))
          throw new ApiError(
            503,
            "PROVIDER_CONFIGURATION_ERROR",
            "The provider rejected the server configuration. Check the API key and subscription.",
          );
        if (!response.ok)
          throw new ApiError(
            502,
            "INTELLIGENCE_SERVICE_UNAVAILABLE",
            "The external intelligence provider did not respond successfully. Please try again.",
          );
        const raw = await response.json();
        if (
          !raw ||
          typeof raw !== "object" ||
          Array.isArray(raw) ||
          !raw.ip ||
          publicIP(raw.ip) !== ip
        )
          throw new ApiError(
            502,
            "INVALID_PROVIDER_RESPONSE",
            "The provider returned an incomplete or mismatched response. Please try again.",
          );
        const data = {
          ...normalizeProvider(raw, ip),
          mode: "live",
          provider: "ipdata",
          fetchedAt: new Date().toISOString(),
          cached: false,
        };
        if (cache.size >= 500) cache.delete(cache.keys().next().value);
        cache.set(ip, { data, expires: Date.now() + config.ttl * 1000 });
        lastProviderStatus = "available";
        return data;
      } catch (error) {
        lastProviderStatus = "unavailable";
        if (error instanceof ApiError && error.status >= 429) throw error;
        if (["TimeoutError", "AbortError"].includes(error.name))
          throw new ApiError(
            504,
            "PROVIDER_TIMEOUT",
            "The intelligence request timed out. Please try again.",
          );
        throw new ApiError(
          502,
          "INTELLIGENCE_SERVICE_UNAVAILABLE",
          "The external intelligence provider is unavailable or returned an invalid response. Please try again.",
        );
      } finally {
        pending.delete(ip);
      }
    })();
    pending.set(ip, job);
    return job;
  }
  return { lookup, status: () => (config.demo ? "demo" : lastProviderStatus) };
}
