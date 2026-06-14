import { createRoot } from "react-dom/client";
import { StrictMode, useEffect, useMemo, useState } from "react";

import "@kleavox/ui/styles.css";
import { ROOT_ORIGIN } from "@kleavox/ui";
import "./pass.css";
import { Account } from "./account";
import { ForgotPassword, Login, Register } from "./auth-forms";
import { ChallengePage } from "./challenge";
import { LinkOAuth, ResetPassword, VerifyEmail, Welcome } from "./flows";
import { api, returnTo } from "./helpers";
import type { Mode, OAuthProviders, SessionResponse } from "./types";
import { LoadingState } from "./ui";

function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [mode, setMode] = useState<Mode>("login");
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
        if (
          nextSession.authenticated &&
          returnTo &&
          nextSession.user?.username
        ) {
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
    if (route === "/link-oauth") return <LinkOAuth />;
    if (session === null) return <LoadingState />;
    if (session.authenticated && session.user) {
      if (!session.user.username) {
        return (
          <Welcome
            user={session.user}
            onCompleted={(user) => {
              if (returnTo) {
                window.location.assign(returnTo);
                return;
              }
              setSession({ authenticated: true, user });
            }}
          />
        );
      }
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
