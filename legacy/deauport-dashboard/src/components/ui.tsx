export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className = "", ...rest } = props;
  return <div className={`card ${className}`} {...rest} />;
}

export function H1(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className={`text-2xl font-semibold tracking-tight ${props.className ?? ""}`}>
      {props.children}
    </h1>
  );
}

export function Subtle(props: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-subtle text-sm ${props.className ?? ""}`}>{props.children}</p>;
}

export function Button({
  variant = "default",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
}) {
  const map: Record<string, string> = {
    default: "btn",
    primary: "btn btn-primary",
    danger: "btn btn-danger",
    ghost: "btn btn-ghost",
  };
  return <button className={`${map[variant]} ${className}`} {...rest} />;
}

export function StatusBadge({ code, message }: { code: number | null | undefined, message?: string }) {
  const label =
    message ??
    (code == null ? "No Resp" :
    code >= 200 && code < 400 ? "OK" :
    code >= 400 && code < 500 ? "Warn" : "Down");

  const cls =
    code == null
      ? "bg-[color-mix(in_srgb,var(--surface-2)_80%,white_20%)] text-muted"
      : code >= 200 && code < 400
      ? "bg-[color-mix(in_srgb,var(--primary)_20%,transparent_80%)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_35%,transparent_65%)]"
      : code >= 400 && code < 500
      ? "bg-[color-mix(in_srgb,var(--warning)_20%,transparent_80%)] text-[var(--warning)] border border-[color-mix(in_srgb,var(--warning)_35%,transparent_65%)]"
      : "bg-[color-mix(in_srgb,var(--danger)_20%,transparent_80%)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_35%,transparent_65%)]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${cls}`}>
      {label}{code && !message ? <span>· {code}</span> : null}
    </span>
  );
}