export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

export default async function RootPage() {
  // Without env vars the Supabase client crashes — just send to login.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect('/admin/login')
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/admin' : '/admin/login')
}
