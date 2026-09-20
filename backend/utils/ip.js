import ipaddr from "ipaddr.js";
import { isIP } from "node:net";
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export function normalizeIP(value) {
  if (typeof value !== "string" || value.includes("%") || !isIP(value.trim()))
    throw new ApiError(
      400,
      "INVALID_IP_ADDRESS",
      "Please enter a valid IPv4 or IPv6 address.",
    );
  let parsed = ipaddr.parse(value.trim());
  if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress())
    parsed = parsed.toIPv4Address();
  return parsed;
}
export function publicIP(value) {
  const parsed = normalizeIP(value);
  const globalV6 =
    parsed.kind() !== "ipv6" || parsed.match(ipaddr.parse("2000::"), 3);
  if (parsed.range() !== "unicast" || !globalV6)
    throw new ApiError(
      422,
      "PRIVATE_NETWORK_ADDRESS",
      "This address is private, reserved, or not publicly routable and cannot normally be geolocated through public IP intelligence services.",
    );
  return parsed.toString();
}
