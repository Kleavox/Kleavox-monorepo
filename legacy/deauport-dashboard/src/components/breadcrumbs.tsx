"use client";
import Link from "next/link";

export function Breadcrumbs({
  items,
  className = "",
  onLastClick,
}: {
  items: Array<{ label: string; href?: string }>;
  className?: string;
  onLastClick?: () => void;
}) {
  return (
    <nav className={`text-sm text-subtle ${className}`}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {isLast && onLastClick ? (
                <button
                  type="button"
                  onClick={onLastClick}
                  className="rounded-md px-1.5 py-0.5 text-muted hover:underline hover:bg-[color-mix(in_srgb,var(--surface-2)_80%,white_20%)]"
                  title={`Create in ${it.label}`}
                >
                  {it.label}
                </button>
              ) : it.href ? (
                <Link href={it.href} className="hover:underline">
                  {it.label}
                </Link>
              ) : (
                <span className="text-muted">{it.label}</span>
              )}
              {i < items.length - 1 ? <span className="opacity-50">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}