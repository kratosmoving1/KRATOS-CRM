'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, LogOut, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Person {
  id: string
  name: string
  profile_picture_url: string | null
  role_data: { label: string } | null
}

export default function CrewSettingsPage() {
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const router = useRouter()

  useEffect(() => {
    fetch('/api/crew/jobs?type=profile')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setPerson(d.person)
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (!newPassword) { setPasswordError('Enter a new password.'); return }
    if (newPassword.length < 8) { setPasswordError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }

    setSavingPassword(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/crew/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-[#ffad33]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-8">
        <div className="rounded-xl bg-red-950 border border-red-800 px-4 py-4 text-sm text-red-300 text-center">
          {error}
        </div>
      </div>
    )
  }

  const initials = person?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 py-4">
        <h1 className="text-base font-bold text-white">Settings</h1>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Profile card — read only */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center shrink-0">
            {person?.profile_picture_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.profile_picture_url} alt={person.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-slate-300">{initials}</span>
            )}
          </div>
          <div>
            <p className="text-white font-semibold text-base">{person?.name}</p>
            {person?.role_data?.label && (
              <p className="text-sm text-slate-400 mt-0.5">{person.role_data.label}</p>
            )}
            <p className="text-[11px] text-slate-600 mt-1">Profile photo managed by admin</p>
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-white">Change Password</p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#ffad33]/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#ffad33]/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {passwordError && (
              <p className="text-xs text-red-400">{passwordError}</p>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 size={13} />
                Password updated successfully.
              </div>
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full flex items-center justify-center gap-2 bg-[#ffad33] text-slate-950 font-semibold py-3 rounded-xl text-sm disabled:opacity-60 transition-opacity"
            >
              {savingPassword ? <Loader2 size={15} className="animate-spin" /> : null}
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 border border-slate-800 text-slate-400 font-medium py-3.5 rounded-2xl text-sm hover:text-white hover:border-slate-600 transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </main>
    </div>
  )
}
