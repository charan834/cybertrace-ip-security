import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import proxyaddr from "proxy-addr";
import { publicIP, ApiError } from "./utils/ip.js";
import { createIntelligenceService } from "./services/intelligence.js";
export function createApp(config, fetcher) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustedProxies?.length)
    app.set("trust proxy", proxyaddr.compile(config.trustedProxies));
  const mapOrigin = new URL(config.mapUrl || "https://tile.openstreetmap.org")
    .origin;
  app.use(
    helmet({
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      contentSecurityPolicy: config.production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", mapOrigin],
              connectSrc: ["'self'"],
              fontSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              upgradeInsecureRequests: config.secure ? [] : null,
            },
          }
        : false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    next();
  });
  const service = createIntelligenceService(config, fetcher);
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.json({
      success: true,
      status: "online",
      mode: config.demo ? "demo" : "live",
      provider: "ipdata",
      providerStatus: service.status(),
      timestamp: new Date().toISOString(),
    }),
  );
  // Forwarded headers are deliberately ignored unless a proxy is explicitly trusted.
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 40,
      validate: { xForwardedForHeader: false },
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) =>
        res
          .status(429)
          .json({
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests. Please wait a minute and try again.",
            },
          }),
    }),
  );
  app.get("/api/my-ip", (req, res) => {
    if (config.demo)
      return res.json({
        success: true,
        mode: "demo",
        ip: null,
        message:
          "Visitor detection is disabled in demo mode. All displayed intelligence is fictional sample data.",
      });
    try {
      res.json({ success: true, mode: "live", ip: publicIP(req.ip) });
    } catch {
      throw new ApiError(
        422,
        "PUBLIC_IP_UNAVAILABLE",
        "A public client IP could not be determined. On localhost, enter a public IP manually. Behind a proxy, configure trusted proxy CIDRs.",
      );
    }
  });
  app.get(
    ["/api/ip-intelligence", "/api/geolocation", "/api/threat-intelligence"],
    async (req, res) => {
      const data = await service.lookup(req.query.ip);
      const meta = {
        success: true,
        mode: data.mode,
        ip: data.ip,
        provider: data.provider,
        fetchedAt: data.fetchedAt,
        analyzedAt: new Date().toISOString(),
        cached: data.cached,
      };
      if (req.path === "/api/geolocation")
        return res.json({
          ...meta,
          ...Object.fromEntries(
            [
              "country",
              "countryCode",
              "region",
              "city",
              "postal",
              "latitude",
              "longitude",
              "timezone",
              "currency",
            ]
              .filter((k) => data[k] !== undefined)
              .map((k) => [k, data[k]]),
          ),
          accuracy: "Approximate IP Geolocation",
        });
      if (req.path === "/api/threat-intelligence")
        return res.json({ ...meta, threat: data.threat, risk: data.risk });
      res.json({ ...data, ...meta });
    },
  );
  app.use("/api", (_req, res) =>
    res
      .status(404)
      .json({
        success: false,
        error: { code: "NOT_FOUND", message: "API endpoint not found." },
      }),
  );
  app.use((error, _req, res, next) => {
    if (res.headersSent) return next(error);
    res
      .status(error instanceof ApiError ? error.status : 500)
      .json({
        success: false,
        error: {
          code: error instanceof ApiError ? error.code : "INTERNAL_ERROR",
          message:
            error instanceof ApiError
              ? error.message
              : "The request could not be completed. Please try again.",
        },
      });
  });
  return app;
}
