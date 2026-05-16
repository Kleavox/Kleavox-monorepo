import { useState } from 'react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function Contact() {
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('loading')
    setError('')

    const form = e.currentTarget
    const data = {
      name:    (form.elements.namedItem('name')    as HTMLInputElement).value,
      email:   (form.elements.namedItem('email')   as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? 'Something went wrong')
      }

      setState('success')
      form.reset()
    } catch (err) {
      setState('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
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

  return (
    <div>
      {state === 'success' ? (
        <div
          style={{
            padding: '24px',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span
              style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--green)', display: 'inline-block',
                boxShadow: '0 0 8px var(--green)',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--green)' }}>
              message sent
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Thanks — I'll get back to you within 24 hours on weekdays.
          </p>
          <button
            onClick={() => setState('idle')}
            style={{
              marginTop: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            send another →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label
                htmlFor="name"
                style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.06em' }}
              >
                name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Your name"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.06em' }}
              >
                email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="your@email.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor="message"
              style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.06em' }}
            >
              message
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              placeholder="What's on your mind?"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent-dim)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          {state === 'error' && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: '#f87171',
                marginBottom: '12px',
              }}
            >
              ✗ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'loading'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              padding: '10px 24px',
              background: state === 'loading' ? 'var(--accent-dim)' : 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              borderRadius: '4px',
              cursor: state === 'loading' ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {state === 'loading' ? 'sending...' : 'send message →'}
          </button>
        </form>
      )}
    </div>
  )
}
