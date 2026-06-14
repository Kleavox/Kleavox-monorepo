import type { CSSProperties } from "react";

export function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong className={danger ? "pulse-danger" : ""}>{value}</strong>
    </div>
  );
}

export function Resource({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  const normalized = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <span>{label}</span>
      <strong>
        {value === null
          ? "--"
          : `${value.toFixed(value >= 10 ? 0 : 1)}${suffix}`}
      </strong>
      <i style={{ "--resource": `${normalized}%` } as CSSProperties} />
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="pulse-section-title">
      <p className="pulse-kicker">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

export function InlineEmpty({ message }: { message: string }) {
  return <p className="pulse-inline-empty">{message}</p>;
}
