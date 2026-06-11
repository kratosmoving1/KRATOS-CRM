'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function CrewAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function handleCallback() {
      const url = new URL(window.location.href)

      // Detect error in hash immediately (e.g. otp_expired, access_denied)
      const hashParams = new URLSearchParams(url.hash.replace('#', ''))
      const hashError = hashParams.get('error_code') || hashParams.get('error')
      if (hashError) {
        if (hashError === 'otp_expired') {
          setError('This invite link has expired. Ask your manager to resend the invite — links are valid for 1 hour.')
        } else {
          setError(`Invite link error: ${hashParams.get('error_description') || hashError}. Ask your manager to resend.`)
        }
        return
      }

      // PKCE flow — Supabase sends ?code=xxx
      const code = url.searchParams.get('code')
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeErr) { setError(exchangeErr.message); return }
        router.replace('/crew/jobs')
        return
      }

      // Hash-based flow — createBrowserClient auto-detects #access_token=xxx
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/crew/jobs')
        return
      }

      // Wait for async auth state change
      let settled = false
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (settled) return
        if (session) {
          settled = true
          subscription.unsubscribe()
          router.replace('/crew/jobs')
        } else if (event === 'SIGNED_OUT') {
          settled = true
          subscription.unsubscribe()
          setError('Invite link expired or already used. Ask your manager to resend.')
        }
      })

      setTimeout(() => {
        if (settled) return
        settled = true
        subscription.unsubscribe()
        setError('Could not verify your invite link. It may have expired — ask your manager to resend it.')
      }, 12000)
    }

    handleCallback()
  }, [router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 bg-slate-950">
        <div className="text-center space-y-4 max-w-sm w-full">
          <p className="text-sm font-semibold text-white">Link expired</p>
          <p className="text-sm text-red-400">{error}</p>
          <a
            href="/crew/login"
            className="inline-block mt-2 text-sm text-[#ffad33] underline underline-offset-2"
          >
            Go to login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#ffad33]" />
        <p className="text-sm text-slate-400">Setting up your account…</p>
      </div>
    </div>
  )
}
