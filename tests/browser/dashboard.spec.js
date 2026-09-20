import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("desktop analysis, validation, export and methodology", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".ip-number")).toContainText("203.0.113.42");
  await expect(page.locator(".demo-banner")).toContainText("DEMO DATA");
  await expect(page.locator(".score-value strong")).toContainText("95");
  await page.getByLabel("IP INTELLIGENCE SEARCH").fill("8.8.8.8");
  await page.getByRole("button", { name: "Analyze IP", exact: true }).click();
  await expect(page.locator(".ip-number")).toContainText("203.0.113.42");
  await page.getByLabel("IP INTELLIGENCE SEARCH").fill("192.168.1.1");
  await page.getByRole("button", { name: "Analyze IP", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "PRIVATE NETWORK ADDRESS",
  );
  await page.getByLabel("IP INTELLIGENCE SEARCH").fill("not-an-ip");
  await page.getByRole("button", { name: "Analyze IP", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("INVALID IP ADDRESS");
  await page.getByLabel("IP INTELLIGENCE SEARCH").fill("2606:4700:4700::1111");
  await page.getByRole("button", { name: "Analyze IP", exact: true }).click();
  await expect(page.locator(".ip-number")).toContainText("203.0.113.42");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("DEMO");
  await page.getByRole("button", { name: "View scoring methodology" }).click();
  await expect(page.getByRole("dialog")).toContainText("Local heuristic v1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause map animation" }).click();
  await expect(
    page.getByRole("button", { name: "Play map animation" }),
  ).toBeVisible();
  await expect(page.locator(".score-value strong")).toContainText("95");
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("mobile navigation, readable layout and no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".ip-number")).toContainText("203.0.113.42");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Geolocation", exact: true }).click();
  await expect(page.locator("#geolocation")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("live partial responses show unavailable fields and unknown risk", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        success: true,
        status: "online",
        mode: "live",
        providerStatus: "available",
      },
    }),
  );
  await page.route("**/api/my-ip", (route) =>
    route.fulfill({
      json: { success: true, mode: "live", ip: "2606:4700:4700::1111" },
    }),
  );
  await page.route("**/api/ip-intelligence?*", (route) =>
    route.fulfill({
      json: {
        success: true,
        mode: "live",
        ip: "2606:4700:4700::1111",
        ipVersion: "IPv6",
        provider: "ipdata",
        analyzedAt: new Date().toISOString(),
        threat: {},
        risk: {
          score: null,
          level: "UNKNOWN",
          availableSignals: 0,
          requiredSignals: 5,
          riskFactors: [],
          protectiveFactors: [],
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".ip-number")).toContainText(
    "2606:4700:4700::1111",
  );
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page.locator(".score-value")).toContainText("INSUFFICIENT DATA");
  await expect(page.locator("#geolocation")).toContainText(
    "Location coordinates unavailable",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("accessible dashboard and final visual capture", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".score-value strong")).toContainText("95");
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.locator("#geolocation").scrollIntoViewIfNeeded();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(
    page
      .locator(".leaflet-tile-loaded")
      .first()
      .or(page.locator(".map-error"))
      .first(),
  ).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.screenshot({
    path: "test-results/desktop-preview.png",
    animations: "disabled",
  });
  await page.screenshot({
    path: "test-results/desktop-full.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/mobile-preview.png",
    animations: "disabled",
  });
});
