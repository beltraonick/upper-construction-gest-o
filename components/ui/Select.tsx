import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={[
            'h-11 w-full rounded-input bg-surface-elevated border px-4 text-sm text-primary appearance-none cursor-pointer',
            'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/60',
            error
              ? 'border-danger/50 focus:ring-danger/30 focus:border-danger/60'
              : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.14)]',
            className,
          ].join(' ')}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
