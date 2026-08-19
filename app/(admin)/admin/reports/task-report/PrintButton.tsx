'use client'

export default function PrintButton({ projectName: _projectName }: { projectName: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 100,
      display: 'flex', gap: '8px',
    }}>
      <a
        href="/admin/reports/task-report"
        style={{
          padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          background: 'var(--surface-elevated)', border: '1px solid var(--border)',
          color: 'var(--text-secondary)', textDecoration: 'none', cursor: 'pointer',
        }}
      >
        ← Voltar
      </a>
      <button
        onClick={() => window.print()}
        style={{
          padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          background: '#D61B0E', color: '#fff', border: 'none', cursor: 'pointer',
        }}
      >
        Exportar PDF
      </button>
    </div>
  )
}
