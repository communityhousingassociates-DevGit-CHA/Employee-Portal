import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAccruals } from '@/lib/accruals'

// Daily job (vercel.json). Does nothing until accruals are switched on under Admin Console → Leave Balances, which
// records the first pay period the portal should accrue. Each run credits any period from then through today that
// hasn't been credited yet (accrual_log makes it idempotent), so a missed day never skips a period.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: settings, error } = await admin.from('accrual_settings').select('enabled, first_period_start').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!settings?.enabled || !settings.first_period_start) {
    return NextResponse.json({ ran: false, reason: 'accruals are not switched on' })
  }

  const summary = await runAccruals(admin, settings.first_period_start)
  return NextResponse.json({ ran: true, ...summary })
}
