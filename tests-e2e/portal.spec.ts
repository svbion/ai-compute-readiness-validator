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
  const validationRoute = await request.get("/portal/validations/val_live", { maxRedirects: 0 });
  expect([302, 401]).toContain(validationRoute.status());
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



test("live RunPod agent dashboard and GPU inventory use fixture API responses", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop live agent workflow is covered in the desktop project");
  const agent = { id: "agt_live", schema_version: "1.0.0", name: "runpod-4gpu-01", hostname: "runpod-node-01", status: "online", capabilities: [], gpu_count: 4, agent_version: "0.1.0", registered_at: "2026-07-20T14:59:00.000Z", last_heartbeat_at: "2026-07-20T15:00:00.000Z", last_error: null, metadata: {} };
  const validation = { id: "val_live", schema_version: "1.0.0", profile: "hardware-discovery", agent_id: "agt_live", state: "completed", created_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:02:00.000Z", error: null, job_ids: ["j1", "j2", "j3", "j4", "j5", "j6"] };
  const baseResult = { schema_version: "1.0.0", validation_id: "val_live", agent_id: "agt_live", exit_code: 0, started_at: "2026-07-20T15:00:00.000Z", completed_at: "2026-07-20T15:00:01.000Z", duration_ms: 1000, stderr: "", output_truncated: false, result_hash: "hash" };
  const validationsPayload = { validations: [{ validation, jobs: [], results: [
    { ...baseResult, id: "r1", job_id: "j1", state: "completed", structured_result: { gpus: [0, 1, 2, 3].map((index) => ({ index, model: "NVIDIA A100-SXM4-40GB", uuid: `GPU-live-${index}` })) }, stdout: "GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-live-0)", command_evidence: { command_type: "nvidia_smi_list", argv: ["nvidia-smi", "-L"], started_at: baseResult.started_at, completed_at: baseResult.completed_at, exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false } },
    { ...baseResult, id: "r2", job_id: "j2", state: "completed", structured_result: { gpus: [0, 1, 2, 3].map((index) => ({ index, name: "NVIDIA A100-SXM4-40GB", uuid: `GPU-live-${index}`, memory_total: "40536 MiB", driver_version: "535.104.05", pci_bus_id: `00000000:${41 + index}1:00.0` })) }, stdout: "0,NVIDIA A100-SXM4-40GB,GPU-live-0,40536,535.104.05,00000000:41:00.0", command_evidence: { command_type: "nvidia_smi_inventory", argv: ["nvidia-smi"], started_at: baseResult.started_at, completed_at: baseResult.completed_at, exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false } },
    { ...baseResult, id: "r3", job_id: "j3", state: "completed", structured_result: { driver_version: "535.104.05" }, stdout: "535.104.05", command_evidence: { command_type: "driver_version", argv: ["nvidia-smi"], started_at: baseResult.started_at, completed_at: baseResult.completed_at, exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false } },
    { ...baseResult, id: "r4", job_id: "j4", state: "unavailable", exit_code: null, structured_result: { available: false }, stdout: "", stderr: "nvcc unavailable", command_evidence: { command_type: "cuda_version", argv: ["nvcc"], started_at: baseResult.started_at, completed_at: baseResult.completed_at, exit_code: null, stdout_sha256: null, stderr_sha256: "sha", output_truncated: false } },
    { ...baseResult, id: "r5", job_id: "j5", state: "completed", structured_result: { topology: [] }, stdout: "GPU0 GPU1\nGPU0 X NV4", command_evidence: { command_type: "nvidia_smi_topology", argv: ["nvidia-smi", "topo", "-m"], started_at: baseResult.started_at, completed_at: baseResult.completed_at, exit_code: 0, stdout_sha256: "sha", stderr_sha256: null, output_truncated: false } },
    { ...baseResult, id: "r6", job_id: "j6", state: "unavailable", exit_code: null, structured_result: { available: false }, stdout: "", stderr: "torch unavailable", command_evidence: { command_type: "pytorch_gpu_count", argv: ["python3"], started_at: baseResult.started_at, completed_at: baseResult.completed_at, exit_code: null, stdout_sha256: null, stderr_sha256: "sha", output_truncated: false } },
  ] }] };
  let createCalls = 0;
  await page.route("**/api/v1/agents", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ agents: [agent], offline_threshold_seconds: 90 }) }));
  await page.route("**/api/v1/validations/val_live", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validationsPayload.validations[0]) }));
  await page.route("**/api/v1/validations/missing-validation", async (route) => route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Validation not found." }) }));
  await page.route("**/api/v1/validations?profile=hardware-discovery", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validationsPayload) }));
  await page.route("**/api/v1/validations", async (route) => {
    if (route.request().method() === "POST") {
      createCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ validation: { ...validation, id: "val_queued", state: "queued" }, jobs: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(validationsPayload) });
  });
  await login(page);
  await expect(page.getByText("RunPod hardware discovery")).toBeVisible();
  await expect(page.getByText("Selected agent: runpod-4gpu-01 / runpod-node-01")).toBeVisible();
  await expect(page.getByLabel("Discovered GPUs: 4")).toBeVisible();
  await page.getByRole("link", { name: "val_live" }).click();
  await expect(page).toHaveURL(/\/portal\/validations\/val_live$/);
  await expect(page.getByRole("heading", { name: "Validation results" })).toBeVisible();
  await expect(page.getByText("hardware-discovery").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "nvidia-smi GPU list" })).toBeVisible();
  await expect(page.getByText("GPU inventory").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "GPU topology" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Driver version" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CUDA version" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "PyTorch GPU count" })).toBeVisible();
  await page.getByText("Expandable evidence: stdout / stderr").first().click();
  await expect(page.getByText("GPU 0: NVIDIA A100-SXM4-40GB")).toBeVisible();
  await expect(page.getByText("nvcc unavailable").first()).toBeVisible();
  await expect(page.getByText("torch unavailable").first()).toBeVisible();
  await expect(page.getByText("validation partial")).toBeVisible();
  await page.goto("/portal/validations/missing-validation");
  await expect(page.getByRole("alert")).toContainText("Validation not found");
  await page.goto("/portal");
  const runButton = page.getByRole("button", { name: "Run hardware validation" });
  await runButton.click();
  await expect(page.getByRole("button", { name: /Queueing validation/ })).toBeDisabled();
  expect(createCalls).toBe(1);

  await page.goto("/portal/inventory/gpus");
  await expect(page.getByRole("heading", { name: "GPU Inventory" })).toBeVisible();
  await expect(page.getByText("Live Agent GPUs")).toBeVisible();
  const inventoryTable = page.locator("table").first();
  await expect(inventoryTable).toContainText("NVIDIA A100-SXM4-40GB");
  await expect(inventoryTable).toContainText("GPU-live-0");
  await page.locator("tbody tr").first().click();
  await expect(page.getByRole("dialog")).toContainText("Live Agent");
  await expect(page.getByRole("dialog")).toContainText("Raw command evidence");
  await expect(page.getByRole("dialog")).toContainText("CUDA unavailable");
  await expect(page.getByRole("dialog")).toContainText("PyTorch unavailable");
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
