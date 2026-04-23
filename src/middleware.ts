import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  // Root redirect to /home
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  // Known valid route prefixes. Note: `/select-company` has been removed from
  // the system — any request to it is redirected to `/dashboard` below.
  const knownRoutes = [
    '/home', '/login',
    '/dashboard', '/fleet', '/history', '/job-cards',
    '/spare-parts', '/forms', '/reserves', '/settings',
    '/notifications', '/admin-dashboard',
  ]
  const isKnownRoute = knownRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))

  // Hard-redirect the legacy `/select-company` page to `/dashboard`.
  // Company-based selection is no longer part of the flow (track-based model).
  if (pathname === '/select-company' || pathname.startsWith('/select-company/')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // Redirect unknown routes to /home
  if (!isKnownRoute) {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  // Public routes that don't need auth
  const publicRoutes = ['/home', '/login']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  try {
    const supabase = createMiddlewareClient({ req, res })

    const {
      data: { session },
    } = await supabase.auth.getSession()

    // If not logged in and trying to access protected route, redirect to /home
    if (!session && !isPublicRoute) {
      return NextResponse.redirect(new URL('/home', req.url))
    }

    // If logged in, check if user is disabled and enforce track-based access
    if (session && !isPublicRoute) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('role, is_disabled, track')
        .eq('user_id', session.user.id)
        .single()

      // Block disabled users
      if (prefs?.is_disabled) {
        await supabase.auth.signOut()
        return NextResponse.redirect(new URL('/home', req.url))
      }

      // Admin dashboard protection (system_admin only)
      if (pathname.startsWith('/admin-dashboard')) {
        if (!prefs || prefs.role !== 'system_admin') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }

      // Misuse Registration protection (supervisor only).
      // Only system_admin + company_manager may access /forms/misuse/**.
      // Normal technicians are redirected back to the /forms hub.
      if (pathname.startsWith('/forms/misuse')) {
        const allowed = prefs?.role === 'system_admin' || prefs?.role === 'company_manager'
        if (!allowed) {
          return NextResponse.redirect(new URL('/forms', req.url))
        }
      }

      // Track-based route guard
      // NOTE: Company-based selection has been removed. A user with no track
      // is treated as having access to everything (null track = see-all).
      if (!pathname.startsWith('/admin-dashboard') && prefs?.role !== 'system_admin') {
        const { pathToSection, getAccess } = await import('@/lib/tracks/accessMatrix')
        const section = pathToSection(pathname)
        if (section) {
          const access = getAccess((prefs?.track as any) ?? null, section)
          if (access === 'none') {
            return NextResponse.redirect(new URL('/dashboard', req.url))
          }
        }
      }
    }
  } catch (e: any) {
    // Handle "Lock was stolen by another request" and other auth errors
    const isLockError = e?.message?.includes('Lock was stolen') || e?.name === 'AbortError'
    
    if (isLockError) {
      // Lock errors are transient - let the request proceed
      console.warn('[Middleware] Session lock conflict, allowing request:', pathname)
      return res
    }
    
    // For other errors on protected routes, redirect to home
    if (!isPublicRoute) {
      console.error('[Middleware] Auth error:', e?.message)
      return NextResponse.redirect(new URL('/home', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images|api).*)',
  ],
}
