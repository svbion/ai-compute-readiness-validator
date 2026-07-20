import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill("reviewer");
  await page.locator("#reviewer-password").fill("Reviewer Test Password 123!");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "GPU Validator" })).toBeVisible();
  await expect(page.getByText("Scenario controls")).toBeVisible();
  await expect(page.getByLabel("Evidence source")).toBeVisible();
}

async function expectProtectedRoutesUnauthenticated(request: APIRequestContext) {
  for (const path of ["/api/results?scenario=healthy", "/api/evidence-sources", "/reports/degraded/html", "/reports/degraded/json"]) {
    const response = await request.get(path);
    expect(response.status(), `${path} should stay protected`).toBe(401);
  }
}

test("root redirects unauthenticated visitors to the login page", async ({ page, request }) => {
  const root = await request.get("/", { maxRedirects: 0, headers: { Accept: "text/html" } });
  expect(root.status()).toBe(302);
  expect(root.headers().location).toBe("/login");

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "GPU Validator" })).toBeVisible();
  await expect(page.getByText("GPU Infrastructure Readiness, Validated")).toBeVisible();
});

test("login is the only unauthenticated public UI", async ({ page }) => {
  await page.goto("/docs");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/security");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/request-access");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("responsive login remains usable on mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile viewport coverage runs in the mobile project");
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.locator("#reviewer-password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("login page loads with accessible private reviewer entry", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "GPU Validator" })).toBeVisible();
  await expect(page.getByText("Private access to GPU infrastructure readiness")).toBeVisible();
  await expect(page.getByText("InfiniBand / RDMA")).toBeVisible();
  await expect(page.getByLabel("Username")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Username")).toHaveAttribute("type", "text");
  await expect(page.getByLabel("Username")).toHaveAttribute("name", "username");
  await expect(page.locator("#reviewer-password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
  await expect(page.getByText("Built by Sabion P. Frazier")).toBeVisible();
  await expect(page.getByText("This project is an independent portfolio project")).toBeVisible();
});

test("authentication-required redirect, invalid credentials, account lockout, login, and logout", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/login$/);

  const invalidUsername = `unknown-reviewer-${testInfo.project.name}-${testInfo.workerIndex}`.toLowerCase();
  await page.getByLabel("Username").fill(invalidUsername);
  await page.locator("#reviewer-password").fill("wrong password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid username or password");

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole("button", { name: "Sign In" }).click();
  }
  await expect(page.getByRole("alert")).toContainText(/locked|Invalid/);

  const cleanPage = await page.context().newPage();
  await login(cleanPage);
  await cleanPage.getByRole("button", { name: /Logout/ }).click();
  await expect(cleanPage).toHaveURL(/\/login$/);
});

test("healthy and degraded scenarios render expected classifications without stale data", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "Healthy", exact: true }).click();
  await expect(page.getByLabel("Evidence source")).toHaveValue("simulated-healthy");
  await expect(page.getByText("100.00%").first()).toBeVisible();
  await expect(page.getByText("Approved for handoff").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Run validation scenario/ })).toHaveCount(0);
  const sourceContext = page.locator("section").filter({ hasText: "Source context" }).first();
  await expect(sourceContext).toBeVisible();
  await expect(sourceContext).toContainText("Simulated Healthy");
  await expect(sourceContext).toContainText("Hardware identity status");
  await expect(sourceContext).toContainText("Sanitization status");
  await expect(sourceContext).toContainText("Source confidence");
  await expect(sourceContext).toContainText("Limitations");

  await page.getByRole("button", { name: "Degraded", exact: true }).click();
  await expect(page.getByLabel("Evidence source")).toHaveValue("simulated-degraded");
  await expect(page.getByText("97.01%")).toBeVisible();
  await expect(page.getByText("Remediation required").first()).toBeVisible();
  await expect(page.getByText("Handoff blocked").first()).toBeVisible();
  await expect(page.getByText(/dgx03 has an active InfiniBand link/i)).toBeVisible();
  await expect(page.getByText(/dgx04 \/ GPU 5: uncorrectable ECC errors detected/i)).toBeVisible();
  await expect(page.getByText("Slurm DRAINED")).toBeVisible();
  await expect(page.getByText("3/4 healthy pods")).toBeVisible();

  await page.getByRole("button", { name: "Healthy", exact: true }).click();
  await expect(page.locator("section").filter({ hasText: "Source context" }).first()).toContainText("Simulated Healthy");
  await expect(page.getByText("100.00%").first()).toBeVisible();
  await expect(page.getByText("97.01%")).toHaveCount(0);
});

test("protected routes remain unavailable before authentication", async ({ request }) => {
  await expectProtectedRoutesUnauthenticated(request);
});

test("GPU inventory route is protected, navigable, filterable, sortable, and exposes details", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "desktop sidebar inventory workflow is covered in the desktop project");
  const unauthenticated = await request.get("/portal/inventory/gpus", { maxRedirects: 0 });
  expect([302, 401]).toContain(unauthenticated.status());

  await login(page);
  await page.getByRole("link", { name: /GPU Inventory/ }).click();
  await expect(page).toHaveURL(/\/portal\/inventory\/gpus$/);
  await expect(page.getByRole("heading", { name: "GPU Inventory" })).toBeVisible();
  await expect(page.getByText(/Validated GPU hardware/)).toBeVisible();
  await expect(page.getByText(/Not collected/).first()).toBeVisible();

  await expect(page.getByLabel("Search GPU inventory")).toBeVisible();
  await page.getByLabel("Search GPU inventory").fill("dgx01");
  await expect(page.getByText(/Showing \d+ of \d+ GPUs/)).toBeVisible();
  await page.getByLabel("Filter by validation status").selectOption("passed");
  await expect(page.getByText("Passed").first()).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByLabel("Search GPU inventory")).toHaveValue("");

  await page.getByRole("button", { name: /GPU \/ Model/ }).click();
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("Identity").last()).toBeVisible();
  await expect(page.getByText("Evidence source")).toBeVisible();
  await page.getByRole("button", { name: "Close GPU details" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("GPU inventory handles no filter matches and backend errors truthfully", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop inventory error states are covered in the desktop project");
  await login(page);
  await page.goto("/portal/inventory/gpus");
  await page.getByLabel("Search GPU inventory").fill("no-such-gpu-uuid");
  await expect(page.getByText("No GPUs match the current filters")).toBeVisible();

  const errorPage = await page.context().newPage();
  await errorPage.route("**/api/v1/engagements", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Controlled inventory failure" }) });
  });
  await errorPage.goto("/portal/inventory/gpus");
  await expect(errorPage.getByRole("alert")).toContainText("Failed to load engagements for GPU inventory");
});

test("GPU inventory export control is backed by current filtered CSV data", async ({ page }) => {
  await login(page);
  await page.goto("/portal/inventory/gpus");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("gpu-inventory-current-filter.csv");
});

test("report links and authenticated API routes work", async ({ page }) => {
  await login(page);

  const reportLinks = [
    "/reports/degraded/html",
    "/reports/degraded/markdown",
    "/reports/degraded/json",
  ];

  for (const href of reportLinks) {
    await expect(page.locator(`a[href="${href}"]`)).toBeVisible();
    const response = await page.request.get(href);
    expect(response.ok()).toBeTruthy();
    const reportText = await response.text();
    if (!href.endsWith("/json")) {
      expect(reportText).toContain("GPU Validator");
    }
  }

  const apiResponse = await page.request.get("/api/results?scenario=degraded");
  expect(apiResponse.status()).toBe(200);
  const payload = await apiResponse.json();
  expect(payload.overall_score).toBe(97.01);

  const runResponse = await page.request.post("/api/run-scenario", { data: { scenario: "healthy" } });
  expect(runResponse.status()).toBe(405);
});

test("controlled backend API error renders a visible error state", async ({ page }) => {
  await login(page);
  await page.route("**/api/results?scenario=healthy", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Controlled test failure" }) });
  });

  await page.getByRole("button", { name: "Healthy", exact: true }).click();
  await expect(page.getByText("Controlled error state")).toBeVisible();
  await expect(page.getByText("Controlled test failure")).toBeVisible();
});

test("mobile viewport keeps login and portal controls usable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile viewport coverage runs in the mobile project");
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  await login(page);
  await expect(page.getByRole("button", { name: "Healthy", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Degraded", exact: true })).toBeVisible();
});
