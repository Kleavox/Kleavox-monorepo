import type { Env } from "../env";

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export async function sendVerificationEmail(
  env: Env,
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const url = new URL("/verify", env.PUBLIC_ORIGIN);
  url.searchParams.set("token", token);

  await sendEmail(env, {
    to: email,
    subject: "Verify your Kleavox account",
    html: accountEmail(
      "Verify your account",
      `Hi ${escapeHtml(name)}, confirm this email address to activate Kleavox Pass.`,
      "Verify email",
      url.toString(),
      "This link expires in 30 minutes.",
    ),
  });
}

export async function sendPasswordResetEmail(
  env: Env,
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const url = new URL("/reset", env.PUBLIC_ORIGIN);
  url.searchParams.set("token", token);

  await sendEmail(env, {
    to: email,
    subject: "Reset your Kleavox password",
    html: accountEmail(
      "Reset your password",
      `Hi ${escapeHtml(name)}, use this link to choose a new Kleavox Pass password.`,
      "Reset password",
      url.toString(),
      "This link expires in 15 minutes. Ignore this email if you did not request it.",
    ),
  });
}

async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (env.ENVIRONMENT === "production") {
      throw new Error("RESEND_API_KEY is required in production");
    }
    console.log("[pass email]", message);
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
      subject: message.subject,
      html: message.html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected email with status ${response.status}`);
  }
}

function accountEmail(
  title: string,
  intro: string,
  action: string,
  url: string,
  note: string,
): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3f1ea;color:#161713;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px">
      <p style="font-weight:700">Kleavox Pass</p>
      <h1 style="font-size:32px;line-height:1.1">${escapeHtml(title)}</h1>
      <p style="line-height:1.7;color:#56574f">${intro}</p>
      <p style="margin:32px 0">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#161713;color:#fff;padding:13px 18px;text-decoration:none;border-radius:4px">${escapeHtml(action)}</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#77786f">${escapeHtml(note)}</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
