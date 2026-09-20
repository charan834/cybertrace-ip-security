import test from "node:test";
import assert from "node:assert/strict";
import { publicIP } from "../backend/utils/ip.js";
import {
  scoreThreat,
  normalizeProvider,
} from "../backend/models/intelligence.js";
import {
  createIntelligenceService,
  DEMO_FIXTURE,
} from "../backend/services/intelligence.js";
import { createApp } from "../backend/app.js";
const config = {
  key: "server-only-secret",
  url: "https://api.ipdata.co/",
  timeout: 100,
  ttl: 300,
  demo: false,
  trustedProxies: [],
};
test("strict IPv4 and IPv6 validation and canonicalization", () => {
  assert.equal(publicIP("8.8.8.8"), "8.8.8.8");
  assert.equal(
    publicIP("2606:4700:4700:0000:0000:0000:0000:1111"),
    "2606:4700:4700::1111",
  );
  assert.equal(publicIP("::ffff:8.8.8.8"), "8.8.8.8");
  for (const ip of [
    "999.1.1.1",
    "127.1",
    "0x08080808",
    "8.8.8.8:80",
    "https://8.8.8.8",
    "1.2.3",
    "2606::zz",
    "fe80::1%eth0",
    "",
    undefined,
    ["8.8.8.8"],
  ])
    assert.throws(
      () => publicIP(ip),
      (e) => e.code === "INVALID_IP_ADDRESS",
      String(ip),
    );
});
test("private, reserved, special and documentation ranges are rejected", () => {
  for (const ip of [
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "198.18.0.1",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:db8::1",
    "::ffff:192.168.1.1",
    "64:ff9b::808:808",
  ])
    assert.throws(
      () => publicIP(ip),
      (e) => e.code === "PRIVATE_NETWORK_ADDRESS",
      ip,
    );
});
test("scores require all five booleans and use documented weights", () => {
  assert.equal(scoreThreat({}).score, null);
  assert.equal(
    scoreThreat({
      is_proxy: false,
      is_tor: false,
      is_vpn: false,
      is_known_attacker: false,
    }).score,
    null,
  );
  const signals = {
    is_proxy: false,
    is_tor: false,
    is_vpn: false,
    is_known_attacker: false,
    is_known_abuser: false,
  };
  assert.equal(scoreThreat(signals).score, 100);
  assert.equal(scoreThreat({ ...signals, is_vpn: true }).score, 95);
  assert.equal(
    scoreThreat({ ...signals, is_known_attacker: true, is_known_abuser: true })
      .level,
    "CRITICAL",
  );
  assert.equal(scoreThreat({ ...signals, is_datacenter: true }).score, 100);
  assert.equal(scoreThreat({ ...signals, is_vpn: "false" }).score, null);
});
test("missing fields stay absent, valid zero coordinates are preserved", () => {
  const data = normalizeProvider(
    { ip: "8.8.8.8", latitude: 0, longitude: 0 },
    "8.8.8.8",
  );
  assert.equal(data.latitude, 0);
  assert.equal(data.longitude, 0);
  assert.equal(data.city, undefined);
  assert.equal(data.risk.score, null);
  const bad = normalizeProvider(
    { latitude: 91, longitude: 0, threat: { is_proxy: "false" } },
    "8.8.8.8",
  );
  assert.equal(bad.latitude, undefined);
  assert.deepEqual(bad.threat, {});
});
test("demo never enriches the searched IP or calls an external provider", async () => {
  const service = createIntelligenceService({ ...config, demo: true }, () => {
    throw Error("Unexpected network request");
  });
  const data = await service.lookup("8.8.8.8");
  assert.equal(data.ip, "203.0.113.42");
  assert.equal(data.mode, "demo");
  await assert.rejects(service.lookup("192.168.1.1"), (e) => e.status === 422);
});
test("provider requests remain server-side, deduplicate and cache", async () => {
  let requests = 0;
  const service = createIntelligenceService(config, async (url) => {
    requests++;
    assert.equal(url.hostname, "api.ipdata.co");
    assert.equal(url.searchParams.get("api-key"), config.key);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ ...DEMO_FIXTURE, ip: "8.8.8.8" }));
  });
  const results = await Promise.all([
    service.lookup("8.8.8.8"),
    service.lookup("8.8.8.8"),
  ]);
  assert.equal(requests, 1);
  assert.equal(results[0].mode, "live");
  assert.equal((await service.lookup("8.8.8.8")).cached, true);
  assert.equal(requests, 1);
  assert.ok(!JSON.stringify(results).includes(config.key));
});
test("provider failures have safe stable error codes", async () => {
  for (const [status, expected] of [
    [429, "PROVIDER_RATE_LIMIT"],
    [401, "PROVIDER_CONFIGURATION_ERROR"],
    [403, "PROVIDER_CONFIGURATION_ERROR"],
    [500, "INTELLIGENCE_SERVICE_UNAVAILABLE"],
  ]) {
    const service = createIntelligenceService(
      config,
      async () => new Response("private error", { status }),
    );
    await assert.rejects(
      service.lookup("8.8.8.8"),
      (e) => e.code === expected && !e.message.includes("private error"),
    );
  }
  await assert.rejects(
    createIntelligenceService(config, async () => {
      throw new DOMException("timeout", "TimeoutError");
    }).lookup("8.8.8.8"),
    (e) => e.code === "PROVIDER_TIMEOUT",
  );
  await assert.rejects(
    createIntelligenceService(
      config,
      async () => new Response("{invalid"),
    ).lookup("8.8.8.8"),
    (e) => e.status === 502,
  );
  await assert.rejects(
    createIntelligenceService(
      config,
      async () => new Response(JSON.stringify({ ip: "1.1.1.1" })),
    ).lookup("8.8.8.8"),
    (e) => e.code === "INVALID_PROVIDER_RESPONSE",
  );
});
async function withServer(settings, fn) {
  const app = createApp(
    { ...config, ...settings },
    async () => new Response(JSON.stringify({ ip: "8.8.8.8" })),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test("arbitrary forwarded headers are not trusted", async () =>
  withServer({}, async (base) => {
    const response = await fetch(`${base}/api/my-ip`, {
      headers: { "X-Forwarded-For": "8.8.8.8" },
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "PUBLIC_IP_UNAVAILABLE");
  }));
test("explicitly trusted proxy walks the forwarding chain safely", async () =>
  withServer({ trustedProxies: ["127.0.0.1/32"] }, async (base) => {
    const response = await fetch(`${base}/api/my-ip`, {
      headers: { "X-Forwarded-For": "1.1.1.1, 8.8.8.8" },
    });
    assert.equal((await response.json()).ip, "8.8.8.8");
  }));
test("API endpoints, no-store, permissions and missing IP behavior", async () =>
  withServer({ demo: true, production: true }, async (base) => {
    const visitor = await (await fetch(`${base}/api/my-ip`)).json();
    assert.equal(visitor.ip, null);
    assert.equal(visitor.mode, "demo");
    for (const endpoint of [
      "ip-intelligence",
      "geolocation",
      "threat-intelligence",
    ]) {
      const response = await fetch(`${base}/api/${endpoint}?ip=8.8.8.8`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.ok(
        response.headers.get("permissions-policy").includes("geolocation=()"),
      );
      const body = await response.json();
      assert.equal(body.mode, "demo");
      assert.equal(body.ip, "203.0.113.42");
    }
    assert.equal((await fetch(`${base}/api/ip-intelligence`)).status, 400);
    assert.equal((await fetch(`${base}/api/not-found`)).status, 404);
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.providerStatus, "demo");
  }));
test("request limit returns a clean 429 without calling the provider", async () =>
  withServer({ demo: true }, async (base) => {
    for (let i = 0; i < 40; i++)
      assert.equal((await fetch(`${base}/api/my-ip`)).status, 200);
    const response = await fetch(`${base}/api/my-ip`);
    assert.equal(response.status, 429);
    assert.equal((await response.json()).error.code, "RATE_LIMITED");
  }));
