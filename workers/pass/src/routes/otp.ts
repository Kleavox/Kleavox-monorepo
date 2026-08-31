import { sendEmail } from "@kleavox/worker";

import { issueOtp } from "../lib/otp";
import { rateLimit } from "../lib/rate-limit";
import {
  apiError,
  clientIp,
  firstIssue,
  otpStartSchema,
  rateLimitError,
  type PassApp,
} from "./shared";

export function registerOtpRoutes(app: PassApp): void {
  app.post("/api/auth/otp/start", async (context) => {
    const body = otpStartSchema.safeParse(await context.req.json());
    if (!body.success) {
      return apiError(context, 400, "invalid_input", firstIssue(body.error));
    }

    const ip = clientIp(context.req.raw);
    const ipLimit = await rateLimit(context.env, "otp-ip", ip, 10, 900);
    const emailLimit = await rateLimit(
      context.env,
      "otp-email",
      body.data.email,
      5,
      900,
    );
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return rateLimitError(
        context,
        Math.max(ipLimit.retryAfter, emailLimit.retryAfter),
      );
    }

    const code = await issueOtp(context.env, body.data.email);
    try {
      await sendEmail(context.env, "[pass otp]", {
        to: body.data.email,
        subject: "Your Kleavox sign-in code",
        html: otpEmail(code),
      });
    } catch (cause) {
      console.error("[pass otp email]", cause);
    }

    return context.json({ ok: true });
  });
}

function otpEmail(code: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3f1ea;color:#161713;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px">
      <p style="font-weight:700">Kleavox Pass</p>
      <h1 style="font-size:32px;line-height:1.1">Your sign-in code</h1>
      <p style="font-size:40px;font-weight:700;letter-spacing:8px">${code}</p>
      <p style="font-size:13px;line-height:1.6;color:#77786f">This code expires in 10 minutes. Ignore this email if you did not request it.</p>
    </div>
  </body>
</html>`;
}
