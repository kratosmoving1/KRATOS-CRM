'use client'

import { Suspense, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Truck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const redirectTo = params.get('redirect') ?? '/admin'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      // Lazy-import so createBrowserClient is never called during SSR
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Invalid email or password. Please try again.')
        return
      }

      router.push(redirectTo)
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
          placeholder="you@kratosmoving.ca"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-kratos focus:bg-white focus:ring-2 focus:ring-kratos/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          'mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-kratos px-4 py-2.5 text-sm font-semibold text-slate-900 transition',
          'hover:bg-kratos-500 focus:outline-none focus:ring-2 focus:ring-kratos/40',
          isPending && 'cursor-not-allowed opacity-70',
        )}
      >
        {isPending && <Loader2 size={16} className="animate-spin" />}
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-kratos shadow-lg shadow-kratos/30">
            <Truck size={22} strokeWidth={2.5} className="text-slate-900" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-kratos">KRATOS CRM</h1>
            <p className="mt-1 text-xs text-slate-500 tracking-wide">Kratos Moving Inc.</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">Sign in to your account</h2>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-slate-100" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Kratos Moving Inc. — Internal use only
        </p>
      </div>
    </div>
  )
}
