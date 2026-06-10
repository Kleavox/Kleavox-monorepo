import { Turnstile } from "@marsidev/react-turnstile";
import { createRoot } from "react-dom/client";
import { ApiError, apiFetch } from "@kleavox/core";
import type { Identity } from "@kleavox/core";
import {
  type FormEvent,
  type ReactNode,
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "@kleavox/ui/styles.css";
import { ROOT_ORIGIN } from "./config";
import "./pass.css";

type Mode = "login" | "register" | "forgot";

interface SessionResponse {
  authenticated: boolean;
  user?: Identity;
  expiresAt?: string;
}

interface FormState {
  status: "idle" | "loading" | "error" | "success";
  message?: string;
}

interface OAuthProviders {
  google: boolean;
  github: boolean;
}

const turnstileSiteKey =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ||
  (import.meta.env.DEV ? "1x00000000000000000000AA" : undefined);
const returnTo = new URLSearchParams(window.location.search).get("returnTo");

function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [gateKey, setGateKey] = useState(0);
  const [providers, setProviders] = useState<OAuthProviders>({
    google: false,
    github: false,
  });
  const route = window.location.pathname;

  useEffect(() => {
    if (route === "/verify" || route === "/reset" || route === "/challenge")
      return;
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
    if (route === "/challenge") return <ChallengePage />;
    if (session === null) return <LoadingState />;
    if (session.authenticated && session.user) {
      return (
        <Account
          user={session.user}
          onSignedOut={() => setSession({ authenticated: false })}
        />
      );
    }
    const requireChallenge = () => setGateKey((value) => value + 1);
    let authView: ReactNode;
    if (mode === "register") {
      authView = (
        <Register onModeChange={setMode} onChallengeRequired={requireChallenge} />
      );
    } else if (mode === "forgot") {
      authView = (
        <ForgotPassword
          onModeChange={setMode}
          onChallengeRequired={requireChallenge}
        />
      );
    } else {
      authView = (
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
    }
    return <SecurityGate key={gateKey}>{authView}</SecurityGate>;
  }, [gateKey, mode, providers, route, session]);

  return (
    <main className="kvx-shell-wide pass-layout">
      <section className="pass-intro" aria-labelledby="pass-title">
        <a className="pass-wordmark" href={ROOT_ORIGIN}>
          Kleav<b>ox</b> <span>/ Pass</span>
        </a>
        <div className="pass-intro-copy">
          <p className="kvx-kicker">IDENTITY / SHARED SESSION</p>
          <h1 id="pass-title" className="kvx-title">
            One signal.
            <br />
            Every tool.
          </h1>
          <p className="kvx-lede">
            Sign in once to unlock Link, file drops, and Pulse — all under the
            same identity.
          </p>
        </div>
        <div className="pass-orbit" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </section>
      <div className="pass-panel-wrap">
        <section className="pass-panel">
          <div className="pass-panel-head">
            <span>KLEAVOX / PASS</span>
            <b>AUTH / v2.1</b>
          </div>
          <div className="pass-panel-inner">{content}</div>
          <div className="pass-panel-foot">
            <span>Secure · Edge-native</span>
            <span>pass.kleavox.xyz</span>
          </div>
        </section>
      </div>
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

function Register({
  onModeChange,
  onChallengeRequired,
}: {
  onModeChange: (mode: Mode) => void;
  onChallengeRequired: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setState({ status: "error", message: "Passwords do not match." });
      return;
    }
    setState({ status: "loading" });
    try {
      const response = await api<{ message: string }>("/api/register", {
        name,
        email,
        password,
      });
      setState({ status: "success", message: response.message });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "challenge_failed") {
        onChallengeRequired();
        return;
      }
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
      <Field
        label="Confirm password"
        name="confirm-password"
        type="password"
        autoComplete="new-password"
        minLength={12}
        value={confirmPassword}
        onChange={setConfirmPassword}
      />
      <p className="pass-switch pass-form-trailing">
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
  onChallengeRequired,
}: {
  onModeChange: (mode: Mode) => void;
  onChallengeRequired: () => void;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const response = await api<{ message: string }>("/api/password/forgot", {
        email,
      });
      setState({ status: "success", message: response.message });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "challenge_failed") {
        onChallengeRequired();
        return;
      }
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
      <button
        className="pass-text-action pass-form-trailing"
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

const PROVIDER_LABELS: Record<string, string> = {
  password: "Password",
  google: "Google",
  github: "GitHub",
};

function Account({
  user,
  onSignedOut,
}: {
  user: Identity;
  onSignedOut: () => void;
}) {
  const [identity, setIdentity] = useState(user);
  const [providers, setProviders] = useState<string[]>();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user.name ?? "");
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  useEffect(() => {
    void api<{ user: Identity; providers: string[] }>("/api/account")
      .then((account) => {
        setIdentity(account.user);
        setNameInput(account.user.name ?? "");
        setProviders(account.providers);
      })
      .catch(() => {});
  }, []);

  async function perform(path: string) {
    setState({ status: "loading" });
    try {
      await api(path, {});
      onSignedOut();
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const result = await apiFetch<{ ok: true; user: Identity }>(
        "/api/account",
        { method: "PATCH", body: JSON.stringify({ name: nameInput }) },
      );
      setIdentity(result.user);
      setEditing(false);
      setState({ status: "success", message: "Name updated." });
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (passwordInput !== confirmInput) {
      setState({ status: "error", message: "Passwords do not match." });
      return;
    }
    setState({ status: "loading" });
    try {
      await api("/api/account/password", { password: passwordInput });
      setProviders((current) =>
        current && !current.includes("password")
          ? [...current, "password"]
          : current,
      );
      setSettingPassword(false);
      setPasswordInput("");
      setConfirmInput("");
      setState({
        status: "success",
        message: "Password set. You can now sign in with it.",
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === "challenge_failed") {
        const url = new URL("/challenge", window.location.origin);
        url.searchParams.set("scope", "fresh");
        url.searchParams.set("returnTo", window.location.href);
        window.location.assign(url);
        return;
      }
      setState({ status: "error", message: errorMessage(cause) });
    }
  }

  return (
    <section className="pass-account">
      <p className="pass-section-label">Signed in</p>
      {editing ? (
        <form className="pass-name-edit" onSubmit={saveName}>
          <Field
            label="Name"
            name="name"
            autoComplete="name"
            maxLength={80}
            value={nameInput}
            onChange={setNameInput}
          />
          <div className="pass-name-edit-actions">
            <button
              className="pass-primary"
              type="submit"
              disabled={state.status === "loading" || !nameInput.trim()}
            >
              Save
            </button>
            <button
              className="pass-text-action"
              type="button"
              onClick={() => {
                setEditing(false);
                setNameInput(identity.name ?? "");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="pass-name-row">
          <h2>{identity.name || identity.email}</h2>
          <button
            className="pass-text-action"
            type="button"
            onClick={() => {
              setState({ status: "idle" });
              setEditing(true);
            }}
          >
            Edit name
          </button>
        </div>
      )}
      <dl>
        <div>
          <dt>Email</dt>
          <dd>{identity.email}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{identity.role.toLowerCase()}</dd>
        </div>
        <div>
          <dt>Sign-in methods</dt>
          <dd>
            {providers ? (
              <span className="pass-providers">
                {providers.map((provider) => (
                  <span key={provider}>
                    {PROVIDER_LABELS[provider] ?? provider}
                  </span>
                ))}
              </span>
            ) : (
              "..."
            )}
          </dd>
        </div>
      </dl>
      {providers && !providers.includes("password") && !settingPassword && (
        <button
          className="pass-text-action"
          type="button"
          onClick={() => {
            setState({ status: "idle" });
            setSettingPassword(true);
          }}
        >
          Set a password for this account
        </button>
      )}
      {settingPassword && (
        <form className="pass-name-edit" onSubmit={savePassword}>
          <Field
            label="New password"
            hint="Use at least 12 characters."
            name="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={passwordInput}
            onChange={setPasswordInput}
          />
          <Field
            label="Confirm password"
            name="confirm-new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={confirmInput}
            onChange={setConfirmInput}
          />
          <div className="pass-name-edit-actions">
            <button
              className="pass-primary"
              type="submit"
              disabled={state.status === "loading" || !passwordInput}
            >
              Set password
            </button>
            <button
              className="pass-text-action"
              type="button"
              onClick={() => {
                setSettingPassword(false);
                setPasswordInput("");
                setConfirmInput("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
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
          className="pass-text-action"
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

function SecurityGate({
  scope = "fresh",
  returnTo = null,
  skipStatusCheck = false,
  onComplete,
  children = null,
}: {
  scope?: "basic" | "fresh";
  returnTo?: string | null;
  skipStatusCheck?: boolean;
  onComplete?: (target: string) => void;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState<
    "checking" | "challenge" | "verified" | "error"
  >("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const submitted = useRef(false);

  async function submitToken(token: string) {
    const response = await api<{ ok: true; returnTo: string }>(
      "/api/challenge",
      { token, scope, returnTo: returnTo ?? undefined },
    );
    if (onComplete) {
      onComplete(response.returnTo);
      return;
    }
    setStatus("verified");
  }

  async function onToken(token?: string) {
    if (!token || submitted.current) return;
    submitted.current = true;
    try {
      await submitToken(token);
    } catch (cause) {
      submitted.current = false;
      setMessage(errorMessage(cause));
      setStatus("error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    setMessage(null);
    submitted.current = false;
    void (async () => {
      try {
        if (!skipStatusCheck) {
          const current = await api<{ verified: boolean }>(
            `/api/challenge/status?scope=${scope}`,
          );
          if (cancelled) return;
          if (current.verified) {
            setStatus("verified");
            return;
          }
        }
        if (turnstileSiteKey) {
          if (!cancelled) setStatus("challenge");
          return;
        }
        await submitToken("dev-fallback");
      } catch {
        if (cancelled) return;
        setMessage(
          turnstileSiteKey
            ? "Security check could not start. Try again."
            : "Security verification is unavailable in this environment.",
        );
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (status === "verified") return <>{children}</>;

  return (
    <section className="pass-result" aria-label="Security check">
      <p className="pass-section-label">Kleavox Pass</p>
      <h2>Just a moment</h2>
      {status === "error" ? (
        <>
          <p className="pass-status pass-status-error" role="alert">
            {message}
          </p>
          <button
            className="pass-text-action"
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
        </>
      ) : (
        <div className="pass-loading-lines" aria-label="Verifying">
          <span />
          <span />
        </div>
      )}
      {status === "challenge" && turnstileSiteKey && (
        <div className="pass-turnstile pass-turnstile-invisible">
          <Turnstile
            key={attempt}
            siteKey={turnstileSiteKey}
            onSuccess={onToken}
            onExpire={() => {
              submitted.current = false;
            }}
            options={{ size: "invisible", appearance: "interaction-only" }}
          />
        </div>
      )}
    </section>
  );
}

function ChallengePage() {
  const params = new URLSearchParams(window.location.search);
  const scope: "basic" | "fresh" =
    params.get("scope") === "fresh" ? "fresh" : "basic";

  return (
    <SecurityGate
      scope={scope}
      returnTo={params.get("returnTo")}
      skipStatusCheck
      onComplete={(target) => window.location.assign(target)}
    />
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
  return apiFetch<T>(path, {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
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
