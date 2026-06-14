import { errorCodeCopy } from "@kleavox/core";

import { AppFooter } from "./app-footer";
import { AppHeader } from "./app-header";

export interface ErrorScreenProps {
  service?: string;
  code?: string;
  title?: string;
  message?: string;
  homeHref?: string;
  homeLabel?: string;
}

export function ErrorScreen({
  service = "Kleavox",
  code,
  title,
  message,
  homeHref = "/",
  homeLabel = "Return to Kleavox",
}: ErrorScreenProps) {
  const fallback = errorCodeCopy(code);
  return (
    <div className="kvx-error">
      <AppHeader rootOrigin={homeHref} />
      <main className="kvx-error-body">
        <small className="kvx-error-kicker">{service}</small>
        {code ? (
          <div className="kvx-error-code" data-code={code}>
            {code}
          </div>
        ) : null}
        <h1 className="kvx-error-title">{title ?? fallback.title}</h1>
        <p className="kvx-error-message">{message ?? fallback.message}</p>
        <a className="kvx-error-action" href={homeHref}>
          {homeLabel} →
        </a>
      </main>
      <AppFooter />
    </div>
  );
}
