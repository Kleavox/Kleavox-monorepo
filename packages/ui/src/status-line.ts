export interface StatusField {
  value: string;
  label: string;
  attention?: boolean;
}

export interface StatusLineModel {
  tool: string;
  fields: StatusField[];
}

export function fieldText(field: StatusField): string {
  return field.label === "" ? field.value : `${field.value} ${field.label}`;
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function statusSentence(model: StatusLineModel): string {
  if (model.fields.length === 0) return model.tool;
  const parts = model.fields.map((field) => fieldText(field));
  return `${model.tool}: ${parts.join(", ")}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatAge(since: string, now: Date = new Date()): string {
  const then = Date.parse(since);
  if (Number.isNaN(then)) return "--";
  const elapsed = now.getTime() - then;
  if (elapsed < 0) return "--";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  return `${Math.floor(elapsed / DAY)}d`;
}
