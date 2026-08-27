export { useAction } from "@kleavox/ui";

export function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="pulse-action-error" role="alert">
      {message}
    </p>
  );
}

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

export function InlineEmpty({ message }: { message: string }) {
  return <p className="pulse-inline-empty">{message}</p>;
}
