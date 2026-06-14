export interface AppFooterProps {
  product?: string;
  rootOrigin?: string;
}

export function AppFooter({ product, rootOrigin }: AppFooterProps) {
  return (
    <footer className="kvx-footer">
      <div className="kvx-footer-inner">
        <span className="kvx-footer-wm">
          KLEAV<span>OX</span>
          {product ? <span> / {product}</span> : null}
        </span>
        {rootOrigin ? (
          <div className="kvx-footer-links">
            <a href={`${rootOrigin}/privacy`}>Privacy</a>
            <a href={`${rootOrigin}/terms`}>Terms</a>
          </div>
        ) : null}
        <span className="kvx-footer-copy">
          &copy; {new Date().getFullYear()} Kleavox
        </span>
      </div>
    </footer>
  );
}
