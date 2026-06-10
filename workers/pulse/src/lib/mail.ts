import { escapeHtml } from "@kleavox/core";
import type { Env } from "../env";

export interface IncidentEmail {
  to: string;
  recipientName: string | null;
  kind: "opened" | "resolved";
  checkName: string;
  nodeName: string;
  summary: string;
  occurredAt: string;
}

export async function sendIncidentEmail(
  env: Env,
  message: IncidentEmail,
): Promise<void> {
  const subject =
    message.kind === "opened"
      ? `[Pulse] ${message.checkName} is down`
      : `[Pulse] ${message.checkName} recovered`;
  const heading =
    message.kind === "opened" ? "Incident opened" : "Incident resolved";
  const greeting = message.recipientName
    ? `Hi ${escapeHtml(message.recipientName)},`
    : "Hi,";

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f3f1ea;color:#161713;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px">
      <p style="font-weight:700">Kleavox Pulse</p>
      <h1 style="font-size:32px;line-height:1.1">${heading}</h1>
      <p style="line-height:1.7;color:#56574f">${greeting} ${escapeHtml(message.summary)}</p>
      <table style="margin:24px 0;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:6px 16px 6px 0;color:#77786f">Node</td><td>${escapeHtml(message.nodeName)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#77786f">Check</td><td>${escapeHtml(message.checkName)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#77786f">Time</td><td>${escapeHtml(message.occurredAt)}</td></tr>
      </table>
      <p style="margin:32px 0">
        <a href="${escapeHtml(env.PUBLIC_ORIGIN)}" style="display:inline-block;background:#161713;color:#fff;padding:13px 18px;text-decoration:none;border-radius:4px">Open Pulse</a>
      </p>
    </div>
  </body>
</html>`;

  if (!env.RESEND_API_KEY) {
    if (env.ENVIRONMENT === "production") {
      throw new Error("RESEND_API_KEY is required in production");
    }
    console.log("[pulse email]", { to: message.to, subject });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: message.to,
      subject,
      html,
    }),
  });
  if (!response.ok) {
    throw new Error(`Resend responded with ${response.status}`);
  }
}
