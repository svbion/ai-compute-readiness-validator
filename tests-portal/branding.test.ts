import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

test("public product branding uses GPU Validator while preserving AI Factory profile language", () => {
  const app = read("src/App.tsx");
  const index = read("index.html");

  assert.match(index, /<title>GPU Validator<\/title>/);
  assert.match(app, /GPU Validator/);
  assert.match(app, /AI Factory Readiness Portal/);
  assert.match(app, /Private access to GPU infrastructure readiness, validation evidence, and\s+customer-acceptance workflows\./);
  assert.match(app, /AI Factory profile|AI Factory validation target|AI Factory/);
  assert.doesNotMatch(app, /AI Factory Validation Portal/);
});

test("deployment branding and canonical domain are gpuvalidator.com", () => {
  const caddy = read("deploy/caddy/Caddyfile");
  const envExample = read(".env.production.example");
  const deploymentGuide = read("docs/HETZNER_DEPLOYMENT.md");

  assert.match(caddy, /gpuvalidator\.com/);
  assert.match(caddy, /www\.gpuvalidator\.com/);
  assert.match(caddy, /redir https:\/\/gpuvalidator\.com\{uri\} permanent/);
  assert.match(envExample, /AI_FACTORY_DOMAIN=gpuvalidator\.com/);
  assert.match(deploymentGuide, /gpuvalidator\.com/);
  assert.doesNotMatch(deploymentGuide, /validator\.tensorcorelabs\.com|tensorcorelabs\.com/);
});

test("internal package, CLI, service, and routes remain compatible", () => {
  const packageJson = read("package.json");
  const pyproject = read("pyproject.toml");
  const service = read("deploy/systemd/ai-factory-validator.service");
  const server = read("server.ts");

  assert.match(packageJson, /"name": "ai-compute-readiness-validator"/);
  assert.match(pyproject, /name = "ai-compute-readiness-validator"/);
  assert.match(pyproject, /ai-validator/);
  assert.match(service, /ai-factory-validator/);
  assert.match(server, /\/api\/evidence-sources|\/api\/run-scenario|\/reports\//);
});
