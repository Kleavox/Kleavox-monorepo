import { Turnstile } from "@marsidev/react-turnstile";
import "@kleavox/ui/styles.css";
import {
  type FormEvent,
  StrictMode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { LINK_ORIGIN, PULSE_ORIGIN, ROOT_ORIGIN } from "./config";
import "./pass.css";

type Mode = "login" | "register" | "forgot";

interface Identity {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
}

interface SessionResponse {
  authenticated: boolean;
  user?: Identity;
  expiresAt?: string;
}

interface ApiFailure {
  error?: {
    code?: string;
    message?: string;
  };
}

interface FormState {
  status: "idle" | "loading" | "error" | "success";
  message?: string;
}

interface OAuthProviders {
  google: boolean;
  github: boolean;
}

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;
const returnTo = new URLSearchParams(window.location.search).get("returnTo");

function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [providers, setProviders] = useState<OAuthProviders>({
    google: false,
    github: false,
  });
  const route = window.location.pathname;

  useEffect(() => {
    if (route === "/verify" || route === "/reset") return;
    void Promise.all([
      api<SessionResponse>("/api/session"),
      api<OAuthProviders>("/api/oauth/providers"),
    ])
      .then(([nextSession, nextProviders]) => {
        if (nextSession.authenticated && returnTo) {
          window.location.assign(returnTo);
          return;
        }
        setProviders(nextProviders);
        setSession(nextSession);
      })
      .catch(() => setSession({ authenticated: false }));
  }, [route]);

  const content = useMemo(() => {
    if (route === "/verify") return <VerifyEmail />;
    if (route === "/reset") return <ResetPassword />;
    if (session === null) return <LoadingState />;
    if (session.authenticated && session.user) {
      return (
        <Account
          user={session.user}
          onSignedOut={() => setSession({ authenticated: false })}
        />
      );
    }
    if (mode === "register") {
      return <Register onModeChange={setMode} />;
    }
    if (mode === "forgot") {
      return <ForgotPassword onModeChange={setMode} />;
    }
    return (
      <Login
        providers={providers}
        onModeChange={setMode}
        onAuthenticated={(user) => {
          if (returnTo) {
            window.location.assign(returnTo);
            return;
          }
          setSession({ authenticated: true, user });
        }}
      />
    );
  }, [mode, providers, route, session]);

  return (
    <main className="pass-layout">
      <section className="pass-intro" aria-labelledby="pass-title">
        <a className="pass-wordmark" href={ROOT_ORIGIN}>
          KLEAVOX <span>PASS</span>
        </a>
        <div className="pass-intro-copy">
          <p className="pass-kicker">IDENTITY / SHARED SESSION</p>
          <h1 id="pass-title">
            One signal.
            <br />
            Every tool.
          </h1>
          <p>Sign in once for Link, files, and Pulse.</p>
        </div>
        <div
          className="pass-service-map"
          aria-label="Connected Kleavox services"
        >
          <span>Connected access</span>
          <a href={LINK_ORIGIN}>
            Link <b>ready</b>
          </a>
          <a href={PULSE_ORIGIN}>
            Pulse <b>ready</b>
          </a>
          <a href={ROOT_ORIGIN}>
            Kleavox <b>home</b>
          </a>
        </div>
        <div className="pass-orbit" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="pass-panel">
        <header className="pass-panel-head">
          <span>AUTH CHANNEL</span>
          <b>ENCRYPTED</b>
        </header>
        <div className="pass-panel-inner">{content}</div>
        <footer className="pass-panel-foot">
          <span>7 day session</span>
          <span>revocable</span>
        </footer>
      </section>
    </main>
  );
}

function Login({
  providers,
  onModeChange,
  onAuthenticated,
}: {
  providers: OAuthProviders;
  onModeChange: (mode: Mode) => void;
  onAuthenticated: (user: Identity) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const oauthError = oauthErrorMessage(
    new URLSearchParams(window.location.search).get("oauthError"),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const response = await api<{ authenticated: true; user: Identity }>(
        "/api/login",
        { email, password },
      );
      onAuthenticated(response.user);
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  return (
    <AuthForm
      title="Sign in"
      description="Use your account or a connected provider."
      onSubmit={submit}
      state={state}
      submitLabel="Sign in"
    >
      {(providers.google || providers.github) && (
        <>
          <div className="pass-oauth">
            {providers.google && (
              <button type="button" onClick={() => startOAuth("google")}>
                <span>G</span>
                Google
              </button>
            )}
            {providers.github && (
              <button type="button" onClick={() => startOAuth("github")}>
                <span>GH</span>
                GitHub
              </button>
            )}
          </div>
          <div className="pass-divider">
            <span>or</span>
          </div>
        </>
      )}
      {oauthError && (
        <p className="pass-status pass-status-error" role="alert">
          {oauthError}
        </p>
      )}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />
      <button
        className="pass-text-action pass-align-right"
        type="button"
        onClick={() => onModeChange("forgot")}
      >
        Forgot password?
      </button>
      <p className="pass-switch">
        No account?{" "}
        <button type="button" onClick={() => onModeChange("register")}>
          Create an account
        </button>
      </p>
    </AuthForm>
  );
}

function Register({ onModeChange }: { onModeChange: (mode: Mode) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const response = await api<{ message: string }>("/api/register", {
        name,
        email,
        password,
        turnstileToken,
      });
      setState({ status: "success", message: response.message });
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  return (
    <AuthForm
      title="Create your account"
      description="Create one identity for Kleavox."
      onSubmit={submit}
      state={state}
      submitLabel="Create account"
    >
      <Field
        label="Name"
        name="name"
        autoComplete="name"
        value={name}
        onChange={setName}
      />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <Field
        label="Password"
        hint="Use at least 12 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        value={password}
        onChange={setPassword}
      />
      <SecurityChallenge onToken={setTurnstileToken} />
      <p className="pass-switch">
        Already registered?{" "}
        <button type="button" onClick={() => onModeChange("login")}>
          Sign in
        </button>
      </p>
    </AuthForm>
  );
}

function ForgotPassword({
  onModeChange,
}: {
  onModeChange: (mode: Mode) => void;
}) {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const response = await api<{ message: string }>("/api/password/forgot", {
        email,
        turnstileToken,
      });
      setState({ status: "success", message: response.message });
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  return (
    <AuthForm
      title="Reset access"
      description="Receive a short-lived reset link."
      onSubmit={submit}
      state={state}
      submitLabel="Send reset link"
    >
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
      />
      <SecurityChallenge onToken={setTurnstileToken} />
      <button
        className="pass-text-action"
        type="button"
        onClick={() => onModeChange("login")}
      >
        Back to sign in
      </button>
    </AuthForm>
  );
}

function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [state, setState] = useState<FormState>({ status: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Verification token is missing." });
      return;
    }
    void api("/api/verify-email", { token })
      .then(() =>
        setState({
          status: "success",
          message: "Email verified. You can now sign in.",
        }),
      )
      .catch((cause) =>
        setState({ status: "error", message: errorMessage(cause) }),
      );
  }, [token]);

  return (
    <ResultState title="Verify email" state={state}>
      <a className="pass-primary-link" href="/">
        Continue to sign in
      </a>
    </ResultState>
  );
}

function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      setState({ status: "error", message: "Reset token is missing." });
      return;
    }
    setState({ status: "loading" });
    try {
      await api("/api/password/reset", { token, password });
      setState({
        status: "success",
        message: "Password updated. All previous sessions were revoked.",
      });
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  return (
    <AuthForm
      title="Choose a new password"
      description="This change signs your account out everywhere."
      onSubmit={submit}
      state={state}
      submitLabel="Update password"
    >
      <Field
        label="New password"
        hint="Use at least 12 characters."
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        value={password}
        onChange={setPassword}
      />
      {state.status === "success" && (
        <a className="pass-primary-link" href="/">
          Return to sign in
        </a>
      )}
    </AuthForm>
  );
}

function Account({
  user,
  onSignedOut,
}: {
  user: Identity;
  onSignedOut: () => void;
}) {
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function perform(path: string) {
    setState({ status: "loading" });
    try {
      await api(path, {});
      onSignedOut();
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  return (
    <section className="pass-account">
      <p className="pass-section-label">Signed in</p>
      <h2>{user.name || user.email}</h2>
      <dl>
        <div>
          <dt>Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{user.role.toLowerCase()}</dd>
        </div>
      </dl>
      <div className="pass-account-actions">
        <button
          className="pass-primary"
          type="button"
          disabled={state.status === "loading"}
          onClick={() => void perform("/api/logout")}
        >
          Sign out
        </button>
        <button
          className="pass-secondary"
          type="button"
          disabled={state.status === "loading"}
          onClick={() => void perform("/api/sessions/revoke-all")}
        >
          Sign out everywhere
        </button>
      </div>
      <Status state={state} />
    </section>
  );
}

function AuthForm({
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
  children: React.ReactNode;
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

function Field({
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
  React.InputHTMLAttributes<HTMLInputElement>,
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

function SecurityChallenge({ onToken }: { onToken: (token?: string) => void }) {
  if (!turnstileSiteKey) {
    return (
      <p className="pass-dev-note">
        Turnstile is bypassed only in non-production environments.
      </p>
    );
  }

  return (
    <div className="pass-turnstile">
      <Turnstile
        siteKey={turnstileSiteKey}
        onSuccess={(token) => onToken(token)}
        onExpire={() => onToken(undefined)}
        options={{ theme: "dark", size: "flexible" }}
      />
    </div>
  );
}

function Status({ state }: { state: FormState }) {
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

function ResultState({
  title,
  state,
  children,
}: {
  title: string;
  state: FormState;
  children: React.ReactNode;
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

function LoadingState() {
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

async function api<T = { ok: boolean }>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as T & ApiFailure;
  if (!response.ok) {
    throw new Error(data.error?.message || "Request failed.");
  }
  return data;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Request failed.";
}

function startOAuth(provider: "google" | "github") {
  const url = new URL(`/api/oauth/${provider}`, window.location.origin);
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  window.location.assign(url);
}

function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  const messages: Record<string, string> = {
    provider_not_configured: "This provider is not configured yet.",
    oauth_cancelled: "Sign in was cancelled.",
    oauth_state_expired: "The sign-in request expired. Try again.",
    oauth_failed: "The provider could not complete sign in.",
    account_disabled: "This account is disabled.",
  };
  return messages[code] ?? "OAuth sign in failed.";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
