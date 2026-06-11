import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (
    !user &&
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/login')
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/admin/login') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/admin'
    return NextResponse.redirect(dashboardUrl)
  }

  if (
    !user &&
    pathname.startsWith('/crew') &&
    !pathname.startsWith('/crew/login')
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/crew/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/crew/login') {
    const crewUrl = request.nextUrl.clone()
    crewUrl.pathname = '/crew/jobs'
    return NextResponse.redirect(crewUrl)
  }

  return supabaseResponse
}
