import { LINK_ORIGIN, PASS_ORIGIN, ROOT_ORIGIN, signInUrl } from "@kleavox/ui";

export function Header({ accountLabel }: { accountLabel?: string }) {
  return (
    <header className="drop-header">
      <a className="drop-brand" href={LINK_ORIGIN}>
        Kleavox <span>Link</span>
      </a>
      <nav>
        <a href={LINK_ORIGIN}>Create</a>
        <a href={`${LINK_ORIGIN}/report`}>Report</a>
        {accountLabel ? (
          <a href={PASS_ORIGIN}>{accountLabel}</a>
        ) : (
          <a href={signInUrl(LINK_ORIGIN)}>Sign in</a>
        )}
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="drop-footer">
      <p>Kleavox Link removes temporary files when their limits end.</p>
      <div>
        <a href={`${ROOT_ORIGIN}/privacy`}>Privacy</a>
        <a href={`${ROOT_ORIGIN}/terms`}>Terms</a>
      </div>
    </footer>
  );
}
