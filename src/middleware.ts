import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEMO_MODE_ENABLED } from '@/lib/demo-mode'

const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host
  } catch {
    return ''
  }
})()

/**
 * A nonce-based 'strict-dynamic' script-src (Next.js's documented pattern)
 * was tried here first and verified end-to-end in a real browser — it broke
 * the app. This Next.js version (16.2.9) doesn't attach the nonce to either
 * its own inline RSC flight-data scripts (`self.__next_f.push(...)`, 6 of
 * them on a plain /login render) or its <script src> chunk tags, so
 * 'strict-dynamic' (which makes browsers ignore 'self' entirely for
 * script-src) blocked everything — zero hydration, no click handlers, no
 * Supabase auth calls firing. 'self' 'unsafe-inline' is what actually works
 * with how this app is rendered today: 'self' covers the external chunk
 * tags, 'unsafe-inline' covers the inline flight-data scripts. It's weaker
 * against inline-script injection than a working nonce setup, but it's an
 * honest reflection of what this Next.js version needs, not a broken policy
 * that happens to "look" stricter on paper.
 */
function buildCsp() {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:${SUPABASE_HOST ? ` https://${SUPABASE_HOST}` : ''}`,
    `font-src 'self'`,
    `connect-src 'self'${SUPABASE_HOST ? ` https://${SUPABASE_HOST} wss://${SUPABASE_HOST}` : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join('; ')
}

function securityHeaders(response: NextResponse, csp: string) {
  response.headers.set('Content-Security-Policy', csp)
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

/**
 * Best-effort, single-instance rate limit on state-changing requests (every
 * Server Action POST + /api/*). Login itself isn't covered here — the app
 * calls supabase.auth.signInWithPassword() directly from the browser, so
 * those requests never reach this middleware; Supabase's own Auth rate
 * limits are what protect that path.
 *
 * This in-memory bucket isn't distributed — under Fluid Compute a client
 * can land on a different warm instance and get a fresh bucket, so it's not
 * a hard guarantee. It's still worth having as a first line of defense
 * against basic scripted abuse at this app's traffic volume. If that stops
 * being true, replace this with a shared store (e.g. Upstash Redis via the
 * Vercel Marketplace).
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 60
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(key: string): boolean {
  const now = Date.now()
  const bucket = rateLimitBuckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count++
  return bucket.count > RATE_LIMIT_MAX_REQUESTS
}

export async function middleware(request: NextRequest) {
  const csp = buildCsp()
  const requestHeaders = new Headers(request.headers)

  if (request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    if (isRateLimited(ip)) {
      return securityHeaders(
        NextResponse.json({ error: 'Too many requests — please slow down and try again shortly.' }, { status: 429 }),
        csp
      )
    }
  }
  requestHeaders.set('Content-Security-Policy', csp)

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Public routes — no auth required
  if (pathname.startsWith('/api/demo-login') || pathname.startsWith('/api/demo-logout') || pathname.startsWith('/set-password')) {
    return securityHeaders(supabaseResponse, csp)
  }

  // Demo mode bypass — non-production only, so it can't function in the deployed beta.
  const isDemoMode = DEMO_MODE_ENABLED && process.env.NODE_ENV !== 'production' && request.cookies.get('cha-demo')?.value === 'true'
  if (isDemoMode) {
    if (pathname === '/login') {
      return securityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), csp)
    }
    return securityHeaders(supabaseResponse, csp)
  }

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unreachable — fail open in dev, fail closed in prod
    if (process.env.NODE_ENV === 'production' && !pathname.startsWith('/login')) {
      return securityHeaders(NextResponse.redirect(new URL('/login', request.url)), csp)
    }
  }

  // Redirect unauthenticated users to login
  if (!user && !pathname.startsWith('/login')) {
    return securityHeaders(NextResponse.redirect(new URL('/login', request.url)), csp)
  }

  // Redirect authenticated users away from login
  if (user && pathname === '/login') {
    return securityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), csp)
  }

  return securityHeaders(supabaseResponse, csp)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
