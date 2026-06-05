import { describe, expect, it } from "vitest";

import { migrateDeauBit } from "./deaubit";
import { migrateDeauBoard } from "./deauboard";
import { referrerHost, rowsFromD1Json, stableId } from "./sql";

describe("D1 export parsing", () => {
  it("accepts Wrangler result envelopes", () => {
    expect(rowsFromD1Json([{ success: true, results: [{ id: 1 }] }])).toEqual([
      { id: 1 },
    ]);
  });

  it("creates stable ids and privacy-safe referrer hosts", () => {
    expect(stableId("user", 1)).toBe(stableId("user", 1));
    expect(referrerHost("https://example.com/private?q=secret")).toBe(
      "example.com",
    );
  });
});

describe("DeauBit migration", () => {
  it("requires password resets and drops identifying analytics fields", () => {
    const result = migrateDeauBit({
      users: [
        {
          id: 7,
          email: "Owner@Example.com",
          name: "Owner",
          role: "ADMIN",
          verified_at: "2025-01-01 00:00:00",
          created_at: "2024-01-01 00:00:00",
        },
      ],
      links: [
        {
          id: 8,
          user_id: 7,
          slug: "legacy",
          target_url: "https://example.com",
          password: "$2a$10$legacy",
          created_at: "2024-01-02 00:00:00",
        },
      ],
      clicks: [
        {
          id: 9,
          short_link_id: 8,
          country: "ID",
          city: "Jakarta",
          ip: "203.0.113.1",
          referrer: "https://ref.example/path",
          clicked_at: "2024-01-03 00:00:00",
        },
      ],
      reports: [],
    });

    const sql = result.files.map((file) => file.sql).join("\n");
    expect(sql).toContain("password_hash, created_at");
    expect(sql).toContain("'legacy-reset-required'");
    expect(sql).toContain("'ref.example'");
    expect(sql).not.toContain("203.0.113.1");
    expect(sql).not.toContain("Jakarta");
    expect(result.manifest.protectedLinksDisabled).toBe(1);
  });
});

describe("DeauBoard migration", () => {
  it("imports disabled nodes and preserves checks", () => {
    const result = migrateDeauBoard({
      ownerUserId: "owner-id",
      projects: [],
      notes: [],
      checks: [
        {
          id: "check-1",
          name: "Homepage",
          url: "https://example.com",
          node_name: "vps-1",
          status: "down",
          response_ms: 420,
        },
      ],
    });

    const sql = result.files.map((file) => file.sql).join("\n");
    expect(sql).toContain("legacy-disabled:");
    expect(sql).toContain("'DOWN'");
    expect(sql).toContain("re-enroll the node");
    expect(result.manifest.nodes).toBe(1);
  });
});
