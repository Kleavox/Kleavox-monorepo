export function PageHeader({
  title,
  subtitle,
  actions,
  className = "",
  sticky = true,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <div
      className={`${sticky ? "sticky top-0 z-30" : ""} bg-[color-mix(in_srgb,var(--bg)_92%,transparent)]/90 backdrop-blur supports-[backdrop-filter]:backdrop-blur-lg border-b border-[var(--border)] ${className}`}
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle ? <p className="text-xs text-subtle mt-0.5">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}