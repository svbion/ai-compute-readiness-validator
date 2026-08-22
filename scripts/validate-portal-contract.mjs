#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const landing = fs.readFileSync('src/components/landing/PublicLanding.tsx', 'utf8');
const publicAuth = fs.readFileSync('src/components/public/auth/PublicAuthExperience.tsx', 'utf8');
const publicAuthShell = fs.readFileSync('src/components/public/auth/AuthShell.tsx', 'utf8');
const publicAuthStyles = fs.readFileSync('src/components/public/auth/AuthShell.css', 'utf8');
const missionControl = fs.readFileSync('src/components/mission-control/MissionControlOverview.tsx', 'utf8');
const aiFactoryHologram = fs.readFileSync('src/components/mission-control/ai-factory/AiFactoryHologram.tsx', 'utf8');
const aiFactoryHealthInstrument = fs.readFileSync('src/components/mission-control/health/AiFactoryHealthInstrument.tsx', 'utf8');
const aiFactoryHealthInstrumentStyles = fs.readFileSync('src/components/mission-control/health/AiFactoryHealthInstrument.css', 'utf8');
const criticalConditionsPanel = fs.readFileSync('src/components/mission-control/critical/CriticalConditionsPanel.tsx', 'utf8');
const criticalConditionsPanelStyles = fs.readFileSync('src/components/mission-control/critical/CriticalConditionsPanel.css', 'utf8');
const criticalConditionsPanelIndex = fs.readFileSync('src/components/mission-control/critical/index.ts', 'utf8');
const hgxTopology = fs.readFileSync('src/components/mission-control/HgxNvlinkVisualization.tsx', 'utf8');
const validationFlow = fs.readFileSync('src/components/mission-control/ValidationFlowVisualization.tsx', 'utf8');
const hudPanel = fs.readFileSync('src/components/hud/HudPanel.tsx', 'utf8');
const hudPanelHeader = fs.readFileSync('src/components/hud/HudPanelHeader.tsx', 'utf8');
const hudNavigationRail = fs.readFileSync('src/components/hud/HudNavigationRail.tsx', 'utf8');
const hudNavigationRailStyles = fs.readFileSync('src/components/hud/HudNavigationRail.css', 'utf8');
const hudTopBar = fs.readFileSync('src/components/hud/HudTopBar.tsx', 'utf8');
const hudTopBarStyles = fs.readFileSync('src/components/hud/HudTopBar.css', 'utf8');
const hudBottomRail = fs.readFileSync('src/components/hud/HudBottomRail.tsx', 'utf8');
const hudBottomRailStyles = fs.readFileSync('src/components/hud/HudBottomRail.css', 'utf8');
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
  'data-testid="PublicSiteShell"',
  'data-testid="PublicHero"',
  'Know if your AI infrastructure is actually ready.',
  'Get Started',
  'Explore Platform',
  'Reviewer sign in',
  'Logical / Reference Topology',
  'Internal node fabric boundary',
  'External cluster fabric boundary',
  'GPU0',
  'NVSwitch',
  'NIC',
  'InfiniBand / RDMA',
  'Cluster Fabric',
  'Discover',
  'Validate',
  'Benchmark',
  'Investigate',
  'Prove',
  'Remediate',
  'AI Factory',
  'Topology Intelligence',
  'Validation Engine',
  'Benchmark Engine',
  'Evidence',
  'Investigations',
  'Copilot',
  'Validate your AI infrastructure before production does it for you.',
  'data-testid="PublicMobileNavTrigger"',
  'prefers-reduced-motion',
  'href="/login"',
  'href="/signup"',
];
for (const marker of requiredLandingMarkers) {
  assert(landing.includes(marker) || app.includes(marker) || styles.includes(marker), `missing landing marker ${marker}`);
}

const requiredPublicAuthMarkers = [
  'PUBLIC_AUTH_ROUTES',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  'GPUValidator',
  'Sign In',
  'Create account',
  'Forgot password',
  'Reset password',
  'Verify email',
  'Reviewer demo entry',
  'Production authentication not connected',
  'Password requirements',
  'MFA-ready patterns',
  'Resend verification',
  'Activate light theme',
  'Activate dark theme',
  'data-testid="PublicAuthShell"',
];
for (const marker of requiredPublicAuthMarkers) {
  assert(
    app.includes(marker) || publicAuth.includes(marker) || publicAuthShell.includes(marker) || publicAuthStyles.includes(marker),
    `missing public auth marker ${marker}`,
  );
}

const forbiddenPublicAuthShellMarkers = ['HudTopBar', 'HudNavigationRail', 'HudBottomRail'];
for (const marker of forbiddenPublicAuthShellMarkers) {
  assert(!publicAuth.includes(marker), `auth page should not render authenticated shell marker ${marker}`);
}

const forbiddenLandingMarkers = [
  'Gate',
  'CLUSTER FABRIC',
  'GPU Infrastructure Readiness, Validated',
  'AI FACTORY READINESS PORTAL',
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
  'System Telemetry',
  'Evidence / Fabric Summary',
  'AI Factory Spatial View',
  'LOGICAL / REFERENCE TOPOLOGY',
  'VALIDATION PIPELINE',
  'Affected scope',
  'Current state',
  'DEMO / FIXTURE DATA',
  'data-testid="JarvisMissionControlShell"',
  'data-testid="JarvisMissionControlGrid"',
  'data-testid="JarvisCenterpieceRegion"',
  'data-testid="PrimaryOperationsWorkspace"',
  'data-testid="DetailedDiagnosticsWorkspace"',
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
  assert(
    missionControl.includes(marker) ||
      aiFactoryHologram.includes(marker) ||
      aiFactoryHealthInstrument.includes(marker) ||
      aiFactoryHealthInstrumentStyles.includes(marker) ||
      criticalConditionsPanel.includes(marker) ||
      criticalConditionsPanelStyles.includes(marker) ||
      validationFlow.includes(marker) ||
      styles.includes(marker) ||
      app.includes(marker),
    `missing Mission Control V3 marker ${marker}`
  );
}

const requiredAiFactoryHologramMarkers = [
  'AiFactoryHologram',
  'LOGICAL / REFERENCE TOPOLOGY',
  'Cluster',
  'GPU FABRIC',
  'NVLink',
  'NVSwitch',
  'NIC',
  'InfiniBand/RDMA boundary',
  'Selected scope',
  'healthy',
  'warning',
  'critical',
  'unknown',
  'Reduced motion',
  'prefers-reduced-motion',
];

for (const marker of requiredAiFactoryHologramMarkers) {
  assert(
    aiFactoryHologram.includes(marker) || styles.includes(marker),
    `missing AI Factory hologram marker ${marker}`
  );
}

const requiredAiFactoryHealthMarkers = [
  'AiFactoryHealthInstrument',
  'data-testid="AiFactoryHealthInstrument"',
  'data-testid="AiFactoryHealthInstrument-score"',
  'data-testid="AiFactoryHealthInstrument-classification"',
  'data-testid="AiFactoryHealthInstrument-affected-scope"',
  'data-testid="AiFactoryHealthInstrument-reason"',
  'Health score',
  'Reason',
  'Affected scope',
  'Evidence confidence',
  'Recommended next action',
  'Current state',
  'healthy',
  'warning',
  'critical',
  'unknown',
  'prefers-reduced-motion',
];

for (const marker of requiredAiFactoryHealthMarkers) {
  assert(
    aiFactoryHealthInstrument.includes(marker) ||
      aiFactoryHealthInstrumentStyles.includes(marker) ||
      missionControl.includes(marker),
    `missing AI Factory Health marker ${marker}`
  );
}

const requiredCriticalConditionsMarkers = [
  'CriticalConditionsPanel',
  'CRITICAL CONDITIONS',
  'Affected scope',
  'Severity',
  'Evidence',
  'Recommendation',
  'critical',
  'warning',
  'informational',
  'unknown',
  'NO CRITICAL CONDITIONS',
  'NOMINAL',
];
for (const marker of requiredCriticalConditionsMarkers) {
  assert(
    criticalConditionsPanel.includes(marker) ||
      criticalConditionsPanelStyles.includes(marker) ||
      criticalConditionsPanelIndex.includes(marker) ||
      missionControl.includes(marker),
    `missing CriticalConditionsPanel marker ${marker}`
  );
}
assert(
  criticalConditionsPanel.includes('Recommendation unavailable in current findings.') &&
    criticalConditionsPanel.includes('EVIDENCE PARTIAL') &&
    criticalConditionsPanel.includes('EVIDENCE UNAVAILABLE'),
  'CriticalConditionsPanel missing truthful evidence/recommendation fallback states'
);

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
  'HudPanelHeader',
  'jarvis-shell-panel--health',
  'jarvis-shell-panel--critical',
  'jarvis-shell-panel--activity',
  'jarvis-shell-panel--centerpiece',
  'jarvis-shell-panel--kpis',
  'jarvis-shell-panel--telemetry',
  'jarvis-shell-panel--evidence',
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

const requiredHudNavigationRailMarkers = [
  'HudNavigationRail',
  'HUD_NAVIGATION_RAIL_ITEM_IDS',
  'aria-label="Primary"',
  'data-testid="HudNavigationRail"',
  'Mission Control',
  'AI Factory',
  'Topology',
  'Benchmarks',
  'Evidence',
  'Alerts',
  'Investigations',
  'Copilot',
  'Settings',
  'activeItemId="mission-control"',
  'availability: "available"',
  'availability: "planned"',
  'aria-current={active ? "page" : undefined}',
  'mobileLabel="Navigation"',
  'position: sticky',
  'width: 88px',
  '@media (max-width: 767px)',
  'hud-navigation-rail-mobile-trigger',
  'Planned',
];
for (const marker of requiredHudNavigationRailMarkers) {
  assert(hudNavigationRail.includes(marker) || hudNavigationRailStyles.includes(marker) || app.includes(marker) || hudIndex.includes(marker), `missing HudNavigationRail marker ${marker}`);
}

const requiredHudBottomRailMarkers = [
  'HudBottomRail',
  'data-testid="HudBottomRail"',
  'HudBottomRail-system',
  'HudBottomRail-data',
  'HudBottomRail-risk',
  'HudBottomRail-session',
  'role="status"',
  'SYSTEM',
  'DATA',
  'RISK',
  'SESSION',
  'UNAVAILABLE',
  'UNKNOWN',
  'DEMO / REFERENCE',
  'AUTHENTICATED REVIEW',
  'position: fixed',
  '@media (max-width: 767px)',
  'HudBottomRail-mobile',
  'dataClassificationLabel',
  'dataFreshnessLabel',
  'riskLabel',
  'sessionLabel',
];
for (const marker of requiredHudBottomRailMarkers) {
  assert(hudBottomRail.includes(marker) || hudBottomRailStyles.includes(marker) || app.includes(marker) || hudIndex.includes(marker), `missing HudBottomRail marker ${marker}`);
}

assert(!landing.includes('HudPanel') && !landing.includes('HudPanelHeader'), 'public landing must not migrate to HudPanel primitives');
assert(!landing.includes('HudTopBar') && app.includes('if (publicAuthRoute)'), 'HudTopBar must not render on public auth routes');
assert(!landing.includes('HudNavigationRail'), 'public landing must not migrate to HudNavigationRail');
assert(!landing.includes('HudBottomRail'), 'public landing must not migrate to HudBottomRail');
assert(app.includes('<HudNavigationRail') && app.includes('if (!reviewerDemoRequested)'), 'HudNavigationRail must render only after reviewer demo entry');
assert(app.includes('<HudBottomRail') && app.includes('if (!reviewerDemoRequested)'), 'HudBottomRail must render only after reviewer demo entry');

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

console.log(
  `portal contract ok: ${requiredRoutes.length} routes, ${requiredUiContracts.length} UI markers, ${requiredLandingMarkers.length} landing markers, ${requiredHgxTopologyMarkers.length} HGX topology markers, ${requiredValidationFlowMarkers.length} validation workflow markers, ${requiredMissionControlV3Markers.length} Mission Control V3 markers, ${requiredAiFactoryHologramMarkers.length} AI Factory hologram markers, ${requiredAiFactoryHealthMarkers.length} AI Factory health markers, ${requiredCriticalConditionsMarkers.length} Critical Conditions markers`
);
