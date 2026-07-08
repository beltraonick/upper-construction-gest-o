import { Card } from '@/components/ui/Card'

export default function TimePage() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Time & Attendance</h1>
        <p className="text-sm text-secondary mt-1">Monitor clock in/out records</p>
      </div>
      <Card className="flex flex-col items-center justify-center py-16 gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-tertiary">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-secondary">Time tracking coming soon</p>
        <p className="text-xs text-tertiary">Connect Supabase to see attendance records</p>
      </Card>
    </div>
  )
}
