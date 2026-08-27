import { createRoot } from "react-dom/client";
import { StrictMode, useEffect, useMemo, useState } from "react";

import "@kleavox/ui/styles.css";
import { AppHeader, ROOT_ORIGIN, loadNavCounts } from "@kleavox/ui";
import type { NavCounts } from "@kleavox/ui";
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
  const [counts, setCounts] = useState<NavCounts | null>(null);
  const route = window.location.pathname;

  useEffect(() => {
    void loadNavCounts().then(setCounts);
  }, []);

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
    <div className="pass-app">
      <AppHeader product="pass" rootOrigin={ROOT_ORIGIN} counts={counts} />
      <main className="kvx-main pass-layout">
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
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
