// src/components/Contact.tsx

import { useState, useRef } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

type FormState = 'idle' | 'pending-token' | 'loading' | 'success' | 'error'

interface Props {
  siteKey: string
}

export default function Contact({ siteKey }: Props) {
  const [state, setState]   = useState<FormState>('idle')
  const [error, setError]   = useState('')
  const turnstileRef        = useRef<TurnstileInstance>(null)
  const pendingRef          = useRef<{ name: string; email: string; message: string } | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('pending-token')
    setError('')

    const form = e.currentTarget
    pendingRef.current = {
      name:    (form.elements.namedItem('name')    as HTMLInputElement).value,
      email:   (form.elements.namedItem('email')   as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    turnstileRef.current?.reset()
    turnstileRef.current?.execute()
  }

  async function onVerified(token: string) {
    if (state !== 'pending-token' || !pendingRef.current) return
    setState('loading')

    try {
      const res = await fetch('/api/contact', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...pendingRef.current, turnstileToken: token }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Something went wrong')
      }

      setState('success')
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
      turnstileRef.current?.reset()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '10px 12px',
    color: 'var(--text)',
    fontSize: '0.875rem',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  const isLoading = state === 'pending-token' || state === 'loading'

  return (
    <div>
      <Turnstile
        ref={turnstileRef}
        siteKey={siteKey}
        options={{ execution: 'execute', appearance: 'interaction-only' }}
        onSuccess={onVerified}
        onError={() => { setState('error'); setError('Verification failed. Please try again.') }}
        onExpire={() => { if (state === 'pending-token') turnstileRef.current?.execute() }}
      />

      {state === 'success' ? (
        <div style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 8px var(--green)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--green)' }}>message sent</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Thanks. I'll get back to you within 24 hours on weekdays.
          </p>
          <button
            onClick={() => setState('idle')}
            style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            send another →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: '12px', marginBottom: '12px' }}>
            <div>
              <label htmlFor="name" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.06em' }}>name</label>
              <input id="name" name="name" type="text" required placeholder="Your name"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.06em' }}>email</label>
              <input id="email" name="email" type="email" required placeholder="your@email.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="message" style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.06em' }}>message</label>
            <textarea id="message" name="message" required minLength={10} rows={5} placeholder="What's on your mind?"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {state === 'error' && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#f87171', marginBottom: '12px' }}>
              ✗ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600,
              letterSpacing: '0.02em', padding: '10px 24px',
              background: isLoading ? 'var(--accent-dim)' : 'var(--accent)',
              color: 'var(--bg)', border: 'none', borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
            }}
          >
            {state === 'pending-token' ? 'verifying...' : state === 'loading' ? 'sending...' : 'send message →'}
          </button>
        </form>
      )}
    </div>
  )
}
