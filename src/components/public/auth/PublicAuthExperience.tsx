import React, { useId, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { AuthField, AuthPanel, AuthShell, AuthStatus, type AuthStatusTone } from "./index";
import "./AuthShell.css";

type PublicAuthRoute = "/login" | "/signup" | "/forgot-password" | "/reset-password" | "/verify-email";

type PublicAuthExperienceProps = {
  route: PublicAuthRoute;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onOpenReviewerDemo: () => void;
  reviewerDemoBlocked?: boolean;
};

type StatusMessage = {
  tone: AuthStatusTone;
  title: string;
  body: string;
};

type ResetPreviewState = "ready" | "expired" | "error" | "success";
type VerifyPreviewState = "waiting" | "verified" | "expired" | "error";

const previewStateLabels: Record<ResetPreviewState | VerifyPreviewState, string> = {
  ready: "Valid preview link",
  expired: "Expired link",
  error: "Error state",
  success: "Success state",
  waiting: "Waiting",
  verified: "Verified",
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getPasswordChecks(password: string) {
  return {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

function passwordIsStrong(password: string) {
  return Object.values(getPasswordChecks(password)).every(Boolean);
}

function PasswordRequirementList({ password }: { password: string }) {
  const checks = getPasswordChecks(password);
  const requirements = [
    { key: "length", label: "At least 12 characters", met: checks.length },
    { key: "upper", label: "One uppercase letter", met: checks.upper },
    { key: "lower", label: "One lowercase letter", met: checks.lower },
    { key: "number", label: "One number", met: checks.number },
    { key: "symbol", label: "One symbol", met: checks.symbol },
  ];

  return (
    <ul className="auth-password-requirements" aria-label="Password requirements">
      {requirements.map((requirement) => (
        <li key={requirement.key} className={requirement.met ? "is-met" : undefined}>
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{requirement.label}</span>
        </li>
      ))}
    </ul>
  );
}

function PreviewStateSelector<T extends ResetPreviewState | VerifyPreviewState>({
  label,
  states,
  current,
  onSelect,
}: {
  label: string;
  states: T[];
  current: T;
  onSelect: (state: T) => void;
}) {
  return (
    <div className="auth-preview-selector">
      <span>{label}</span>
      <div className="auth-preview-selector__controls" role="toolbar" aria-label={label}>
        {states.map((state) => (
          <button
            key={state}
            type="button"
            className={`auth-preview-selector__button${current === state ? " is-active" : ""}`}
            onClick={() => onSelect(state)}
            aria-pressed={current === state}
          >
            {previewStateLabels[state]}
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoEntryCard({ onOpenReviewerDemo }: { onOpenReviewerDemo: () => void }) {
  return (
    <aside className="auth-demo-card" aria-label="Reviewer demo entry">
      <div className="auth-demo-card__header">
        <p className="auth-panel__eyebrow">Reviewer demo entry</p>
        <h2>Preserve reviewer-local access without presenting it as production auth</h2>
      </div>
      <p>
        This route opens the existing authenticated reviewer workspace for local evaluation only. It is not connected to a production identity provider.
      </p>
      <button type="button" className="auth-button auth-button--secondary" onClick={onOpenReviewerDemo}>
        Open reviewer demo workspace
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}

function LoginView({ onOpenReviewerDemo, reviewerDemoBlocked = false }: { onOpenReviewerDemo: () => void; reviewerDemoBlocked?: boolean }) {
  const identifierId = useId();
  const passwordId = useId();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  const [status, setStatus] = useState<StatusMessage | null>(
    reviewerDemoBlocked
      ? {
          tone: "warning",
          title: "Reviewer demo access is not active",
          body: "Open the reviewer demo from the public preview so the public shell remains distinct from the authenticated workspace.",
        }
      : null,
  );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: { identifier?: string; password?: string } = {};

    if (!identifier.trim()) {
      nextErrors.identifier = "Enter your work email or username.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus({
        tone: "critical",
        title: "Sign-in details required",
        body: "Complete the required fields before continuing.",
      });
      return;
    }

    setStatus({
      tone: "warning",
      title: "Production authentication not connected",
      body: "This public preview validates the sign-in experience only. No live identity provider was contacted and no session was created.",
    });
  };

  return (
    <AuthPanel
      eyebrow="Sign In"
      title="Access GPUValidator securely"
      description="Enter your organization credentials when a production identity provider is connected. This public preview focuses on UX, validation, and route structure."
      footer={
        <p>
          New to GPUValidator? <a href="/signup">Create account</a>
        </p>
      }
    >
      {status ? <AuthStatus tone={status.tone} title={status.title}>{status.body}</AuthStatus> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField
          id={identifierId}
          label="Email or username"
          type="text"
          autoComplete="username"
          placeholder="name@company.com"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          error={errors.identifier}
          hint="Use the organization identity you expect to sign in with."
          required
        />

        <AuthField
          id={passwordId}
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="Enter password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          required
          action={
            <button
              type="button"
              className="auth-inline-button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{showPassword ? "Hide" : "Show"}</span>
            </button>
          }
        />

        <div className="auth-form__row auth-form__row--spread">
          <label className="auth-checkbox">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me</span>
          </label>
          <a className="auth-inline-link" href="/forgot-password">Forgot password?</a>
        </div>

        <button type="submit" className="auth-button auth-button--primary">
          Sign In
        </button>
      </form>

      <DemoEntryCard onOpenReviewerDemo={onOpenReviewerDemo} />
    </AuthPanel>
  );
}

function SignupView() {
  const firstNameId = useId();
  const lastNameId = useId();
  const emailId = useId();
  const organizationId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organization: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!form.firstName.trim()) nextErrors.firstName = "Enter your first name.";
    if (!form.lastName.trim()) nextErrors.lastName = "Enter your last name.";
    if (!isValidEmail(form.email)) nextErrors.email = "Enter a valid work email.";
    if (!form.organization.trim()) nextErrors.organization = "Enter your organization.";
    if (!passwordIsStrong(form.password)) nextErrors.password = "Choose a stronger password.";
    if (form.confirmPassword !== form.password) nextErrors.confirmPassword = "Passwords must match.";
    if (!form.acceptedTerms) nextErrors.acceptedTerms = "Acknowledge the terms and privacy notice to continue.";

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus({
        tone: "critical",
        title: "Review the highlighted fields",
        body: "The public preview validates account setup requirements before any backend provisioning is connected.",
      });
      return;
    }

    setStatus({
      tone: "warning",
      title: "Provisioning is not connected in this preview",
      body: "GPUValidator collected the expected account details locally only. No account was created and no organization directory was updated.",
    });
  };

  return (
    <AuthPanel
      eyebrow="Create account"
      title="Request organization access"
      description="Establish a professional account-creation flow now so a real identity provider can power it later without changing the public UX."
      footer={
        <p>
          Already have an account? <a href="/login">Sign in</a>
        </p>
      }
    >
      {status ? <AuthStatus tone={status.tone} title={status.title}>{status.body}</AuthStatus> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-form__grid auth-form__grid--split">
          <AuthField
            id={firstNameId}
            label="First name"
            type="text"
            autoComplete="given-name"
            placeholder="Avery"
            value={form.firstName}
            onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            error={errors.firstName}
            required
          />
          <AuthField
            id={lastNameId}
            label="Last name"
            type="text"
            autoComplete="family-name"
            placeholder="Jordan"
            value={form.lastName}
            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            error={errors.lastName}
            required
          />
        </div>

        <AuthField
          id={emailId}
          label="Work email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          error={errors.email}
          hint="Use an organization address for access review and future domain verification."
          required
        />

        <AuthField
          id={organizationId}
          label="Organization"
          type="text"
          autoComplete="organization"
          placeholder="Example Infrastructure"
          value={form.organization}
          onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))}
          error={errors.organization}
          required
        />

        <AuthField
          id={passwordId}
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Create password"
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          error={errors.password}
          hint="Password requirements are visible before account provisioning is connected."
          required
          action={
            <button
              type="button"
              className="auth-inline-button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{showPassword ? "Hide" : "Show"}</span>
            </button>
          }
        />

        <PasswordRequirementList password={form.password} />

        <AuthField
          id={confirmPasswordId}
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirm password"
          value={form.confirmPassword}
          onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
          error={errors.confirmPassword}
          required
          action={
            <button
              type="button"
              className="auth-inline-button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              aria-pressed={showConfirmPassword}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{showConfirmPassword ? "Hide" : "Show"}</span>
            </button>
          }
        />

        <div className="auth-checkbox-card">
          <label className="auth-checkbox auth-checkbox--top-aligned">
            <input
              type="checkbox"
              checked={form.acceptedTerms}
              onChange={(event) => setForm((current) => ({ ...current, acceptedTerms: event.target.checked }))}
              aria-describedby={errors.acceptedTerms ? `${confirmPasswordId}-terms-error` : undefined}
            />
            <span>
              I acknowledge the <a href="/#terms">Terms</a> and <a href="/#privacy">Privacy</a> information for organization access review.
            </span>
          </label>
          {errors.acceptedTerms ? (
            <span className="auth-field__error" id={`${confirmPasswordId}-terms-error`}>
              {errors.acceptedTerms}
            </span>
          ) : null}
        </div>

        <button type="submit" className="auth-button auth-button--primary">
          Create account
        </button>
      </form>
    </AuthPanel>
  );
}

function ForgotPasswordView() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phase, setPhase] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const status = useMemo<StatusMessage | null>(() => {
    if (phase === "success") {
      return {
        tone: "warning",
        title: "Reset workflow validated locally",
        body: "No email was sent because the public preview is not connected to a reset-delivery provider yet.",
      };
    }

    if (phase === "error") {
      return {
        tone: "critical",
        title: "Reset instructions were not prepared",
        body: "Enter a valid work email to continue with the provider-ready reset flow.",
      };
    }

    return null;
  }, [phase]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setEmailError("Enter a valid work email.");
      setPhase("error");
      return;
    }

    setEmailError(undefined);
    setPhase("submitting");
    window.setTimeout(() => setPhase("success"), 700);
  };

  return (
    <AuthPanel
      eyebrow="Forgot password"
      title="Reset access carefully"
      description="Guide a real password-reset flow later without implying that email delivery or token issuance exists today."
      footer={
        <p>
          Need your sign-in form instead? <a href="/login">Return to login</a>
        </p>
      }
    >
      {status ? <AuthStatus tone={status.tone} title={status.title}>{status.body}</AuthStatus> : null}
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField
          id={emailId}
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (phase !== "idle") setPhase("idle");
          }}
          error={emailError}
          hint="Reset instructions will route through your organization email when a provider is connected."
          required
        />

        <button type="submit" className="auth-button auth-button--primary" disabled={phase === "submitting"}>
          {phase === "submitting" ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Sending reset instructions
            </>
          ) : (
            "Send reset instructions"
          )}
        </button>
      </form>
    </AuthPanel>
  );
}

function ResetPasswordView() {
  const passwordId = useId();
  const confirmPasswordId = useId();
  const initialState = useMemo<ResetPreviewState>(() => {
    if (typeof window === "undefined") {
      return "expired";
    }

    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");

    if (state === "error") return "error";
    if (state === "success") return "success";
    if (params.get("token")) return "ready";
    return "expired";
  }, []);
  const [previewState, setPreviewState] = useState<ResetPreviewState>(initialState);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  const status = useMemo<StatusMessage>(() => {
    if (previewState === "success") {
      return {
        tone: "warning",
        title: "Reset completion previewed",
        body: "The UI reached a success state for review, but no account password was changed because token validation is not connected.",
      };
    }

    if (previewState === "error") {
      return {
        tone: "critical",
        title: "Password reset could not continue",
        body: "Use this state to integrate provider errors such as unavailable reset services or rejected password updates.",
      };
    }

    if (previewState === "expired") {
      return {
        tone: "warning",
        title: "Reset link is invalid or expired",
        body: "No reset token is present. This public preview keeps the failure state explicit instead of inventing token validation.",
      };
    }

    return {
      tone: "info",
      title: "Ready for connected reset flow",
      body: "Preview a valid reset session here, then hand the final token validation and password write to a future identity provider.",
    };
  }, [previewState]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (previewState !== "ready") {
      return;
    }

    const nextErrors: { password?: string; confirmPassword?: string } = {};
    if (!passwordIsStrong(password)) nextErrors.password = "Choose a stronger password.";
    if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords must match.";
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setPreviewState("success");
  };

  return (
    <AuthPanel
      eyebrow="Reset password"
      title="Prepare a controlled password update flow"
      description="Keep reset-link validity, password requirements, and submission outcomes explicit so backend token checks can plug in later without UI rework."
      footer={
        <p>
          Need a new reset link? <a href="/forgot-password">Send reset instructions</a>
        </p>
      }
    >
      <AuthStatus tone={status.tone} title={status.title}>{status.body}</AuthStatus>
      <PreviewStateSelector
        label="Preview states"
        states={["ready", "expired", "error"]}
        current={previewState === "success" ? "ready" : previewState}
        onSelect={(next) => {
          setPreviewState(next);
          if (next !== "success") {
            setErrors({});
          }
        }}
      />
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthField
          id={passwordId}
          label="New password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Create new password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          disabled={previewState !== "ready"}
          required
          action={
            <button
              type="button"
              className="auth-inline-button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={previewState !== "ready"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{showPassword ? "Hide" : "Show"}</span>
            </button>
          }
        />

        <PasswordRequirementList password={password} />

        <AuthField
          id={confirmPasswordId}
          label="Confirm password"
          type={showConfirmPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          disabled={previewState !== "ready"}
          required
          action={
            <button
              type="button"
              className="auth-inline-button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              aria-pressed={showConfirmPassword}
              disabled={previewState !== "ready"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{showConfirmPassword ? "Hide" : "Show"}</span>
            </button>
          }
        />

        <button type="submit" className="auth-button auth-button--primary" disabled={previewState !== "ready"}>
          Reset password
        </button>
      </form>
    </AuthPanel>
  );
}

function VerifyEmailView() {
  const initialState = useMemo<VerifyPreviewState>(() => {
    if (typeof window === "undefined") {
      return "waiting";
    }

    const params = new URLSearchParams(window.location.search);
    const state = params.get("state");

    if (state === "verified") return "verified";
    if (state === "expired") return "expired";
    if (state === "error") return "error";
    return "waiting";
  }, []);
  const [previewState, setPreviewState] = useState<VerifyPreviewState>(initialState);
  const [resendStatus, setResendStatus] = useState<StatusMessage | null>(null);
  const status = useMemo<StatusMessage>(() => {
    if (previewState === "verified") {
      return {
        tone: "info",
        title: "Verified state available for integration",
        body: "Use this view when a backend confirms the verification token. The current preview does not claim a live verification event occurred.",
      };
    }

    if (previewState === "expired") {
      return {
        tone: "warning",
        title: "Verification link expired",
        body: "Keep retry and resend actions available without hiding that the underlying verification service is not connected.",
      };
    }

    if (previewState === "error") {
      return {
        tone: "critical",
        title: "Verification could not be completed",
        body: "This state is reserved for provider errors such as invalid token parsing or unavailable verification services.",
      };
    }

    return {
      tone: "info",
      title: "Awaiting verification",
      body: "Guide the user to check their inbox while clearly separating the UI shell from any future email provider integration.",
    };
  }, [previewState]);

  const resendVerification = () => {
    setResendStatus({
      tone: "warning",
      title: "Resend flow previewed only",
      body: "The public preview shows where resend confirmation belongs, but no verification email was sent.",
    });
  };

  return (
    <AuthPanel
      eyebrow="Verify email"
      title="Confirm organization ownership"
      description="Present waiting, verified, expired, and error states truthfully so an email-verification provider can attach later without changing the public shell."
      footer={
        <p>
          Already verified? <a href="/login">Return to login</a>
        </p>
      }
    >
      <AuthStatus tone={status.tone} title={status.title}>{status.body}</AuthStatus>
      {resendStatus ? <AuthStatus tone={resendStatus.tone} title={resendStatus.title}>{resendStatus.body}</AuthStatus> : null}
      <PreviewStateSelector
        label="Preview states"
        states={["waiting", "verified", "expired", "error"]}
        current={previewState}
        onSelect={(next) => {
          setPreviewState(next);
          setResendStatus(null);
        }}
      />
      <div className="auth-verify-actions">
        <button type="button" className="auth-button auth-button--primary" onClick={resendVerification}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Resend verification
        </button>
        <a className="auth-button auth-button--secondary auth-button--link" href="/login">
          Return to login
        </a>
      </div>
    </AuthPanel>
  );
}

const routeContent: Record<PublicAuthRoute, { badge: string; supportTitle: string; supportBody: string }> = {
  "/login": {
    badge: "AUTH / ENTRY",
    supportTitle: "Secure access starts with clear identity boundaries",
    supportBody: "A restrained technical shell keeps attention on the sign-in form while leaving room for provider-backed controls, enterprise copy, and future MFA patterns.",
  },
  "/signup": {
    badge: "AUTH / PROVISION",
    supportTitle: "Organization onboarding should read like enterprise provisioning",
    supportBody: "The account-request flow stays professional, accessible, and honest about what happens before any identity backend is connected.",
  },
  "/forgot-password": {
    badge: "AUTH / RECOVERY",
    supportTitle: "Password recovery needs calm, explicit communication",
    supportBody: "Recovery language focuses on the user, the account boundary, and what the system can or cannot do right now.",
  },
  "/reset-password": {
    badge: "AUTH / UPDATE",
    supportTitle: "Reset flows should make token state and password policy visible",
    supportBody: "The shell leaves space for real provider outcomes without pretending a token or password update succeeded remotely.",
  },
  "/verify-email": {
    badge: "AUTH / VERIFY",
    supportTitle: "Verification should feel procedural, not theatrical",
    supportBody: "Status states stay explicit so users know whether they are waiting, verified, expired, or blocked by an integration error.",
  },
};

export function PublicAuthExperience({ route, isDarkMode, onToggleTheme, onOpenReviewerDemo, reviewerDemoBlocked = false }: PublicAuthExperienceProps) {
  const content = routeContent[route];

  return (
    <AuthShell
      isDarkMode={isDarkMode}
      onToggleTheme={onToggleTheme}
      supportBadge={content.badge}
      supportTitle={content.supportTitle}
      supportBody={content.supportBody}
    >
      {route === "/login" ? <LoginView onOpenReviewerDemo={onOpenReviewerDemo} reviewerDemoBlocked={reviewerDemoBlocked} /> : null}
      {route === "/signup" ? <SignupView /> : null}
      {route === "/forgot-password" ? <ForgotPasswordView /> : null}
      {route === "/reset-password" ? <ResetPasswordView /> : null}
      {route === "/verify-email" ? <VerifyEmailView /> : null}
    </AuthShell>
  );
}
