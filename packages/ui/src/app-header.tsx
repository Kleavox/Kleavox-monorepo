import type { ReactNode } from "react";

export interface AppHeaderProps {
  product?: string;
  rootOrigin?: string;
  children?: ReactNode;
}

export function AppHeader({
  product,
  rootOrigin = "/",
  children,
}: AppHeaderProps) {
  return (
    <header className="kvx-header">
      <a className="kvx-brand" href={rootOrigin}>
        KLEAV<span>OX</span>
        {product ? <span> / {product}</span> : null}
      </a>
      {children}
    </header>
  );
}
