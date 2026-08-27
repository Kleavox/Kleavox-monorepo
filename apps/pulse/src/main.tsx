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
  loadNavCounts,
  signInUrl,
} from "@kleavox/ui";
import type { NavCounts } from "@kleavox/ui";
import "./pulse.css";
import { Dashboard, EnrollmentDialog, SectionNav } from "./dashboard";
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
    return <ErrorScreen code="503" message={state.message} />;
  }

  return (
    <div className="pulse-app">
      <Header state={state} />
      <main className="kvx-main">
        {state.status === "loading" && <Loading />}
        {state.status === "guest" && <Guest />}
        {state.status === "ready" && (
          <>
            <SectionNav />
            <Dashboard
              identity={state.identity}
              overview={state.overview}
              onRefresh={refreshOverview}
              onEnrollment={setEnrollment}
            />
          </>
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
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    void loadNavCounts().then(setCounts);
  }, []);

  return (
    <AppHeader product="PULSE" rootOrigin={ROOT_ORIGIN} counts={counts}>
      <nav className="kvx-nav">
        <a href={PASS_ORIGIN}>
          {state.status === "ready"
            ? displayHandle(state.identity.username, state.identity.email)
            : "Account"}
        </a>
      </nav>
    </AppHeader>
  );
}

function Guest() {
  return (
    <main className="pulse-guest">
      <section>
        <a className="pulse-primary" href={signInUrl()}>
          Sign in
        </a>
      </section>
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
