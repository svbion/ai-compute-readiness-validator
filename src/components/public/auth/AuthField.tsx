import type { InputHTMLAttributes, ReactNode } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  action?: ReactNode;
  inputClassName?: string;
};

export function AuthField({
  label,
  hint,
  error,
  action,
  className,
  inputClassName,
  id,
  ...inputProps
}: AuthFieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <label className={`auth-field ${className ?? ""}`.trim()} htmlFor={id}>
      <span className="auth-field__label">{label}</span>
      <div className="auth-field__control">
        <input
          {...inputProps}
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          className={`auth-field__input ${inputClassName ?? ""}`.trim()}
        />
        {action ? <div className="auth-field__action">{action}</div> : null}
      </div>
      {hint ? (
        <span className="auth-field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="auth-field__error" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
