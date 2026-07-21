import Link from 'next/link'
import { ActivateForm } from './ActivateForm'

export default function ActivatePage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token ?? ''

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-danger">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-primary mb-2">Invalid Link</h1>
          <p className="text-sm text-secondary mb-6">This activation link is missing or invalid. Please use the link from your invitation email.</p>
          <Link href="/login" className="text-sm text-brand hover:text-brand-hover font-medium transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="OrbitOps" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-primary tracking-tight">Activate Account</h1>
          <p className="text-sm text-secondary mt-1">Set a password to access your client portal</p>
        </div>

        <div className="bg-surface rounded-card border border-[rgba(255,255,255,0.07)] p-6">
          <ActivateForm token={token} />
        </div>

        <p className="text-center text-sm text-secondary mt-6">
          Already activated?{' '}
          <Link href="/login" className="text-brand hover:text-brand-hover font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
