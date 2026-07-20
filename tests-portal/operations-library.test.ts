import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { libraryPages, searchLibrary } from "../src/portal/operations-library";

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const serverSource = readFileSync(resolve(process.cwd(), "server.ts"), "utf8");

test("operations library index and topic pages are registered and authenticated", () => {
  for (const route of ["/portal/library", "/portal/library/slurm", "/portal/library/lustre", "/portal/library/base-command-manager", "/portal/library/benchmarks"]) {
    assert.match(appSource, new RegExp(route.replace(/\//g, "\\/")));
  }
  assert.match(appSource, /Operations Library/);
  assert.match(serverSource, /if \(req\.path\.startsWith\("\/api\/"\)/);
});

test("operations library pages include required searchable cheat-sheet structure", () => {
  assert.equal(libraryPages.length, 4);
  for (const page of libraryPages) {
    assert.ok(page.overview);
    assert.ok(page.keyConcepts.length > 0);
    assert.ok(page.commands.some((cmd) => cmd.safety === "read-only" || cmd.safety === "mutating"));
    assert.ok(page.troubleshooting.length > 0);
    assert.ok(page.safetyWarnings.length > 0);
    assert.ok(page.interviewQuestions.length > 0);
    assert.ok(page.relatedFeatures.length > 0);
    assert.match(page.lastReviewed, /reviewed/i);
  }
  assert.ok(searchLibrary("NCCL busbw").some((item) => item.slug === "benchmarks"));
  assert.ok(searchLibrary("lfs setstripe").some((item) => item.slug === "lustre"));
  assert.ok(searchLibrary("cmsh").some((item) => item.slug === "base-command-manager"));
});

test("operations library UI includes copy controls, filters, labels, and escapes command injection as text", () => {
  assert.match(appSource, /Search operations topics/);
  assert.match(appSource, /Filter by category/);
  assert.match(appSource, /Copy command/);
  assert.match(appSource, /Copied/);
  assert.match(appSource, /read-only/);
  assert.match(appSource, /mutating/);
  assert.match(appSource, /illustrative example/);
  assert.doesNotMatch(appSource, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(appSource, /innerHTML\s*=/);
});
