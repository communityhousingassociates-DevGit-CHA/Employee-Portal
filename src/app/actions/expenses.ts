'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { getCurrentEmployee, requireRole } from '@/lib/auth/session'
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
  await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expenses')
    .select('*, employee:employees!expenses_employee_id_fkey(name, avatar_url)')
    .eq('status', 'pending')
    .order('expense_date')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function approveExpense(id: string) {
  const actor = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('expenses').update({
    status: 'approved',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/approvals')
}

export async function denyExpense(id: string, reason: string) {
  const actor = await requireRole(MANAGER_ROLES)
  const admin = createAdminClient()
  const { error } = await admin.from('expenses').update({
    status: 'denied',
    approver_id: actor.id,
    approved_at: new Date().toISOString(),
    deny_reason: reason,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/approvals')
}
