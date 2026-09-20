import { isIP } from "node:net";
export const SIGNALS = [
  ["is_known_attacker", "Known attacker", 45],
  ["is_known_abuser", "Known abuse", 30],
  ["is_tor", "Tor exit/node", 10],
  ["is_proxy", "Proxy detected", 10],
  ["is_vpn", "VPN detected", 5],
];
export function scoreThreat(threat = {}) {
  const available = SIGNALS.filter(([key]) => typeof threat[key] === "boolean");
  const riskFactors = available
    .filter(([key]) => threat[key])
    .map(([key, label, weight]) => ({ key, label, weight }));
  const protectiveFactors = available
    .filter(([key]) => !threat[key])
    .map(([, label]) => `${label}: not reported`);
  const score =
    available.length === SIGNALS.length
      ? Math.max(0, 100 - riskFactors.reduce((n, f) => n + f.weight, 0))
      : null;
  return {
    score,
    level:
      score === null
        ? "UNKNOWN"
        : score >= 85
          ? "LOW"
          : score >= 60
            ? "MEDIUM"
            : score >= 30
              ? "HIGH"
              : "CRITICAL",
    availableSignals: available.length,
    requiredSignals: SIGNALS.length,
    riskFactors,
    protectiveFactors,
    explanation:
      "Local heuristic v1: start at 100; subtract 45 for known attacker, 30 for known abuse, 10 for Tor, 10 for proxy, and 5 for VPN. All five explicit boolean signals are required. Negative reports retain the baseline; they do not prove safety. VPN, proxy and Tor use is not inherently malicious. Hosting and datacenter status do not affect the score.",
  };
}
const cleanString = (v) =>
  typeof v === "string" && v.trim() ? v.slice(0, 300) : undefined;
export function normalizeProvider(raw, ip) {
  const result = { ip, ipVersion: `IPv${isIP(ip)}` };
  const fields = {
    country: raw.country_name,
    countryCode: raw.country_code,
    region: raw.region,
    city: raw.city,
    postal: raw.postal,
    timezone: raw.time_zone?.name,
    currency: raw.currency?.code,
    isp: raw.asn?.type === "isp" ? raw.asn?.name : raw.carrier?.name,
    organization: raw.company?.name,
    asn: raw.asn?.asn,
    asnOrganization: raw.asn?.name,
    network: raw.asn?.route,
    connectionType: raw.asn?.type,
    hostname: raw.hostname,
  };
  for (const [key, value] of Object.entries(fields))
    if (cleanString(value)) result[key] = cleanString(value);
  if (
    typeof raw.latitude === "number" &&
    Number.isFinite(raw.latitude) &&
    Math.abs(raw.latitude) <= 90 &&
    typeof raw.longitude === "number" &&
    Number.isFinite(raw.longitude) &&
    Math.abs(raw.longitude) <= 180
  ) {
    result.latitude = raw.latitude;
    result.longitude = raw.longitude;
  }
  result.threat = {};
  for (const key of [
    "is_tor",
    "is_vpn",
    "is_proxy",
    "is_datacenter",
    "is_known_attacker",
    "is_known_abuser",
    "is_threat",
    "is_anonymous",
    "is_bogon",
  ])
    if (typeof raw.threat?.[key] === "boolean")
      result.threat[key] = raw.threat[key];
  if (typeof raw.asn?.type === "string")
    result.threat.is_hosting = raw.asn.type === "hosting";
  result.risk = scoreThreat(result.threat);
  return result;
}
