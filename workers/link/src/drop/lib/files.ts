export function sanitizeFileName(value: string): string {
  const cleaned = value
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)!
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .trim();
  return (cleaned || "download").slice(0, 180);
}

export function contentDisposition(fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const ascii = safeName
    .replace(/[^\x20-\x7e]/gu, "_")
    .replaceAll('"', "'")
    .slice(0, 120);
  return `attachment; filename="${ascii || "download"}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}

export function normalizeContentType(value: string | undefined): string {
  const contentType = value?.trim().toLowerCase();
  if (!contentType || contentType.length > 120) {
    return "application/octet-stream";
  }
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;.*)?$/u.test(contentType)) {
    return "application/octet-stream";
  }
  return contentType;
}
