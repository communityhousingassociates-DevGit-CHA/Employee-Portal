import { NextRequest, NextResponse } from 'next/server'
import { getCurrentEmployee } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAuditLog, auditCsv, type AuditFilter } from '@/lib/system-dashboard'

export const dynamic = 'force-dynamic'

// CSV of the audit log with the same filters as the System > Audit log tab. Super admin only.
export async function GET(request: NextRequest) {
  const employee = await getCurrentEmployee()
  if (!employee?.is_super_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const p = request.nextUrl.searchParams
  const days = [7, 30, 90, 365].includes(Number(p.get('days'))) ? Number(p.get('days')) : 30
  const type = (['all', 'timesheet', 'leave', 'expense', 'admin'].includes(p.get('type') ?? '') ? p.get('type') : 'all') as AuditFilter['type']
  const items = await loadAuditLog(createAdminClient(), { days, type, exceptionsOnly: p.get('exceptions') === '1', includeTest: p.get('test') === '1' })
  return new NextResponse(auditCsv(items), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="audit-log-${days}d.csv"` } })
}
