const stages = [
  {
    id: "discover",
    label: "DISCOVER",
    description: "Collect GPU, node, NIC, driver, and topology inventory.",
    items: ["GPU inventory", "NVLink state", "NIC inventory", "node identity"],
  },
  {
    id: "topology",
    label: "TOPOLOGY",
    description: "Map NVLink and NVSwitch inside the node separately from InfiniBand outside the node.",
    items: ["GPUs", "NVSwitch", "NVLink", "NIC", "InfiniBand boundary"],
  },
  {
    id: "validate",
    label: "VALIDATE",
    description: "Check GPU peer access, NVLink state, NCCL communication, and network health.",
    items: ["P2P", "NVLink", "NCCL", "fabric checks"],
  },
  {
    id: "benchmark",
    label: "BENCHMARK",
    description: "Execute selected performance tests and compare results against references.",
    items: ["NCCL AllReduce", "HPL", "MLPerf reference"],
  },
  {
    id: "result",
    label: "RESULT",
    description: "Produce a health assessment with supporting evidence.",
    items: ["health score", "pass / warning / fail", "evidence available"],
  },
];

const stageX = [78, 228, 378, 528, 678];

export function ValidationFlowVisualization() {
  return (
    <section
      className="validation-flow-panel"
      aria-labelledby="validation-flow-title"
      aria-describedby="validation-flow-disclaimer"
    >
      <div className="validation-flow-header">
        <div>
          <p className="validation-flow-kicker">VALIDATION PIPELINE</p>
          <h3 id="validation-flow-title">Reference validation workflow</h3>
        </div>
        <span className="validation-flow-reference">REFERENCE WORKFLOW</span>
      </div>

      <div className="validation-flow-canvas" role="img" aria-label="Reference validation workflow from infrastructure discovery through topology mapping, fabric validation, benchmark execution, evidence evaluation, and healthy result.">
        <svg viewBox="0 0 760 300" className="validation-flow-svg" aria-hidden="true">
          <defs>
            <linearGradient id="validationFlowStage" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(15, 23, 42, 0.95)" />
              <stop offset="100%" stopColor="rgba(2, 6, 23, 0.96)" />
            </linearGradient>
            <filter id="validationFlowGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path id="pipeline-path" className="validation-flow-path validation-flow-path--pipeline" d="M 120 78 H 635" />
          <path id="gpu-nvlink-path-a" className="validation-flow-path validation-flow-path--gpu" d="M 230 170 C 260 140, 305 140, 335 170" />
          <path id="gpu-nvlink-path-b" className="validation-flow-path validation-flow-path--gpu" d="M 230 205 C 265 235, 300 235, 335 205" />
          <path id="nccl-collective-path" className="validation-flow-path validation-flow-path--nccl" d="M 392 154 C 426 124, 468 124, 502 154 C 536 184, 578 184, 612 154" />
          <path id="external-fabric-path" className="validation-flow-path validation-flow-path--external" d="M 335 222 C 390 245, 466 245, 522 222" />
          <path id="benchmark-path" className="validation-flow-path validation-flow-path--benchmark" d="M 528 190 H 640" />

          {stageX.map((x, index) => (
            <g key={x} className={`validation-flow-node validation-flow-node--${stages[index].id}`}>
              <rect x={x - 55} y="42" width="110" height="72" rx="14" />
              <text x={x} y="70" textAnchor="middle" className="validation-flow-node-label">{stages[index].label}</text>
              <text x={x} y="91" textAnchor="middle" className="validation-flow-node-meta">
                {index === 0 ? "inventory" : index === 1 ? "logical map" : index === 2 ? "checks" : index === 3 ? "workloads" : "Healthy"}
              </text>
            </g>
          ))}

          {[0, 1, 2, 3].map((index) => (
            <text key={index} x={(stageX[index] + stageX[index + 1]) / 2} y="84" textAnchor="middle" className="validation-flow-arrow">→</text>
          ))}

          <g className="validation-topology-card">
            <rect x="166" y="134" width="218" height="116" rx="16" />
            <text x="188" y="158" className="validation-topology-title">Logical node topology</text>
            <text x="188" y="181" className="validation-topology-text">GPU 0–7</text>
            <text x="257" y="181" className="validation-topology-arrow">→</text>
            <text x="284" y="181" className="validation-topology-text validation-topology-text--green">NVLink</text>
            <text x="188" y="211" className="validation-topology-text">NVSwitch Fabric</text>
            <text x="188" y="235" className="validation-topology-note">GPU-local validation boundary</text>
          </g>

          <g className="validation-external-card">
            <rect x="398" y="134" width="188" height="116" rx="16" />
            <text x="420" y="158" className="validation-topology-title">External fabric</text>
            <text x="420" y="184" className="validation-topology-text">Node NIC</text>
            <text x="488" y="184" className="validation-topology-arrow">→</text>
            <text x="515" y="184" className="validation-topology-text validation-topology-text--yellow">InfiniBand</text>
            <text x="420" y="214" className="validation-topology-text">Cluster Fabric</text>
            <text x="420" y="235" className="validation-topology-note">External validation boundary</text>
          </g>

          <g className="validation-result-card">
            <rect x="620" y="142" width="104" height="92" rx="16" />
            <circle cx="648" cy="174" r="13" className="validation-result-dot" />
            <path d="M 641 174 L 646 180 L 656 168" className="validation-result-check" />
            <text x="674" y="177" className="validation-result-title">Healthy</text>
            <text x="644" y="207" className="validation-result-copy">Evidence</text>
            <text x="644" y="224" className="validation-result-copy">available</text>
          </g>

          <circle r="5" className="validation-pulse validation-pulse--blue">
            <animateMotion dur="12s" begin="0s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#pipeline-path" />
            </animateMotion>
          </circle>
          <circle r="5" className="validation-pulse validation-pulse--green">
            <animateMotion dur="12s" begin="2.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#gpu-nvlink-path-a" />
            </animateMotion>
          </circle>
          <circle r="5" className="validation-pulse validation-pulse--green">
            <animateMotion dur="12s" begin="2.7s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#gpu-nvlink-path-b" />
            </animateMotion>
          </circle>
          <circle r="6" className="validation-pulse validation-pulse--purple">
            <animateMotion dur="12s" begin="4.4s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#nccl-collective-path" />
            </animateMotion>
          </circle>
          <circle r="5" className="validation-pulse validation-pulse--yellow">
            <animateMotion dur="12s" begin="6.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#external-fabric-path" />
            </animateMotion>
          </circle>
          <circle r="5" className="validation-pulse validation-pulse--yellow">
            <animateMotion dur="12s" begin="8s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
              <mpath href="#benchmark-path" />
            </animateMotion>
          </circle>
        </svg>

        <div className="validation-flow-stages" aria-label="Validation workflow stage details">
          {stages.map((stage) => (
            <button key={stage.id} type="button" className="validation-flow-stage" title={stage.description} aria-label={`${stage.label}: ${stage.description}`}>
              <span className="validation-flow-stage-label">{stage.label}</span>
              <span className="validation-flow-stage-summary">{stage.description}</span>
              <span className="validation-flow-stage-items">{stage.items.join(" • ")}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="validation-flow-status" aria-label="Workflow status summary">
        <span>DISCOVERY</span>
        <span>FABRIC</span>
        <span>BENCHMARK</span>
        <span>EVIDENCE</span>
        <span>HEALTH</span>
      </div>
      <p id="validation-flow-disclaimer" className="validation-flow-disclaimer">
        Logical workflow and topology representation. Values shown are demonstration data. reference-workflow disclaimer.
      </p>
    </section>
  );
}
