import React, { useId, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Cpu,
  FileText,
  LineChart,
  Network,
  ShieldCheck,
} from "lucide-react";
import { PublicSiteShell, usePageMetadata } from "./publicSite";

type PublicLandingProps = {
  isDarkMode: boolean;
  onSubmit: () => void;
  onToggleTheme: () => void;
};

type TopologyStage = "gpu" | "nvlink" | "nvswitch" | "nic" | "fabric" | "validated";

type FeatureCard = {
  title: string;
  body: string;
  detail: string;
  icon: LucideIcon;
};

const trustIndicators = [
  "Evidence-grounded validation",
  "GPU fabric topology",
  "NCCL benchmarking",
  "Infrastructure investigations",
  "Secure enterprise workflow",
];

const capabilityModules: FeatureCard[] = [
  {
    title: "AI Factory",
    body: "Map cluster, node, GPU fabric, topology path, affected scope, and evidence in one spatial operating view.",
    detail: "Cluster-aware system model",
    icon: Building2,
  },
  {
    title: "Topology Intelligence",
    body: "Separate GPU, NVLink, NVSwitch, NIC, and InfiniBand / RDMA relationships without implying unsupported physical cabling.",
    detail: "Logical and evidence-aware boundaries",
    icon: Network,
  },
  {
    title: "Validation Engine",
    body: "Run readiness checks across node state, software stack, accelerator health, and fabric dependencies before production rollout.",
    detail: "Operational readiness checks",
    icon: ShieldCheck,
  },
  {
    title: "Benchmark Engine",
    body: "Review NCCL, HPL, and broader benchmark workflows as repeatable evidence rather than isolated one-off runs.",
    detail: "Performance context with provenance",
    icon: LineChart,
  },
  {
    title: "Evidence",
    body: "Keep benchmark packages, findings, summaries, and supporting artifacts close to each conclusion for review and audit.",
    detail: "Traceable proof packages",
    icon: FileText,
  },
  {
    title: "Investigations",
    body: "Follow a regression from symptom to affected node, fabric path, evidence, likely cause, and recommendation.",
    detail: "Structured root-cause workflow",
    icon: Activity,
  },
  {
    title: "Copilot",
    body: "Support engineers with evidence-backed explanations, scoped investigation context, and recommendation framing without fabricating facts.",
    detail: "Evidence-first reasoning support",
    icon: Bot,
  },
];

const validationFlowSteps = ["Discover", "Validate", "Benchmark", "Investigate", "Prove", "Remediate"];

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

function HeroTopologyVisualization({ compact = false }: { compact?: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const stages: TopologyStage[] = ["gpu", "nvlink", "nvswitch", "nic", "fabric", "validated"];
  const [stageIndex, setStageIndex] = useState(prefersReducedMotion ? stages.length - 1 : 0);
  const activeStage = stages[stageIndex] ?? "validated";

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setStageIndex(stages.length - 1);
      return;
    }

    const timer = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % stages.length);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, stages.length]);

  const stageLabel = useMemo(() => {
    switch (activeStage) {
      case "gpu":
        return "GPU scope";
      case "nvlink":
        return "NVLink path trace";
      case "nvswitch":
        return "NVSwitch aggregation";
      case "nic":
        return "Node NIC boundary";
      case "fabric":
        return "InfiniBand / RDMA egress";
      default:
        return "Validated logical route";
    }
  }, [activeStage]);

  return (
    <figure
      className={[
        "hero-topology",
        compact ? "hero-topology--compact" : "",
        `hero-topology--${activeStage}`,
        prefersReducedMotion ? "hero-topology--reduced" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid="PublicHeroTopology"
    >
      <div className="hero-topology__meta">
        <div>
          <p className="public-site-eyebrow">Logical / Reference Topology</p>
          <h2>GPU node fabric with explicit internal and external boundaries</h2>
        </div>
        <span className="hero-topology__stage" aria-live="polite">
          {prefersReducedMotion ? "Static reference" : stageLabel}
        </span>
      </div>

      <p className="hero-topology__summary" id={compact ? "hero-topology-mobile-summary" : "hero-topology-summary"}>
        GPU traffic stays inside the node through NVLink and NVSwitch. External communication leaves the node through the NIC into the InfiniBand / RDMA cluster fabric.
      </p>

      <div
        className="hero-topology__canvas"
        role="img"
        aria-label="Logical reference topology showing GPU to NVLink to NVSwitch to NIC to InfiniBand or RDMA to cluster fabric"
        aria-describedby={compact ? "hero-topology-mobile-summary" : "hero-topology-summary"}
      >
        <svg viewBox={compact ? "0 0 360 500" : "0 0 760 520"} className="hero-topology__svg" focusable="false" aria-hidden="true">
          <rect className="hero-topology__field" x={compact ? 18 : 20} y={compact ? 56 : 56} width={compact ? 230 : 498} height={compact ? 278 : 302} rx="28" />
          <rect className="hero-topology__field hero-topology__field--external" x={compact ? 264 : 546} y={compact ? 56 : 56} width={compact ? 78 : 178} height={compact ? 278 : 302} rx="28" />

          <text x={compact ? 38 : 46} y={compact ? 84 : 88} className="hero-topology__boundary-label">Internal node fabric boundary</text>
          <text x={compact ? 303 : 634} y={compact ? 84 : 88} textAnchor="middle" className="hero-topology__boundary-label">External cluster fabric boundary</text>

          {compact
            ? [
                { label: "GPU0", x: 44, y: 118 },
                { label: "GPU1", x: 134, y: 118 },
                { label: "GPU2", x: 44, y: 182 },
                { label: "GPU3", x: 134, y: 182 },
              ].map((gpu) => (
                <g key={gpu.label}>
                  <rect className="hero-topology__block hero-topology__block--gpu" x={gpu.x} y={gpu.y} width="74" height="38" rx="14" />
                  <text x={gpu.x + 37} y={gpu.y + 24} textAnchor="middle" className="hero-topology__block-label">{gpu.label}</text>
                </g>
              ))
            : [
                { label: "GPU0", x: 62, y: 124 },
                { label: "GPU1", x: 178, y: 124 },
                { label: "GPU2", x: 294, y: 124 },
                { label: "GPU3", x: 410, y: 124 },
                { label: "GPU4", x: 62, y: 196 },
                { label: "GPU5", x: 178, y: 196 },
                { label: "GPU6", x: 294, y: 196 },
                { label: "GPU7", x: 410, y: 196 },
              ].map((gpu) => (
                <g key={gpu.label}>
                  <rect className="hero-topology__block hero-topology__block--gpu" x={gpu.x} y={gpu.y} width="90" height="42" rx="14" />
                  <text x={gpu.x + 45} y={gpu.y + 26} textAnchor="middle" className="hero-topology__block-label">{gpu.label}</text>
                </g>
              ))}

          {compact ? (
            <>
              <path d="M 86 156 C 110 198, 124 212, 150 234" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 176 156 C 168 194, 164 212, 154 234" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 86 220 C 112 232, 124 238, 150 244" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 176 220 C 168 232, 164 238, 154 244" className="hero-topology__path hero-topology__path--nvlink" />
              <text x="152" y="222" className="hero-topology__annotation">NVLink</text>
              <rect className="hero-topology__block hero-topology__block--nvswitch" x="92" y="248" width="118" height="38" rx="16" />
              <text x="151" y="272" textAnchor="middle" className="hero-topology__block-label">NVSwitch</text>
              <path d="M 151 286 V 318" className="hero-topology__path hero-topology__path--nic" />
              <rect className="hero-topology__block hero-topology__block--nic" x="106" y="324" width="90" height="34" rx="14" />
              <text x="151" y="346" textAnchor="middle" className="hero-topology__block-label">NIC</text>
              <path d="M 196 341 C 236 341, 250 304, 264 226" className="hero-topology__path hero-topology__path--fabric" />
              <rect className="hero-topology__block hero-topology__block--fabric" x="280" y="178" width="48" height="48" rx="18" />
              <text x="304" y="208" textAnchor="middle" className="hero-topology__cluster-mark">CF</text>
              <text x="304" y="254" textAnchor="middle" className="hero-topology__external-label">Cluster</text>
              <text x="304" y="272" textAnchor="middle" className="hero-topology__external-label">Fabric</text>
              <text x="152" y="390" textAnchor="middle" className="hero-topology__topology-note">GPU → NVLink → NVSwitch → NIC → InfiniBand / RDMA → Cluster Fabric</text>
            </>
          ) : (
            <>
              <path d="M 108 166 C 168 234, 244 274, 302 304" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 224 166 C 250 234, 280 272, 314 304" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 340 166 C 338 234, 334 270, 330 304" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 456 166 C 426 234, 394 272, 348 304" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 108 238 C 168 270, 244 292, 302 312" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 224 238 C 250 274, 280 296, 314 314" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 340 238 C 338 274, 334 298, 330 314" className="hero-topology__path hero-topology__path--nvlink" />
              <path d="M 456 238 C 426 270, 394 292, 348 314" className="hero-topology__path hero-topology__path--nvlink" />
              <text x="270" y="280" className="hero-topology__annotation">NVLink</text>

              <rect className="hero-topology__block hero-topology__block--nvswitch" x="248" y="316" width="172" height="46" rx="16" />
              <text x="334" y="344" textAnchor="middle" className="hero-topology__block-label">NVSwitch</text>

              <path d="M 334 362 V 394" className="hero-topology__path hero-topology__path--nic" />
              <rect className="hero-topology__block hero-topology__block--nic" x="284" y="400" width="100" height="36" rx="14" />
              <text x="334" y="423" textAnchor="middle" className="hero-topology__block-label">NIC</text>

              <path d="M 384 418 C 462 418, 500 370, 546 240" className="hero-topology__path hero-topology__path--fabric" />
              <text x="434" y="394" className="hero-topology__external-label">InfiniBand / RDMA</text>

              <rect className="hero-topology__block hero-topology__block--fabric" x="594" y="192" width="78" height="78" rx="20" />
              <text x="633" y="238" textAnchor="middle" className="hero-topology__cluster-mark">CF</text>
              <text x="633" y="302" textAnchor="middle" className="hero-topology__external-label">Cluster Fabric</text>

              <text x="46" y="404" className="hero-topology__topology-note">GPU-local communication remains inside the node.</text>
              <text x="46" y="428" className="hero-topology__topology-note">External communication exits through the NIC into the cluster fabric.</text>
            </>
          )}
        </svg>
      </div>

      <figcaption className="hero-topology__legend">
        <span><span className="hero-topology__legend-dot hero-topology__legend-dot--gpu" /> GPU</span>
        <span><span className="hero-topology__legend-dot hero-topology__legend-dot--link" /> NVLink / NVSwitch</span>
        <span><span className="hero-topology__legend-dot hero-topology__legend-dot--nic" /> NIC / egress</span>
        <span><span className="hero-topology__legend-dot hero-topology__legend-dot--fabric" /> Cluster fabric</span>
      </figcaption>
    </figure>
  );
}

function ValidationFlowVisualization() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(prefersReducedMotion ? validationFlowSteps.length - 1 : 0);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setActiveIndex(validationFlowSteps.length - 1);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % validationFlowSteps.length);
    }, 1600);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  return (
    <div className="public-flow" data-testid="PublicValidationFlow">
      {validationFlowSteps.map((step, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex || activeIndex === validationFlowSteps.length - 1;

        return (
          <React.Fragment key={step}>
            <article
              className={[
                "public-flow__step",
                isActive ? "public-flow__step--active" : "",
                isComplete ? "public-flow__step--complete" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="public-flow__index">0{index + 1}</span>
              <h3>{step}</h3>
              <p>
                {step === "Discover" && "Inventory clusters, nodes, and GPU scope before judging readiness."}
                {step === "Validate" && "Check software, accelerator health, and fabric prerequisites."}
                {step === "Benchmark" && "Run repeatable suites against the represented topology and scope."}
                {step === "Investigate" && "Follow regressions into evidence, affected paths, and likely causes."}
                {step === "Prove" && "Package conclusions with benchmark artifacts and supporting evidence."}
                {step === "Remediate" && "Return an evidence-backed next action with approval-aware context."}
              </p>
            </article>
            {index < validationFlowSteps.length - 1 ? <div className="public-flow__connector" aria-hidden="true" /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function PublicLanding({ isDarkMode, onSubmit, onToggleTheme }: PublicLandingProps) {
  usePageMetadata(
    "GPUValidator | AI Infrastructure Readiness",
    "GPUValidator helps teams validate AI infrastructure readiness through GPU topology awareness, benchmarking, evidence traceability, investigation workflows, and evidence-backed remediation context.",
  );

  const usernameId = useId();
  const passwordId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <PublicSiteShell currentPath="/" isDarkMode={isDarkMode} onToggleTheme={onToggleTheme}>
      <section className="public-hero" id="top" aria-labelledby="public-hero-title" data-testid="PublicHero">
        <div className="public-hero__copy">
          <p className="public-site-eyebrow">GPUValidator</p>
          <h1 id="public-hero-title">Know if your AI infrastructure is actually ready.</h1>
          <p className="public-hero__lede">
            GPUValidator helps infrastructure teams validate GPU infrastructure, understand topology, run benchmark-backed readiness workflows, investigate regressions, and move toward evidence-backed remediation.
          </p>

          <div className="public-hero__actions">
            <a href="/platform" className="public-site-button public-site-button--primary">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="/platform" className="public-site-button public-site-button--secondary">
              Explore Platform
            </a>
          </div>

          <div className="public-hero__rails" aria-label="Public capability summary">
            <article>
              <span>Validation scope</span>
              <strong>GPU, node, fabric, benchmark workflow</strong>
            </article>
            <article>
              <span>Evidence model</span>
              <strong>Findings linked to artifacts and affected scope</strong>
            </article>
            <article>
              <span>Operational outcome</span>
              <strong>Readiness, investigation, recommendation</strong>
            </article>
          </div>
        </div>

        <div className="public-hero__visual">
          <div className="public-hero__topology-desktop">
            <HeroTopologyVisualization />
          </div>
          <div className="public-hero__topology-mobile">
            <HeroTopologyVisualization compact />
          </div>
          <div className="public-hero__support-grid">
            <article className="public-support-card">
              <span>Internal node boundary</span>
              <strong>GPU → NVLink → NVSwitch</strong>
              <p>Explicitly separated from cluster egress to keep the topology truthful.</p>
            </article>
            <article className="public-support-card">
              <span>External fabric path</span>
              <strong>NIC → InfiniBand / RDMA → Cluster Fabric</strong>
              <p>Cluster communication is shown as a node egress path, not as direct GPU cabling.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-proof-strip" aria-label="Trust indicators" data-testid="PublicTrustStrip">
        {trustIndicators.map((item) => (
          <div key={item} className="public-proof-strip__item">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </section>

      <section className="public-section" id="platform" data-testid="PublicCapabilitiesSection">
        <div className="public-section__intro">
          <p className="public-site-eyebrow">Platform capabilities</p>
          <h2>Purpose-built for production-readiness questions</h2>
          <p>
            GPUValidator focuses on whether AI infrastructure is truly ready, why it is not ready, what evidence supports that conclusion, and what should happen next.
          </p>
        </div>

        <div className="public-capability-grid">
          {capabilityModules.map(({ title, body, detail, icon: Icon }) => (
            <article key={title} className="public-capability-card">
              <div className="public-capability-card__header">
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{detail}</span>
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section" id="validation-flow">
        <div className="public-section__intro">
          <p className="public-site-eyebrow">Validation flow</p>
          <h2>Discover → Validate → Benchmark → Investigate → Prove → Remediate</h2>
          <p>
            The public experience keeps the same evidence-first operational logic as Mission Control while presenting it through a simplified product introduction.
          </p>
        </div>

        <ValidationFlowVisualization />
      </section>

      <section className="public-section public-section--split" id="ai-factory">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">AI Factory</p>
          <h2>A cinematic spatial model of affected scope and evidence context</h2>
          <p>
            The AI Factory view reduces density for the public site while preserving the product’s spatial reasoning model: cluster, node, GPU fabric, topology path, affected scope, evidence, and benchmark relation.
          </p>
          <ul className="public-bullet-list">
            <li>Cluster and node context stay visible</li>
            <li>GPU fabric and topology path remain explicit</li>
            <li>Evidence and benchmark relationship stay adjacent to the finding</li>
          </ul>
        </div>

        <div className="factory-visual" data-testid="PublicAiFactorySection">
          <div className="factory-visual__frame">
            <div className="factory-visual__cluster">Cluster / ai-factory-prod-01</div>
            <div className="factory-visual__node">Node / dgx03</div>
            <div className="factory-visual__fabric">GPU fabric / NVLink + NVSwitch</div>
            <div className="factory-visual__path">Topology path / Node NIC → InfiniBand / RDMA</div>
            <div className="factory-visual__evidence">Evidence / nccl-allreduce-run-042</div>
            <div className="factory-visual__benchmark">Benchmark relation / bandwidth regression against validated baseline</div>
          </div>
          <div className="factory-visual__hud">
            <article>
              <span>Affected scope</span>
              <strong>1 node · 8 GPUs · 1 external path</strong>
            </article>
            <article>
              <span>Finding class</span>
              <strong>Benchmark regression under validated topology</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section public-section--split" id="benchmarks">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">Benchmark and evidence</p>
          <h2>Benchmark workflows that stay tied to provenance</h2>
          <p>
            GPUValidator communicates NCCL, HPL, and MLPerf readiness workflows as evidence packages with traceability, not unsupported claims of live external integrations.
          </p>
        </div>

        <div className="benchmark-grid" data-testid="PublicBenchmarkEvidenceSection">
          <article className="benchmark-card">
            <div className="benchmark-card__header">
              <LineChart className="h-5 w-5" aria-hidden="true" />
              <span>Benchmark suites</span>
            </div>
            <h3>NCCL · HPL · MLPerf readiness workflow</h3>
            <ul className="public-bullet-list public-bullet-list--compact">
              <li>NCCL collective path and bandwidth validation</li>
              <li>HPL system-level compute and fabric readiness context</li>
              <li>MLPerf readiness workflow framing where applicable</li>
            </ul>
          </article>

          <article className="benchmark-card">
            <div className="benchmark-card__header">
              <FileText className="h-5 w-5" aria-hidden="true" />
              <span>Evidence package</span>
            </div>
            <h3>Repeatable validation with traceability</h3>
            <ol className="public-sequence-list">
              <li>Benchmark package</li>
              <li>Topology context</li>
              <li>Run metadata</li>
              <li>Evidence summary</li>
              <li>Readiness conclusion</li>
            </ol>
          </article>
        </div>
      </section>

      <section className="public-final-cta" id="get-started" data-testid="PublicFinalCta">
        <div className="public-final-cta__copy">
          <p className="public-site-eyebrow">Get started</p>
          <h2>Validate your AI infrastructure before production does it for you.</h2>
          <p>
            Start with the public product pages today, then move into the reviewer workspace for deeper validation, benchmark, and investigation workflows.
          </p>

          <div className="public-hero__actions public-hero__actions--footer">
            <a href="/platform" className="public-site-button public-site-button--primary">Explore Platform</a>
            <a href="/pricing" className="public-site-button public-site-button--secondary">View Pricing</a>
          </div>
        </div>

        <aside className="reviewer-access-card" id="sign-in">
          <div className="reviewer-access-card__header">
            <p className="public-site-eyebrow">Reviewer sign in</p>
            <h3>Secure access to the authenticated reviewer workspace</h3>
            <p>
              PUBLIC-001 preserves the existing reviewer entry path without introducing production authentication behavior.
            </p>
          </div>

          <form
            className="reviewer-access-card__form"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <label className="reviewer-access-card__field" htmlFor={usernameId}>
              <span>Username</span>
              <input
                id={usernameId}
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="reviewer"
                required
              />
            </label>

            <label className="reviewer-access-card__field" htmlFor={passwordId}>
              <span>Password</span>
              <div className="reviewer-access-card__password-row">
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
                  className="reviewer-access-card__password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <button type="submit" className="public-site-button public-site-button--primary public-site-button--submit">
              Enter reviewer workspace
            </button>
          </form>

          <div className="reviewer-access-card__markers">
            <span><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Controlled evidence access</span>
            <span><Cpu className="h-4 w-4" aria-hidden="true" /> Public/auth boundary preserved</span>
            <span><Activity className="h-4 w-4" aria-hidden="true" /> Authenticated Mission Control remains separate</span>
          </div>
        </aside>
      </section>
    </PublicSiteShell>
  );
}
