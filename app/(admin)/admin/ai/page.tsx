'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n/LocaleContext'

interface Message {
  id?: string
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

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

const SUGGESTIONS_KEY = [
  'admin.aiChat.suggestion1',
  'admin.aiChat.suggestion2',
  'admin.aiChat.suggestion3',
  'admin.aiChat.suggestion4',
]

export default function AdminAIPage() {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [quotaError, setQuotaError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeIdRef = useRef<string | null>(null)

  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const loadConversations = useCallback(async () => {
    const res = await fetch('/api/orbit-ai/conversations')
    if (!res.ok) { setLoadingList(false); return }
    const data = await res.json()
    setConversations(data.conversations ?? [])
    setLoadingList(false)
    return data.conversations as Conversation[]
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id)
    setQuotaError('')
    const res = await fetch(`/api/orbit-ai/conversations/${id}/messages`)
    if (!res.ok) { setMessages([]); return }
    const data = await res.json()
    setMessages((data.messages ?? []).map((m: Message) => ({ id: m.id, role: m.role, content: m.content })))
  }, [])

  useEffect(() => {
    loadConversations().then(list => {
      if (list && list.length > 0) selectConversation(list[0].id)
    })
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function newConversation() {
    setQuotaError('')
    const res = await fetch('/api/orbit-ai/conversations', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setQuotaError(data.error ?? t('admin.aiChat.limitReached'))
      return null
    }
    setConversations(prev => [data.conversation, ...prev])
    setActiveId(data.conversation.id)
    setMessages([])
    return data.conversation.id as string
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    await fetch(`/api/orbit-ai/conversations/${id}`, { method: 'DELETE' })
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeId === id) {
      setActiveId(null)
      setMessages([])
    }
  }

  async function send(question?: string) {
    const q = (question ?? input).trim()
    if (!q || loading) return
    setInput('')
    setQuotaError('')

    let convId = activeIdRef.current
    if (!convId) {
      convId = await newConversation()
      if (!convId) return
    }

    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const res = await fetch(`/api/orbit-ai/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: q }),
      })

      if (!res.ok) {
        const err = await res.text()
        setMessages(m => [...m, { role: 'assistant', content: err || t('admin.aiChat.somethingWrong') }])
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

      loadConversations()
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: t('admin.aiChat.connectionError') }])
    }

    setLoading(false)
  }

  const SUGGESTIONS = SUGGESTIONS_KEY.map(key => t(key))

  return (
    <div className="p-4 md:p-8 max-w-[900px] mx-auto h-[calc(100dvh-56px)] md:h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 flex-shrink-0">
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
            {t('admin.aiChat.subtitle')}
          </p>
        </div>
      </div>

      {/* Conversation list — horizontal scroll of chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={newConversation}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-brand text-white hover:bg-brand-hover transition-colors"
        >
          + {t('admin.aiChat.newChat')}
        </button>
        {!loadingList && conversations.map(c => (
          <button
            key={c.id}
            onClick={() => selectConversation(c.id)}
            className={[
              'flex-shrink-0 flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-medium border transition-colors max-w-[220px]',
              c.id === activeId
                ? 'bg-surface-elevated border-brand/40 text-primary'
                : 'bg-surface border-[var(--border)] text-secondary hover:text-primary',
            ].join(' ')}
          >
            <span className="truncate">{c.title || t('admin.aiChat.untitled')}</span>
            <span
              onClick={e => deleteConversation(c.id, e)}
              className="text-tertiary hover:text-danger flex-shrink-0 cursor-pointer"
              title={t('common.delete')}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {quotaError && (
        <div className="mb-3 bg-amber/5 border border-amber/20 rounded-input px-4 py-3 text-sm text-amber flex-shrink-0">
          {quotaError}
        </div>
      )}

      {/* Chat card */}
      <div className="flex-1 min-h-0 flex flex-col bg-surface border border-[var(--border)] rounded-card overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <p className="text-sm text-secondary mb-4">{t('admin.aiChat.askAnything')}</p>
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
              <div key={m.id ?? i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
            placeholder={t('admin.aiChat.inputPlaceholder')}
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
