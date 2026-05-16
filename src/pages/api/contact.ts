export const prerender = false

import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { Resend } from 'resend'
import { z } from 'zod'

const schema = z.object({
  name:           z.string().min(1).max(100),
  email:          z.string().email(),
  message:        z.string().min(10).max(2000),
  turnstileToken: z.string().min(1),
})

const cfEnv = env as Record<string, string | undefined>

export const POST: APIRoute = async ({ request }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const issues = parsed.error.issues ?? []
    const msg = issues.length > 0
      ? `${issues[0].path.join('.')}: ${issues[0].message}`.replace(/^: /, '')
      : 'Invalid input'
    return new Response(JSON.stringify({ error: msg }), { status: 422 })
  }

  const { name, email, message, turnstileToken } = parsed.data

  // Verify Turnstile
  const turnstileSecret = cfEnv.TURNSTILE_SECRET_KEY
  if (!turnstileSecret) {
    return new Response(JSON.stringify({ error: 'Verification not configured' }), { status: 503 })
  }

  const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      secret:   turnstileSecret,
      response: turnstileToken,
      remoteip: request.headers.get('CF-Connecting-IP') ?? undefined,
    }),
  })

  const { success: verified } = await verifyRes.json() as { success: boolean }
  if (!verified) {
    return new Response(JSON.stringify({ error: 'Bot verification failed. Please try again.' }), { status: 400 })
  }

  // Send email
  const apiKey = cfEnv.RESEND_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Mail service not configured' }), { status: 503 })
  }

  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from:    'Hafidh <port@deau.site>',
    to:      ['port@deau.site'],
    replyTo: email,
    subject: `[deauport] ${name}`,
    text:    `From: ${name} <${email}>\n\n${message}`,
    html: `
      <table style="font-family:monospace;font-size:14px;color:#1a1a1a;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">from</td><td>${name} &lt;<a href="mailto:${email}">${email}</a>&gt;</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">reply-to</td><td><a href="mailto:${email}">${email}</a></td></tr>
      </table>
      <hr style="margin:16px 0;border:none;border-top:1px solid #e5e5e5;" />
      <div style="font-family:sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap;">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />')}</div>
      <hr style="margin:16px 0;border:none;border-top:1px solid #e5e5e5;" />
      <p style="font-size:12px;color:#999;">Reply to this email to respond directly to ${name}.</p>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    return new Response(JSON.stringify({ error: 'Failed to send message' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
