import React, { useId, useMemo, useState } from "react";
import { CheckCircle2, LockKeyhole, Moon, Server, ShieldCheck, Sun } from "lucide-react";

type PublicLandingProps = {
  isDarkMode: boolean;
  onSubmit: () => void;
  onToggleTheme: () => void;
};

type TopologyStage = "discovery" | "fabric" | "nccl" | "egress" | "cluster" | "validated";

type TopologyChip = {
  label: string;
  detail: string;
};

const topologySequence: TopologyStage[] = [
  "discovery",
  "fabric",
  "nccl",
  "egress",
  "cluster",
  "validated",
];

const capabilityChips: TopologyChip[] = [
  { label: "GPU inventory", detail: "Discover 8× GPU node inventory and reviewer evidence." },
  { label: "Fabric validation", detail: "Inspect NVLink, NVSwitch, and node-level NIC boundaries." },
  { label: "Collective readiness", detail: "Verify NCCL communication paths before cluster benchmarks." },
  { label: "Secure access", detail: "Controlled reviewer sign in for evidence-grounded portal access." },
];

const trustIndicators = [
  {
    title: "Evidence-first",
    body: "Logical reference topology with explicit internal and external fabric boundaries.",
    icon: CheckCircle2,
  },
  {
    title: "Secure access",
    body: "Reviewer sign in gates access without changing authentication semantics.",
    icon: LockKeyhole,
  },
  {
    title: "Operational clarity",
    body: "GPU, NVLink, NVSwitch, NIC, and InfiniBand/RDMA roles are separated clearly.",
    icon: ShieldCheck,
  },
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function TopologyDiagram({ compact }: { compact: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const activeStage = topologySequence[sequenceIndex] ?? "validated";

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setSequenceIndex(topologySequence.length - 1);
      return;
    }

    const timer = window.setInterval(() => {
      setSequenceIndex((current) => (current + 1) % topologySequence.length);
    }, 2400);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  const stageLabel = useMemo(() => {
    switch (activeStage) {
      case "discovery":
        return "DISCOVERY";
      case "fabric":
        return "GPU FABRIC";
      case "nccl":
        return "NCCL";
      case "egress":
        return "NODE EGRESS";
      case "cluster":
        return "Cluster fabric";
      default:
        return "VALIDATED";
    }
  }, [activeStage]);

  const nodeClassNames = [
    "landing-topology",
    compact ? "landing-topology--compact" : "landing-topology--desktop",
    `landing-topology--${activeStage}`,
    prefersReducedMotion ? "landing-topology--reduced" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (compact) {
    return (
      <div className={nodeClassNames}>
        <div className="landing-topology__header-row">
          <div>
            <p className="landing-topology__eyebrow">Logical GPU Node Fabric</p>
            <h2 className="landing-topology__title">Logical reference topology</h2>
          </div>
          <span className="landing-topology__stage" aria-live="polite">{prefersReducedMotion ? "Static reference" : stageLabel}</span>
        </div>
        <p className="landing-topology__summary" id="landing-topology-summary-mobile">
          NVLink and NVSwitch provide high-bandwidth GPU communication inside the node. The node NIC connects the system to the external InfiniBand/RDMA cluster fabric.
        </p>
        <div
          className="landing-topology__canvas landing-topology__canvas--compact"
          role="img"
          aria-labelledby="landing-topology-title-mobile"
          aria-describedby="landing-topology-summary-mobile"
        >
          <svg viewBox="0 0 320 420" className="landing-topology__svg" focusable="false" aria-hidden="true">
            <defs>
              <linearGradient id="compactNodeFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(15, 23, 42, 0.95)" />
                <stop offset="100%" stopColor="rgba(2, 6, 23, 0.98)" />
              </linearGradient>
            </defs>

            <rect x="28" y="54" width="264" height="202" rx="22" className="landing-topology__boundary landing-topology__boundary--internal" />
            <text id="landing-topology-title-mobile" x="46" y="82" className="landing-topology__boundary-label">Internal GPU Fabric boundary</text>

            <rect x="86" y="104" width="148" height="42" rx="16" className="landing-topology__block landing-topology__block--gpu" />
            <text x="160" y="130" textAnchor="middle" className="landing-topology__block-label">8× GPU FABRIC</text>

            <path d="M 160 146 V 180" className="landing-topology__path landing-topology__path--discovery landing-topology__path--fabric" />
            <text x="160" y="174" textAnchor="middle" className="landing-topology__path-label">↓</text>

            <rect x="108" y="184" width="104" height="34" rx="14" className="landing-topology__block landing-topology__block--nvlink" />
            <text x="160" y="206" textAnchor="middle" className="landing-topology__block-label">NVLink</text>

            <path d="M 160 218 V 250" className="landing-topology__path landing-topology__path--fabric landing-topology__path--nccl" />
            <text x="160" y="244" textAnchor="middle" className="landing-topology__path-label">↓</text>

            <rect x="96" y="254" width="128" height="36" rx="14" className="landing-topology__block landing-topology__block--nvswitch" />
            <text x="160" y="277" textAnchor="middle" className="landing-topology__block-label">NVSwitch</text>

            <path d="M 160 290 V 322" className="landing-topology__path landing-topology__path--nccl landing-topology__path--egress" />
            <text x="160" y="316" textAnchor="middle" className="landing-topology__path-label">↓</text>

            <rect x="108" y="326" width="104" height="34" rx="14" className="landing-topology__block landing-topology__block--nic" />
            <text x="160" y="348" textAnchor="middle" className="landing-topology__block-label">Node NIC</text>

            <path d="M 160 360 V 387" className="landing-topology__path landing-topology__path--egress landing-topology__path--cluster" />
            <text x="160" y="379" textAnchor="middle" className="landing-topology__path-label">│</text>

            <text x="160" y="404" textAnchor="middle" className="landing-topology__external-label">InfiniBand/RDMA</text>
            <text x="160" y="423" textAnchor="middle" className="landing-topology__external-label">Cluster Fabric</text>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={nodeClassNames}>
      <div className="landing-topology__header-row">
        <div>
          <p className="landing-topology__eyebrow">Logical GPU Node Fabric</p>
          <h2 className="landing-topology__title">Logical reference topology</h2>
        </div>
        <span className="landing-topology__stage" aria-live="polite">{prefersReducedMotion ? "Static reference" : stageLabel}</span>
      </div>
      <p className="landing-topology__summary" id="landing-topology-summary-desktop">
        NVLink and NVSwitch provide high-bandwidth GPU communication inside the node. The node NIC connects the system to the external InfiniBand/RDMA cluster fabric.
      </p>
      <div
        className="landing-topology__canvas"
        role="img"
        aria-labelledby="landing-topology-title-desktop"
        aria-describedby="landing-topology-summary-desktop"
      >
        <svg viewBox="0 0 760 430" className="landing-topology__svg" focusable="false" aria-hidden="true">
          <defs>
            <linearGradient id="desktopNodeFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(15, 23, 42, 0.95)" />
              <stop offset="100%" stopColor="rgba(2, 6, 23, 0.98)" />
            </linearGradient>
          </defs>

          <rect x="42" y="48" width="548" height="270" rx="24" className="landing-topology__boundary landing-topology__boundary--internal" />
          <text id="landing-topology-title-desktop" x="68" y="76" className="landing-topology__boundary-label">Internal GPU Fabric boundary</text>
          <text x="68" y="100" className="landing-topology__node-title">GPU NODE</text>

          <rect x="628" y="48" width="90" height="270" rx="24" className="landing-topology__boundary landing-topology__boundary--external" />
          <text x="673" y="80" textAnchor="middle" className="landing-topology__boundary-label">External Fabric boundary</text>
          <text x="673" y="112" textAnchor="middle" className="landing-topology__external-label">External Cluster Fabric</text>

          {[
            { label: "GPU0", x: 96, y: 124 },
            { label: "GPU1", x: 210, y: 124 },
            { label: "GPU2", x: 324, y: 124 },
            { label: "GPU3", x: 438, y: 124 },
            { label: "GPU4", x: 96, y: 188 },
            { label: "GPU5", x: 210, y: 188 },
            { label: "GPU6", x: 324, y: 188 },
            { label: "GPU7", x: 438, y: 188 },
          ].map((gpu) => (
            <g key={gpu.label} className="landing-topology__gpu-group">
              <rect x={gpu.x} y={gpu.y} width="88" height="42" rx="14" className="landing-topology__block landing-topology__block--gpu" />
              <text x={gpu.x + 44} y={gpu.y + 26} textAnchor="middle" className="landing-topology__block-label">{gpu.label}</text>
            </g>
          ))}

          <path d="M 140 230 C 204 254, 248 268, 316 282" className="landing-topology__path landing-topology__path--discovery landing-topology__path--fabric" />
          <path d="M 254 230 C 280 256, 302 266, 330 282" className="landing-topology__path landing-topology__path--fabric" />
          <path d="M 368 230 C 356 254, 346 266, 332 282" className="landing-topology__path landing-topology__path--fabric landing-topology__path--nccl" />
          <path d="M 482 230 C 428 252, 388 266, 346 282" className="landing-topology__path landing-topology__path--fabric" />
          <text x="276" y="264" className="landing-topology__annotation">NVLink</text>

          <rect x="250" y="286" width="164" height="46" rx="16" className="landing-topology__block landing-topology__block--nvswitch" />
          <text x="332" y="315" textAnchor="middle" className="landing-topology__block-label">NVSwitch Fabric</text>

          <path d="M 332 332 V 362" className="landing-topology__path landing-topology__path--nccl landing-topology__path--egress" />
          <text x="344" y="352" className="landing-topology__annotation">↓</text>

          <rect x="280" y="366" width="104" height="34" rx="14" className="landing-topology__block landing-topology__block--nic" />
          <text x="332" y="389" textAnchor="middle" className="landing-topology__block-label">Node NIC</text>

          <path d="M 384 383 C 456 383, 514 342, 590 240" className="landing-topology__path landing-topology__path--egress landing-topology__path--cluster" />
          <path d="M 590 240 H 628" className="landing-topology__path landing-topology__path--cluster landing-topology__path--validated" />
          <text x="446" y="366" className="landing-topology__external-label">InfiniBand / RDMA</text>

          <rect x="646" y="162" width="54" height="54" rx="18" className="landing-topology__block landing-topology__block--cluster" />
          <text x="673" y="194" textAnchor="middle" className="landing-topology__cluster-mark">CF</text>
          <text x="673" y="236" textAnchor="middle" className="landing-topology__external-label">External Cluster Fabric</text>

          <text x="68" y="352" className="landing-topology__topology-note">8× GPU</text>
          <text x="68" y="374" className="landing-topology__topology-note">Logical GPU-local communication: GPU → NVLink → NVSwitch</text>
          <text x="68" y="396" className="landing-topology__topology-note">External communication: Node → NIC → InfiniBand/RDMA → Cluster Fabric</text>
        </svg>
      </div>
    </div>
  );
}

export function PublicLanding({ isDarkMode, onSubmit, onToggleTheme }: PublicLandingProps) {
  const usernameId = useId();
  const passwordId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="public-landing-shell min-h-screen">
      <header className="public-landing-header">
        <button
          type="button"
          className="public-landing-theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDarkMode ? "Activate light mode" : "Activate dark mode"}
          title={isDarkMode ? "Activate light mode" : "Activate dark mode"}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      <main className="public-landing-main">
        <section className="public-landing-grid" aria-labelledby="gpuvalidator-landing-title">
          <div className="public-landing-identity">
            <div className="public-landing-identity-block">
              <p className="public-landing-kicker">GPUValidator</p>
              <p className="public-landing-subkicker">AI FACTORY READINESS PORTAL</p>
              <h1 id="gpuvalidator-landing-title" className="public-landing-title">
                GPU Infrastructure
                <br />
                Readiness, Validated.
              </h1>
              <span className="sr-only">GPU Infrastructure Readiness, Validated</span>
              <p className="public-landing-copy">
                GPUValidator helps infrastructure reviewers confirm GPU node inventory, internal GPU fabric readiness, and external cluster connectivity with technically accurate logical topology and evidence-grounded access.
              </p>
            </div>

            <div className="public-landing-trust-grid public-landing-trust-grid--desktop">
              {trustIndicators.map(({ title, body, icon: Icon }) => (
                <article key={title} className="public-landing-trust-card">
                  <Icon className="public-landing-trust-icon" aria-hidden="true" />
                  <div>
                    <h2>{title}</h2>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>

            <TopologyDiagram compact={false} />

            <div className="public-landing-capabilities" aria-label="Capability indicators">
              {capabilityChips.map((chip) => (
                <article key={chip.label} className="public-landing-capability-chip">
                  <h2>{chip.label}</h2>
                  <p>{chip.detail}</p>
                </article>
              ))}
            </div>

            <footer className="public-landing-footer">
              <div className="public-landing-footer-markers" aria-label="Trust and security indicators">
                <span><Server className="h-3.5 w-3.5" aria-hidden="true" /> Logical reference topology</span>
                <span><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Secure access</span>
                <span><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Built for AI infrastructure reviewers</span>
              </div>
            </footer>
          </div>

          <div className="public-landing-signin-column">
            <form
              className="public-landing-signin-card"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
              }}
            >
              <div className="public-landing-signin-header">
                <p className="public-landing-kicker">Reviewer Sign In</p>
                <h2>Secure access to GPUValidator</h2>
                <p>
                  Enter reviewer credentials to access AI infrastructure readiness evidence, validation summaries, and logical fabric references.
                </p>
              </div>

              <div className="public-landing-field">
                <label htmlFor={usernameId}>Username</label>
                <input
                  id={usernameId}
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  spellCheck={false}
                  placeholder="reviewer"
                  required
                />
              </div>

              <div className="public-landing-field">
                <label htmlFor={passwordId}>Password</label>
                <div className="public-landing-password-row">
                  <input
                    id={passwordId}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    className="public-landing-password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button type="submit" className="public-landing-submit">
                Sign In
              </button>

              <div className="public-landing-trust-grid public-landing-trust-grid--mobile">
                {trustIndicators.map(({ title, body, icon: Icon }) => (
                  <article key={title} className="public-landing-trust-card">
                    <Icon className="public-landing-trust-icon" aria-hidden="true" />
                    <div>
                      <h2>{title}</h2>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>

              <TopologyDiagram compact={true} />

              <div className="public-landing-capabilities public-landing-capabilities--mobile" aria-label="Capability indicators">
                {capabilityChips.map((chip) => (
                  <article key={chip.label} className="public-landing-capability-chip">
                    <h2>{chip.label}</h2>
                    <p>{chip.detail}</p>
                  </article>
                ))}
              </div>

              <div className="public-landing-footer-markers public-landing-footer-markers--mobile" aria-label="Trust and security indicators">
                <span><Server className="h-3.5 w-3.5" aria-hidden="true" /> Logical reference topology</span>
                <span><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Secure access</span>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
