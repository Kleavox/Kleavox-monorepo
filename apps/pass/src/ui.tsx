import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";

import type { FormState } from "./types";

export function AuthForm({
  title,
  description,
  onSubmit,
  state,
  submitLabel,
  children,
}: {
  title: string;
  description: string;
  onSubmit: (event: FormEvent) => void;
  state: FormState;
  submitLabel: string;
  children: ReactNode;
}) {
  return (
    <form className="pass-form" onSubmit={onSubmit}>
      <div className="pass-form-heading">
        <p className="pass-section-label">Kleavox Pass</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="pass-fields">{children}</div>
      <Status state={state} />
      <button
        className="pass-primary"
        type="submit"
        disabled={state.status === "loading" || state.status === "success"}
      >
        {state.status === "loading" ? "Working..." : submitLabel}
      </button>
    </form>
  );
}

export function Field({
  label,
  hint,
  name,
  value,
  onChange,
  type = "text",
  ...inputProps
}: {
  label: string;
  hint?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "value" | "onChange" | "type"
>) {
  return (
    <label className="pass-field">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        {...inputProps}
        required
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      className={`pass-status pass-status-${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {state.message}
    </p>
  );
}

export function ResultState({
  title,
  state,
  children,
}: {
  title: string;
  state: FormState;
  children: ReactNode;
}) {
  return (
    <section className="pass-result">
      <p className="pass-section-label">Kleavox Pass</p>
      <h2>{title}</h2>
      {state.status === "loading" ? (
        <div className="pass-loading-lines" aria-label="Loading">
          <span />
          <span />
        </div>
      ) : (
        <Status state={state} />
      )}
      {state.status === "success" && children}
    </section>
  );
}

export function LoadingState() {
  return (
    <section className="pass-result" aria-label="Loading session">
      <div className="pass-loading-lines">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
