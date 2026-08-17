import type { CSSProperties } from "react";
import "./AiFactoryHologram.css";

type NodeStatus = "pass" | "warning" | "fail" | "unknown" | "unavailable";
type HologramTone = "healthy" | "warning" | "critical" | "unknown" | "scanning";

type HologramNode = {
  name: string;
  status: NodeStatus;
};

export type AiFactoryHologramProps = {
  clusterName: string;
  classification: string;
  nodeCount: number;
  gpuCount: number;
  selectedScope: string;
  nodes: HologramNode[];
  affectedNodes: string[];
  validationState: HologramTone;
  fabricState: HologramTone;
  dataClassification: string;
  onOpenTopology: () => void;
  onToggleBookmark: () => void;
  isBookmarked: boolean;
};

type PositionedNode = HologramNode & {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  gpuDots: number;
  isSelected: boolean;
  isAffected: boolean;
  tone: Exclude<HologramTone, "scanning">;
};

const desktopNodeSlots = [
  { x: 152, y: 186 },
  { x: 264, y: 116 },
  { x: 384, y: 164 },
  { x: 502, y: 104 },
  { x: 604, y: 194 },
  { x: 698, y: 142 },
];

function normalizeTone(status: NodeStatus): Exclude<HologramTone, "scanning"> {
  if (status === "fail") return "critical";
  if (status === "warning") return "warning";
  if (status === "pass") return "healthy";
  return "unknown";
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function stateLabel(state: HologramTone) {
  return state === "scanning" ? "Scanning" : titleCase(state);
}

function stateChipClass(state: HologramTone) {
  return `ai-factory-hologram__chip ai-factory-hologram__chip--${state}`;
}

function buildVisibleNodes(nodes: HologramNode[], selectedScope: string, affectedNodes: string[], gpuCount: number, nodeCount: number) {
  const gpuDots = Math.max(1, Math.min(8, Math.round(gpuCount / Math.max(nodeCount, 1))));
  return nodes.slice(0, desktopNodeSlots.length).map((node, index) => {
    const slot = desktopNodeSlots[index] || desktopNodeSlots[desktopNodeSlots.length - 1];
    return {
      ...node,
      ...slot,
      width: 72,
      height: 112,
      depth: 26,
      gpuDots,
      isSelected: node.name === selectedScope,
      isAffected: affectedNodes.includes(node.name),
      tone: normalizeTone(node.status),
    } satisfies PositionedNode;
  });
}

function nodeStatusSummary(nodes: HologramNode[]) {
  if (!nodes.length) return "Unknown";
  if (nodes.some((node) => node.status === "fail")) return "Critical";
  if (nodes.some((node) => node.status === "warning")) return "Warning";
  if (nodes.every((node) => node.status === "pass")) return "Healthy";
  return "Unknown";
}

function buildAriaDescription(props: AiFactoryHologramProps) {
  const affectedScope = props.affectedNodes.length ? props.affectedNodes.join(", ") : "none";
  return [
    `Cluster ${props.clusterName}.`,
    `Classification ${props.classification}.`,
    `${props.nodeCount} nodes and ${props.gpuCount} GPUs in logical or reference topology.`,
    `Selected scope ${props.selectedScope}.`,
    `Validation state ${stateLabel(props.validationState)}.`,
    `Fabric state ${stateLabel(props.fabricState)}.`,
    `Affected nodes ${affectedScope}.`,
    `Data classification ${props.dataClassification}.`,
    "NVLink and NVSwitch remain inside the GPU fabric; NIC and InfiniBand/RDMA boundary remain external to the node fabric.",
  ].join(" ");
}

function buildNodeGrid(gpuDots: number) {
  return Array.from({ length: Math.min(8, gpuDots) }, (_, index) => ({
    key: `gpu-${index}`,
    cx: 12 + (index % 4) * 12,
    cy: 16 + Math.floor(index / 4) * 14,
  }));
}

function pathForNode(node: PositionedNode) {
  const startX = node.x + node.width * 0.54;
  const startY = node.y + node.height * 0.16;
  return `M ${startX} ${startY} C ${startX + 22} ${startY - 48}, 402 146, 412 224`;
}

export function AiFactoryHologram(props: AiFactoryHologramProps) {
  const visibleNodes = buildVisibleNodes(props.nodes, props.selectedScope, props.affectedNodes, props.gpuCount, props.nodeCount);
  const selectedNode = visibleNodes.find((node) => node.isSelected) || visibleNodes[0];
  const fallbackSelectedScope = selectedNode?.name || props.selectedScope || "unknown";
  const perNodeGpuDots = selectedNode?.gpuDots || Math.max(1, Math.min(8, Math.round(props.gpuCount / Math.max(props.nodeCount, 1))));
  const selectedNodeGrid = buildNodeGrid(perNodeGpuDots);
  const accessibleSummary = buildAriaDescription({ ...props, selectedScope: fallbackSelectedScope });
  const nodeSummary = nodeStatusSummary(props.nodes);
  const selectedNodeTone = selectedNode?.tone || "unknown";
  const compactFacts = [
    { label: "Cluster", value: props.clusterName.toUpperCase() },
    { label: "Class", value: props.classification.toUpperCase() },
    { label: "Node count", value: `${props.nodeCount}` },
    { label: "GPU count", value: `${props.gpuCount}` },
    { label: "Affected", value: props.affectedNodes.length ? props.affectedNodes.map((node) => node.toUpperCase()).join(", ") : "NONE" },
  ];
  const stateRows = [
    { label: "Selected scope", value: fallbackSelectedScope.toUpperCase(), tone: selectedNodeTone },
    { label: "Validation", value: stateLabel(props.validationState), tone: props.validationState },
    { label: "GPU fabric", value: stateLabel(props.fabricState), tone: props.fabricState },
    { label: "Node envelope", value: nodeSummary, tone: selectedNodeTone },
  ];

  return (
    <section
      className="ai-factory-hologram"
      data-testid="AiFactoryHologram"
      aria-labelledby="ai-factory-hologram-title"
      aria-describedby="ai-factory-hologram-description"
    >
      <div className="ai-factory-hologram__header">
        <div>
          <p className="ai-factory-hologram__eyebrow">LOGICAL / REFERENCE TOPOLOGY</p>
          <h3 id="ai-factory-hologram-title">Cluster / Node GPU Fabric</h3>
        </div>
        <div className="ai-factory-hologram__header-chips" aria-label="Topology state markers">
          <span className={stateChipClass(props.validationState)}>{stateLabel(props.validationState)}</span>
          <span className={stateChipClass(props.fabricState)}>{`GPU fabric ${stateLabel(props.fabricState)}`}</span>
        </div>
      </div>

      <div className="ai-factory-hologram__desktop-layout">
        <div className="ai-factory-hologram__canvas-shell">
          <svg viewBox="0 0 820 520" className="ai-factory-hologram__svg" role="img" aria-label={accessibleSummary}>
            <defs>
              <linearGradient id="factoryBeam" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(19,216,255,0)" />
                <stop offset="42%" stopColor="rgba(19,216,255,0.42)" />
                <stop offset="100%" stopColor="rgba(19,216,255,0)" />
              </linearGradient>
              <radialGradient id="factoryGlow" cx="50%" cy="52%" r="56%">
                <stop offset="0%" stopColor="rgba(19,216,255,0.28)" />
                <stop offset="100%" stopColor="rgba(19,216,255,0)" />
              </radialGradient>
              <filter id="factorySoftGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g aria-hidden="true">
              <rect x="22" y="28" width="776" height="430" rx="30" className="ai-factory-hologram__backplane" />
              <ellipse cx="410" cy="348" rx="270" ry="98" className="ai-factory-hologram__ring ai-factory-hologram__ring--outer" />
              <ellipse cx="410" cy="348" rx="220" ry="82" className="ai-factory-hologram__ring ai-factory-hologram__ring--middle" />
              <ellipse cx="410" cy="348" rx="166" ry="62" className="ai-factory-hologram__ring ai-factory-hologram__ring--inner" />
              <path d="M 144 348 H 676" className="ai-factory-hologram__axis" />
              <path d="M 218 296 C 320 244 500 244 602 296" className="ai-factory-hologram__orbit ai-factory-hologram__orbit--a" />
              <path d="M 206 394 C 322 442 498 442 614 394" className="ai-factory-hologram__orbit ai-factory-hologram__orbit--b" />
              <path d="M 410 64 V 356" className="ai-factory-hologram__beam" />
              <circle cx="410" cy="210" r="118" fill="url(#factoryGlow)" />
              <ellipse cx="410" cy="226" rx="146" ry="70" className="ai-factory-hologram__group-plane" />
              <path d="M 214 232 L 606 232" className="ai-factory-hologram__grid-line" />
              <path d="M 242 190 L 634 190" className="ai-factory-hologram__grid-line ai-factory-hologram__grid-line--subtle" />
              <path d="M 242 274 L 634 274" className="ai-factory-hologram__grid-line ai-factory-hologram__grid-line--subtle" />
            </g>

            <g className="ai-factory-hologram__node-fleet" aria-label="GPU node group">
              {visibleNodes.map((node, index) => {
                const frontX = node.x;
                const frontY = node.y;
                const topX = node.x + node.depth;
                const topY = node.y - node.depth;
                const nodeClass = [
                  "ai-factory-hologram__node",
                  `ai-factory-hologram__node--${node.tone}`,
                  node.isSelected ? "ai-factory-hologram__node--selected" : "",
                  node.isAffected ? "ai-factory-hologram__node--affected" : "",
                ].filter(Boolean).join(" ");
                const nicX = node.x + node.width + node.depth + 10;
                const nicY = node.y + node.height * 0.56;

                return (
                  <g key={node.name} className={nodeClass} style={{ ["--node-order" as string]: index } as CSSProperties}>
                    <path d={`M ${frontX} ${frontY} L ${topX} ${topY} L ${topX + node.width} ${topY} L ${frontX + node.width} ${frontY} Z`} className="ai-factory-hologram__node-top" />
                    <path d={`M ${frontX + node.width} ${frontY} L ${topX + node.width} ${topY} L ${topX + node.width} ${topY + node.height} L ${frontX + node.width} ${frontY + node.height} Z`} className="ai-factory-hologram__node-side" />
                    <rect x={frontX} y={frontY} width={node.width} height={node.height} rx="8" className="ai-factory-hologram__node-front" />
                    <rect x={frontX + 10} y={frontY + 14} width={node.width - 20} height={node.height - 24} rx="7" className="ai-factory-hologram__node-core" />

                    {buildNodeGrid(node.gpuDots).map((dot) => (
                      <circle key={`${node.name}-${dot.key}`} cx={frontX + dot.cx} cy={frontY + dot.cy + 26} r="3.2" className="ai-factory-hologram__gpu-dot" />
                    ))}

                    <path d={pathForNode(node)} className="ai-factory-hologram__fabric-link" />
                    <circle cx={nicX} cy={nicY} r="5" className="ai-factory-hologram__nic-dot" />
                    <path d={`M ${nicX} ${nicY} C ${nicX + 42} ${nicY - 10}, 734 292, 744 244`} className="ai-factory-hologram__external-link" />
                    <text x={frontX + node.width / 2} y={frontY + node.height + 18} textAnchor="middle" className="ai-factory-hologram__node-label">
                      {node.name.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>

            <g className="ai-factory-hologram__selected-fabric" filter="url(#factorySoftGlow)">
              <path d="M 342 210 L 410 172 L 478 210 L 410 252 Z" className="ai-factory-hologram__fabric-shell" />
              <path d="M 342 210 L 342 280 L 410 320 L 410 252 Z" className="ai-factory-hologram__fabric-shell ai-factory-hologram__fabric-shell--left" />
              <path d="M 478 210 L 478 280 L 410 320 L 410 252 Z" className="ai-factory-hologram__fabric-shell ai-factory-hologram__fabric-shell--right" />
              <text x="410" y="188" textAnchor="middle" className="ai-factory-hologram__fabric-title">GPU FABRIC</text>
              <text x="410" y="210" textAnchor="middle" className="ai-factory-hologram__fabric-label">NVSwitch</text>
              <text x="410" y="232" textAnchor="middle" className="ai-factory-hologram__fabric-label ai-factory-hologram__fabric-label--muted">NVLink inside node</text>
              {selectedNodeGrid.map((dot, index) => {
                const side = index < 4 ? -1 : 1;
                const targetX = 410 + side * 84;
                const targetY = 196 + (index % 4) * 21;
                return (
                  <g key={`selected-${dot.key}`}>
                    <circle cx={targetX} cy={targetY} r="5.2" className="ai-factory-hologram__selected-gpu-dot" />
                    <path d={`M ${410 + side * 12} ${210 + (index % 4) * 4} C ${410 + side * 34} ${204 + (index % 4) * 5}, ${targetX - side * 16} ${targetY}, ${targetX - side * 6} ${targetY}`} className="ai-factory-hologram__selected-link" />
                  </g>
                );
              })}
            </g>

            <g className="ai-factory-hologram__boundary-layer">
              <path d="M 644 186 C 700 176 742 194 758 240 C 772 286 748 332 692 352" className="ai-factory-hologram__boundary-arc" />
              <circle cx="744" cy="244" r="7" className="ai-factory-hologram__boundary-node" />
              <path d="M 612 170 L 682 136" className="ai-factory-hologram__callout-line" />
              <path d="M 594 324 L 676 344" className="ai-factory-hologram__callout-line" />
              <path d="M 308 170 L 238 132" className="ai-factory-hologram__callout-line" />
              <path d="M 300 340 L 230 374" className="ai-factory-hologram__callout-line" />

              <g transform="translate(668 108)" className="ai-factory-hologram__callout">
                <rect width="118" height="52" rx="10" />
                <text x="14" y="20">InfiniBand/RDMA boundary</text>
                <text x="14" y="38">NIC external cluster fabric</text>
              </g>
              <g transform="translate(666 338)" className="ai-factory-hologram__callout ai-factory-hologram__callout--semantic">
                <rect width="120" height="56" rx="10" />
                <text x="14" y="20">Selected scope</text>
                <text x="14" y="38">{fallbackSelectedScope.toUpperCase()}</text>
              </g>
              <g transform="translate(108 100)" className="ai-factory-hologram__callout">
                <rect width="118" height="56" rx="10" />
                <text x="14" y="20">Cluster</text>
                <text x="14" y="38">{props.clusterName.toUpperCase()}</text>
              </g>
              <g transform="translate(92 350)" className="ai-factory-hologram__callout">
                <rect width="136" height="58" rx="10" />
                <text x="14" y="20">Node group</text>
                <text x="14" y="38">Logical / reference plane</text>
              </g>
              <text x="410" y="374" textAnchor="middle" className="ai-factory-hologram__platform-label">CLUSTER → NODE GROUP → GPU NODE → GPU FABRIC</text>
              <text x="410" y="394" textAnchor="middle" className="ai-factory-hologram__platform-label ai-factory-hologram__platform-label--muted">NIC boundary remains outside NVLink / NVSwitch</text>
            </g>
          </svg>
        </div>

        <aside className="ai-factory-hologram__sidebar" aria-label="Hologram technical summary">
          <div className="ai-factory-hologram__summary-card ai-factory-hologram__summary-card--selected">
            <span>Data classification</span>
            <strong>{props.dataClassification}</strong>
          </div>

          <div className="ai-factory-hologram__summary-grid">
            {compactFacts.map((fact) => (
              <div key={fact.label} className="ai-factory-hologram__summary-card">
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>

          <div className="ai-factory-hologram__status-board">
            {stateRows.map((row) => (
              <div key={row.label} className="ai-factory-hologram__status-row">
                <span>{row.label}</span>
                <strong className={`ai-factory-hologram__state ai-factory-hologram__state--${row.tone}`}>{row.value}</strong>
              </div>
            ))}
          </div>

          <dl className="ai-factory-hologram__legend" aria-label="Topology legend">
            <div>
              <dt>Topology semantics</dt>
              <dd>NVLink and NVSwitch remain inside the node fabric; NIC and InfiniBand/RDMA stay external.</dd>
            </div>
          </dl>

          <div className="ai-factory-hologram__actions">
            <button type="button" className="ai-factory-hologram__action ai-factory-hologram__action--primary" onClick={props.onOpenTopology}>
              View topology
            </button>
            <button type="button" className="ai-factory-hologram__action ai-factory-hologram__action--secondary" onClick={props.onToggleBookmark}>
              {props.isBookmarked ? `Pinned ${fallbackSelectedScope.toUpperCase()}` : `Pin ${fallbackSelectedScope.toUpperCase()}`}
            </button>
          </div>
        </aside>
      </div>

      <div className="ai-factory-hologram__mobile" aria-label="Compact AI Factory topology">
        <div className="ai-factory-hologram__mobile-header">
          <strong>{props.clusterName.toUpperCase()}</strong>
          <span>{`Selected scope ${fallbackSelectedScope.toUpperCase()}`}</span>
        </div>
        <div className="ai-factory-hologram__mobile-grid" aria-hidden="true">
          <div className="ai-factory-hologram__mobile-column ai-factory-hologram__mobile-column--cluster">
            <span>Cluster</span>
            <strong>{props.nodeCount} nodes</strong>
          </div>
          <div className="ai-factory-hologram__mobile-column ai-factory-hologram__mobile-column--nodes">
            <span>GPU fabric</span>
            <div className="ai-factory-hologram__mobile-nodes">
              {visibleNodes.slice(0, 4).map((node) => (
                <span key={`mobile-${node.name}`} className={`ai-factory-hologram__mobile-node ai-factory-hologram__mobile-node--${node.tone} ${node.isSelected ? "ai-factory-hologram__mobile-node--selected" : ""}`}>
                  {node.name.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          <div className="ai-factory-hologram__mobile-column ai-factory-hologram__mobile-column--boundary">
            <span>NIC → InfiniBand/RDMA boundary</span>
            <strong>{stateLabel(props.fabricState)}</strong>
          </div>
        </div>
        <div className="ai-factory-hologram__mobile-footer">
          <span>{`${props.gpuCount} GPUs`}</span>
          <span>{props.dataClassification}</span>
        </div>
      </div>

      <p id="ai-factory-hologram-description" className="ai-factory-hologram__sr-only">
        {accessibleSummary} Reduced motion keeps the diagram static while preserving cluster, GPU fabric, selected scope, and state overlays.
      </p>
    </section>
  );
}
