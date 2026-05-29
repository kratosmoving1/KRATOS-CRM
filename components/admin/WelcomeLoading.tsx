'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

type WelcomeLoadingProps = {
  name?: string | null
  className?: string
  fullScreen?: boolean
}

export default function WelcomeLoading({ name, className = '', fullScreen = false }: WelcomeLoadingProps) {
  const first = name?.trim() ? name.trim().split(' ')[0] : null
  const headline = first ? `Welcome, ${first}` : 'Welcome'

  if (fullScreen) {
    return (
      <div className={cn('flex min-h-screen flex-col items-center justify-center bg-[#0b1220]', className)}>
        <div
          className="flex flex-col items-center gap-6"
          style={{ animation: 'kratosEnter 1.1s cubic-bezier(0.22,1,0.36,1) forwards', opacity: 0 }}
        >
          <div className="relative flex items-center justify-center">
            {/* orange glow behind the mark */}
            <div
              className="absolute rounded-full bg-kratos opacity-20 blur-2xl"
              style={{ width: 120, height: 120 }}
            />
            <Image
              src="/logo.png"
              alt="Kratos"
              width={72}
              height={72}
              className="relative object-contain"
              style={{ filter: 'drop-shadow(0 0 18px rgba(255,173,51,0.45))' }}
              priority
            />
          </div>
          <div
            className="text-center"
            style={{ animation: 'kratosFadeIn 0.7s 0.55s cubic-bezier(0.22,1,0.36,1) forwards', opacity: 0 }}
          >
            <p className="text-xl font-semibold tracking-tight text-white">{headline}</p>
            <p className="mt-1.5 text-sm text-slate-400">Loading your dashboard…</p>
          </div>
        </div>
      </div>
    )
  }

  // Inline variant used while page data loads
  return (
    <div className={cn('flex min-h-[60vh] items-center justify-center', className)}>
      <div
        className="flex flex-col items-center gap-3"
        style={{ animation: 'kratosEnter 0.8s cubic-bezier(0.22,1,0.36,1) forwards', opacity: 0 }}
      >
        <Image
          src="/logo.png"
          alt="Kratos"
          width={38}
          height={38}
          className="object-contain opacity-50"
        />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}
