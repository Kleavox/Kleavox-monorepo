interface Env {
  ASSETS: Fetcher;
  CONTACT_RATE_LIMIT: RateLimit;
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CONTACT_EMAIL: string;
  FROM_EMAIL: string;
}

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  turnstileToken?: unknown;
}

interface TurnstileResult {
  success: boolean;
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ service: "portfolio", status: "ok" });
    }
    if (url.pathname === "/api/contact" && request.method === "POST") {
      return contact(request, env);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function contact(request: Request, env: Env): Promise<Response> {
  const ip = request.headers.get("cf-connecting-ip") ?? "anonymous";
  if (!(await env.CONTACT_RATE_LIMIT.limit({ key: ip })).success) {
    return json({ error: "Please wait before sending another message." }, 429);
  }

  const body = await request
    .json<ContactBody>()
    .catch(() => null as ContactBody | null);
  if (!body) return json({ error: "Invalid request." }, 400);

  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const message = text(body.message);
  const token = text(body.turnstileToken);
  if (
    name.length < 1 ||
    name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
    message.length < 10 ||
    message.length > 2000 ||
    !token
  ) {
    return json({ error: "Check the form fields." }, 422);
  }

  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  form.set("remoteip", ip);
  const verification = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  const result = await verification
    .json<TurnstileResult>()
    .catch(() => ({ success: false }));
  if (!verification.ok || !result.success) {
    return json({ error: "Verification failed. Try again." }, 400);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: env.CONTACT_EMAIL,
      reply_to: email,
      subject: `[Zarkiv Port] ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>`,
    }),
  });
  if (!response.ok) {
    return json({ error: "Message delivery failed." }, 502);
  }
  return json({ ok: true }, 200);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(value: object, status: number): Response {
  return Response.json(value, { status });
}
