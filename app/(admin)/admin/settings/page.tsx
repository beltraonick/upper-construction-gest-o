'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getCompanyInviteCode, regenerateInviteCode } from '@/app/actions/invites'
import { useTranslation } from '@/lib/i18n/LocaleContext'

const VERSION = '1.0.0'

const ACCOUNTS = [
  { roleKey: 'roleAdmin' as const, email: 'admin@orbit.test', password: 'Admin123!' },
  { roleKey: 'employee' as const, email: 'employee@orbit.test', password: 'Employee123!' },
  { roleKey: 'client' as const, email: 'client@orbit.test', password: 'Client123!' },
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
  const { t } = useTranslation()
  const [copied, setCopied] = useState('')
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(true)
  const [inviteRegenerating, setInviteRegenerating] = useState(false)

  useEffect(() => {
    getCompanyInviteCode().then(res => {
      setInviteCode(res.code ?? null)
      setInviteLoading(false)
    })
  }, [])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    })
  }

  async function handleRegenerate() {
    setInviteRegenerating(true)
    const res = await regenerateInviteCode()
    if (res.code) setInviteCode(res.code)
    setInviteRegenerating(false)
  }

  const orbitAiKey = process.env.NEXT_PUBLIC_HAS_AI === '1'

  const roleLabel = (roleKey: 'roleAdmin' | 'employee' | 'client') =>
    roleKey === 'roleAdmin' ? t('admin.settings.roleAdmin') : t(`common.role.${roleKey}`)

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">{t('admin.settings.title')}</h1>
        <p className="text-sm text-secondary mt-1">{t('admin.settings.subtitle')}</p>
      </div>

      {/* Employee Invite Code */}
      <Section title={t('admin.settings.sectionInviteCode')}>
        <Card>
          <div className="space-y-3">
            <p className="text-xs text-secondary">
              {t('admin.settings.inviteCodeHint')}
            </p>
            {inviteLoading ? (
              <div className="h-11 bg-surface-elevated rounded-input animate-pulse" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-11 flex items-center px-4 bg-surface-elevated rounded-input border border-[rgba(255,255,255,0.08)]">
                  <span className="text-base font-mono font-semibold text-primary tracking-widest">
                    {inviteCode ?? '—'}
                  </span>
                </div>
                {inviteCode && (
                  <button
                    onClick={() => copy(inviteCode, 'invite')}
                    className="h-11 px-4 rounded-button bg-surface-elevated border border-[rgba(255,255,255,0.07)] text-xs text-secondary hover:text-primary transition-colors flex-shrink-0"
                  >
                    {copied === 'invite' ? t('admin.settings.copied') : t('admin.settings.copy')}
                  </button>
                )}
              </div>
            )}
            <Button
              variant="secondary"
              onClick={handleRegenerate}
              loading={inviteRegenerating}
              disabled={inviteLoading || inviteRegenerating}
              className="w-full"
            >
              {t('admin.settings.regenerateCode')}
            </Button>
          </div>
        </Card>
      </Section>

      {/* Platform info */}
      <Section title={t('admin.settings.sectionPlatform')}>
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">OrbitOps</p>
                <p className="text-xs text-secondary">{t('admin.settings.constructionTeamManagement')}</p>
              </div>
              <Badge variant="green">v{VERSION}</Badge>
            </div>
            <div className="border-t border-[rgba(255,255,255,0.07)] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">Supabase</span>
                <Badge variant="green">{t('admin.settings.connected')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">{t('admin.settings.pwaOffline')}</span>
                <Badge variant="green">{t('admin.settings.enabled')}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary">OrbitOps AI</span>
                <Badge variant={orbitAiKey ? 'green' : 'amber'}>
                  {orbitAiKey ? t('common.active') : t('admin.settings.addAnthropicKey')}
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
              <p className="text-xs text-secondary mt-0.5">{t('admin.settings.aiDescription')}</p>
            </div>
          </div>
          <div className="bg-surface-elevated rounded-input p-3 space-y-1">
            <p className="text-xs font-medium text-secondary">{t('admin.settings.enableAiTitle')}</p>
            <p className="text-xs text-secondary">1. {t('admin.settings.aiStep1')} <span className="text-brand">console.anthropic.com</span></p>
            <p className="text-xs text-secondary">2. {t('admin.settings.aiStep2Before')} <code className="text-amber">ANTHROPIC_API_KEY</code> {t('admin.settings.aiStep2After')}</p>
            <p className="text-xs text-secondary">3. {t('admin.settings.aiStep3')}</p>
          </div>
        </Card>
      </Section>

      {/* Test accounts */}
      <Section title={t('admin.settings.sectionTestAccounts')}>
        <Card padding="none">
          <div className="divide-y divide-[rgba(255,255,255,0.05)]">
            {ACCOUNTS.map(a => (
              <div key={a.roleKey} className="px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-primary">{roleLabel(a.roleKey)}</p>
                  </div>
                  <p className="text-xs font-mono text-secondary mt-0.5">{a.email}</p>
                  <p className="text-xs font-mono text-tertiary">{a.password}</p>
                </div>
                <button
                  onClick={() => copy(`${a.email}\n${a.password}`, a.roleKey)}
                  className="text-xs px-2.5 py-1.5 rounded-button bg-surface-elevated text-secondary hover:text-primary transition-colors border border-[rgba(255,255,255,0.07)]"
                >
                  {copied === a.roleKey ? t('admin.settings.copied') : t('admin.settings.copy')}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* Company settings (coming in next release) */}
      <Section title={t('admin.settings.sectionCompanySettings')}>
        <Card>
          <div className="space-y-4">
            <Input
              label={t('admin.settings.companyName')}
              defaultValue="Upper Construction"
              disabled
            />
            <Input
              label={t('admin.settings.defaultHourlyRate')}
              type="number"
              defaultValue="25"
              disabled
            />
            <div className="pt-1">
              <Button disabled variant="secondary">
                {t('admin.settings.saveChangesComingSoon')}
              </Button>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  )
}
