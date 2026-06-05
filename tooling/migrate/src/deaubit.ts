import { integer, referrerHost, sqlValue, stableId, text, type Row } from "./sql.js";

export interface DeauBitInput {
  users: Row[];
  links: Row[];
  clicks: Row[];
  reports: Row[];
}

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface DeauBitResult {
  files: MigrationFile[];
  manifest: {
    users: number;
    userIdMap: Array<{ legacyId: number; email: string; passUserId: string }>;
    links: number;
    clicks: number;
    reports: number;
    protectedLinksDisabled: number;
    analyticsFieldsDropped: string[];
  };
}

export function migrateDeauBit(input: DeauBitInput): DeauBitResult {
  const userIds = new Map<number, string>();
  const linkIds = new Map<number, string>();
  const userIdMap: Array<{
    legacyId: number;
    email: string;
    passUserId: string;
  }> = [];

  const passStatements = input.users.flatMap((row) => {
    const legacyId = requiredInteger(row.id, "DeauBit user id");
    const email = requiredText(row.email, "DeauBit user email").toLowerCase();
    const userId = stableId("deaubit-user", legacyId);
    userIds.set(legacyId, userId);
    userIdMap.push({ legacyId, email, passUserId: userId });
    const identityId = stableId("deaubit-password-identity", legacyId);
    const role = String(row.role).toUpperCase() === "ADMIN" ? "ADMIN" : "USER";
    const createdAt = text(row.created_at) ?? new Date(0).toISOString();

    return [
      `INSERT OR IGNORE INTO users
  (id, email, name, role, email_verified_at, created_at, updated_at)
VALUES
  (${sqlValue(userId)}, ${sqlValue(email)}, ${sqlValue(text(row.name))}, ${sqlValue(role)}, ${sqlValue(text(row.verified_at))}, ${sqlValue(createdAt)}, ${sqlValue(createdAt)});`,
      `INSERT OR IGNORE INTO identities
  (id, user_id, provider, provider_subject, password_hash, created_at, updated_at)
VALUES
  (${sqlValue(identityId)}, ${sqlValue(userId)}, 'password', ${sqlValue(email)}, NULL, ${sqlValue(createdAt)}, ${sqlValue(createdAt)});`,
    ];
  });

  let protectedLinksDisabled = 0;
  const linkStatements = input.links.map((row) => {
    const legacyId = requiredInteger(row.id, "DeauBit link id");
    const linkId = stableId("deaubit-link", legacyId);
    linkIds.set(legacyId, linkId);
    const legacyUserId = integer(row.user_id);
    const userId = legacyUserId === null ? null : userIds.get(legacyUserId) ?? null;
    const protectedLink = Boolean(text(row.password));
    if (protectedLink) protectedLinksDisabled += 1;
    const createdAt = text(row.created_at) ?? new Date(0).toISOString();

    return `INSERT OR IGNORE INTO links
  (id, user_id, slug, target_url, password_hash, expires_at, disabled_at, created_at, updated_at)
VALUES
  (${sqlValue(linkId)}, ${sqlValue(userId)}, ${sqlValue(requiredText(row.slug, "DeauBit slug"))}, ${sqlValue(requiredText(row.target_url, "DeauBit target URL"))}, ${sqlValue(protectedLink ? "legacy-reset-required" : null)}, ${sqlValue(text(row.expires_at))}, ${sqlValue(protectedLink ? createdAt : null)}, ${sqlValue(createdAt)}, ${sqlValue(createdAt)});`;
  });

  const clickStatements = input.clicks.flatMap((row) => {
    const legacyLinkId = requiredInteger(row.short_link_id, "DeauBit click link id");
    const linkId = linkIds.get(legacyLinkId);
    if (!linkId) return [];
    return [
      `INSERT OR IGNORE INTO clicks
  (id, link_id, country, browser, operating_system, device_type, referrer_host, clicked_at)
VALUES
  (${sqlValue(stableId("deaubit-click", requiredInteger(row.id, "DeauBit click id")))}, ${sqlValue(linkId)}, ${sqlValue(text(row.country))}, ${sqlValue(text(row.browser))}, ${sqlValue(text(row.os))}, ${sqlValue(text(row.device))}, ${sqlValue(referrerHost(row.referrer))}, ${sqlValue(text(row.clicked_at) ?? new Date(0).toISOString())});`,
    ];
  });

  const reportStatements = input.reports.map((row) => {
    const legacyLinkId = integer(row.short_link_id);
    const status = reportStatus(text(row.status));
    return `INSERT OR IGNORE INTO reports
  (id, link_id, reason, details, status, created_at, resolved_at)
VALUES
  (${sqlValue(stableId("deaubit-report", requiredInteger(row.id, "DeauBit report id")))}, ${sqlValue(legacyLinkId === null ? null : linkIds.get(legacyLinkId) ?? null)}, ${sqlValue(requiredText(row.reason, "DeauBit report reason"))}, ${sqlValue(text(row.details))}, ${sqlValue(status)}, ${sqlValue(text(row.created_at) ?? new Date(0).toISOString())}, ${sqlValue(status === "RESOLVED" ? text(row.created_at) : null)});`;
  });

  const counterStatements = [
    `UPDATE links
SET click_count = (SELECT COUNT(*) FROM clicks WHERE clicks.link_id = links.id),
    last_clicked_at = (SELECT MAX(clicked_at) FROM clicks WHERE clicks.link_id = links.id)
WHERE id IN (SELECT DISTINCT link_id FROM clicks);`,
  ];

  return {
    files: [
      sqlFile("001-pass-users.sql", passStatements),
      sqlFile("010-link-records.sql", linkStatements),
      ...chunkFiles("020-link-clicks", clickStatements, 500),
      sqlFile("030-link-reports.sql", reportStatements),
      sqlFile("040-link-counters.sql", counterStatements),
    ],
    manifest: {
      users: input.users.length,
      userIdMap,
      links: input.links.length,
      clicks: clickStatements.length,
      reports: input.reports.length,
      protectedLinksDisabled,
      analyticsFieldsDropped: ["clicks.ip", "clicks.city", "reports.contact"],
    },
  };
}

function reportStatus(value: string | null): "OPEN" | "RESOLVED" | "REJECTED" {
  if (value === "RESOLVED") return "RESOLVED";
  if (value === "IGNORED") return "REJECTED";
  return "OPEN";
}

function requiredText(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`${label} is missing.`);
  return result;
}

function requiredInteger(value: unknown, label: string): number {
  const result = integer(value);
  if (result === null) throw new Error(`${label} is missing.`);
  return result;
}

function sqlFile(name: string, statements: string[]): MigrationFile {
  return {
    name,
    sql: ["PRAGMA foreign_keys = ON;", ...statements, ""].join("\n\n"),
  };
}

function chunkFiles(
  prefix: string,
  statements: string[],
  size: number,
): MigrationFile[] {
  if (statements.length === 0) return [sqlFile(`${prefix}-0001.sql`, [])];
  const files: MigrationFile[] = [];
  for (let index = 0; index < statements.length; index += size) {
    const sequence = String(files.length + 1).padStart(4, "0");
    files.push(sqlFile(`${prefix}-${sequence}.sql`, statements.slice(index, index + size)));
  }
  return files;
}
