#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const landing = fs.readFileSync('src/components/landing/PublicLanding.tsx', 'utf8');
const missionControl = fs.readFileSync('src/components/mission-control/MissionControlOverview.tsx', 'utf8');
const hgxTopology = fs.readFileSync('src/components/mission-control/HgxNvlinkVisualization.tsx', 'utf8');
const validationFlow = fs.readFileSync('src/components/mission-control/ValidationFlowVisualization.tsx', 'utf8');
const hudPanel = fs.readFileSync('src/components/hud/HudPanel.tsx', 'utf8');
const hudPanelHeader = fs.readFileSync('src/components/hud/HudPanelHeader.tsx', 'utf8');
const hudTopBar = fs.readFileSync('src/components/hud/HudTopBar.tsx', 'utf8');
const hudTopBarStyles = fs.readFileSync('src/components/hud/HudTopBar.css', 'utf8');
const hudPanelTypes = fs.readFileSync('src/components/hud/types.ts', 'utf8');
const hudPanelStyles = fs.readFileSync('src/components/hud/HudPanel.css', 'utf8');
const hudIndex = fs.readFileSync('src/components/hud/index.ts', 'utf8');
const styles = fs.readFileSync('src/index.css', 'utf8');
const requiredRoutes = [
  '/api/platform/summary',
  '/api/platform/inventory',
  '/api/platform/clusters',
  '/api/platform/validation',
  '/api/platform/benchmarks',
  '/api/platform/topology/:clusterId',
  '/api/platform/monitoring',
  '/api/platform/alerts',
  '/api/platform/reports',
  '/api/platform/academy',
  '/api/platform/settings',
  '/api/platform/copilot',
  '/api/platform/remediation-plans',
];
for (const route of requiredRoutes) {
  assert(server.includes(route), `missing platform API route ${route}`);
}

const requiredUiContracts = [
  'loadingHistory',
  'historyError',
  'No historical logs recorded',
  'showSettingsModal',
  'showTopologyModal',
  'showExportModal',
  'showCompareModal',
  'fetch(`/api/results?scenario=${scenario}`)',
  'fetch(`/api/node-history/${nodeName}?scenario=${scenario}`)',
];
for (const marker of requiredUiContracts) {
  assert(app.includes(marker), `missing UI state or service contract marker ${marker}`);
}

const requiredLandingMarkers = [
  'GPUValidator',
  'GPU Infrastructure Readiness, Validated',
  'Reviewer sign in',
  'Logical GPU Node Fabric',
  'NVLink',
  'NVSwitch',
  'Node NIC',
  'InfiniBand / RDMA',
  'External Cluster Fabric',
  'Logical reference topology',
  'AI FACTORY READINESS PORTAL',
  '8× GPU',
  'NVLink and NVSwitch provide high-bandwidth GPU communication inside the node. The node NIC connects the system to the external InfiniBand/RDMA cluster fabric.',
  'prefers-reduced-motion',
];
for (const marker of requiredLandingMarkers) {
  assert(landing.includes(marker) || app.includes(marker) || styles.includes(marker), `missing landing marker ${marker}`);
}

const forbiddenLandingMarkers = [
  'Gate',
  'CLUSTER FABRIC',
  'GPU-0',
  'GPU-1',
  'GPU-2',
  'GPU-3',
];
for (const marker of forbiddenLandingMarkers) {
  assert(!landing.includes(marker), `obsolete landing marker still present: ${marker}`);
}

assert(indexHtml.includes('GPUValidator | AI Infrastructure Readiness'), 'landing metadata title was not updated');

const requiredHgxTopologyMarkers = [
  'Logical HGX-style topology',
  'GPU {gpu.id}',
  'NVLink',
  'NVSwitch',
  'Fabric',
  'NIC',
  'InfiniBand / External Cluster Network',
  'NVLink connects GPUs through the NVSwitch fabric inside the node. InfiniBand connects the node to the external cluster network.',
  'Demo/reference values only',
  'not exact physical cabling',
  'Individual GPUs are not drawn as direct InfiniBand endpoints',
  'prefers-reduced-motion',
  'animateMotion',
  'hgx-traffic--green',
  'hgx-traffic--purple',
  'hgx-traffic--yellow',
  'hgx-traffic--red',
  'hgx-traffic--blue',
];
for (const marker of requiredHgxTopologyMarkers) {
  assert(hgxTopology.includes(marker) || app.includes(marker) || styles.includes(marker), `missing HGX topology marker ${marker}`);
}

const requiredValidationFlowMarkers = [
  'ValidationFlowVisualization',
  'VALIDATION PIPELINE',
  'REFERENCE WORKFLOW',
  'DISCOVER',
  'TOPOLOGY',
  'VALIDATE',
  'BENCHMARK',
  'RESULT',
  'NVLink',
  'NVSwitch',
  'InfiniBand',
  'reference-workflow disclaimer',
  'Logical workflow and topology representation. Values shown are demonstration data.',
  'GPU 0–7',
  'Node NIC',
  'Cluster Fabric',
  'prefers-reduced-motion',
  'animateMotion',
  'validation-pulse--blue',
  'validation-pulse--green',
  'validation-pulse--purple',
  'validation-pulse--yellow',
];
for (const marker of requiredValidationFlowMarkers) {
  assert(validationFlow.includes(marker) || app.includes(marker) || styles.includes(marker), `missing validation workflow marker ${marker}`);
}

const requiredMissionControlV3Markers = [
  'Mission Control V3',
  'Current AI Factory Health',
  'AI Factory Health',
  'Critical Conditions',
  'Current Activity',
  'Prioritized KPIs',
  'VALIDATION PIPELINE',
  'Affected scope',
  'Current validation',
  'Latest benchmark',
  'Recommended next action',
  'DEMO / FIXTURE DATA',
  '--surface-primary',
  '--surface-secondary',
  '--surface-elevated',
  '--text-primary',
  '--text-secondary',
  '--success',
  '--warning',
  '--critical',
  '--info',
  '--border-primary',
  'prefers-reduced-motion',
];
for (const marker of requiredMissionControlV3Markers) {
  assert(missionControl.includes(marker) || validationFlow.includes(marker) || styles.includes(marker) || app.includes(marker), `missing Mission Control V3 marker ${marker}`);
}

const requiredHudPanelMarkers = [
  'export function HudPanel',
  'export function HudPanelHeader',
  'HUD_PANEL_STATES',
  '"default"',
  '"active"',
  '"selected"',
  '"healthy"',
  '"warning"',
  '"critical"',
  '"informational"',
  '"disabled"',
  'clip-path: polygon',
  'hud-panel-header',
  'hud-panel-demo-title',
  'JARVIS-002 primitive validation',
  'HUD instrumentation panel geometry',
];
for (const marker of requiredHudPanelMarkers) {
  assert(hudPanel.includes(marker) || hudPanelHeader.includes(marker) || hudPanelTypes.includes(marker) || hudPanelStyles.includes(marker) || styles.includes(marker) || missionControl.includes(marker), `missing HUD panel marker ${marker}`);
}

const requiredHudTopBarMarkers = [
  'HudTopBar',
  'GPUValidator',
  'AI INFRASTRUCTURE MISSION CONTROL',
  'AI FACTORY OPERATIONS EXPERIENCE',
  'environmentLabel',
  'THEME',
  'SYSTEM STATE',
  'data-testid="HudTopBar"',
  'aria-live="off"',
  'hud-top-bar__waveform',
  'environmentLabel={environmentLabel}',
  'userLabel="Reviewer"',
  'systemStateLabel={systemStateLabel}',
];
for (const marker of requiredHudTopBarMarkers) {
  assert(hudTopBar.includes(marker) || hudTopBarStyles.includes(marker) || hudIndex.includes(marker) || app.includes(marker), `missing HudTopBar marker ${marker}`);
}

assert(!landing.includes('HudPanel') && !landing.includes('HudPanelHeader'), 'public landing must not migrate to HudPanel primitives');
assert(!landing.includes('HudTopBar') && !app.includes('<HudTopBar') || app.includes('if (!isReviewerAuthenticated)'), 'HudTopBar must not render on PublicLanding');

const obsoleteLandingMarkers = ['Gate', 'GPU-0', 'GPU-1', 'GPU-2', 'GPU-3'];
for (const marker of obsoleteLandingMarkers) {
  assert(!validationFlow.includes(marker) && !app.includes(marker), `obsolete landing workflow marker still present: ${marker}`);
}

const storeEntities = [
  'organizations', 'clusters', 'nodes', 'gpus', 'agents', 'agent_heartbeats',
  'validation_runs', 'validation_findings', 'benchmark_runs', 'benchmark_comparisons',
  'regression_findings', 'remediation_plans', 'approval_requests', 'audit_events',
  'academy_courses', 'academy_labs'
];
for (const entity of storeEntities) {
  assert(server.includes(`${entity}: []`) || server.includes(`${entity}:`), `platform store missing ${entity}`);
}

console.log(`portal contract ok: ${requiredRoutes.length} routes, ${requiredUiContracts.length} UI markers, ${requiredLandingMarkers.length} landing markers, ${requiredHgxTopologyMarkers.length} HGX topology markers, ${requiredValidationFlowMarkers.length} validation workflow markers, ${requiredMissionControlV3Markers.length} Mission Control V3 markers`);
