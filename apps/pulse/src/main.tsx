import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { apiFetch as api, displayHandle, errorMessage } from "@kleavox/core";

import "@kleavox/ui/styles.css";
import {
  AppFooter,
  AppHeader,
  ErrorScreen,
  PASS_ORIGIN,
  ROOT_ORIGIN,
  signInUrl,
} from "@kleavox/ui";
import "./pulse.css";
import { Dashboard, EnrollmentDialog } from "./dashboard";
import type { AppState, Enrollment, Overview, SessionResponse } from "./types";

function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  const refresh = async () => {
    try {
      const session = await api<SessionResponse>("/api/session");
      if (!session.authenticated || !session.identity) {
        setState({ status: "guest" });
        return;
      }
      if (session.identity.role !== "ADMIN") {
        setState({ status: "restricted" });
        return;
      }
      const overview = await api<Overview>("/api/overview");
      setState({ status: "ready", identity: session.identity, overview });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  const refreshOverview = async () => {
    try {
      const overview = await api<Overview>("/api/overview");
      setState((current) =>
        current.status === "ready" ? { ...current, overview } : current,
      );
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (state.status === "restricted") {
    return <ErrorScreen code="403" />;
  }
  if (state.status === "error") {
    return <ErrorScreen code="503" />;
  }

  return (
    <div className="pulse-app">
      <Header state={state} />
      <main className="kvx-main">
        {state.status === "loading" && <Loading />}
        {state.status === "guest" && <Guest />}
        {state.status === "ready" && (
          <Dashboard
            identity={state.identity}
            overview={state.overview}
            onRefresh={refreshOverview}
            onEnrollment={setEnrollment}
          />
        )}
      </main>
      {state.status === "guest" && <GuestFooter />}
      {enrollment && (
        <EnrollmentDialog
          enrollment={enrollment}
          onClose={() => setEnrollment(null)}
        />
      )}
    </div>
  );
}

function Header({ state }: { state: AppState }) {
  return (
    <AppHeader product="PULSE" rootOrigin={ROOT_ORIGIN}>
      <a href={PASS_ORIGIN} className="kvx-nav">
        {state.status === "ready"
          ? displayHandle(state.identity.username, state.identity.email)
          : "Account"}
      </a>
    </AppHeader>
  );
}

function Guest() {
  return (
    <main className="pulse-guest">
      <section>
        <p className="pulse-kicker">Kleavox Pulse / Go agent</p>
        <h1>
          Your VPS,
          <br />
          in one signal.
        </h1>
        <p>Host metrics. Service checks. Incident history.</p>
        <a className="pulse-primary" href={signInUrl()}>
          Sign in
        </a>
      </section>
      <div className="pulse-guest-panel" aria-hidden="true">
        <header>
          <span />
          <b>node / production-01</b>
          <em>online</em>
        </header>
        <div className="pulse-guest-metrics">
          <strong>
            18<i>% CPU</i>
          </strong>
          <strong>
            42<i>% MEM</i>
          </strong>
          <strong>
            61<i>% DISK</i>
          </strong>
        </div>
        <svg viewBox="0 0 600 150">
          <path d="M0 112L50 100L100 106L150 64L200 77L250 42L300 58L350 35L400 75L450 58L500 87L550 52L600 69" />
        </svg>
      </div>
    </main>
  );
}

function GuestFooter() {
  return <AppFooter product="PULSE" rootOrigin={ROOT_ORIGIN} />;
}

function Loading() {
  return (
    <main className="pulse-loading" aria-label="Loading Pulse">
      <div />
      <div />
      <div />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
