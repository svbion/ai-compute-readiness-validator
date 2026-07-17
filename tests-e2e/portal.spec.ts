import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("reviewer@example.invalid");
  await page.locator("#reviewer-password").fill("Reviewer Test Password 123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "GPU Validator" })).toBeVisible();
  await expect(page.getByText("Scenario controls")).toBeVisible();
  await expect(page.getByLabel("Evidence source")).toBeVisible();
}

test("login page loads with accessible private reviewer entry", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "GPU Validator" })).toBeVisible();
  await expect(page.getByText("Private access to GPU infrastructure readiness")).toBeVisible();
  await expect(page.getByText("InfiniBand / RDMA")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("autocomplete", "email");
  await expect(page.locator("#reviewer-password")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Show password" })).toBeVisible();
  await expect(page.getByText("Built by Sabion P. Frazier")).toBeVisible();
  await expect(page.getByText("This project is an independent portfolio project")).toBeVisible();
});

test("authentication-required redirect, invalid credentials, account lockout, login, and logout", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?reason=expired-session$/);
  await expect(page.getByText("Your session expired")).toBeVisible();

  const invalidEmail = `unknown-reviewer-${testInfo.project.name}-${testInfo.workerIndex}@example.invalid`;
  await page.getByLabel("Email").fill(invalidEmail);
  await page.locator("#reviewer-password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid email or password");

  for (let i = 0; i < 4; i += 1) {
    await page.getByRole("button", { name: "Sign in" }).click();
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
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await login(page);
  await expect(page.getByRole("button", { name: "Healthy", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Degraded", exact: true })).toBeVisible();
});
