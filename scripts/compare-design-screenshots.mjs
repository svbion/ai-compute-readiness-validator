#!/usr/bin/env node
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || "true"];
}));

if (!args.reference || !args.current) {
  console.error("Usage: node scripts/compare-design-screenshots.mjs --reference=<png> --current=<png> [--output=<png>] [--threshold=0.02]");
  process.exit(2);
}

const reference = PNG.sync.read(readFileSync(String(args.reference)));
let current = PNG.sync.read(readFileSync(String(args.current)));
if (reference.width !== current.width || reference.height !== current.height) {
  const normalized = new PNG({ width: reference.width, height: reference.height });
  const copyWidth = Math.min(reference.width, current.width);
  const copyHeight = Math.min(reference.height, current.height);
  PNG.bitblt(current, normalized, 0, 0, copyWidth, copyHeight, 0, 0);
  current = normalized;
  console.log(`normalized_current=${copyWidth}x${copyHeight} into ${reference.width}x${reference.height}`);
}

const diff = new PNG({ width: reference.width, height: reference.height });
const changed = pixelmatch(reference.data, current.data, diff.data, reference.width, reference.height, { threshold: 0.1 });
const ratio = changed / (reference.width * reference.height);
const output = String(args.output ?? "design/implementation-screenshots/comparisons/diff.png");
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, PNG.sync.write(diff));

console.log(`reference=${args.reference}`);
console.log(`current=${args.current}`);
console.log(`diff=${output}`);
console.log(`changed_pixels=${changed}`);
console.log(`changed_ratio=${ratio.toFixed(6)}`);

const allowed = Number(args.threshold ?? 0.02);
if (ratio > allowed) process.exit(1);
