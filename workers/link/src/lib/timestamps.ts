export function isoTimestamp(value: string): string;
export function isoTimestamp(value: string | null): string | null;
export function isoTimestamp(value: string | null): string | null {
  if (!value) return value;
  if (/[Zz]$/.test(value) || /[+-]\d{2}:?\d{2}$/.test(value)) return value;
  const separated = value.includes("T") ? value : value.replace(" ", "T");
  return `${separated}Z`;
}
