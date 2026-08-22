import type { ReactNode } from "react";
import { ArrowLeft, KeyRound, Moon, ShieldCheck, Smartphone, Sun, Workflow } from "lucide-react";

type AuthShellProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  children: ReactNode;
  supportTitle: string;
  supportBody: string;
  supportBadge: string;
};

const telemetryItems = [
  { label: "Session security", value: "Client-side preview only" },
  { label: "Organization access", value: "Backend provider pending" },
  { label: "Password handling", value: "Validation only · no remote write" },
];

const mfaPatterns = [
  {
    icon: KeyRound,
    title: "Verification code",
    body: "Reserved space for step-up verification without crowding the primary sign-in form.",
  },
  {
    icon: Smartphone,
    title: "Authenticator app",
    body: "Support cards can expand into trusted-device and authenticator enrollment flows later.",
  },
  {
    icon: Workflow,
    title: "Recovery code",
    body: "Fallback recovery messaging can sit beside the form without changing the page structure.",
  },
];

export function AuthShell({ isDarkMode, onToggleTheme, children, supportTitle, supportBody, supportBadge }: AuthShellProps) {
  return (
    <div className="auth-shell" data-testid="PublicAuthShell">
      <header className="auth-shell__header">
        <a className="auth-shell__back-link" href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to GPUValidator public site
        </a>

        <div className="auth-shell__brand">
          <span className="auth-shell__brand-mark" aria-hidden="true">
            <span className="auth-shell__brand-pulse" />
          </span>
          <div>
            <strong>GPUValidator</strong>
            <span>Secure public access preview</span>
          </div>
        </div>

        <button
          type="button"
          className="auth-shell__theme-toggle"
          onClick={onToggleTheme}
          aria-label={isDarkMode ? "Activate light theme" : "Activate dark theme"}
          title={isDarkMode ? "Activate light theme" : "Activate dark theme"}
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span>{isDarkMode ? "Light" : "Dark"} mode</span>
        </button>
      </header>

      <main className="auth-shell__main">
        <div className="auth-shell__layout">
          <div className="auth-shell__form-stage">{children}</div>

          <aside className="auth-shell__support" aria-label="Authentication context and future readiness">
            <section className="auth-support-card auth-support-card--visual">
              <div className="auth-support-card__label-row">
                <span>{supportBadge}</span>
                <span>Public auth shell</span>
              </div>
              <div className="auth-visualization" aria-hidden="true">
                <div className="auth-visualization__ring auth-visualization__ring--outer" />
                <div className="auth-visualization__ring auth-visualization__ring--middle" />
                <div className="auth-visualization__ring auth-visualization__ring--inner" />
                <div className="auth-visualization__grid" />
                <div className="auth-visualization__core" />
              </div>
              <h2>{supportTitle}</h2>
              <p>{supportBody}</p>
              <div className="auth-support-card__telemetry">
                {telemetryItems.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="auth-support-card">
              <div className="auth-support-card__section-title">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>MFA-ready patterns</span>
              </div>
              <div className="auth-support-card__stack">
                {mfaPatterns.map(({ icon: Icon, title, body }) => (
                  <article key={title} className="auth-support-card__mfa-item">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <div>
                      <strong>{title}</strong>
                      <p>{body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="auth-support-card auth-support-card--compact">
              <div className="auth-support-card__section-title">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                <span>Enterprise access language</span>
              </div>
              <p>
                GPUValidator describes session security, organization access, and verification states without claiming a live provider where one is not connected.
              </p>
            </section>
          </aside>
        </div>
      </main>

      <footer className="auth-shell__footer">
        <span>© 2026 GPUValidator</span>
        <nav aria-label="Auth shell legal links">
          <a href="/#privacy">Privacy</a>
          <a href="/#terms">Terms</a>
          <a href="/login">Support</a>
        </nav>
      </footer>
    </div>
  );
}
