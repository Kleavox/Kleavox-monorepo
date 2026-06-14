import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "@kleavox/ui/styles.css";
import { FilesApp } from "./files";
import { ReportApp } from "./report";
import { WorkspaceApp } from "./workspace";
import "./link.css";

function App() {
  if (
    window.location.pathname.startsWith("/d/") ||
    /^\/f_[a-zA-Z0-9_-]+$/u.test(window.location.pathname)
  ) {
    return <FilesApp />;
  }
  if (window.location.pathname === "/report") {
    return <ReportApp />;
  }

  return <WorkspaceApp />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
