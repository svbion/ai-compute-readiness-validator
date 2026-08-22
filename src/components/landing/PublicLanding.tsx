import React, { useId, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileText,
  LineChart,
  LockKeyhole,
  Mail,
  Menu,
  Moon,
  Network,
  Search,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";

type PublicPage = "home" | "about" | "contact" | "privacy" | "terms" | "not-found";

type PublicLandingProps = {
  currentPage: PublicPage;
  currentPath?: string;
  isDarkMode: boolean;
  onSubmit: () => void;
  onToggleTheme: () => void;
};

type TopologyStage = "gpu" | "nvlink" | "nvswitch" | "nic" | "fabric" | "validated";

type NavLink = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type FooterLinkGroup = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

type FeatureCard = {
  title: string;
  body: string;
  detail: string;
  icon: LucideIcon;
};

type DocumentSection = {
  id: string;
  title: string;
  body: string[];
  bullets?: string[];
  review?: string;
};

type ContactFormState = {
  name: string;
  workEmail: string;
  organization: string;
  topic: string;
  message: string;
};

const ROUTES = {
  home: "/",
  about: "/about",
  contact: "/contact",
  privacy: "/privacy",
  terms: "/terms",
  signIn: "/login",
  platform: "/platform",
  aiFactory: "/ai-factory",
  validation: "/validation",
  benchmarks: "/benchmarks",
  enterprise: "/enterprise",
  security: "/security",
  pricing: "/pricing",
  docs: "/docs",
  investigation: "/docs",
  getStarted: "/signup",
} as const;

const navigationLinks: NavLink[] = [
  { label: "Platform", href: ROUTES.platform },
  { label: "AI Factory", href: ROUTES.aiFactory },
  { label: "Validation", href: ROUTES.validation },
  { label: "Benchmarks", href: ROUTES.benchmarks },
  { label: "Enterprise", href: ROUTES.enterprise },
  { label: "Security", href: ROUTES.security },
  { label: "Docs", href: ROUTES.docs },
  { label: "Pricing", href: ROUTES.pricing },
  { label: "Sign In", href: ROUTES.signIn, variant: "secondary" },
  { label: "Get Started", href: ROUTES.getStarted, variant: "primary" },
];

const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: ROUTES.platform },
      { label: "AI Factory", href: ROUTES.aiFactory },
      { label: "Validation", href: ROUTES.validation },
      { label: "Benchmarks", href: ROUTES.benchmarks },
      { label: "Enterprise", href: ROUTES.enterprise },
      { label: "Security", href: ROUTES.security },
      { label: "Pricing", href: ROUTES.pricing },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: ROUTES.docs },
      { label: "Investigations", href: ROUTES.investigation },
      { label: "Evidence and benchmarking", href: ROUTES.benchmarks },
      { label: "Sign In", href: ROUTES.signIn },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: ROUTES.about },
      { label: "Contact", href: ROUTES.contact },
      { label: "Enterprise", href: ROUTES.enterprise },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: ROUTES.privacy },
      { label: "Terms", href: ROUTES.terms },
    ],
  },
];

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
    icon: Search,
  },
  {
    title: "Copilot",
    body: "Support engineers with evidence-backed explanations, scoped investigation context, and recommendation framing without fabricating facts.",
    detail: "Evidence-first reasoning support",
    icon: Bot,
  },
];

const validationFlowSteps = [
  "Discover",
  "Validate",
  "Benchmark",
  "Investigate",
  "Prove",
  "Remediate",
];

const enterpriseBullets = [
  "Private infrastructure and controlled evidence boundaries",
  "Approval-aware remediation workflows",
  "Role-aware access for reviewers and operators",
  "Auditability across findings, evidence, and recommendations",
];

const aboutPrinciples = [
  "Readiness should be supported by evidence, not a green dashboard alone.",
  "Technical accuracy matters more than visual novelty or unsupported simplification.",
  "Unknown, unavailable, partial, planned, and blocked states should stay explicit.",
  "Recommendations should remain distinct from infrastructure-changing action.",
];

const contactTopics = [
  "General inquiry",
  "Sales / enterprise",
  "Technical questions",
  "Security",
] as const;

const contactChannels = [
  {
    title: "General inquiry",
    detail: "Route product, rollout, and partnership questions into the production contact workflow once messaging channels are finalized.",
    status: "Production routing pending",
  },
  {
    title: "Sales / enterprise",
    detail: "Use this path for deployment planning, evaluation scope, enterprise review, and environment-specific discussion.",
    status: "Production routing pending",
  },
  {
    title: "Technical questions",
    detail: "Use this path for architecture, validation coverage, evidence model, benchmark workflow, and integration discussion.",
    status: "Production routing pending",
  },
  {
    title: "Security",
    detail: "Use this path for vulnerability reporting, security review coordination, and responsible disclosure handling.",
    status: "Production routing pending",
  },
];

const privacySections: DocumentSection[] = [
  {
    id: "privacy-information-you-provide",
    title: "Information you provide",
    body: [
      "This public site may collect information you choose to submit through contact or access-request workflows, such as your name, work email, organization, topic, and message content.",
      "In the current pre-production build, the contact experience is presentational and does not send messages to a production intake backend.",
    ],
    review: "Production/legal review required: define approved contact channels, required fields, and who may access submitted business information.",
  },
  {
    id: "privacy-technical-site-data",
    title: "Technical and site data",
    body: [
      "Like most web applications, a production deployment may process basic technical request data such as browser type, approximate device information, requested pages, timestamps, and diagnostic logs needed to operate and secure the service.",
      "This repository does not define the final production logging, analytics, or observability policy for the public site.",
    ],
    review: "Production/legal review required: define exact logging fields, IP handling, retention, and whether analytics will be enabled.",
  },
  {
    id: "privacy-authentication-data",
    title: "Authentication data",
    body: [
      "The current public build includes a local reviewer sign-in interface for product demonstration flow. It does not document a finalized production authentication system, identity provider, or account lifecycle.",
      "Do not treat this pre-production interface as a statement of final customer authentication, session handling, or identity storage practices.",
    ],
    review: "Production/legal review required: define account creation, identity provider, session retention, audit logging, and support processes before launch.",
  },
  {
    id: "privacy-cookies-local-storage",
    title: "Cookies and local storage",
    body: [
      "This build uses browser local storage for interface preferences such as theme selection. Additional browser storage may be introduced for authenticated product workflows in future phases.",
      "Any production cookie banner, consent mechanism, or storage classification depends on the final deployment architecture and enabled services.",
    ],
    review: "Production/legal review required: classify essential vs optional storage, cookie names, durations, and consent requirements.",
  },
  {
    id: "privacy-use-of-information",
    title: "Use of information",
    body: [
      "Information provided through production contact or support workflows may be used to respond to inquiries, evaluate enterprise interest, coordinate technical discussion, improve the site, and protect the service.",
      "Final production purposes should be limited to what is documented in the launch-approved privacy notice.",
    ],
  },
  {
    id: "privacy-security",
    title: "Security",
    body: [
      "GPUValidator is designed around controlled evidence boundaries and approval-aware operations. Public-site security controls, however, depend on the final hosting, identity, logging, and support environment.",
      "No specific certification, compliance program, or security guarantee is claimed by this page.",
    ],
    review: "Production/legal review required: document approved security controls and review wording for launch.",
  },
  {
    id: "privacy-retention",
    title: "Retention",
    body: [
      "Retention periods for production inquiry, authentication, support, and technical log data are not yet finalized in this repository.",
      "Retention should be limited to operational, contractual, security, and legal needs defined during production review.",
    ],
    review: "Production/legal review required: define retention schedules and deletion procedures for each data category.",
  },
  {
    id: "privacy-third-party-services",
    title: "Third-party services",
    body: [
      "Production deployments may rely on third-party infrastructure, hosting, security, identity, email, or support providers. This repository does not define the final vendor list for the public site.",
      "Any third-party processing disclosures should be updated when the production architecture is approved.",
    ],
    review: "Production/legal review required: list approved vendors and applicable data-processing terms.",
  },
  {
    id: "privacy-your-choices",
    title: "Your choices",
    body: [
      "Your choices in a production deployment may include whether to provide contact information, whether to engage with future account workflows, and how you manage local browser storage for interface preferences.",
      "Specific rights and request paths must be confirmed in the final policy before launch.",
    ],
    review: "Production/legal review required: define request channels for access, correction, deletion, and preference management where applicable.",
  },
  {
    id: "privacy-contact",
    title: "Contact",
    body: [
      "The production privacy contact channel has not been finalized in this repository.",
      "Until launch review is complete, treat this page as a structural draft for product, legal, and security review rather than a final notice.",
    ],
  },
  {
    id: "privacy-changes",
    title: "Changes",
    body: [
      "This page describes a pre-production structure and may change as GPUValidator public-site operations, support channels, and legal review are finalized.",
      "Any production version should include an effective date and a documented process for material updates.",
    ],
  },
];

const termsSections: DocumentSection[] = [
  {
    id: "terms-acceptance",
    title: "Acceptance",
    body: [
      "These terms are a pre-production structural draft for review. They are not a final binding agreement and do not identify a finalized legal entity, jurisdiction, or contracting address.",
      "Use of a production GPUValidator public site should be governed only by launch-approved terms.",
    ],
    review: "Legal review required: finalize contracting entity, governing law, venue, and effective date.",
  },
  {
    id: "terms-use-of-service",
    title: "Use of service",
    body: [
      "The public site is intended to explain GPUValidator capabilities, support enterprise inquiry, and provide pre-production product information.",
      "This page does not promise specific production availability, benchmark outcomes, support response times, or feature completeness.",
    ],
  },
  {
    id: "terms-accounts",
    title: "Accounts",
    body: [
      "This repository does not define a finalized production account model for the public site or the authenticated product experience.",
      "Any production account requirements, credential rules, identity-provider terms, and user responsibilities must be documented during launch review.",
    ],
    review: "Legal and product review required: define account creation, suspension, authentication, and administrator responsibilities.",
  },
  {
    id: "terms-acceptable-use",
    title: "Acceptable use",
    body: [
      "Users should not misuse the site, attempt unauthorized access, interfere with service operation, submit malicious content, or misrepresent their affiliation or evaluation intent.",
      "Additional acceptable-use restrictions may be required once production integrations and account workflows are finalized.",
    ],
  },
  {
    id: "terms-intellectual-property",
    title: "Intellectual property",
    body: [
      "GPUValidator names, software, site content, designs, and related materials remain subject to applicable intellectual-property rights.",
      "Nothing on this page grants a license beyond what is expressly approved in production documentation or separate agreements.",
    ],
  },
  {
    id: "terms-customer-data",
    title: "Customer data",
    body: [
      "The final product is intended to preserve public/private evidence boundaries and support controlled infrastructure review. This public-site draft does not define final terms for customer data processing, hosting, export, or deletion.",
      "Customer-data commitments should be documented in production agreements and privacy materials, not assumed from this draft structure.",
    ],
    review: "Legal review required: define data ownership, processing scope, confidentiality, export, deletion, and security commitments.",
  },
  {
    id: "terms-beta-evaluation",
    title: "Beta and evaluation status",
    body: [
      "Public product information may describe pre-release, planned, partial, or evaluation-stage capabilities. Those descriptions should not be read as production warranties or promises of immediate availability.",
      "Features and workflows may change during review and validation before general availability.",
    ],
  },
  {
    id: "terms-availability",
    title: "Availability",
    body: [
      "This draft does not commit to uptime, support windows, maintenance schedules, or uninterrupted access.",
      "Any production service levels should be documented in separate launch-approved materials or commercial agreements.",
    ],
  },
  {
    id: "terms-disclaimers",
    title: "Disclaimers",
    body: [
      "This page is provided for pre-production review of site structure and language. Product visuals, example workflows, and demonstration flows may include reference or evaluation context.",
      "Operational decisions should rely on approved production documentation, validated evidence, and executed agreements rather than this draft alone.",
    ],
    review: "Legal review required: finalize disclaimer language for beta, evaluation, and informational content.",
  },
  {
    id: "terms-limitation",
    title: "Limitation placeholders",
    body: [
      "Any limitation-of-liability, exclusion-of-damages, indemnity, or warranty language must be reviewed and approved before launch.",
      "No binding limitation language is asserted by this draft structure.",
    ],
    review: "Legal review required: insert approved limitation, warranty, and indemnity clauses.",
  },
  {
    id: "terms-termination",
    title: "Termination",
    body: [
      "The conditions for suspension, termination, or withdrawal of access have not been finalized in this repository.",
      "Production account and service-access rules should define those conditions explicitly.",
    ],
  },
  {
    id: "terms-changes",
    title: "Changes",
    body: [
      "These draft terms may change during product, legal, and security review.",
      "A production version should include an effective date and a clear method for communicating material updates.",
    ],
  },
  {
    id: "terms-contact",
    title: "Contact",
    body: [
      "The production legal and commercial contact channels are not finalized in this repository.",
      "Until those details are approved, this page should be treated as a review draft only.",
    ],
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

function PublicNavigation({
  currentPage,
  isDarkMode,
  menuOpen,
  onToggleMenu,
  onToggleTheme,
}: {
  currentPage: PublicPage;
  isDarkMode: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onToggleTheme: () => void;
}) {
  return (
    <header className="public-site-header" data-testid="PublicSiteHeader">
      <a className="public-site-brand" href={ROUTES.home} aria-label="GPUValidator public home">
        <span className="public-site-brand__mark" aria-hidden="true">
          <span className="public-site-brand__pulse" />
        </span>
        <span className="public-site-brand__text">
          <strong>GPUValidator</strong>
          <span>AI Infrastructure Readiness</span>
        </span>
      </a>

      <nav className="public-site-nav" aria-label="Primary public navigation">
        {navigationLinks.slice(0, 8).map((link) => {
          const isActive =
            (currentPage === "about" && link.href === ROUTES.about) ||
            (currentPage === "contact" && link.href === ROUTES.contact);

          return (
            <a
              key={link.label}
              href={link.href}
              className={`public-site-nav__link${isActive ? " public-site-nav__link--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {link.label}
            </a>
          );
        })}
      </nav>

      <div className="public-site-actions">
        <button
          type="button"
          className="public-site-theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDarkMode ? "Activate light theme" : "Activate dark theme"}
          title={isDarkMode ? "Activate light theme" : "Activate dark theme"}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <a href={ROUTES.signIn} className="public-site-action public-site-action--secondary">Sign In</a>
        <a href={ROUTES.getStarted} className="public-site-action public-site-action--primary">Get Started</a>
        <button
          type="button"
          className="public-site-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="public-mobile-nav"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          data-testid="PublicMobileNavTrigger"
          onClick={onToggleMenu}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span>Menu</span>
        </button>
      </div>

      <div
        id="public-mobile-nav"
        className={`public-site-mobile-nav${menuOpen ? " public-site-mobile-nav--open" : ""}`}
        data-testid="PublicMobileNav"
      >
        <nav aria-label="Mobile public navigation">
          {navigationLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`public-site-mobile-nav__link public-site-mobile-nav__link--${link.variant ?? "default"}`}
              onClick={onToggleMenu}
            >
              <span>{link.label}</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ))}
          <a
            href={ROUTES.privacy}
            className={`public-site-mobile-nav__link public-site-mobile-nav__link--${currentPage === "privacy" ? "secondary" : "default"}`}
            onClick={onToggleMenu}
          >
            <span>Privacy</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a
            href={ROUTES.terms}
            className={`public-site-mobile-nav__link public-site-mobile-nav__link--${currentPage === "terms" ? "secondary" : "default"}`}
            onClick={onToggleMenu}
          >
            <span>Terms</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </nav>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer__grid">
        {footerLinkGroups.map((group) => (
          <section key={group.title} aria-labelledby={`footer-${group.title.toLowerCase()}`}>
            <h2 id={`footer-${group.title.toLowerCase()}`}>{group.title}</h2>
            {group.links.map((link) => (
              <a key={`${group.title}-${link.label}`} href={link.href}>
                {link.label}
              </a>
            ))}
          </section>
        ))}
      </div>

      <div className="public-site-footer__bottom">
        <span>© 2026 GPUValidator</span>
        <span>Public-site legal, contact, and support language remains subject to production review.</span>
      </div>
    </footer>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  headingId,
}: {
  eyebrow: string;
  title: string;
  description: string;
  headingId: string;
}) {
  return (
    <section className="public-route-hero" aria-labelledby={headingId}>
      <div className="public-route-hero__frame">
        <p className="public-site-eyebrow">{eyebrow}</p>
        <h1 id={headingId}>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

function ReviewBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-review-banner" role="note">
      <span>Review marker</span>
      <p>{children}</p>
    </div>
  );
}

function DocumentPage({
  eyebrow,
  title,
  description,
  headingId,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  headingId: string;
  sections: DocumentSection[];
}) {
  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} description={description} headingId={headingId} />

      <section className="public-document-layout" aria-labelledby={`${headingId}-toc-title`}>
        <aside className="public-document-toc">
          <p className="public-site-eyebrow">Contents</p>
          <h2 id={`${headingId}-toc-title`}>On this page</h2>
          <nav aria-label={`${title} table of contents`}>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="public-document" aria-label={title}>
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="public-document__section" aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="public-bullet-list public-bullet-list--document">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
              {section.review ? <ReviewBanner>{section.review}</ReviewBanner> : null}
            </section>
          ))}
        </article>
      </section>
    </>
  );
}

function ContactPage() {
  const nameId = useId();
  const emailId = useId();
  const organizationId = useId();
  const topicId = useId();
  const messageId = useId();
  const [formState, setFormState] = useState<ContactFormState>({
    name: "",
    workEmail: "",
    organization: "",
    topic: contactTopics[0],
    message: "",
  });
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const errors = {
    name: formState.name.trim() ? "" : "Name is required.",
    workEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.workEmail) ? "" : "Enter a valid work email.",
    organization: formState.organization.trim() ? "" : "Organization is required.",
    topic: formState.topic.trim() ? "" : "Select a topic.",
    message: formState.message.trim().length >= 24 ? "" : "Message must be at least 24 characters.",
  };

  const hasErrors = Object.values(errors).some(Boolean);
  const canPrepareDraft = attemptedSubmit && !hasErrors;

  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Professional contact and support routing"
        description="Use this page to route general, enterprise, technical, or security questions. This build does not send messages to a production backend, so delivery remains pending until contact infrastructure is finalized."
        headingId="public-contact-title"
      />

      <section className="public-section public-section--stacked" aria-labelledby="public-contact-paths-title">
        <div className="public-section__intro">
          <p className="public-site-eyebrow">Contact paths</p>
          <h2 id="public-contact-paths-title">Choose the right conversation lane</h2>
          <p>
            GPUValidator public contact flows are organized around business inquiry, enterprise rollout, technical discussion, and security review. Production delivery endpoints remain pending in this branch.
          </p>
        </div>

        <div className="public-contact-grid">
          {contactChannels.map((channel) => (
            <article key={channel.title} className="public-contact-card">
              <div className="public-contact-card__header">
                <Mail className="h-5 w-5" aria-hidden="true" />
                <span>{channel.status}</span>
              </div>
              <h3>{channel.title}</h3>
              <p>{channel.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section public-section--split" aria-labelledby="public-contact-form-title">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">Contact form</p>
          <h2 id="public-contact-form-title">Prepare an inquiry without pretending it was sent</h2>
          <p>
            This form validates the information a production intake flow is expected to require. In the current build, submission integration is pending and no message is transmitted.
          </p>
          <ReviewBanner>
            Submission integration pending. Do not treat this form as a live mailbox, CRM workflow, or support ticketing backend.
          </ReviewBanner>
        </div>

        <div className="public-contact-form-card">
          <form
            className="public-contact-form"
            onSubmit={(event) => {
              event.preventDefault();
              setAttemptedSubmit(true);
            }}
            noValidate
          >
            <label className="public-contact-form__field" htmlFor={nameId}>
              <span>Name</span>
              <input
                id={nameId}
                name="name"
                type="text"
                autoComplete="name"
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                aria-invalid={attemptedSubmit && Boolean(errors.name)}
                aria-describedby={attemptedSubmit && errors.name ? `${nameId}-error` : undefined}
                required
              />
              {attemptedSubmit && errors.name ? <small id={`${nameId}-error`}>{errors.name}</small> : null}
            </label>

            <label className="public-contact-form__field" htmlFor={emailId}>
              <span>Work email</span>
              <input
                id={emailId}
                name="workEmail"
                type="email"
                autoComplete="email"
                value={formState.workEmail}
                onChange={(event) => setFormState((current) => ({ ...current, workEmail: event.target.value }))}
                aria-invalid={attemptedSubmit && Boolean(errors.workEmail)}
                aria-describedby={attemptedSubmit && errors.workEmail ? `${emailId}-error` : undefined}
                required
              />
              {attemptedSubmit && errors.workEmail ? <small id={`${emailId}-error`}>{errors.workEmail}</small> : null}
            </label>

            <label className="public-contact-form__field" htmlFor={organizationId}>
              <span>Organization</span>
              <input
                id={organizationId}
                name="organization"
                type="text"
                autoComplete="organization"
                value={formState.organization}
                onChange={(event) => setFormState((current) => ({ ...current, organization: event.target.value }))}
                aria-invalid={attemptedSubmit && Boolean(errors.organization)}
                aria-describedby={attemptedSubmit && errors.organization ? `${organizationId}-error` : undefined}
                required
              />
              {attemptedSubmit && errors.organization ? <small id={`${organizationId}-error`}>{errors.organization}</small> : null}
            </label>

            <label className="public-contact-form__field" htmlFor={topicId}>
              <span>Topic</span>
              <select
                id={topicId}
                name="topic"
                value={formState.topic}
                onChange={(event) => setFormState((current) => ({ ...current, topic: event.target.value }))}
              >
                {contactTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>

            <label className="public-contact-form__field" htmlFor={messageId}>
              <span>Message</span>
              <textarea
                id={messageId}
                name="message"
                value={formState.message}
                onChange={(event) => setFormState((current) => ({ ...current, message: event.target.value }))}
                aria-invalid={attemptedSubmit && Boolean(errors.message)}
                aria-describedby={attemptedSubmit && errors.message ? `${messageId}-error` : undefined}
                rows={7}
                required
              />
              {attemptedSubmit && errors.message ? <small id={`${messageId}-error`}>{errors.message}</small> : null}
            </label>

            <button type="submit" className="public-site-button public-site-button--primary public-site-button--submit">
              Review contact request
            </button>
          </form>

          {attemptedSubmit ? (
            <div className={`public-contact-form__result${canPrepareDraft ? " public-contact-form__result--pending" : " public-contact-form__result--error"}`} role="status">
              <strong>
                {canPrepareDraft
                  ? "Submission integration pending — message prepared, not sent."
                  : "Complete the required fields before preparing a contact request."}
              </strong>
              <p>
                {canPrepareDraft
                  ? "No backend submission exists in this build. Review the prepared request below and route it through the production contact channel once configured."
                  : "The form shows validation errors instead of a success state because this page must not imply delivery that did not occur."}
              </p>
              {canPrepareDraft ? (
                <pre className="public-contact-form__draft">{`Topic: ${formState.topic}\nName: ${formState.name}\nWork email: ${formState.workEmail}\nOrganization: ${formState.organization}\n\nMessage:\n${formState.message}`}</pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About"
        title="AI infrastructure readiness with evidence, not guesswork"
        description="GPUValidator exists to help AI and HPC infrastructure teams understand whether systems are ready, why they are not, what evidence supports the diagnosis, and what should happen next."
        headingId="public-about-title"
      />

      <section className="public-section public-section--split" aria-labelledby="public-about-what-title">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">What GPUValidator is</p>
          <h2 id="public-about-what-title">An operational intelligence and validation layer for AI factories</h2>
          <p>
            GPUValidator combines infrastructure discovery, readiness validation, topology interpretation, benchmarking, regression review, evidence, investigation, reporting, and AI-assisted reasoning into one operational product surface.
          </p>
          <p>
            It is not merely a benchmark launcher, a generic dashboard, or a source of unsupported live-state claims.
          </p>
        </div>

        <div className="public-about-grid">
          <article className="public-about-card">
            <span>Readiness question</span>
            <strong>Is the environment healthy enough for AI workloads?</strong>
          </article>
          <article className="public-about-card">
            <span>Diagnosis question</span>
            <strong>Why is the environment degraded or at risk?</strong>
          </article>
          <article className="public-about-card">
            <span>Evidence question</span>
            <strong>What proves the conclusion and affected scope?</strong>
          </article>
          <article className="public-about-card">
            <span>Action question</span>
            <strong>What should an operator review or do next?</strong>
          </article>
        </div>
      </section>

      <section className="public-section public-section--split" aria-labelledby="public-about-why-title">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">Why it exists</p>
          <h2 id="public-about-why-title">Complex AI infrastructure needs truthful operational clarity</h2>
          <p>
            AI and HPC environments span GPU health, software state, topology paths, network fabric, benchmark behavior, and operational history. Teams need to know what changed, what is affected, and what evidence is available before they trust a deployment or act on an issue.
          </p>
        </div>

        <div className="public-about-problem">
          <article>
            <span>Infrastructure problem</span>
            <strong>Readiness can fail in ways a single health badge cannot explain.</strong>
            <p>GPUValidator keeps evidence, topology context, and benchmark interpretation close to the diagnosis so teams can review what is actually known.</p>
          </article>
          <article>
            <span>Operational objective</span>
            <strong>Reduce uncertainty for engineers operating AI factories.</strong>
            <p>That means preserving technical accuracy, explicit unknown states, and recommendation framing without inventing confidence.</p>
          </article>
        </div>
      </section>

      <section className="public-section public-section--stacked" aria-labelledby="public-about-principles-title">
        <div className="public-section__intro">
          <p className="public-site-eyebrow">Product principles</p>
          <h2 id="public-about-principles-title">What the public site should communicate clearly</h2>
          <p>
            The public presence should match the product philosophy: operational seriousness, evidence-grounded language, and technically accurate representation of AI infrastructure state.
          </p>
        </div>

        <ul className="public-bullet-list public-bullet-list--principles">
          {aboutPrinciples.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
      </section>
    </>
  );
}

function NotFoundPage({ currentPath }: { currentPath?: string }) {
  return (
    <section className="public-not-found" aria-labelledby="public-404-title">
      <div className="public-not-found__signal">
        <span>404</span>
        <strong>NODE NOT FOUND</strong>
      </div>

      <div className="public-not-found__copy">
        <p className="public-site-eyebrow">Route unavailable</p>
        <h1 id="public-404-title">The requested public route is not present in this build.</h1>
        <p>
          GPUValidator kept the surrounding shell intact, but the requested page path{currentPath ? ` (${currentPath})` : ""} is not defined in the current public experience.
        </p>
        <div className="public-hero__actions">
          <a href={ROUTES.home} className="public-site-button public-site-button--primary">Return Home</a>
          <a href={ROUTES.signIn} className="public-site-button public-site-button--secondary">Sign In</a>
          <a href={ROUTES.platform} className="public-site-button public-site-button--secondary">Explore Platform</a>
        </div>
      </div>
    </section>
  );
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
  }, [prefersReducedMotion]);

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

function PublicHome({ onSubmit }: { onSubmit: () => void }) {
  const usernameId = useId();
  const passwordId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main id="public-main" className="public-site-main">
      <section className="public-hero" id="top" aria-labelledby="public-hero-title" data-testid="PublicHero">
        <div className="public-hero__copy">
          <p className="public-site-eyebrow">GPUValidator</p>
          <h1 id="public-hero-title">Know if your AI infrastructure is actually ready.</h1>
          <p className="public-hero__lede">
            GPUValidator helps infrastructure teams validate GPU infrastructure, understand topology, run benchmark-backed readiness workflows, investigate regressions, and move toward evidence-backed remediation.
          </p>

          <div className="public-hero__actions">
            <a href={ROUTES.getStarted} className="public-site-button public-site-button--primary">
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href={ROUTES.platform} className="public-site-button public-site-button--secondary">
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
            The public experience uses a simpler technical pipeline than Mission Control, but it keeps the same evidence-first operational logic.
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

      <section className="public-section public-section--split" id="investigation">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">Investigation</p>
          <h2>From performance question to likely cause and recommendation</h2>
          <p>
            This is a product visualization, not a live Copilot session. It shows how GPUValidator would visually structure an investigation path.
          </p>
        </div>

        <div className="investigation-panel" data-testid="PublicInvestigationSection">
          <article className="investigation-panel__question">
            <span>Example question</span>
            <h3>Why did NCCL all-reduce bandwidth fall?</h3>
          </article>

          <div className="investigation-chain" aria-label="Investigation flow">
            {[
              "Finding",
              "Affected node",
              "Fabric path",
              "Evidence",
              "Likely cause",
              "Recommendation",
            ].map((item) => (
              <div key={item} className="investigation-chain__item">{item}</div>
            ))}
          </div>

          <div className="investigation-panel__detail-grid">
            <article>
              <span>Finding</span>
              <strong>NCCL all-reduce bandwidth regression</strong>
            </article>
            <article>
              <span>Affected node</span>
              <strong>dgx03 / NIC 2</strong>
            </article>
            <article>
              <span>Fabric path</span>
              <strong>Node NIC → InfiniBand / RDMA → Cluster Fabric</strong>
            </article>
            <article>
              <span>Likely cause</span>
              <strong>Negotiated link speed below expected operating band</strong>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section public-section--split" id="enterprise">
        <div className="public-section__intro public-section__intro--left">
          <p className="public-site-eyebrow">Enterprise and security</p>
          <h2 id="security">Built for controlled enterprise environments</h2>
          <p>
            GPUValidator is designed for teams operating private AI infrastructure with controlled evidence handling, role-aware access, approval-aware remediation, and auditable operational workflows.
          </p>
        </div>

        <div className="enterprise-grid" data-testid="PublicEnterpriseSection">
          <article className="enterprise-card">
            <div className="enterprise-card__header">
              <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              <span>Security posture</span>
            </div>
            <ul className="public-bullet-list public-bullet-list--compact">
              {enterpriseBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="enterprise-card">
            <div className="enterprise-card__header">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              <span>Grounded workflow</span>
            </div>
            <div className="enterprise-card__stack">
              <div>
                <span>Private infrastructure</span>
                <strong>Evidence can stay bounded to the operating environment.</strong>
              </div>
              <div>
                <span>Approval-aware remediation</span>
                <strong>Recommendations stay distinct from infrastructure-changing action.</strong>
              </div>
              <div>
                <span>Auditability</span>
                <strong>Findings, evidence, and next steps remain reviewable.</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="public-final-cta" id="get-started" data-testid="PublicFinalCta">
        <div className="public-final-cta__copy">
          <p className="public-site-eyebrow">Get started</p>
          <h2>Validate your AI infrastructure before production does it for you.</h2>
          <p>
            Start with a reviewer-guided public entry experience today, then expand into deeper validation, benchmark, and investigation workflows in follow-on public site phases.
          </p>

          <div className="public-hero__actions public-hero__actions--footer">
            <a href={ROUTES.getStarted} className="public-site-button public-site-button--primary">Get Started</a>
            <a href={ROUTES.contact} className="public-site-button public-site-button--secondary">Contact Sales</a>
          </div>

          <div className="public-pricing-note" id="pricing">
            <span>Pricing</span>
            <strong>Enterprise rollout and benchmarking scope are reviewed with deployment context.</strong>
          </div>
        </div>

        <aside className="reviewer-access-card" id="sign-in">
          <div className="reviewer-access-card__header">
            <p className="public-site-eyebrow">Reviewer sign in</p>
            <h3>Secure access to the authenticated reviewer workspace</h3>
            <p>
              PUBLIC-001 preserves a reviewer-local demo path without presenting it as production authentication.
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
            <span><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Review the production-facing auth UX at /login</span>
            <span><Cpu className="h-4 w-4" aria-hidden="true" /> Launch the existing reviewer demo entry only for local evaluation</span>
            <span><Activity className="h-4 w-4" aria-hidden="true" /> Authenticated Mission Control remains separate</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function PublicLanding({ currentPage, currentPath, isDarkMode, onSubmit, onToggleTheme }: PublicLandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const headingIdByPage: Record<Exclude<PublicPage, "home">, string> = {
    about: "public-about-title",
    contact: "public-contact-title",
    privacy: "public-privacy-title",
    terms: "public-terms-title",
    "not-found": "public-404-title",
  };

  return (
    <div className="public-site-shell" data-testid="PublicSiteShell" data-public-page={currentPage}>
      <a className="public-site-skip-link" href="#public-main">Skip to content</a>

      <PublicNavigation
        currentPage={currentPage}
        isDarkMode={isDarkMode}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((current) => !current)}
        onToggleTheme={onToggleTheme}
      />

      {currentPage === "home" ? (
        <PublicHome onSubmit={onSubmit} />
      ) : (
        <main id="public-main" className="public-site-main public-site-main--document">
          {currentPage === "about" ? <AboutPage /> : null}
          {currentPage === "contact" ? <ContactPage /> : null}
          {currentPage === "privacy" ? (
            <DocumentPage
              eyebrow="Privacy"
              title="Privacy structure for public-site production review"
              description="This page is a conservative pre-production privacy structure based on known current product behavior in this repository. It is not legal advice and should be finalized during production and legal review."
              headingId={headingIdByPage.privacy}
              sections={privacySections}
            />
          ) : null}
          {currentPage === "terms" ? (
            <DocumentPage
              eyebrow="Terms"
              title="Terms structure for pre-production legal review"
              description="This page is a professional structural draft for GPUValidator public-site terms. It intentionally avoids unsupported legal commitments, entity details, or jurisdictional claims until legal review is complete."
              headingId={headingIdByPage.terms}
              sections={termsSections}
            />
          ) : null}
          {currentPage === "not-found" ? <NotFoundPage currentPath={currentPath} /> : null}
        </main>
      )}

      <PublicFooter />
    </div>
  );
}
