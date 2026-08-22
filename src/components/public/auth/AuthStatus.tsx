import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, Info } from "lucide-react";

export type AuthStatusTone = "info" | "success" | "warning" | "critical";

type AuthStatusProps = {
  tone: AuthStatusTone;
  title: string;
  children: ReactNode;
  id?: string;
};

const toneIcon = {
  info: Info,
  success: CheckCircle2,
  warning: CircleDashed,
  critical: CircleAlert,
} as const;

export function AuthStatus({ tone, title, children, id }: AuthStatusProps) {
  const Icon = toneIcon[tone];

  return (
    <div className={`auth-status auth-status--${tone}`} id={id} role={tone === "critical" ? "alert" : "status"}>
      <div className="auth-status__icon" aria-hidden="true">
        <Icon className="h-4 w-4" />
      </div>
      <div className="auth-status__body">
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
