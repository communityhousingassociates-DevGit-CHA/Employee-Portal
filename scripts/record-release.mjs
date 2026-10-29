// Runs before every build (npm "prebuild"). On a Vercel production build it records the commit being deployed in release_log, which
// feeds the System dashboard's change log. Never fails the build: a missing key, a network error or a duplicate is just skipped.

const sha = process.env.VERCEL_GIT_COMMIT_SHA
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (process.env.VERCEL_ENV !== 'production' || !sha || !url || !key) {
  console.log('[record-release] skipped (not a Vercel production build, or no database key)')
} else {
  try {
    const res = await fetch(`${url}/rest/v1/release_log`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        sha,
        message: process.env.VERCEL_GIT_COMMIT_MESSAGE || '(no message)',
        author: process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN || process.env.VERCEL_GIT_COMMIT_AUTHOR_NAME || null,
        branch: process.env.VERCEL_GIT_COMMIT_REF || null,
        env: 'production',
      }),
    })
    console.log(`[record-release] ${res.ok ? 'recorded' : `not recorded (HTTP ${res.status})`} ${sha.slice(0, 7)}`)
  } catch (e) {
    console.log('[record-release] not recorded:', e instanceof Error ? e.message : e)
  }
}
