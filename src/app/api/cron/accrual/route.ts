import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAccruals } from '@/lib/accruals'
import { applyDueLeaveDeductions } from '@/lib/leave-deductions'
import { sendApprovalDigest } from '@/lib/approval-digest'

// Daily job (vercel.json), in two steps:
//  1. Accruals — does nothing until switched on under Admin Console → Leave Balances, which records the first pay
//     period the portal should accrue. Each run credits any period from then through today that hasn't been
//     credited yet (accrual_log makes it idempotent), so a missed day never skips a period.
//  2. Leave deductions — approved leave that was reserved while it was in the future comes off the balance once
//     its start date arrives. Runs regardless of the accrual switch, after accruals so a shortfall isn't overstated.
//  3. Approver digest — a weekday reminder of anything that's been waiting on approval longer than REMINDER_AFTER_DAYS.
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: settings, error } = await admin.from('accrual_settings').select('enabled, first_period_start').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const accruals = settings?.enabled && settings.first_period_start
    ? { ran: true, ...(await runAccruals(admin, settings.first_period_start)) }
    : { ran: false, reason: 'accruals are not switched on' }

  const deductions = await applyDueLeaveDeductions(admin).catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
  const digest = await sendApprovalDigest(admin).catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
  return NextResponse.json({ accruals, deductions, digest })
}
