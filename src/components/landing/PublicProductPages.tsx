import React from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  GitBranch,
  HardDrive,
  Layers,
  LineChart,
  LockKeyhole,
  Network,
  Server,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { PublicSiteShell, type PublicThemeProps, usePageMetadata } from "./publicSite";

export const PUBLIC_PRODUCT_ROUTE_HEADINGS = {
  "/platform": "The operating system for AI infrastructure decisions",
  "/ai-factory": "Spatial AI Factory investigation surface",
  "/validation": "Evidence-first infrastructure readiness validation",
  "/benchmarks": "Benchmark intelligence with regression context",
  "/enterprise": "Enterprise workflows for private AI infrastructure",
  "/security": "Security principles for evidence-grounded operations",
  "/pricing": "Packaging for evaluation, operators, and enterprise teams",
  "/docs": "Public documentation entry for GPUValidator",
} as const;

const PRODUCT_METADATA = {
  "/platform": {
    title: "GPUValidator Platform | Operational AI Infrastructure Control",
    description:
      "Understand how Mission Control, AI Factory, validation, benchmark intelligence, evidence, investigations, reports, and integrations work together in GPUValidator.",
  },
  "/ai-factory": {
    title: "GPUValidator AI Factory | Spatial Infrastructure Investigation",
    description:
      "See the logical AI Factory experience across cluster, node, GPU fabric, NIC, storage, validation, and benchmark evidence without implying unsupported physical placement.",
  },
  "/validation": {
    title: "GPUValidator Validation | Readiness and Evidence",
    description:
      "Review evidence-first validation across Linux, GPU, driver and CUDA, NVLink, NVSwitch, InfiniBand, Kubernetes, Slurm, storage, and benchmark readiness.",
  },
  "/benchmarks": {
    title: "GPUValidator Benchmarks | Performance and Regression Intelligence",
    description:
      "Understand benchmark workflows for NCCL, HPL, MLPerf-style reference runs, P2P, bandwidth, latency, regression tracking, and evidence packaging.",
  },
  "/enterprise": {
    title: "GPUValidator Enterprise | Private Infrastructure Operations",
    description:
      "Learn how GPUValidator supports multi-cluster evidence review, auditability, private deployment patterns, and approval-aware operational workflows.",
  },
  "/security": {
    title: "GPUValidator Security | Trust, Provenance, and Approval Boundaries",
    description:
      "Review GPUValidator security principles including evidence classification, provenance, sanitization, least privilege, private deployment, and a clear security roadmap.",
  },
  "/pricing": {
    title: "GPUValidator Pricing | Evaluation, Professional, and Enterprise Packaging",
    description:
      "Explore GPUValidator packaging for community evaluation, professional operator workflows, and enterprise deployment planning without fabricated price points or SLAs.",
  },
  "/docs": {
    title: "GPUValidator Docs | Public Documentation Entry",
    description:
      "Start with the public documentation entry for architecture, validation, benchmark packages, topology, agents, integrations, API direction, security, and troubleshooting.",
  },
} as const;

type ProductRoute = keyof typeof PRODUCT_METADATA;

type ProductPageProps = PublicThemeProps & {
  route: ProductRoute;
};

type SectionCardProps = {
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
};

type StatusLabel = "Available now" | "Architecture-ready" | "Planned";

function StatusChip({ label }: { label: StatusLabel }) {
  return <span className={`public-status-chip public-status-chip--${label.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{label}</span>;
}

function ProductHero({
  eyebrow,
  title,
  body,
  currentPath,
  actions,
  children,
}: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  body: string;
  currentPath: string;
  actions?: Array<{ href: string; label: string; variant: "primary" | "secondary" }>;
}>) {
  return (
    <section className="public-product-hero" data-testid={`PublicProductPage:${currentPath}`}>
      <div className="public-product-hero__copy">
        <p className="public-site-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="public-product-hero__lede">{body}</p>
        {actions ? (
          <div className="public-hero__actions public-hero__actions--product">
            {actions.map((action) => (
              <a
                key={action.href + action.label}
                href={action.href}
                className={`public-site-button public-site-button--${action.variant}`}
              >
                {action.label}
                {action.variant === "primary" ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
              </a>
            ))}
          </div>
        ) : null}
      </div>
      <div className="public-product-hero__visual">{children}</div>
    </section>
  );
}

function ProductSection({ eyebrow, title, body, points }: SectionCardProps) {
  return (
    <article className="public-product-section-card">
      <p className="public-site-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      {points?.length ? (
        <ul className="public-bullet-list public-bullet-list--compact">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function PlatformVisual() {
  return (
    <figure className="public-diagram public-diagram--platform" role="img" aria-label="Operational flow from infrastructure to evidence to decisions">
      <div className="public-diagram__meta">
        <span>Logical / reference operational graph</span>
        <strong>Infrastructure → evidence → decision</strong>
      </div>
      <div className="public-flow-rail public-flow-rail--platform">
        {[
          [Server, "Infrastructure"],
          [Network, "Topology"],
          [ShieldCheck, "Validation"],
          [LineChart, "Benchmarks"],
          [FileText, "Evidence"],
          [Bot, "Decision"],
        ].map(([Icon, label], index) => {
          const IconComponent = Icon as typeof Server;
          return (
            <React.Fragment key={label}>
              <div className="public-flow-rail__node">
                <IconComponent className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </div>
              {index < 5 ? <div className="public-flow-rail__connector" aria-hidden="true" /> : null}
            </React.Fragment>
          );
        })}
      </div>
      <div className="public-diagram__caption-grid">
        <div>Mission Control coordinates the operating picture.</div>
        <div>AI Factory and topology scope the affected systems.</div>
        <div>Validation and benchmarks produce evidence packages.</div>
        <div>Investigations, reports, and integrations support the next decision.</div>
      </div>
    </figure>
  );
}

function AiFactoryVisual() {
  return (
    <figure className="public-diagram public-diagram--factory" role="img" aria-label="Logical spatial AI Factory showing cluster, node, GPU fabric, external fabric, storage, validation, and benchmark evidence">
      <div className="public-diagram__meta">
        <span>Logical / reference spatial view</span>
        <strong>Does not imply exact physical placement</strong>
      </div>
      <div className="public-factory-stack">
        <div className="public-factory-stack__band public-factory-stack__band--cluster">Cluster</div>
        <div className="public-factory-stack__row">
          <div className="public-factory-stack__card">Node</div>
          <div className="public-factory-stack__card">GPU fabric · NVLink · NVSwitch</div>
          <div className="public-factory-stack__card">NIC · InfiniBand / RDMA</div>
        </div>
        <div className="public-factory-stack__row">
          <div className="public-factory-stack__card">Storage</div>
          <div className="public-factory-stack__card">Validation evidence</div>
          <div className="public-factory-stack__card">Benchmark evidence</div>
        </div>
      </div>
      <p className="public-diagram__note">Selection moves from cluster to node to subsystem while keeping evidence and benchmark context adjacent to the finding.</p>
    </figure>
  );
}

function ValidationVisual() {
  return (
    <figure className="public-diagram public-diagram--validation" role="img" aria-label="Validation pipeline with categories feeding an evidence package">
      <div className="public-diagram__meta">
        <span>Evidence-first readiness flow</span>
        <strong>Categories remain explicit and reviewable</strong>
      </div>
      <div className="public-validation-layout">
        <div className="public-validation-layout__categories">
          {[
            "Linux",
            "GPU",
            "Driver / CUDA",
            "NVLink / NVSwitch",
            "InfiniBand / RDMA",
            "Slurm",
            "Kubernetes",
            "Storage",
            "Benchmark readiness",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="public-validation-layout__evidence">
          <div>Check result</div>
          <div>Affected scope</div>
          <div>Supporting evidence</div>
          <div>Recommendation / approval boundary</div>
        </div>
      </div>
      <p className="public-diagram__note">Each validation path ends in a reviewable evidence package rather than an unexplained pass/fail badge.</p>
    </figure>
  );
}

function BenchmarksVisual() {
  return (
    <figure className="public-diagram public-diagram--benchmarks" role="img" aria-label="Illustrative normalized benchmark curves with regression markers and evidence packaging">
      <div className="public-diagram__meta">
        <span>Illustrative normalized comparison</span>
        <strong>No fabricated benchmark numbers</strong>
      </div>
      <svg viewBox="0 0 640 300" className="public-benchmark-plot" aria-hidden="true">
        <line x1="56" y1="28" x2="56" y2="248" className="public-benchmark-plot__axis" />
        <line x1="56" y1="248" x2="594" y2="248" className="public-benchmark-plot__axis" />
        <path d="M 76 176 C 148 146, 226 118, 286 104 C 342 90, 392 82, 458 98 C 506 110, 544 126, 574 138" className="public-benchmark-plot__curve public-benchmark-plot__curve--reference" />
        <path d="M 76 192 C 148 164, 226 130, 286 122 C 342 116, 392 128, 458 150 C 506 164, 544 170, 574 178" className="public-benchmark-plot__curve public-benchmark-plot__curve--current" />
        <circle cx="458" cy="150" r="8" className="public-benchmark-plot__marker" />
        <text x="470" y="148" className="public-benchmark-plot__label">Regression marker</text>
        <text x="68" y="24" className="public-benchmark-plot__label">Relative throughput / latency trend</text>
        <text x="462" y="274" className="public-benchmark-plot__label">Run-to-run comparison</text>
      </svg>
      <p className="public-diagram__note">GPUValidator compares NCCL, HPL, P2P, latency, and reference workflows as evidence-backed histories, not decorative charts.</p>
    </figure>
  );
}

function EnterpriseVisual() {
  return (
    <figure className="public-diagram public-diagram--enterprise" role="img" aria-label="Multi-cluster enterprise control structure with review and approval boundaries">
      <div className="public-diagram__meta">
        <span>Multi-cluster command structure</span>
        <strong>Private infrastructure with review paths</strong>
      </div>
      <div className="public-enterprise-map">
        <div className="public-enterprise-map__clusters">
          <div>Cluster A</div>
          <div>Cluster B</div>
          <div>OEM Lab</div>
        </div>
        <div className="public-enterprise-map__hub">
          <div>Evidence review</div>
          <div>RBAC direction</div>
          <div>Approval-aware remediation</div>
        </div>
        <div className="public-enterprise-map__agents">
          <div>Collector / agent boundary</div>
          <div>Private deployment patterns</div>
        </div>
      </div>
    </figure>
  );
}

function SecurityVisual() {
  return (
    <figure className="public-diagram public-diagram--security" role="img" aria-label="Trust and evidence boundary map showing classification, sanitization, secrets boundaries, and audit paths">
      <div className="public-diagram__meta">
        <span>Trust and evidence boundary map</span>
        <strong>Classification, provenance, approval boundaries</strong>
      </div>
      <div className="public-security-map">
        <div className="public-security-map__column">
          <span>Collection inputs</span>
          <strong>Commands · logs · benchmark artifacts</strong>
        </div>
        <div className="public-security-map__column">
          <span>Sanitized evidence plane</span>
          <strong>Classification · provenance · reviewable excerpts</strong>
        </div>
        <div className="public-security-map__column">
          <span>Approval boundary</span>
          <strong>Recommendations stay distinct from mutation</strong>
        </div>
      </div>
    </figure>
  );
}

function PricingVisual() {
  return (
    <figure className="public-diagram public-diagram--pricing" role="img" aria-label="Package architecture comparing evaluation, professional, and enterprise feature groups without prices">
      <div className="public-diagram__meta">
        <span>Package architecture</span>
        <strong>Commercial details finalized with deployment context</strong>
      </div>
      <div className="public-pricing-visual-grid">
        <div>Evaluation</div>
        <div>Professional</div>
        <div>Enterprise</div>
      </div>
      <p className="public-diagram__note">Packaging emphasizes access pattern, workflow depth, and deployment requirements rather than placeholder dollar amounts.</p>
    </figure>
  );
}

function DocsVisual() {
  return (
    <figure className="public-diagram public-diagram--docs" role="img" aria-label="Technical documentation index covering getting started, architecture, validation, benchmark packages, topology, agents, integrations, API, security, and troubleshooting">
      <div className="public-diagram__meta">
        <span>Technical index / navigation</span>
        <strong>Entry page, not the full docs system</strong>
      </div>
      <div className="public-docs-map">
        {[
          "Getting Started",
          "Architecture",
          "Validation",
          "Benchmark Packages",
          "Topology",
          "Agents",
          "Integrations",
          "API",
          "Security",
          "Troubleshooting",
        ].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </figure>
  );
}

function PlatformPage() {
  return (
    <>
      <ProductHero
        eyebrow="Platform"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/platform"]}
        body="GPUValidator connects discovery, validation, benchmarks, evidence, investigations, and decision support so infrastructure teams can understand current state, risk, proof, and next action in one operational system."
        currentPath="platform"
        actions={[
          { href: "/ai-factory", label: "Explore AI Factory", variant: "secondary" },
          { href: "/#sign-in", label: "Get Started", variant: "primary" },
        ]}
      >
        <PlatformVisual />
      </ProductHero>

      <section className="public-product-grid public-product-grid--three">
        <ProductSection eyebrow="Mission Control" title="Current state, risk, and next action" body="Mission Control keeps overall health, active conditions, current jobs, and risk summaries visible while linking every major conclusion back to evidence." />
        <ProductSection eyebrow="AI Factory" title="Spatial operational context" body="AI Factory scopes the selected cluster, node, GPU fabric, storage, and external fabric relationships so engineers can see where the problem lives before they decide what it means." />
        <ProductSection eyebrow="Topology Intelligence" title="Technical boundaries stay explicit" body="GPU, NVLink, NVSwitch, NIC, InfiniBand, Ethernet, and storage relationships stay distinct instead of collapsing into a generic network diagram." />
      </section>

      <section className="public-product-grid public-product-grid--three">
        <ProductSection eyebrow="Validation" title="Readiness with supporting proof" body="Validation checks software, accelerator health, fabrics, schedulers, and storage before production rollout, then packages the evidence alongside each finding." />
        <ProductSection eyebrow="Benchmark Intelligence" title="Performance with regression context" body="Benchmark workflows compare runs, track regressions, and preserve run metadata so teams can explain the difference between a slower result and a meaningful operational change." />
        <ProductSection eyebrow="Evidence + Investigations" title="Proof stays close to the question" body="Evidence Explorer and investigations connect findings to supporting commands, artifacts, and likely causes rather than leaving the operator with an isolated score." />
      </section>

      <section className="public-product-grid public-product-grid--two">
        <ProductSection
          eyebrow="Copilot"
          title="Evidence-first reasoning support"
          body="Copilot is designed to explain observations, cite supporting evidence, state uncertainty, and frame recommendations without fabricating telemetry or conclusions."
          points={[
            "Observation, inference, recommendation, and action remain distinct.",
            "Unknown and partial evidence stay visible.",
            "Approval boundaries remain explicit.",
          ]}
        />
        <ProductSection
          eyebrow="Reports + Integrations"
          title="Operational output that other teams can trust"
          body="Reports, agents, and integrations extend the workflow into review, audit, and downstream systems while preserving provenance, classification, and approval-aware action paths."
          points={[
            "Reports summarize health, scope, evidence, and risk.",
            "Agents and integrations stay least-privilege by design.",
            "Operational decisions remain reviewable.",
          ]}
        />
      </section>
    </>
  );
}

function AiFactoryPage() {
  return (
    <>
      <ProductHero
        eyebrow="AI Factory"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/ai-factory"]}
        body="The public AI Factory page explains the logical spatial experience: cluster, node, GPU fabric, NIC egress, storage, validation, and benchmark evidence in one cinematic but technically restrained view."
        currentPath="ai-factory"
        actions={[
          { href: "/platform", label: "Explore Platform", variant: "secondary" },
          { href: "/#sign-in", label: "Get Started", variant: "primary" },
        ]}
      >
        <AiFactoryVisual />
      </ProductHero>

      <section className="public-product-grid public-product-grid--three">
        <ProductSection eyebrow="Cluster" title="Infrastructure hierarchy stays visible" body="Selection starts with cluster context and moves into nodes, racks, and subsystems without losing freshness, classification, or affected-scope context." />
        <ProductSection eyebrow="GPU Fabric" title="NVLink and NVSwitch remain inside the node model" body="The page keeps internal GPU communication distinct from external cluster communication so the visual stays truthful to supported topology semantics." />
        <ProductSection eyebrow="External Fabric" title="NIC and InfiniBand or RDMA paths show node egress" body="External communication is represented through the node NIC boundary into cluster fabric rather than as direct GPU cabling." />
      </section>

      <section className="public-product-grid public-product-grid--two">
        <ProductSection
          eyebrow="Storage + evidence"
          title="Data paths stay operational, not decorative"
          body="Storage, validation results, and benchmark evidence live next to the selected scope so an engineer can move from spatial context to proof without changing mental models."
          points={[
            "Logical / reference layouts are labeled.",
            "Unknown placement remains explicit.",
            "Evidence stays one click away in the authenticated product.",
          ]}
        />
        <ProductSection
          eyebrow="Investigation flow"
          title="Alert to subsystem to recommendation"
          body="The spatial model supports the primary workflow: follow an alert into the affected scope, inspect validation and benchmark evidence, then review the next action with approval context."
          points={[
            "Cluster → node → subsystem selection",
            "Validation and benchmark overlays",
            "Evidence-backed recommendation framing",
          ]}
        />
      </section>
    </>
  );
}

function ValidationPage() {
  return (
    <>
      <ProductHero
        eyebrow="Validation"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/validation"]}
        body="GPUValidator validation focuses on readiness with proof: infrastructure state, software stack, GPU health, fabrics, schedulers, storage, and benchmark readiness reviewed through evidence-first workflows."
        currentPath="validation"
      >
        <ValidationVisual />
      </ProductHero>

      <section className="public-product-grid public-product-grid--three">
        <ProductSection eyebrow="System foundations" title="Linux, driver, CUDA, and GPU readiness" body="Readiness begins with Linux platform state, driver and CUDA alignment, and GPU-specific health such as ECC, thermal, XID, and diagnostic outcomes when evidence exists." />
        <ProductSection eyebrow="Fabric" title="NVLink, NVSwitch, InfiniBand, and RDMA context" body="GPU-local connectivity and external network fabrics remain technically distinct so benchmark and workload readiness can be interpreted against the right path." />
        <ProductSection eyebrow="Schedulers + storage" title="Slurm, Kubernetes, and storage are first-class checks" body="GPUValidator treats scheduler state, drain conditions, storage health, and benchmark prerequisites as part of readiness rather than postscript details." />
      </section>

      <section className="public-product-grid public-product-grid--two">
        <ProductSection
          eyebrow="Benchmark readiness"
          title="Validation does not stop at static checks"
          body="Benchmark readiness captures whether the represented system can move into repeatable evidence-generating suites with the right topology, software, and support services in place."
          points={[
            "Reference workflow support for NCCL, HPL, and related suites",
            "Topology-aware interpretation",
            "Evidence packages for review and reporting",
          ]}
        />
        <ProductSection
          eyebrow="Evidence-first outcome"
          title="Findings stay reviewable"
          body="Every major validation outcome is designed to preserve reason, affected scope, evidence, uncertainty, and the recommended next step instead of reducing the result to a generic traffic light."
          points={[
            "Affected scope and reason are visible",
            "Unknown and partial states stay explicit",
            "Approval-aware remediation remains separate from execution",
          ]}
        />
      </section>
    </>
  );
}

function BenchmarksPage() {
  return (
    <>
      <ProductHero
        eyebrow="Benchmarks"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/benchmarks"]}
        body="Benchmark Intelligence turns runs into operational evidence: NCCL, HPL, MLPerf-style reference workflows, P2P, bandwidth, latency, and regression history tied back to topology and run provenance."
        currentPath="benchmarks"
      >
        <BenchmarksVisual />
      </ProductHero>

      <section className="public-product-grid public-product-grid--three">
        <ProductSection eyebrow="NCCL + P2P" title="Collective and locality-sensitive workflows" body="NCCL collectives, P2P behavior, and locality-sensitive tests are interpreted against GPU fabric, PCIe relationships, and node egress rather than as isolated charts." />
        <ProductSection eyebrow="HPL + reference workflows" title="System-level benchmark context" body="HPL and MLPerf-style reference workflows help frame whether the represented infrastructure is performing consistently with its intended operational design and comparison baseline." />
        <ProductSection eyebrow="Bandwidth + latency" title="Performance curves with regression markers" body="Benchmark views emphasize comparative change, time range, and evidence packaging over decorative graphing or unsupported real-time claims." />
      </section>

      <section className="public-product-grid public-product-grid--two">
        <ProductSection
          eyebrow="Regression tracking"
          title="Operational change over time"
          body="GPUValidator focuses on when a benchmark changed, what scope it affected, which topology path it touched, and which evidence package supports the conclusion."
          points={[
            "Historical versus current comparison",
            "Affected scope and run metadata",
            "Recommendation framing for investigation",
          ]}
        />
        <ProductSection
          eyebrow="Evidence packages"
          title="Run artifacts remain attached to the result"
          body="Benchmark packages preserve provenance, parsed metrics, excerpts, and supporting context so teams can compare confidently without inventing benchmark numbers or unsupported live dashboards."
          points={[
            "Illustrative and reference visuals stay labeled",
            "Baseline source remains visible",
            "Conclusions stay traceable",
          ]}
        />
      </section>
    </>
  );
}

function EnterprisePage() {
  return (
    <>
      <ProductHero
        eyebrow="Enterprise"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/enterprise"]}
        body="GPUValidator is designed for AI infrastructure teams, HPC operators, platform engineering, OEM validation, enterprise support, and SRE workflows that need evidence, auditability, and controlled remediation paths."
        currentPath="enterprise"
      >
        <EnterpriseVisual />
      </ProductHero>

      <section className="public-product-grid public-product-grid--three">
        <article className="public-product-section-card">
          <p className="public-site-eyebrow">Multi-cluster workflows</p>
          <h2>Private fleet review</h2>
          <p>Enterprise teams often need to compare clusters, labs, and support environments while preserving evidence boundaries and operator context.</p>
          <StatusChip label="Available now" />
        </article>
        <article className="public-product-section-card">
          <p className="public-site-eyebrow">RBAC direction</p>
          <h2>Role-aware review path</h2>
          <p>Role-aware access and audit expectations are part of the product direction, but they should remain labeled according to current maturity.</p>
          <StatusChip label="Architecture-ready" />
        </article>
        <article className="public-product-section-card">
          <p className="public-site-eyebrow">Approval-aware remediation</p>
          <h2>Recommendations stay separate from mutation</h2>
          <p>Operational guidance may be surfaced, but infrastructure-changing action remains approval-gated and auditable.</p>
          <StatusChip label="Available now" />
        </article>
      </section>

      <section className="public-product-grid public-product-grid--two">
        <article className="public-product-section-card">
          <p className="public-site-eyebrow">Deployment model</p>
          <h2>Private infrastructure and agent boundaries</h2>
          <p>Collector and agent patterns are intended to fit private environments with explicit trust boundaries, evidence classification, and deployment review.</p>
          <div className="public-pill-row">
            <StatusChip label="Available now" />
            <StatusChip label="Architecture-ready" />
          </div>
        </article>
        <article className="public-product-section-card">
          <p className="public-site-eyebrow">Enterprise audiences</p>
          <h2>Built for operational handoffs</h2>
          <div className="public-audience-grid">
            <span><Users className="h-4 w-4" aria-hidden="true" /> AI infrastructure teams</span>
            <span><Server className="h-4 w-4" aria-hidden="true" /> HPC teams</span>
            <span><Layers className="h-4 w-4" aria-hidden="true" /> Platform engineering</span>
            <span><Building2 className="h-4 w-4" aria-hidden="true" /> OEM validation</span>
            <span><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Enterprise support</span>
            <span><GitBranch className="h-4 w-4" aria-hidden="true" /> SRE</span>
          </div>
        </article>
      </section>
    </>
  );
}

function SecurityPage() {
  return (
    <>
      <ProductHero
        eyebrow="Security"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/security"]}
        body="The security page explains principles that are visible in the product and documentation today: evidence classification, provenance, sanitization, least privilege, approval boundaries, auditability, and private deployment patterns."
        currentPath="security"
      >
        <SecurityVisual />
      </ProductHero>

      <section className="public-product-grid public-product-grid--three">
        <ProductSection eyebrow="Evidence classification" title="Trust context stays explicit" body="Evidence is expected to carry classification and freshness context so operators can distinguish demo, reference, partial, and current data before acting on it." />
        <ProductSection eyebrow="Provenance + sanitization" title="Evidence should be traceable and reviewable" body="Parsed findings, raw excerpts, checksums, and sanitization state are part of the trust model. Sensitive values should remain bounded and redacted where appropriate." />
        <ProductSection eyebrow="Least privilege" title="Integrations and agents stay controlled" body="Private deployment patterns, collector boundaries, and downstream integrations should keep privileges narrow and auditable rather than implying broad autonomous control." />
      </section>

      <section className="public-product-grid public-product-grid--two">
        <ProductSection
          eyebrow="Approval + auditability"
          title="Recommendations are not silent execution"
          body="Approval boundaries, action review, and audit trails are central to the product philosophy: evidence can support a recommendation without turning the product into an unchecked controller."
          points={[
            "Approval boundary remains visible",
            "Secrets handling is explicit and bounded",
            "No fabricated telemetry or unsupported claims",
          ]}
        />
        <article className="public-product-section-card">
          <p className="public-site-eyebrow">Security roadmap</p>
          <h2>Planned trust surface expansion</h2>
          <p>The roadmap can grow to cover deeper enterprise trust workflows, but the public page avoids claiming unsupported certifications or unverified production controls.</p>
          <div className="public-pill-row">
            <StatusChip label="Available now" />
            <StatusChip label="Planned" />
          </div>
        </article>
      </section>
    </>
  );
}

function PricingPage() {
  return (
    <>
      <ProductHero
        eyebrow="Pricing"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/pricing"]}
        body="GPUValidator pricing is presented as packaging guidance rather than fabricated prices. The public page explains how evaluation, operator workflows, and enterprise deployment conversations differ."
        currentPath="pricing"
        actions={[
          { href: "/#sign-in", label: "Request access", variant: "secondary" },
          { href: "/enterprise", label: "Contact sales", variant: "primary" },
        ]}
      >
        <PricingVisual />
      </ProductHero>

      <section className="public-pricing-grid">
        {[
          {
            name: "Community / Evaluation",
            badge: "Request access",
            points: [
              "Public product orientation",
              "Reference workflow review",
              "Evaluation planning for topology, validation, and benchmark fit",
            ],
          },
          {
            name: "Professional",
            badge: "Contact us",
            points: [
              "Operator-facing validation and benchmark workflows",
              "Evidence packaging for engineering review",
              "Deployment conversation for production-readiness operations",
            ],
          },
          {
            name: "Enterprise",
            badge: "Contact sales",
            points: [
              "Private infrastructure deployment planning",
              "Multi-team evidence and review workflows",
              "Architecture and security alignment discussions",
            ],
          },
        ].map((tier) => (
          <article key={tier.name} className="public-pricing-card">
            <p className="public-site-eyebrow">Packaging</p>
            <h2>{tier.name}</h2>
            <strong>{tier.badge}</strong>
            <ul className="public-bullet-list public-bullet-list--compact">
              {tier.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="public-product-grid public-product-grid--two">
        <ProductSection
          eyebrow="Feature groups"
          title="Compare packaging by workflow depth"
          body="Pricing discussions are organized around validation scope, benchmark evidence, investigation depth, deployment context, and review expectations rather than placeholder support promises or invented SLAs."
          points={[
            "Validation and readiness workflows",
            "Benchmark and evidence packaging",
            "Private deployment and enterprise review context",
          ]}
        />
        <ProductSection
          eyebrow="Commercial status"
          title="Packaging exists before price finalization"
          body="Commercial pricing is not finalized. This page stays truthful by describing package intent, access path, and deployment conversation instead of publishing speculative numbers."
          points={[
            "No fabricated prices",
            "No fabricated support commitments",
            "Clear call-to-action for access and sales conversations",
          ]}
        />
      </section>
    </>
  );
}

function DocsPage() {
  return (
    <>
      <ProductHero
        eyebrow="Docs"
        title={PUBLIC_PRODUCT_ROUTE_HEADINGS["/docs"]}
        body="The public docs page is an entry point into the technical map: getting started, architecture, validation, benchmark packages, topology, agents, integrations, API direction, security, and troubleshooting."
        currentPath="docs"
      >
        <DocsVisual />
      </ProductHero>

      <section className="public-docs-grid">
        {[
          ["Getting Started", "Public entry", "How teams begin evaluating GPUValidator and move toward the reviewer workspace."],
          ["Architecture", "Current repo sources", "See docs/VISION_2027.md and docs/design/AI_FACTORY_V1.md for current product framing."],
          ["Validation", "Current repo sources", "Validation concepts are documented today; a dedicated public destination can expand this later."],
          ["Benchmark Packages", "Planned public destination", "Benchmark package structure, provenance, and regression interpretation will expand in the public docs system."],
          ["Topology", "Current repo sources", "Topology semantics and evidence boundaries are already described in canonical design and engineering docs."],
          ["Agents", "Architecture-ready", "Public documentation can explain bounded agent and collector patterns without overstating runtime scope."],
          ["Integrations", "Architecture-ready", "Future docs can detail supported integration paths and least-privilege patterns as they mature."],
          ["API", "Planned public destination", "Public API and integration documentation should follow verified product surface area."],
          ["Security", "Current route", "Use the security page for current trust and approval principles."],
          ["Troubleshooting", "Planned public destination", "A future public troubleshooting path can package known operational review patterns and evidence guidance."],
        ].map(([title, status, body]) => (
          <article key={title} className="public-docs-card">
            <p className="public-site-eyebrow">{status}</p>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </>
  );
}

export function PublicProductPage({ route, isDarkMode, onToggleTheme }: ProductPageProps) {
  const metadata = PRODUCT_METADATA[route];
  usePageMetadata(metadata.title, metadata.description);

  let content: React.ReactNode;

  switch (route) {
    case "/platform":
      content = <PlatformPage />;
      break;
    case "/ai-factory":
      content = <AiFactoryPage />;
      break;
    case "/validation":
      content = <ValidationPage />;
      break;
    case "/benchmarks":
      content = <BenchmarksPage />;
      break;
    case "/enterprise":
      content = <EnterprisePage />;
      break;
    case "/security":
      content = <SecurityPage />;
      break;
    case "/pricing":
      content = <PricingPage />;
      break;
    case "/docs":
      content = <DocsPage />;
      break;
    default:
      content = null;
  }

  return (
    <PublicSiteShell currentPath={route} isDarkMode={isDarkMode} onToggleTheme={onToggleTheme}>
      {content}
    </PublicSiteShell>
  );
}
