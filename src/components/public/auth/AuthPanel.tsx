import type { ReactNode } from "react";

type AuthPanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthPanel({ eyebrow, title, description, children, footer }: AuthPanelProps) {
  return (
    <section className="auth-panel" aria-labelledby="auth-panel-title">
      <header className="auth-panel__header">
        <p className="auth-panel__eyebrow">{eyebrow}</p>
        <h1 id="auth-panel-title">{title}</h1>
        <p className="auth-panel__description">{description}</p>
      </header>
      <div className="auth-panel__body">{children}</div>
      {footer ? <footer className="auth-panel__footer">{footer}</footer> : null}
    </section>
  );
}
