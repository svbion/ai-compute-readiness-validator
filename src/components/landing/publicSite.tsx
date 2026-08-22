import React, { useEffect, useState } from "react";
import { ChevronRight, Menu, Moon, Sun, X } from "lucide-react";

export type PublicThemeProps = {
  isDarkMode: boolean;
  onToggleTheme: () => void;
};

export type PublicRouteDefinition = {
  label: string;
  href: string;
};

export const PUBLIC_PRIMARY_ROUTES: PublicRouteDefinition[] = [
  { label: "Platform", href: "/platform" },
  { label: "AI Factory", href: "/ai-factory" },
  { label: "Validation", href: "/validation" },
  { label: "Benchmarks", href: "/benchmarks" },
  { label: "Enterprise", href: "/enterprise" },
  { label: "Security", href: "/security" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
];

function updateMeta(name: string, content: string) {
  const element = document.querySelector(`meta[name="${name}"]`);
  if (element) {
    element.setAttribute("content", content);
  }
}

function updateProperty(property: string, content: string) {
  const element = document.querySelector(`meta[property="${property}"]`);
  if (element) {
    element.setAttribute("content", content);
  }
}

export function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    updateMeta("description", description);
    updateMeta("theme-color", "#05090F");
    updateProperty("og:title", title);
    updateProperty("og:description", description);
  }, [description, title]);
}

function PublicNavigation({
  currentPath,
  isDarkMode,
  onToggleTheme,
}: PublicThemeProps & { currentPath: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    ...PUBLIC_PRIMARY_ROUTES,
    { label: "Sign In", href: "/login" },
    { label: "Get Started", href: "/signup" },
  ];

  return (
    <header className="public-site-header" data-testid="PublicSiteHeader">
      <a className="public-site-brand" href="/" aria-label="GPUValidator public home">
        <span className="public-site-brand__mark" aria-hidden="true">
          <span className="public-site-brand__pulse" />
        </span>
        <span className="public-site-brand__text">
          <strong>GPUValidator</strong>
          <span>AI Infrastructure Readiness</span>
        </span>
      </a>

      <nav className="public-site-nav" aria-label="Primary public navigation">
        {PUBLIC_PRIMARY_ROUTES.map((link) => {
          const active = currentPath === link.href;
          return (
            <a
              key={link.href}
              href={link.href}
              className={`public-site-nav__link${active ? " public-site-nav__link--active" : ""}`}
              aria-current={active ? "page" : undefined}
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
        <a href="/login" className="public-site-action public-site-action--secondary">Sign In</a>
        <a href="/signup" className="public-site-action public-site-action--primary">Get Started</a>
        <button
          type="button"
          className="public-site-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="public-mobile-nav"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          data-testid="PublicMobileNavTrigger"
          onClick={() => setMenuOpen((current) => !current)}
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
          {links.map((link) => {
            const active = currentPath === link.href;
            const variant =
              link.label === "Get Started"
                ? "primary"
                : link.label === "Sign In"
                  ? "secondary"
                  : "default";

            return (
              <a
                key={link.href}
                href={link.href}
                className={[
                  "public-site-mobile-nav__link",
                  `public-site-mobile-nav__link--${variant}`,
                  active ? "public-site-mobile-nav__link--active" : "",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span>{link.label}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function PublicSiteFooter() {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer__grid">
        <section>
          <h2>Product</h2>
          <a href="/platform">Platform</a>
          <a href="/ai-factory">AI Factory</a>
          <a href="/validation">Validation</a>
          <a href="/benchmarks">Benchmarks</a>
        </section>

        <section>
          <h2>Resources</h2>
          <a href="/docs">Docs</a>
          <a href="/security">Security</a>
          <a href="/pricing">Pricing</a>
          <a href="/login">Reviewer access</a>
        </section>

        <section>
          <h2>Company</h2>
          <a href="/enterprise">Enterprise</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </section>

        <section>
          <h2>Legal</h2>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </section>
      </div>

      <div className="public-site-footer__bottom">
        <span>© 2026 GPUValidator</span>
        <span>Built for secure enterprise deployment review and infrastructure trust workflows.</span>
      </div>
    </footer>
  );
}

export function PublicSiteShell({
  children,
  currentPath,
  isDarkMode,
  onToggleTheme,
}: React.PropsWithChildren<PublicThemeProps & { currentPath: string }>) {
  return (
    <div className="public-site-shell" data-testid="PublicSiteShell">
      <a className="public-site-skip-link" href="#public-main">Skip to content</a>
      <PublicNavigation currentPath={currentPath} isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} />
      <main id="public-main" className="public-site-main">
        {children}
      </main>
      <PublicSiteFooter />
    </div>
  );
}
