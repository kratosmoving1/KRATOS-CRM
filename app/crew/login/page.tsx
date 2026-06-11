'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function CrewLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) {
      setError(authErr.message)
      setLoading(false)
      return
    }
    router.push('/crew/jobs')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 bg-slate-950">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="Kratos Moving" width={64} height={64} className="rounded-xl" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Kratos Crew</h1>
            <p className="text-sm text-slate-400 mt-1">Sign in to see your jobs</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@kratosmoving.com"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-[#ffad33] focus:outline-none focus:ring-1 focus:ring-[#ffad33] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white placeholder-slate-500 focus:border-[#ffad33] focus:outline-none focus:ring-1 focus:ring-[#ffad33] text-sm"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#ffad33] px-4 py-3.5 text-sm font-bold text-slate-950 hover:bg-[#f0a030] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
        </form>

        <p className="text-center text-xs text-slate-600">
          Kratos Moving Inc. · Crew Portal
        </p>
      </div>
    </div>
  )
}
