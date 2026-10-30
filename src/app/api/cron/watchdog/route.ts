import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isCronAuthorized } from '@/lib/cron-auth'
import { runWatchdog } from '@/lib/job-watchdog'

// Runs two hours after the daily job (vercel.json) and emails WATCHDOG_ALERT_TO if the daily job left no run record in the last
// WATCHDOG_MAX_AGE_HOURS. Separate from /api/cron/accrual on purpose: it must still work when that route is the thing that broke.
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runWatchdog(createAdminClient())
  return NextResponse.json(result)
}
