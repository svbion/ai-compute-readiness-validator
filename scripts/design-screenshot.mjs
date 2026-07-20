#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const reviewerPasswordHash = "scrypt$e19283383dd48dfaadae7f77a44698e9$c928165ce617ca2ea90068af6ef0d6b8b4e99b0f4b9e422dd2ac2703464d3bbb5db9125b8f3fb933e2ff4029b7f172cecb8300ff2ff2ca384b7c848c6ca3d39b";
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));
const routes = args.all === "true" ? [
  ["login", "/login"],
  ["dashboard", "/portal"],
  ["engagements", "/portal/engagements"],
  ["operations-library", "/portal/library"],
] : [[String(args.name ?? "page"), String(args.route ?? "/login")]];
const [width, height] = String(args.viewport ?? "1536x1024").split("x").map(Number);
const port = Number(process.env.PORT ?? 3100);
const baseURL = process.env.TARGET_URL ?? `http://127.0.0.1:${port}`;
const outputDir = path.resolve("design/implementation-screenshots/current");

function run(command, commandArgs, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", env: { ...process.env, ...env } });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${commandArgs.join(" ")} exited ${code}`)));
  });
}

async function waitForHealth() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`${baseURL}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not become healthy at ${baseURL}/healthz`);
}

await mkdir(outputDir, { recursive: true });
if (!process.env.TARGET_URL) {
  await run("npm", ["run", "build"]);
}
const server = process.env.TARGET_URL ? null : spawn("npm", ["run", "start"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    AI_FACTORY_AUTH_REQUIRED: "true",
    AI_FACTORY_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    AI_FACTORY_REVIEWER_USERNAME: "reviewer",
    AI_FACTORY_REVIEWER_PASSWORD_HASH: reviewerPasswordHash,
    AI_FACTORY_COOKIE_SECURE: "false",
  },
});
try {
  await waitForHealth();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.addStyleTag({ content: `*, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; caret-color: transparent !important; }` });
  async function loginIfNeeded(route) {
    if (route === "/login") return;
    await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
    if (page.url().includes("/login")) {
      await page.getByLabel("Username").fill("reviewer");
      await page.locator("#reviewer-password").fill("Reviewer Test Password 123!");
      await page.getByRole("button", { name: "Sign In" }).click();
      await page.waitForURL(/\/portal/, { timeout: 15000 });
    }
  }
  for (const [name, route] of routes) {
    await loginIfNeeded(route);
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(500);
    const file = path.join(outputDir, `${name}-${width}x${height}.png`);
    await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
    console.log(file);
  }
  await browser.close();
} finally {
  if (server) server.kill("SIGTERM");
}
