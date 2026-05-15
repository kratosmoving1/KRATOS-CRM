import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type WelcomeLoadingProps = {
  name?: string | null
  className?: string
  fullScreen?: boolean
}

export default function WelcomeLoading({ name, className = '', fullScreen = false }: WelcomeLoadingProps) {
  const displayName = name?.trim() || 'back'
  const headline = displayName === 'back' ? 'Welcome back.' : `Welcome, ${displayName.split(' ')[0]}.`

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-slate-50',
        fullScreen ? 'min-h-screen' : 'min-h-[60vh]',
        className,
      )}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white px-8 py-9 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-kratos to-transparent" />
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-kratos/20 bg-kratos/10 text-slate-900">
          <Loader2 size={21} className="animate-spin" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{headline}</h1>
        <p className="mt-2 text-sm text-slate-500">Loading your command dashboard...</p>
      </div>
    </div>
  )
}
