import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createPortalServerApp } from '../server.ts';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpu-validator-smoke-'));
const previous = { ...process.env };
Object.assign(process.env, {
  NODE_ENV: 'production',
  AI_FACTORY_AUTH_REQUIRED: 'true',
  AI_FACTORY_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  AI_FACTORY_REVIEWER_USERNAME: 'reviewer',
  AI_FACTORY_REVIEWER_PASSWORD_HASH: 'scrypt$abc$def',
  AI_FACTORY_AUTH_TEST_BYPASS_TOKEN: 'test-bypass-token',
  AI_VALIDATOR_ENGAGEMENT_STORE: path.join(dir, 'store.json'),
  AI_VALIDATOR_BENCHMARK_STORAGE_DIR: path.join(dir, 'benchmarks'),
});
const app = await createPortalServerApp({ mountFrontend: true });
const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const adminHeaders = { 'Content-Type': 'application/json', 'x-ai-factory-test-auth': 'test-bypass-token' };
async function json(method, url, body, headers = adminHeaders) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  assert.ok(response.ok, `${method} ${url} failed: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}
async function maybeJson(method, url, body, headers = adminHeaders) {
  const response = await fetch(`${baseUrl}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { response, payload: await response.json().catch(() => ({})) };
}
try {
  const demo = await json('POST', '/api/v1/engagement-fixtures/nvis-interview-demo', {});
  const engagementId = demo.engagement.id;
  const nodes = await json('GET', `/api/v1/engagements/${engagementId}/nodes`);
  const node = nodes.nodes.find((item) => item.display_name === 'node01') ?? nodes.nodes[0];
  const token = await json('POST', `/api/v1/engagements/${engagementId}/nodes/${node.id}/runner-tokens`, {});
  assert.equal(token.token.token_hash, undefined);
  const registered = await json('POST', '/api/v1/runners/register', { node_id: node.id, token: token.plaintext, runner_version: '0.1.0', hostname_display: 'HOST-001', supported_benchmark_ids: ['nccl-all-reduce'], capabilities: { gpu_count: 4, nccl_tests_available: true, mpi_available: false } }, { 'Content-Type': 'application/json' });
  const bearer = registered.credential.bearer_token;
  await json('POST', '/api/v1/runners/heartbeat', { capabilities: { gpu_count: 4, nccl_tests_available: true } }, { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` });
  const job = await json('POST', `/api/v1/engagements/${engagementId}/benchmark-jobs`, { benchmark_definition_id: 'nccl-all-reduce', target_node_ids: [node.id], parameters: { gpu_count: 4, maximum_bytes: '64M', iterations: 5 } });
  assert.match(job.job.generated_command_preview, /all_reduce_perf/);
  const claimed = await json('POST', '/api/v1/runners/jobs/claim', {}, { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` });
  assert.equal(claimed.job.id, job.job.id);
  await json('POST', `/api/v1/runners/jobs/${job.job.id}/status`, { status: 'running', progress: 50 }, { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` });
  await json('POST', `/api/v1/runners/jobs/${job.job.id}/logs`, { chunk: 'NCCL smoke progress Authorization: Bearer SECRET' }, { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` });
  const fixture = fs.readFileSync(path.join(process.cwd(), 'sample-data', 'benchmarks', 'redacted-real-nccl-all-reduce.txt'), 'utf8');
  const complete = await json('POST', `/api/v1/runners/jobs/${job.job.id}/complete`, { filename: 'redacted-real-nccl-all-reduce.txt', output: fixture, source_kind: 'redacted_real_format_fixture' }, { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` });
  assert.equal(complete.job.status, 'completed');
  assert.equal(complete.benchmark.metrics.average_bus_bandwidth, 37.3098);
  assert.equal(complete.benchmark.metrics.bus_bandwidth, 185.67);
  const listed = await json('GET', `/api/v1/engagements/${engagementId}/benchmarks`);
  assert.equal(listed.benchmarks.length, 1);
  const jobs = await json('GET', `/api/v1/engagements/${engagementId}/benchmark-jobs`);
  assert.equal(jobs.jobs[0].result_ids[0], complete.benchmark.id);
  const readiness = await json('GET', `/api/v1/engagements/${engagementId}/readiness`);
  assert.ok(readiness.readiness);
  for (const route of ['/portal/library', '/portal/library/slurm', '/portal/library/lustre', '/portal/library/base-command-manager', '/portal/library/benchmarks']) {
    const response = await fetch(`${baseUrl}${route}`, { headers: { 'x-ai-factory-test-auth': 'test-bypass-token' } });
    assert.equal(response.status, 200, route);
  }
  const store = fs.readFileSync(process.env.AI_VALIDATOR_ENGAGEMENT_STORE, 'utf8');
  assert.equal(/Bearer SECRET/.test(store), false);
  console.log(JSON.stringify({ ok: true, engagementId, nodeId: node.id, jobId: job.job.id, resultId: complete.benchmark.id, average_bus_bandwidth: complete.benchmark.metrics.average_bus_bandwidth, bus_bandwidth: complete.benchmark.metrics.bus_bandwidth, library_routes_rendered: 5, storePath: process.env.AI_VALIDATOR_ENGAGEMENT_STORE }, null, 2));
} finally {
  await new Promise((resolve) => server.close(() => resolve()));
  process.env = previous;
  fs.rmSync(dir, { recursive: true, force: true });
}
