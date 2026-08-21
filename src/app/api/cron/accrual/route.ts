import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcTier, SICK_RATE_PER_PERIOD, PTO_CARRYOVER_CAP } from '@/lib/constants/accrual'
import { getCurrentPeriod, isPeriodBoundary } from '@/lib/pay-periods'

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (!isPeriodBoundary(today)) {
    return NextResponse.json({ ran: false, reason: 'not a pay period boundary', today })
  }

  const { start: periodStart } = getCurrentPeriod()
  const admin = createAdminClient()

  const { data: employees, error: empError } = await admin
    .from('employees')
    .select('id, hire_date')
    .eq('is_active', true)
  if (empError) return NextResponse.json({ error: empError.message }, { status: 500 })

  const { data: existingLog, error: logError } = await admin
    .from('accrual_log')
    .select('employee_id, accrual_type')
    .eq('period_start', periodStart)
  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  const alreadyAccrued = new Set((existingLog ?? []).map(l => `${l.employee_id}:${l.accrual_type}`))

  let processed = 0
  let skipped = 0
  const errors: string[] = []

  for (const emp of employees ?? []) {
    const ptoKey = `${emp.id}:pto`
    const sickKey = `${emp.id}:sick`
    if (alreadyAccrued.has(ptoKey) && alreadyAccrued.has(sickKey)) {
      skipped++
      continue
    }

    const { ptoRate } = calcTier(emp.hire_date)

    const { data: balance, error: balError } = await admin
      .from('leave_balances')
      .select('pto_hours, sick_hours')
      .eq('employee_id', emp.id)
      .single()
    if (balError || !balance) {
      errors.push(`${emp.id}: no leave_balances row (${balError?.message ?? 'not found'})`)
      continue
    }

    const newPto = Math.min(Number(balance.pto_hours) + ptoRate, PTO_CARRYOVER_CAP)
    const newSick = Number(balance.sick_hours) + SICK_RATE_PER_PERIOD

    const logRows = []
    if (!alreadyAccrued.has(ptoKey)) logRows.push({ employee_id: emp.id, accrual_type: 'pto', hours: ptoRate, period_start: periodStart })
    if (!alreadyAccrued.has(sickKey)) logRows.push({ employee_id: emp.id, accrual_type: 'sick', hours: SICK_RATE_PER_PERIOD, period_start: periodStart })

    const { error: insertError } = await admin.from('accrual_log').insert(logRows)
    if (insertError) {
      errors.push(`${emp.id}: ${insertError.message}`)
      continue
    }

    const { error: updateError } = await admin
      .from('leave_balances')
      .update({ pto_hours: newPto, sick_hours: newSick })
      .eq('employee_id', emp.id)
    if (updateError) {
      errors.push(`${emp.id}: ${updateError.message}`)
      continue
    }

    processed++
  }

  return NextResponse.json({ ran: true, periodStart, processed, skipped, errors })
}
