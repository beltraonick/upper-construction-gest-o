'use client'

import { useRef, useState, useCallback } from 'react'

interface PhotoPickerProps {
  onFiles: (files: File[]) => void
  multiple?: boolean
  disabled?: boolean
  trigger: (open: () => void) => React.ReactNode
}

export function PhotoPicker({ onFiles, multiple = true, disabled = false, trigger }: PhotoPickerProps) {
  const [open, setOpen] = useState(false)
  const cameraRef  = useRef<HTMLInputElement>(null)
  const libraryRef = useRef<HTMLInputElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onFiles(files)
    e.target.value = ''
    setOpen(false)
  }, [onFiles])

  function pick(ref: React.RefObject<HTMLInputElement>) {
    // Click synchronously BEFORE closing — preserves the user-gesture trust on iOS.
    // A setTimeout (even 0ms) drops the gesture context and the OS blocks the file picker.
    ref.current?.click()
    setOpen(false)
  }

  return (
    <>
      {trigger(() => { if (!disabled) setOpen(true) })}

      {/* Always-mounted hidden inputs so refs survive between sheet open/close */}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" multiple={multiple} className="hidden" onChange={handleChange} />
      <input ref={libraryRef} type="file" accept="image/*"                        multiple={multiple} className="hidden" onChange={handleChange} />
      <input ref={fileRef}    type="file"                                          multiple={multiple} className="hidden" onChange={handleChange} />

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-lg bg-surface rounded-t-[20px] border-t border-l border-r border-[var(--border)] shadow-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Pill */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
            </div>

            <div className="px-4 py-2 space-y-0.5">
              {/* Take Photo */}
              <button
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] hover:bg-surface-elevated active:bg-surface-elevated/70 transition-colors text-left"
                onClick={() => pick(cameraRef)}
              >
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5 text-brand">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Take Photo</p>
                  <p className="text-xs text-secondary">Open camera</p>
                </div>
              </button>

              {/* Photo Library */}
              <button
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] hover:bg-surface-elevated active:bg-surface-elevated/70 transition-colors text-left"
                onClick={() => pick(libraryRef)}
              >
                <div className="w-10 h-10 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5 text-blue">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Photo Library</p>
                  <p className="text-xs text-secondary">Choose from your photos</p>
                </div>
              </button>

              {/* Choose File */}
              <button
                className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] hover:bg-surface-elevated active:bg-surface-elevated/70 transition-colors text-left"
                onClick={() => pick(fileRef)}
              >
                <div className="w-10 h-10 rounded-full bg-green/10 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-5 h-5 text-green">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">Choose File</p>
                  <p className="text-xs text-secondary">Browse files &amp; documents</p>
                </div>
              </button>
            </div>

            {/* Cancel */}
            <div className="px-4 pt-1 pb-2">
              <button
                className="w-full py-3.5 rounded-[14px] bg-surface-elevated text-sm font-semibold text-secondary hover:text-primary active:opacity-70 transition-colors"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
