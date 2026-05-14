'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Browser-safe client: only use NEXT_PUBLIC_* values here.
  // Never use SUPABASE_SERVICE_ROLE_KEY in this file.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
