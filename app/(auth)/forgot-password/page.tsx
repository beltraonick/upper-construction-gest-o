import Link from 'next/link'
import { ForgotPasswordForm } from './ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="OrbitOps" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-primary tracking-tight">Reset Password</h1>
          <p className="text-sm text-secondary mt-1">We&apos;ll send you a link to reset your password</p>
        </div>

        <div className="bg-surface rounded-card border border-[rgba(255,255,255,0.07)] p-6">
          <ForgotPasswordForm />
        </div>

        <p className="text-center text-sm text-secondary mt-6">
          <Link href="/login" className="text-brand hover:text-brand-hover font-medium transition-colors inline-flex items-center gap-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
