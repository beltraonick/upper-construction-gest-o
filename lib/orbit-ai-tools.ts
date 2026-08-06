import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Tool schemas in OpenAI/Groq function-calling format.
// READ tools execute immediately and feed results back to the model.
// WRITE tools never execute automatically — the model proposing one just
// pauses the turn for the admin to explicitly confirm or cancel.
export const READ_TOOL_NAMES = ['list_change_orders', 'list_tasks', 'get_project_detail', 'get_payroll_summary'] as const
export const WRITE_TOOL_NAMES = ['create_task', 'create_change_order', 'mark_task_complete'] as const

export const ORBIT_AI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_change_orders',
      description: 'List change orders / extras with full detail (title, amount, status, project), optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Filter by status. Omit to list all.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'List tasks with full detail (title, status, priority, assignee, project), optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'blocked'], description: 'Filter by status. Omit to list all.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_detail',
      description: 'Get full detail on one project by name: address, progress, status, client, task counts.',
      parameters: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'The project name, or the closest match to what the admin said.' },
        },
        required: ['project_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_payroll_summary',
      description: 'Get recent payroll records with amounts and paid/pending status.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Propose creating a new task on a project. Requires admin confirmation before it is actually created.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Task title.' },
          project_name: { type: 'string', description: 'Which project this task belongs to.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Defaults to medium.' },
          assignee_name: { type: 'string', description: 'Employee full name to assign it to, if mentioned.' },
        },
        required: ['title', 'project_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_change_order',
      description: 'Propose a new change order / extra for a project. Requires admin confirmation before it is actually created. The client still makes the final approval — this only drafts the request.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          project_name: { type: 'string' },
          amount: { type: 'number', description: 'Dollar amount.' },
          description: { type: 'string' },
        },
        required: ['title', 'project_name', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_task_complete',
      description: 'Propose marking a task as completed. Requires admin confirmation before it actually changes.',
      parameters: {
        type: 'object',
        properties: {
          task_title: { type: 'string', description: 'The task title, or the closest match to what the admin said.' },
        },
        required: ['task_title'],
      },
    },
  },
]

async function findProjectByName(supabase: SupabaseClient, companyId: string, name: string) {
  const { data } = await supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', companyId)
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return data
}

async function findEmployeeByName(supabase: SupabaseClient, companyId: string, name: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('company_id', companyId)
    .eq('role', 'employee')
    .ilike('full_name', `%${name}%`)
    .limit(1)
    .maybeSingle()
  return data
}

async function findTaskByTitle(supabase: SupabaseClient, companyId: string, title: string) {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, status')
    .eq('company_id', companyId)
    .neq('status', 'completed')
    .ilike('title', `%${title}%`)
    .limit(1)
    .maybeSingle()
  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeReadTool(name: string, args: any, companyId: string): Promise<string> {
  const supabase = createClient()

  if (name === 'list_change_orders') {
    let query = supabase.from('change_orders').select('title, amount, status, project:project_id(name)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(25)
    if (args?.status) query = query.eq('status', args.status)
    const { data } = await query
    if (!data || data.length === 0) return 'No change orders found.'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((c: any) => `${c.title} — $${Number(c.amount).toLocaleString('en-US')} [${c.status}] (${c.project?.name ?? 'no project'})`).join('\n')
  }

  if (name === 'list_tasks') {
    let query = supabase.from('tasks').select('title, status, priority, assigned_employee:assigned_to(full_name), project:project_id(name)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(25)
    if (args?.status) query = query.eq('status', args.status)
    const { data } = await query
    if (!data || data.length === 0) return 'No tasks found.'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((t: any) => `${t.title} [${t.status}, ${t.priority ?? 'medium'}] → ${t.assigned_employee?.full_name ?? 'unassigned'} (${t.project?.name ?? 'no project'})`).join('\n')
  }

  if (name === 'get_project_detail') {
    const project = await findProjectByName(supabase, companyId, args?.project_name ?? '')
    if (!project) return `No project matching "${args?.project_name}" found.`
    const [{ data: full }, { count: taskCount }, { count: openCount }] = await Promise.all([
      supabase.from('projects').select('name, address, status, progress, client_name, created_at').eq('id', project.id).single(),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', project.id).neq('status', 'completed'),
    ])
    if (!full) return `No project matching "${args?.project_name}" found.`
    return `${full.name} — ${full.status}, ${full.progress ?? 0}% complete. Address: ${full.address ?? 'n/a'}. Client: ${full.client_name ?? 'n/a'}. Tasks: ${taskCount ?? 0} total, ${openCount ?? 0} open. Started ${full.created_at}.`
  }

  if (name === 'get_payroll_summary') {
    const { data } = await supabase.from('payroll_records').select('period_start, period_end, total_amount, status, profile:employee_id(full_name)').eq('company_id', companyId).order('period_start', { ascending: false }).limit(15)
    if (!data || data.length === 0) return 'No payroll records yet.'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((r: any) => `${r.profile?.full_name ?? 'unknown'}: $${Number(r.total_amount).toLocaleString('en-US')} [${r.status}] (${r.period_start} to ${r.period_end})`).join('\n')
  }

  return `Unknown tool: ${name}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildActionSummary(name: string, args: any, companyId: string): Promise<{ summary: string; valid: boolean }> {
  const supabase = createClient()

  if (name === 'create_task') {
    const project = await findProjectByName(supabase, companyId, args?.project_name ?? '')
    if (!project) return { summary: `Create task "${args?.title}" — but no project matching "${args?.project_name}" was found.`, valid: false }
    const assignee = args?.assignee_name ? await findEmployeeByName(supabase, companyId, args.assignee_name) : null
    return {
      summary: `Create task "${args?.title}" in ${project.name}${assignee ? `, assigned to ${assignee.full_name}` : ''}${args?.priority ? ` (priority: ${args.priority})` : ''}.`,
      valid: true,
    }
  }

  if (name === 'create_change_order') {
    const project = await findProjectByName(supabase, companyId, args?.project_name ?? '')
    if (!project) return { summary: `Create extra "${args?.title}" — but no project matching "${args?.project_name}" was found.`, valid: false }
    return {
      summary: `Create extra "${args?.title}" for ${project.name}, $${Number(args?.amount ?? 0).toLocaleString('en-US')}. The client will still need to approve it.`,
      valid: true,
    }
  }

  if (name === 'mark_task_complete') {
    const task = await findTaskByTitle(supabase, companyId, args?.task_title ?? '')
    if (!task) return { summary: `Mark "${args?.task_title}" as complete — but no matching open task was found.`, valid: false }
    return { summary: `Mark "${task.title}" as completed.`, valid: true }
  }

  return { summary: `Unknown action: ${name}`, valid: false }
}

// Only called from the confirm endpoint, once the admin explicitly approves.
export async function executeWriteTool(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
  companyId: string,
  profileId: string | null
): Promise<{ ok: boolean; message: string }> {
  const supabase = createClient()

  if (name === 'create_task') {
    const project = await findProjectByName(supabase, companyId, args?.project_name ?? '')
    if (!project) return { ok: false, message: 'Project not found.' }
    const assignee = args?.assignee_name ? await findEmployeeByName(supabase, companyId, args.assignee_name) : null
    const { error } = await supabase.from('tasks').insert({
      company_id: companyId,
      project_id: project.id,
      title: args.title,
      priority: args.priority ?? 'medium',
      status: 'pending',
      assigned_to: assignee?.id ?? null,
    })
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: `Task "${args.title}" created in ${project.name}.` }
  }

  if (name === 'create_change_order') {
    const project = await findProjectByName(supabase, companyId, args?.project_name ?? '')
    if (!project) return { ok: false, message: 'Project not found.' }
    const { error } = await supabase.from('change_orders').insert({
      company_id: companyId,
      project_id: project.id,
      title: args.title,
      description: args.description ?? null,
      amount: args.amount ?? 0,
      status: 'pending',
      created_by: profileId,
    })
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: `Extra "${args.title}" created for ${project.name} and sent to the client for review.` }
  }

  if (name === 'mark_task_complete') {
    const task = await findTaskByTitle(supabase, companyId, args?.task_title ?? '')
    if (!task) return { ok: false, message: 'Task not found.' }
    const { error } = await supabase.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id)
    if (error) return { ok: false, message: error.message }
    return { ok: true, message: `"${task.title}" marked as completed.` }
  }

  return { ok: false, message: 'Unknown action.' }
}
