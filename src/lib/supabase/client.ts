import { createBrowserClient } from '@supabase/ssr'

// Implicit, not PKCE (the @supabase/ssr default): password reset and invite
// links are opened from email, often on a different device/browser than the
// one that requested them. PKCE requires the code_verifier it stored in that
// *specific* browser's localStorage — implicit tokens ride in the redirect
// URL itself, so the link works wherever it's opened. See set-password/page.tsx,
// which already handles a hash-based session with no further changes needed.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: 'implicit' } }
  )
}
