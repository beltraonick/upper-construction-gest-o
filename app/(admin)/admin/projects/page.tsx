import { Card } from '@/components/ui/Card'

export default function ProjectsPage() {
  return (
    <div className="p-4 md:p-8 max-w-[1400px]">
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">Projects</h1>
        <p className="text-sm text-secondary mt-1">Track all construction projects</p>
      </div>
      <Card className="flex flex-col items-center justify-center py-16 gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-tertiary">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
        <p className="text-sm font-medium text-secondary">Project management coming soon</p>
        <p className="text-xs text-tertiary">Connect Supabase to manage your projects</p>
      </Card>
    </div>
  )
}
