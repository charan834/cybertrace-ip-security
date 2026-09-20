import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";
const key = process.env.IP_API_KEY?.trim(),
  url = process.env.IP_API_URL || "https://api.ipdata.co/";
if (new URL(url).protocol !== "https:")
  throw new Error("IP_API_URL must use HTTPS.");
const positive = (value, fallback) =>
  Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value)
    : fallback;
const app = createApp({
  key,
  url,
  production,
  secure: process.env.HTTPS_ONLY === "true",
  demo: !key || process.env.DEMO_MODE === "true",
  timeout: positive(process.env.PROVIDER_TIMEOUT_MS, 8000),
  ttl: positive(process.env.CACHE_TTL_SECONDS, 300),
  trustedProxies: (process.env.TRUSTED_PROXY_CIDRS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  mapUrl: process.env.VITE_MAP_TILE_URL,
});
let vite;
if (production) {
  app.use(
    express.static(path.join(root, "dist"), {
      maxAge: "1h",
      setHeaders: (res, file) => {
        if (file.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const server = app.listen(
  positive(process.env.PORT, 3000),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      `CYBERTRACE running at http://${process.env.HOST || "localhost"}:${process.env.PORT || 3000} (${!key || process.env.DEMO_MODE === "true" ? "DEMO" : "LIVE"})`,
    ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    server.close(async () => {
      await vite?.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
