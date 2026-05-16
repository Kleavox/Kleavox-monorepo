export const prerender = false

import type { APIRoute } from 'astro'
import { Resend } from 'resend'
import { z } from 'zod'

const schema = z.object({
  name:    z.string().min(1).max(100),
  email:   z.string().email(),
  message: z.string().min(10).max(2000),
})

export const POST: APIRoute = async ({ request, locals }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? 'Invalid input'
    return new Response(JSON.stringify({ error: msg }), { status: 422 })
  }

  const { name, email, message } = parsed.data

  // RESEND_API_KEY bound via wrangler.jsonc secret / CF env variable
  const apiKey = (locals.runtime?.env?.RESEND_API_KEY as string | undefined)
    ?? import.meta.env.RESEND_API_KEY

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Mail service not configured' }), { status: 503 })
  }

  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from:    'Deauport Contact <noreply@deauport.id>',
    to:      ['hello@deauport.id'],
    replyTo: email,
    subject: `[deauport.id] Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: `
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
      <hr />
      <p>${message.replace(/\n/g, '<br />')}</p>
    `,
  })

  if (error) {
    console.error('Resend error:', error)
    return new Response(JSON.stringify({ error: 'Failed to send message' }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
