import type { ReactNode } from "react";

export interface ProductShellProps {
  name: string;
  description: string;
  children?: ReactNode;
}

export function ProductShell({
  name,
  description,
  children,
}: ProductShellProps) {
  return (
    <main className="z-shell">
      <header className="z-header">
        <a className="z-brand" href="https://zarkiv.com">
          Zarkiv
        </a>
        <span className="z-product">{name}</span>
      </header>
      <section className="z-content">
        <p className="z-eyebrow">Zarkiv {name}</p>
        <h1>{description}</h1>
        {children}
      </section>
    </main>
  );
}
