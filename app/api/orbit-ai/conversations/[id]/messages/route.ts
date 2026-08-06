import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { buildCompanyContext, buildSystemPrompt, streamGroqChat, type ChatMessage } from '@/lib/orbit-ai'

async function loadConversation(companyId: string, conversationId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('company_id', companyId)
    .maybeSingle()
  return data
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const conversation = await loadConversation(user.company_id as string, params.id)
  if (!conversation) return new Response('Not found', { status: 404 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('ai_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ messages: data ?? [] })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const companyId = user.company_id as string
  const conversation = await loadConversation(companyId, params.id)
  if (!conversation) return new Response('Not found', { status: 404 })

  if (!process.env.GROQ_API_KEY) {
    return new Response(
      'OrbitOps AI requires a GROQ_API_KEY environment variable. Add it to your Vercel project settings.',
      { status: 200 }
    )
  }

  const { content }: { content: string } = await req.json()
  if (!content?.trim()) return new Response('Message is required.', { status: 400 })

  const supabase = createClient()

  // Load prior history, then append the new user message.
  const { data: history } = await supabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true })

  const messages: ChatMessage[] = [...(history ?? []), { role: 'user', content: content.trim() }]

  const { data: savedUserMessage } = await supabase
    .from('ai_messages')
    .insert({ conversation_id: params.id, role: 'user', content: content.trim() })
    .select('id')
    .single()

  // First message in the conversation — auto-title it from the question.
  if (!history || history.length === 0) {
    const title = content.trim().slice(0, 60)
    await supabase.from('ai_conversations').update({ title, updated_at: new Date().toISOString() }).eq('id', params.id)
  } else {
    await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', params.id)
  }

  const context = await buildCompanyContext(companyId)
  const systemPrompt = buildSystemPrompt(context)
  const result = await streamGroqChat(systemPrompt, messages)

  if ('error' in result) {
    return Response.json({ error: result.error, userMessageId: savedUserMessage?.id }, { status: result.status })
  }

  // Forward chunks to the client while accumulating the full text, then
  // persist the assistant's complete reply once the stream ends.
  const decoder = new TextDecoder()
  const reader = result.stream.getReader()
  let fullText = ''

  const relay = new ReadableStream<Uint8Array>({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        controller.enqueue(value)
      }
      controller.close()
      if (fullText.trim()) {
        await supabase.from('ai_messages').insert({ conversation_id: params.id, role: 'assistant', content: fullText })
      }
    },
  })

  return new Response(relay, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
