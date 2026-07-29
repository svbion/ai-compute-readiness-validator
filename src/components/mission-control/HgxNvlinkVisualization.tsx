type GpuNode = {
  id: number;
  x: number;
  y: number;
  nvlinkState: string;
  p2pState: string;
  validationState: string;
  benchmarkState: string;
};

const gpus: GpuNode[] = [
  { id: 0, x: 82, y: 74, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo NCCL collective active" },
  { id: 1, x: 82, y: 134, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo NCCL collective active" },
  { id: 2, x: 82, y: 194, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo validation traffic active" },
  { id: 3, x: 82, y: 254, nvlinkState: "Degraded demo path", p2pState: "P2P rerouted through fabric", validationState: "Reference check: degraded", benchmarkState: "Demo NCCL collective impacted" },
  { id: 4, x: 558, y: 74, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo discovery active" },
  { id: 5, x: 558, y: 134, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo NCCL collective active" },
  { id: 6, x: 558, y: 194, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo validation traffic active" },
  { id: 7, x: 558, y: 254, nvlinkState: "Healthy demo path", p2pState: "P2P via NVSwitch fabric", validationState: "Reference check: pass", benchmarkState: "Demo NCCL collective active" },
];

const switchPorts = [
  { id: 0, x: 264, y: 86 },
  { id: 1, x: 264, y: 132 },
  { id: 2, x: 264, y: 178 },
  { id: 3, x: 264, y: 224 },
  { id: 4, x: 376, y: 86 },
  { id: 5, x: 376, y: 132 },
  { id: 6, x: 376, y: 178 },
  { id: 7, x: 376, y: 224 },
];

const trafficFlows = [
  { id: "healthy-nvlink", path: "link-gpu-0", colorClass: "hgx-traffic--green", delay: "0s", label: "healthy NVLink traffic" },
  { id: "nccl-collective", path: "collective-path", colorClass: "hgx-traffic--purple", delay: "-1.2s", label: "NCCL collective traffic" },
  { id: "validation", path: "link-gpu-2", colorClass: "hgx-traffic--yellow", delay: "-0.6s", label: "validation traffic" },
  { id: "degraded", path: "link-gpu-3", colorClass: "hgx-traffic--red", delay: "-1.7s", label: "degraded path" },
  { id: "discovery", path: "link-gpu-4", colorClass: "hgx-traffic--blue", delay: "-0.9s", label: "discovery activity" },
  { id: "ib-external", path: "ib-external-path", colorClass: "hgx-traffic--blue", delay: "-1.4s", label: "InfiniBand external cluster network" },
];

export function HgxNvlinkVisualization() {
  return (
    <section className="hgx-visualization cyber-panel rounded-2xl border border-slate-800/80 p-5" aria-labelledby="hgx-topology-title">
      <div className="flex flex-col gap-2 text-left mb-4">
        <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-emerald-400">Logical HGX-style topology</span>
        <h3 id="hgx-topology-title" className="text-base font-display font-bold text-slate-100">NVLink/NVSwitch node fabric reference</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          NVLink connects GPUs through the NVSwitch fabric inside the node. InfiniBand connects the node to the external cluster network.
        </p>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          Demo/reference values only; this is a logical topology, not exact physical cabling.
        </p>
      </div>

      <div className="hgx-canvas" role="img" aria-label="Logical HGX-style topology showing GPU 0 through GPU 7 connected by NVLink into an internal NVSwitch Fabric, with a node-level NIC connecting outward to InfiniBand / External Cluster Network.">
        <svg viewBox="0 0 760 360" className="w-full h-auto" focusable="false">
          <defs>
            <linearGradient id="hgx-node-zone" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.08)" />
              <stop offset="100%" stopColor="rgba(30, 41, 59, 0.2)" />
            </linearGradient>
            <marker id="hgx-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#60a5fa" />
            </marker>
          </defs>

          <rect x="20" y="28" width="620" height="300" rx="18" fill="url(#hgx-node-zone)" stroke="rgba(16,185,129,0.35)" strokeWidth="1.5" strokeDasharray="6 5" />
          <text x="36" y="52" fill="#8ae300" fontSize="10" fontFamily="monospace" fontWeight="700">Internal GPU fabric inside one node</text>

          <rect x="666" y="28" width="72" height="300" rx="18" fill="rgba(37,99,235,0.08)" stroke="rgba(96,165,250,0.4)" strokeWidth="1.5" strokeDasharray="6 5" />
          <text x="702" y="52" fill="#93c5fd" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="middle">External cluster</text>
          <text x="702" y="66" fill="#93c5fd" fontSize="9" fontFamily="monospace" fontWeight="700" textAnchor="middle">network</text>

          <path id="collective-path" d="M 132 74 C 210 56 260 70 288 116 C 322 172 348 188 406 178 C 462 168 500 152 528 134" fill="none" stroke="rgba(168,85,247,0.45)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="7 7" />
          {gpus.map((gpu) => {
            const port = switchPorts[gpu.id];
            const path = `M ${gpu.x + (gpu.x < 320 ? 50 : -50)} ${gpu.y} C ${gpu.x < 320 ? 176 : 464} ${gpu.y}, ${gpu.x < 320 ? 218 : 422} ${port.y}, ${port.x} ${port.y}`;
            return (
              <path
                key={`link-${gpu.id}`}
                id={`link-gpu-${gpu.id}`}
                d={path}
                fill="none"
                stroke={gpu.id === 3 ? "rgba(248,113,113,0.78)" : "rgba(52,211,153,0.72)"}
                strokeWidth={gpu.id === 3 ? "3" : "2"}
                strokeLinecap="round"
              />
            );
          })}
          <path id="fabric-peer-path" d="M 288 116 C 312 96 338 96 362 116 M 288 178 C 314 202 342 202 370 178" fill="none" stroke="rgba(168,85,247,0.55)" strokeWidth="2" strokeLinecap="round" strokeDasharray="6 6" />

          <g className="hgx-hotspot" tabIndex={0} role="button" aria-label="NVSwitch Fabric internal to the node. GPU peer traffic reaches other GPUs through this internal fabric.">
            <rect x="264" y="70" width="112" height="170" rx="14" fill="rgba(15,23,42,0.94)" stroke="#8ae300" strokeWidth="2" />
            <text x="320" y="142" fill="#f8fafc" fontSize="13" fontFamily="monospace" fontWeight="700" textAnchor="middle">NVSwitch</text>
            <text x="320" y="160" fill="#8ae300" fontSize="11" fontFamily="monospace" fontWeight="700" textAnchor="middle">Fabric</text>
            <text x="320" y="182" fill="#94a3b8" fontSize="8.5" fontFamily="monospace" textAnchor="middle">internal GPU peer fabric</text>
            <foreignObject x="210" y="244" width="220" height="66" className="hgx-tooltip">
              <div className="hgx-tooltip-card">NVSwitch Fabric is internal to the node. It carries GPU peer communication and NCCL collectives between GPUs; it is not the external network.</div>
            </foreignObject>
          </g>

          {gpus.map((gpu) => (
            <g key={gpu.id} className="hgx-hotspot" tabIndex={0} role="button" aria-label={`GPU ${gpu.id}. NVLink state ${gpu.nvlinkState}. P2P state ${gpu.p2pState}. Validation state ${gpu.validationState}. Benchmark state ${gpu.benchmarkState}.`}>
              <rect x={gpu.x - 50} y={gpu.y - 20} width="100" height="40" rx="9" fill="rgba(15,23,42,0.92)" stroke={gpu.id === 3 ? "#f87171" : "#34d399"} strokeWidth="1.7" />
              <text x={gpu.x} y={gpu.y + 4} fill="#f8fafc" fontSize="12" fontFamily="monospace" fontWeight="700" textAnchor="middle">GPU {gpu.id}</text>
              <foreignObject x={gpu.x < 320 ? gpu.x + 26 : gpu.x - 180} y={Math.max(32, gpu.y - 48)} width="154" height="96" className="hgx-tooltip">
                <div className="hgx-tooltip-card">
                  <strong>GPU {gpu.id}</strong><br />
                  NVLink state: {gpu.nvlinkState}<br />
                  P2P state: {gpu.p2pState}<br />
                  Validation state: {gpu.validationState}<br />
                  Benchmark state: {gpu.benchmarkState}
                </div>
              </foreignObject>
            </g>
          ))}

          <g className="hgx-hotspot" tabIndex={0} role="button" aria-label="NIC connects the node to InfiniBand and the external cluster network. It is outside the NVLink fabric.">
            <rect x="548" y="280" width="74" height="34" rx="9" fill="rgba(15,23,42,0.94)" stroke="#60a5fa" strokeWidth="1.8" />
            <text x="585" y="301" fill="#bfdbfe" fontSize="12" fontFamily="monospace" fontWeight="700" textAnchor="middle">NIC</text>
            <foreignObject x="454" y="236" width="184" height="70" className="hgx-tooltip">
              <div className="hgx-tooltip-card">NIC is the node-level adapter that connects this node outward to InfiniBand / External Cluster Network. Individual GPUs are not drawn as direct InfiniBand endpoints.</div>
            </foreignObject>
          </g>

          <path id="nic-path" d="M 376 224 C 432 250 492 274 548 296" fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 5" />
          <path id="ib-external-path" d="M 622 296 C 648 296 668 260 690 220 C 706 190 714 156 716 118" fill="none" stroke="#60a5fa" strokeWidth="2.8" strokeLinecap="round" markerEnd="url(#hgx-arrow)" />
          <text x="646" y="286" fill="#93c5fd" fontSize="10" fontFamily="monospace" fontWeight="700">InfiniBand / External Cluster Network</text>
          <text x="418" y="247" fill="#94a3b8" fontSize="9" fontFamily="monospace">boundary: NVLink fabric ends before NIC</text>

          <text x="196" y="94" fill="#34d399" fontSize="9" fontFamily="monospace" fontWeight="700">NVLink</text>
          <text x="424" y="94" fill="#34d399" fontSize="9" fontFamily="monospace" fontWeight="700">NVLink</text>
          <text x="382" y="158" fill="#c084fc" fontSize="9" fontFamily="monospace" fontWeight="700">GPU peer communication through NVSwitch</text>

          {trafficFlows.map((flow) => (
            <circle key={flow.id} r="4.5" className={`hgx-traffic ${flow.colorClass}`} aria-label={flow.label}>
              <animateMotion dur="3.8s" repeatCount="indefinite" begin={flow.delay} rotate="auto">
                <mpath href={`#${flow.path}`} />
              </animateMotion>
            </circle>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] font-mono text-slate-400" aria-label="Traffic legend">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />healthy NVLink traffic</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-400" />NCCL collective traffic</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" />validation traffic</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" />degraded path</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" />discovery activity</span>
      </div>
    </section>
  );
}
