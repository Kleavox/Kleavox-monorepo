import { describe, expect, it } from "vitest";

import {
  contentDisposition,
  normalizeContentType,
  sanitizeFileName,
} from "./files";

describe("Drop file metadata", () => {
  it("removes paths and control characters from names", () => {
    expect(sanitizeFileName("../private/report\u0000.pdf")).toBe("report.pdf");
    expect(sanitizeFileName("C:\\users\\notes.txt")).toBe("notes.txt");
  });

  it("builds a safe attachment header", () => {
    const header = contentDisposition('quarterly "report".pdf');
    expect(header).toContain("attachment;");
    expect(header).not.toContain('filename="quarterly "');
    expect(header).toContain("filename*=UTF-8''");
  });

  it("falls back for malformed media types", () => {
    expect(normalizeContentType("image/png")).toBe("image/png");
    expect(normalizeContentType("not a media type")).toBe(
      "application/octet-stream",
    );
  });
});
