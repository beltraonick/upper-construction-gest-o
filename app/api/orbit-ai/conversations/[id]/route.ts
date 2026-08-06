import { getCurrentUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', params.id)
    .eq('company_id', user.company_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
