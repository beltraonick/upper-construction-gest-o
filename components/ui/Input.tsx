import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'h-11 w-full rounded-input bg-surface-elevated border px-4 text-sm text-primary',
            'placeholder:text-tertiary transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60',
            error
              ? 'border-danger/50 focus:ring-danger/30 focus:border-danger/60'
              : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)]',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        {hint && !error && <p className="text-xs text-tertiary">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
