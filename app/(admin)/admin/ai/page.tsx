'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "How are today's projects?",
  "Who's clocked in right now?",
  'Show pending tasks',
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

export default function AdminAIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    <div className="p-4 md:p-8 max-w-[900px] mx-auto h-[calc(100dvh-56px)] md:h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 md:pb-6 flex-shrink-0">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'radial-gradient(circle at 35% 35%, #1c1c1e, #0a0a0a)', boxShadow: '0 0 12px rgba(193,18,31,0.3)' }}
        >
          <OrbitSphere active={loading} size={24} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">OrbitOps AI</h1>
          <p className="text-xs text-green flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse inline-block" />
            Business copilot · Admin only
          </p>
        </div>
      </div>

      {/* Chat card */}
      <div className="flex-1 min-h-0 flex flex-col bg-surface border border-[var(--border)] rounded-card overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <p className="text-sm text-secondary mb-4">Ask me anything about your company</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs text-secondary bg-surface-elevated hover:text-primary hover:bg-black/[0.04] px-3 py-2 rounded-full transition-colors border border-[var(--border)]"
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
                    'max-w-[85%] md:max-w-[70%] text-sm rounded-card px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-brand text-white'
                      : 'bg-surface-elevated text-primary border border-[var(--border)]',
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
        <div className="flex gap-2 p-3 md:p-4 border-t border-[var(--border)] flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask OrbitOps AI…"
            disabled={loading}
            className="flex-1 bg-surface-elevated text-sm text-primary placeholder:text-tertiary rounded-input px-4 py-2.5 border border-[var(--border)] focus:border-brand/50 outline-none transition-colors disabled:opacity-60"
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-button bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
