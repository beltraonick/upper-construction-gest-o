'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "How are today's projects?",
  "Who's clocked in right now?",
  "Show pending tasks",
  "Summarize this week's work",
]

function OrbitSphere({ active, size = 28 }: { active: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" className={active ? 'orbit-ai-spin' : ''}>
      <circle cx="14" cy="14" r="12.5" fill="none" stroke="rgba(193,18,31,0.5)" strokeWidth="1" />
      <circle cx="14" cy="14" r="8.5" fill="none" stroke="rgba(193,18,31,0.75)" strokeWidth="1.25" />
      <circle cx="14" cy="14" r="4.5" fill="none" stroke="rgba(193,18,31,1)" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="1.5" fill="rgba(193,18,31,0.9)" />
    </svg>
  )
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-4">
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  )
}

export function OrbitAI() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Dashboard has its own embedded OrbitAIHub — no floating button needed there
  if (pathname === '/admin/dashboard') return null

  async function send(question?: string) {
    const q = (question ?? input).trim()
    if (!q || loading) return
    setInput('')

    const next: Message[] = [...messages, { role: 'user', content: q }]
    setMessages(next)
    setLoading(true)

    try {
      const res = await fetch('/api/orbit-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok) {
        const err = await res.text()
        setMessages(m => [...m, { role: 'assistant', content: err || 'Something went wrong.' }])
        setLoading(false)
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let text = ''
      setMessages(m => [...m, { role: 'assistant', content: '' }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: text }])
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }

    setLoading(false)
  }

  return (
    <>
      {/* Floating sphere button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open Orbit AI"
        className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center orbit-ai-btn"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
          right: '16px',
        }}
      >
        <div className={`transition-transform duration-300 ${open ? 'scale-90' : 'hover:scale-110'}`}>
          <OrbitSphere active={open} size={36} />
        </div>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col bg-surface border border-[rgba(255,255,255,0.1)] rounded-card shadow-2xl overflow-hidden orbit-ai-panel"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)',
            right: '12px',
            width: 'min(360px, calc(100vw - 24px))',
            maxHeight: '480px',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(255,255,255,0.07)] flex-shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'radial-gradient(circle at 35% 35%, #1c1c1e, #0a0a0a)', boxShadow: '0 0 12px rgba(193,18,31,0.3)' }}
            >
              <OrbitSphere active={false} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">Orbit AI</p>
              <p className="text-[10px] text-green flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse inline-block" />
                Business copilot
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-button text-tertiary hover:text-primary hover:bg-surface-elevated transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div>
                <p className="text-xs text-secondary text-center mb-3">Ask me anything about your company</p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-xs text-secondary bg-surface-elevated hover:text-primary hover:bg-[rgba(255,255,255,0.05)] px-3 py-2 rounded-button transition-colors border border-[rgba(255,255,255,0.05)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'max-w-[85%] text-xs rounded-card px-3 py-2 leading-relaxed whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-brand text-white'
                        : 'bg-surface-elevated text-primary border border-[rgba(255,255,255,0.05)]',
                    ].join(' ')}
                  >
                    {m.content === '' && loading && i === messages.length - 1
                      ? <TypingDots />
                      : m.content}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 p-3 border-t border-[rgba(255,255,255,0.07)] flex-shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask Orbit AI…"
              disabled={loading}
              className="flex-1 bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-3 py-2 border border-[rgba(255,255,255,0.07)] focus:border-brand/50 outline-none transition-colors disabled:opacity-60"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="px-3 py-2 rounded-button bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40 flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
