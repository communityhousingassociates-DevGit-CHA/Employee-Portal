'use server'

import { UserError } from '@/lib/user-error'
import { denyReasonProblem } from '@/lib/deny-reason'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { notifyApprovers, notifyEmployee } from '@/lib/notifications'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/constants/expense-categories'
import { fmtDate } from '@/lib/format-date'
import { RECEIPT_REQUIRED_OVER, receiptRequired, descriptionRequired } from '@/lib/constants/expense-policy'
import { resolveActor, resolveSubjectId } from '@/lib/on-behalf'
import { logExpenseEvent, loadExpenseEvents } from '@/lib/expense-events'
import { onBehalfReasonLabel, type OnBehalf } from '@/lib/constants/on-behalf'
import { LEAVE_EXPENSE_APPROVER_ROLES, FINAL_APPROVER_ROLES, canSelfApprove } from '@/lib/constants/approvals'
import { requireDecisionAuthority, assertMayDecide, delegatedFrom, onBehalfSuffix, announceDelegatedDecision, type DecisionAuthority } from '@/lib/approval-authority'
import { getTestAccountIds } from '@/lib/test-accounts'
import type { ExpenseCategory, Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

export async function getMyExpenses(forEmployeeId?: string) {
  const subjectId = await resolveSubjectId(forEmployeeId)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .select('*, submitter:employees!expenses_submitted_by_fkey(name)')
    .eq('employee_id', subjectId)
    .order('expense_date', { ascending: false })
  if (error) throw new Error(error.message)
  const eventsByExpense = await loadExpenseEvents(admin, (data ?? []).map(e => e.id))
  return (data ?? []).map(e => {
    const submitter = e.submitter as unknown as { name: string } | { name: string }[] | null
    return { ...e, submitted_by_name: (Array.isArray(submitter) ? submitter[0]?.name : submitter?.name) ?? null, events: eventsByExpense.get(e.id) ?? [] }
  })
}

export async function getExpensesForPeriod(employeeId: string, periodStart: string, periodEnd: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new UserError('Forbidden')
  if (employee.id !== employeeId && !MANAGER_ROLES.includes(employee.role)) throw new UserError('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('expense_date', periodStart)
    .lte('expense_date', periodEnd)
    .order('expense_date')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function submitExpense(data: {
  category: ExpenseCategory
  expense_date: string
  description: string
  miles?: number
  amount?: number
  receipt_path?: string | null
}, forEmployee?: { employeeId: string; onBehalf: OnBehalf }) {
  const admin = createAdminClient()
  // `forEmployee` = a named administrator entering this for someone else (an exception, with a reason code and notes). Validated here.
  const { actor, subject: employee, onBehalf } = await resolveActor(admin, { employeeId: forEmployee?.employeeId, onBehalf: forEmployee?.onBehalf })

  let amount: number
  let rate_per_mile: number | null = null
  let miles: number | null = null

  if (descriptionRequired(data.category) && !data.description?.trim()) throw new UserError('Mileage needs a description — say where you drove and the business purpose.')

  if (data.category === 'mileage') {
    if (!data.miles || data.miles <= 0) throw new UserError('Miles must be greater than 0')
    const year = Number(data.expense_date.slice(0, 4))
    const { data: rateRow, error: rateError } = await admin
      .from('mileage_rates')
      .select('rate_per_mile')
      .eq('year', year)
      .maybeSingle()
    if (rateError) throw new Error(rateError.message)
    if (!rateRow) throw new UserError(`No mileage rate set for ${year} yet — ask an admin/accounting manager to set it on the Mileage Rate page first`)
    miles = data.miles
    rate_per_mile = rateRow.rate_per_mile
    amount = Math.round(miles * rateRow.rate_per_mile * 100) / 100
  } else {
    if (!data.amount || data.amount <= 0) throw new UserError('Amount must be greater than 0')
    amount = data.amount
    if (receiptRequired(data.category, amount) && !data.receipt_path) throw new UserError(`A receipt is required for expenses over $${RECEIPT_REQUIRED_OVER}.`)
  }

  const { data: created, error } = await admin.from('expenses').insert({
    employee_id: employee.id,
    category: data.category,
    expense_date: data.expense_date,
    description: data.description || null,
    miles,
    rate_per_mile,
    amount,
    receipt_url: data.receipt_path || null,
    status: 'pending',
    submitted_by: onBehalf ? actor.id : null,
    on_behalf_reason_code: onBehalf?.reasonCode ?? null,
    on_behalf_note: onBehalf?.note ?? null,
  }).select('id').single()
  if (error) throw new Error(error.message)
  await logExpenseEvent(admin, onBehalf
    ? { expenseId: created.id, action: 'submitted_on_behalf', actor, reasonCode: onBehalf.reasonCode, note: onBehalf.note }
    : { expenseId: created.id, action: 'submitted', actor: employee })

  const label = EXPENSE_CATEGORY_LABELS[data.category] ?? data.category
  const summary = `${label}${miles ? ` (${miles} mi)` : ''} · $${amount.toFixed(2)} · ${fmtDate(data.expense_date)}${data.description ? `\n${data.description}` : ''}`
  if (onBehalf) {
    await notifyEmployee(admin, employee.id, {
      kind: 'on_behalf',
      title: `${actor.name} entered an expense on your behalf`,
      body: `${summary}\nReason: ${onBehalfReasonLabel(onBehalf.reasonCode)}\nNotes: ${onBehalf.note}`,
      link: '/expenses',
      cta: 'View My Expenses',
    })
  }
  await notifyApprovers(admin, employee.id, FINAL_APPROVER_ROLES, {
    title: `Expense from ${employee.name}${onBehalf ? ' — entered on their behalf' : ''}`,
    body: `${summary}${onBehalf ? `\nException: entered by ${actor.name} for the employee. Reason: ${onBehalfReasonLabel(onBehalf.reasonCode)} — ${onBehalf.note}` : ''}`,
  })

  revalidatePath('/expenses')
}

export async function getReceiptUploadUrl(fileName: string, forEmployeeId?: string) {
  const subjectId = await resolveSubjectId(forEmployeeId)
  const admin = createAdminClient()
  const ext = fileName.split('.').pop()
  const path = `${subjectId}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await admin.storage.from('receipts').createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return { signedUrl: data.signedUrl, path, token: data.token }
}

export async function getReceiptViewUrl(expenseId: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new UserError('Forbidden')
  const admin = createAdminClient()
  const { data: expense, error: fetchError } = await admin.from('expenses').select('employee_id, receipt_url').eq('id', expenseId).single()
  if (fetchError) throw new Error(fetchError.message)
  if (!expense.receipt_url) return null
  if (expense.employee_id !== employee.id && !MANAGER_ROLES.includes(employee.role)) throw new UserError('Forbidden')
  const { data, error } = await admin.storage.from('receipts').createSignedUrl(expense.receipt_url, 60 * 10)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function getPendingExpenseApprovals() {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  let query = admin
    .from('expenses')
    .select('*, employee:employees!expenses_employee_id_fkey(name, avatar_url), submitter:employees!expenses_submitted_by_fkey(name)')
    .eq('status', 'pending')
  // Your own expense only shows in your queue if you're allowed to approve it yourself; otherwise it routes to another approver.
  if (!canSelfApprove(actor)) query = query.neq('employee_id', actor.id).or(`submitted_by.is.null,submitted_by.neq.${actor.id}`) // …nor one you entered on someone's behalf
  // Test-account submissions stay out of real approvers' queues — unless the approver is themselves testing.
  // Test-account items stay out of real approvers' queues — unless the approver is a test account themselves.
  const testIds = await getTestAccountIds(admin)
  if (!actor.is_test_account && testIds.size) query = query.not('employee_id', 'in', `(${[...testIds].join(',')})`)
  const { data, error } = await query.order('expense_date')
  if (error) throw new Error(error.message)
  const eventsByExpense = await loadExpenseEvents(admin, (data ?? []).map(e => e.id))
  return (data ?? []).map(e => {
    const submitter = e.submitter as unknown as { name: string } | { name: string }[] | null
    return { ...e, submitted_by_name: (Array.isArray(submitter) ? submitter[0]?.name : submitter?.name) ?? null, events: eventsByExpense.get(e.id) ?? [] }
  })
}

async function getPendingExpense(admin: ReturnType<typeof createAdminClient>, id: string, authority: DecisionAuthority) {
  const { data, error } = await admin.from('expenses').select('status, employee_id, category, amount, expense_date, submitted_by').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (data.status !== 'pending') throw new UserError('This expense has already been decided')
  const overrideUsed = await assertMayDecide(admin, authority, data, 'expense')
  return { ...data, overrideUsed }
}

function expenseSummary(e: { category: string; amount: number | string; expense_date: string }) {
  return `${EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category} · $${Number(e.amount).toFixed(2)} · ${fmtDate(e.expense_date)}`
}

export async function approveExpense(id: string) {
  const authority = await requireDecisionAuthority()
  const actor = authority.actor
  const admin = createAdminClient()
  const expense = await getPendingExpense(admin, id, authority)
  const { error } = await admin.from('expenses').update({
    delegated_from: delegatedFrom(authority),
    status: 'approved',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  await logExpenseEvent(admin, { expenseId: id, action: 'approved', actor })

  await notifyEmployee(admin, expense.employee_id, {
    kind: 'approved',
    title: 'Your expense was approved',
    body: `${expenseSummary(expense)}\nApproved by ${actor.name}${onBehalfSuffix(authority, expense.overrideUsed)}.`,
    link: '/expenses',
    cta: 'View My Expenses',
  })
  await announceDelegatedDecision(admin, authority, `Approved expense: ${expenseSummary(expense)}`, expense.overrideUsed)

  revalidatePath('/approvals')
  revalidatePath('/expenses')
}

export async function denyExpense(id: string, reason: string) {
  const authority = await requireDecisionAuthority()
  const actor = authority.actor
  const reasonProblem = denyReasonProblem(reason)
  if (reasonProblem) throw new UserError(reasonProblem)
  const admin = createAdminClient()
  const expense = await getPendingExpense(admin, id, authority)
  const { error } = await admin.from('expenses').update({
    delegated_from: delegatedFrom(authority),
    status: 'denied',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    deny_reason: reason.trim(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  await logExpenseEvent(admin, { expenseId: id, action: 'denied', actor, note: reason.trim() })

  await notifyEmployee(admin, expense.employee_id, {
    kind: 'denied',
    title: 'Your expense was denied',
    body: `${expenseSummary(expense)}\nDenied by ${actor.name}${onBehalfSuffix(authority, expense.overrideUsed)}.\nReason: ${reason.trim()}`,
    link: '/expenses',
    cta: 'View My Expenses',
  })
  await announceDelegatedDecision(admin, authority, `Denied expense: ${expenseSummary(expense)}`, expense.overrideUsed)

  revalidatePath('/approvals')
  revalidatePath('/expenses')
}
