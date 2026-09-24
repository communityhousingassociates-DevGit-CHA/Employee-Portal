'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
import { notifyApprovers, notifyEmployee } from '@/lib/notifications'
import { EXPENSE_CATEGORY_LABELS } from '@/lib/constants/expense-categories'
import { fmtDate } from '@/lib/format-date'
import { LEAVE_EXPENSE_APPROVER_ROLES, canSelfApprove } from '@/lib/constants/approvals'
import type { ExpenseCategory, Role } from '@/types'

const MANAGER_ROLES: Role[] = ['accounting_manager', 'ceo', 'admin']

export async function getMyExpenses() {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .select('*')
    .eq('employee_id', employee.id)
    .order('expense_date', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getExpensesForPeriod(employeeId: string, periodStart: string, periodEnd: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  if (employee.id !== employeeId && !MANAGER_ROLES.includes(employee.role)) throw new Error('Forbidden')
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
}) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()

  let amount: number
  let rate_per_mile: number | null = null
  let miles: number | null = null

  if (data.category === 'mileage') {
    if (!data.miles || data.miles <= 0) throw new Error('Miles must be greater than 0')
    const year = new Date(data.expense_date).getFullYear()
    const { data: rateRow, error: rateError } = await admin
      .from('mileage_rates')
      .select('rate_per_mile')
      .eq('year', year)
      .maybeSingle()
    if (rateError) throw new Error(rateError.message)
    if (!rateRow) throw new Error(`No mileage rate set for ${year} yet — ask an admin/accounting manager to set it on the Mileage Rate page first`)
    miles = data.miles
    rate_per_mile = rateRow.rate_per_mile
    amount = Math.round(miles * rateRow.rate_per_mile * 100) / 100
  } else {
    if (!data.amount || data.amount <= 0) throw new Error('Amount must be greater than 0')
    amount = data.amount
  }

  const { error } = await admin.from('expenses').insert({
    employee_id: employee.id,
    category: data.category,
    expense_date: data.expense_date,
    description: data.description || null,
    miles,
    rate_per_mile,
    amount,
    receipt_url: data.receipt_path || null,
    status: 'pending',
  })
  if (error) throw new Error(error.message)

  const label = EXPENSE_CATEGORY_LABELS[data.category] ?? data.category
  await notifyApprovers(admin, employee.id, LEAVE_EXPENSE_APPROVER_ROLES, {
    title: `Expense from ${employee.name}`,
    body: `${label}${miles ? ` (${miles} mi)` : ''} · $${amount.toFixed(2)} · ${fmtDate(data.expense_date)}${data.description ? `\n${data.description}` : ''}`,
  })

  revalidatePath('/expenses')
}

export async function getReceiptUploadUrl(fileName: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const ext = fileName.split('.').pop()
  const path = `${employee.id}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await admin.storage.from('receipts').createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return { signedUrl: data.signedUrl, path, token: data.token }
}

export async function getReceiptViewUrl(expenseId: string) {
  const employee = await getCurrentEmployee()
  if (!employee) throw new Error('Forbidden')
  const admin = createAdminClient()
  const { data: expense, error: fetchError } = await admin.from('expenses').select('employee_id, receipt_url').eq('id', expenseId).single()
  if (fetchError) throw new Error(fetchError.message)
  if (!expense.receipt_url) return null
  if (expense.employee_id !== employee.id && !MANAGER_ROLES.includes(employee.role)) throw new Error('Forbidden')
  const { data, error } = await admin.storage.from('receipts').createSignedUrl(expense.receipt_url, 60 * 10)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function getPendingExpenseApprovals() {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  let query = admin
    .from('expenses')
    .select('*, employee:employees!expenses_employee_id_fkey(name, avatar_url)')
    .eq('status', 'pending')
  // Your own expense only shows in your queue if you're allowed to approve it yourself; otherwise it routes to another approver.
  if (!canSelfApprove(actor.role)) query = query.neq('employee_id', actor.id)
  const { data, error } = await query.order('expense_date')
  if (error) throw new Error(error.message)
  return data ?? []
}

async function getPendingExpense(admin: ReturnType<typeof createAdminClient>, id: string, actor: { id: string; role: Role }) {
  const { data, error } = await admin.from('expenses').select('status, employee_id, category, amount, expense_date').eq('id', id).single()
  if (error) throw new Error(error.message)
  if (data.status !== 'pending') throw new Error('This expense has already been decided')
  if (data.employee_id === actor.id && !canSelfApprove(actor.role)) throw new Error("You can't decide your own expense — it needs another approver.")
  return data
}

function expenseSummary(e: { category: string; amount: number | string; expense_date: string }) {
  return `${EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category} · $${Number(e.amount).toFixed(2)} · ${fmtDate(e.expense_date)}`
}

export async function approveExpense(id: string) {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  const expense = await getPendingExpense(admin, id, actor)
  const { error } = await admin.from('expenses').update({
    status: 'approved',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, expense.employee_id, {
    kind: 'approved',
    title: 'Your expense was approved',
    body: `${expenseSummary(expense)}\nApproved by ${actor.name}.`,
    link: '/expenses',
    cta: 'View My Expenses',
  })

  revalidatePath('/approvals')
  revalidatePath('/expenses')
}

export async function denyExpense(id: string, reason: string) {
  const actor = await requireRole(LEAVE_EXPENSE_APPROVER_ROLES)
  const admin = createAdminClient()
  const expense = await getPendingExpense(admin, id, actor)
  const { error } = await admin.from('expenses').update({
    status: 'denied',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    deny_reason: reason,
  }).eq('id', id)
  if (error) throw new Error(error.message)

  await notifyEmployee(admin, expense.employee_id, {
    kind: 'denied',
    title: 'Your expense was denied',
    body: `${expenseSummary(expense)}\nDenied by ${actor.name}.${reason ? `\nReason: ${reason}` : ''}`,
    link: '/expenses',
    cta: 'View My Expenses',
  })

  revalidatePath('/approvals')
  revalidatePath('/expenses')
}
