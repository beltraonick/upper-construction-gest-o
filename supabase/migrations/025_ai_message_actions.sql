-- Lets an assistant message carry a proposed write action (create task,
-- create change order, etc.) that the admin must explicitly confirm before
-- anything is actually written. See lib/orbit-ai-tools.ts.
-- Shape: { tool: text, args: object, summary: text, status: 'proposed' | 'confirmed' | 'cancelled' }
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS action jsonb;
