import Link from 'next/link'
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.png" alt="OrbitOps" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-primary tracking-tight">OrbitOps</h1>
          <p className="text-sm text-secondary mt-1">Workforce Management</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-card border border-[rgba(255,255,255,0.07)] p-6">
          <LoginForm />
        </div>

        <p className="text-center text-sm text-secondary mt-6">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="text-brand hover:text-brand-hover font-medium transition-colors"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
