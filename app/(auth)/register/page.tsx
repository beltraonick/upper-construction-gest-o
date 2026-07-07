import Link from 'next/link'
import { RegisterForm } from './RegisterForm'

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center mb-4 shadow-lg shadow-brand/30">
            <svg viewBox="0 0 20 20" fill="white" className="w-7 h-7">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Create Account</h1>
          <p className="text-sm text-secondary mt-1">Join the Upper Construction team</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-card border border-[rgba(255,255,255,0.07)] p-6">
          <RegisterForm />
        </div>

        <p className="text-center text-sm text-secondary mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand hover:text-brand-hover font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
