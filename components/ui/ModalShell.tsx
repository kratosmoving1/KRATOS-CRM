'use client'

import { useEffect, type ReactNode } from 'react'
import { X, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  label: string
}

interface ModalShellProps {
  title: string
  subtitle?: string
  steps?: Step[]
  currentStep?: number
  onClose: () => void
  footer: ReactNode
  children: ReactNode
  maxWidth?: string
}

export default function ModalShell({
  title,
  subtitle,
  steps,
  currentStep = 0,
  onClose,
  footer,
  children,
  maxWidth = 'max-w-4xl',
}: ModalShellProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative flex w-full overflow-hidden rounded-2xl shadow-2xl',
          maxWidth,
          'max-h-[90vh]',
        )}
      >
        {/* Left branding column */}
        <div className="hidden w-64 shrink-0 flex-col bg-slate-900 p-6 text-white md:flex">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {subtitle ?? 'CREATE'}
            </p>
            <h2 className="mt-1 text-xl font-bold text-kratos">{title}</h2>
          </div>

          {steps && steps.length > 0 && (
            <div className="flex flex-col gap-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      i < currentStep
                        ? 'bg-kratos text-slate-900'
                        : i === currentStep
                        ? 'border-2 border-kratos text-kratos'
                        : 'border border-slate-600 text-slate-500',
                    )}
                  >
                    {i < currentStep ? '✓' : i + 1}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium transition-colors',
                      i === currentStep ? 'text-white' : i < currentStep ? 'text-kratos' : 'text-slate-500',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto flex justify-center opacity-20">
            <Truck size={64} strokeWidth={1} />
          </div>
        </div>

        {/* Right form column */}
        <div className="flex min-w-0 flex-1 flex-col bg-white">
          {/* Mobile header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 md:hidden">
            <h2 className="font-bold text-slate-900">{title}</h2>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          {/* Desktop close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:block"
          >
            <X size={18} />
          </button>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {children}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            {footer}
          </div>
        </div>
      </div>
    </div>
  )
}
