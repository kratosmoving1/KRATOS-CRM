import { cn } from '@/lib/utils'
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface FieldWrapperProps {
  label: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function FieldWrapper({ label, error, required, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20'
const errorCls = 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  wrapClassName?: string
}

export function Input({ label, error, wrapClassName, className, required, ...props }: InputProps) {
  return (
    <FieldWrapper label={label} error={error} required={required} className={wrapClassName}>
      <input
        className={cn(inputCls, error && errorCls, className)}
        required={required}
        {...props}
      />
    </FieldWrapper>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  wrapClassName?: string
  placeholder?: string
  options: { value: string; label: string }[]
}

export function Select({ label, error, wrapClassName, placeholder, options, required, className, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error} required={required} className={wrapClassName}>
      <select
        className={cn(inputCls, error && errorCls, className)}
        required={required}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldWrapper>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  wrapClassName?: string
}

export function Textarea({ label, error, wrapClassName, required, className, ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error} required={required} className={wrapClassName}>
      <textarea
        rows={3}
        className={cn(inputCls, error && errorCls, 'resize-none', className)}
        required={required}
        {...props}
      />
    </FieldWrapper>
  )
}

interface CheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}

export function Checkbox({ label, checked, onChange, className }: CheckboxProps) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-kratos"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}
