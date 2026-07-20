'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const VERSION = '1.0.0'

const ACCOUNTS = [
  { role: 'Admin', email: 'admin@orbit.test', password: 'Admin123!' },
  { role: 'Employee', email: 'employee@orbit.test', password: 'Employee123!' },
  { role: 'Client', email: 'client@orbit.test', password: 'Client123!' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-primary mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [copied, setCopied] = useState('')

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    })
  }

  const orbitAiKey = process.env.NEXT_PUBLIC_HAS_AI === '1'

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Settings</h1>
        <p className="text-sm text-secondary mt-1">Platform configuration and accounts</p>
      </div>

      {/* Platform info */}
      <Section title="Platform">
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">OrbitOps</p>
                <p className="text-xs text-secondary">Construction team management</p>
              </div>
              <Badge variant="green">v{VERSION}</Badge>
            </div>
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">Supabase</span>
                <Badge variant="green">Connected</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">PWA / Offline</span>
                <Badge variant="green">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">OrbitOps AI</span>
                <Badge variant={orbitAiKey ? 'green' : 'amber'}>
                  {orbitAiKey ? 'Active' : 'Add ANTHROPIC_API_KEY'}
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </Section>

      {/* OrbitOps AI setup */}
      <Section title="OrbitOps AI">
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'radial-gradient(circle at 35% 35%, #1c1c1e, #0a0a0a)', boxShadow: '0 0 12px rgba(193,18,31,0.3)' }}>
              <svg width="20" height="20" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="12.5" fill="none" stroke="rgba(193,18,31,0.5)" strokeWidth="1" />
                <circle cx="14" cy="14" r="8.5" fill="none" stroke="rgba(193,18,31,0.75)" strokeWidth="1.25" />
                <circle cx="14" cy="14" r="4.5" fill="none" stroke="rgba(193,18,31,1)" strokeWidth="1.5" />
                <circle cx="14" cy="14" r="1.5" fill="rgba(193,18,31,0.9)" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">OrbitOps AI Business Copilot</p>
              <p className="text-xs text-secondary mt-0.5">Ask about projects, workforce, tasks and payroll in natural language.</p>
            </div>
          </div>
          <div className="bg-surface-elevated rounded-input p-3 space-y-1">
            <p className="text-xs font-medium text-secondary">To enable OrbitOps AI:</p>
            <p className="text-xs text-secondary">1. Get an API key from <span className="text-brand">console.anthropic.com</span></p>
            <p className="text-xs text-secondary">2. Add <code className="text-amber">ANTHROPIC_API_KEY</code> to your Vercel environment variables</p>
            <p className="text-xs text-secondary">3. Redeploy — the OrbitOps AI sphere will activate automatically</p>
          </div>
        </Card>
      </Section>

      {/* Test accounts */}
      <Section title="Test Accounts">
        <Card padding="none">
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {ACCOUNTS.map(a => (
              <div key={a.role} className="px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-primary">{a.role}</p>
                  </div>
                  <p className="text-xs font-mono text-secondary mt-0.5">{a.email}</p>
                  <p className="text-xs font-mono text-tertiary">{a.password}</p>
                </div>
                <button
                  onClick={() => copy(`${a.email}\n${a.password}`, a.role)}
                  className="text-xs px-2.5 py-1.5 rounded-button bg-surface-elevated text-secondary hover:text-primary transition-colors border border-[rgba(255,255,255,0.07)]"
                >
                  {copied === a.role ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Company settings (coming in next release) */}
      <Section title="Company Settings">
        <Card>
          <div className="space-y-4">
            <Input
              label="Company Name"
              defaultValue="Upper Construction"
              disabled
            />
            <Input
              label="Default Hourly Rate ($)"
              type="number"
              defaultValue="25"
              disabled
            />
            <div className="pt-1">
              <Button disabled variant="secondary">
                Save Changes (coming soon)
              </Button>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  )
}
