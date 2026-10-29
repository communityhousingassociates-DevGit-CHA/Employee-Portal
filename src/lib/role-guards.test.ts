import { describe, it, expect } from 'vitest'
import { canManageAccount, roleChangeProblem, emailChangeProblem, hasPayrollEmail } from './role-guards'

const superAdmin = { id: 's', role: 'admin' as const, is_super_admin: true }
const ceo = { id: 'c', role: 'ceo' as const, is_super_admin: false }
const admin = { id: 'a', role: 'admin' as const, is_super_admin: false }
const employee = { id: 'e', role: 'employee', email: 'someone@example.org', is_super_admin: false }

describe('canManageAccount', () => {
  it('lets anyone in the admin tier manage an ordinary employee', () => {
    expect(canManageAccount(admin, employee)).toBe(true)
    expect(canManageAccount(ceo, employee)).toBe(true)
  })
  it('keeps a plain admin away from the CEO, other admins and payroll users', () => {
    expect(canManageAccount(admin, { id: 'x', role: 'ceo', email: 'x@example.org' })).toBe(false)
    expect(canManageAccount(admin, { id: 'y', role: 'admin', email: 'y@example.org' })).toBe(false)
    expect(canManageAccount(admin, { id: 'z', role: 'accounting_manager', email: 'cedwards@communityhousingmd.org' })).toBe(false)
  })
  it('lets the CEO manage admins and payroll users', () => {
    expect(canManageAccount(ceo, { id: 'y', role: 'admin', email: 'y@example.org' })).toBe(true)
    expect(canManageAccount(ceo, { id: 'z', role: 'accounting_manager', email: 'cedwards@communityhousingmd.org' })).toBe(true)
  })
  it('protects super admins from everyone but another super admin, even the CEO', () => {
    const sa = { id: 'sa', role: 'admin', email: 'a@b.c', is_super_admin: true }
    expect(canManageAccount(ceo, sa)).toBe(false)
    expect(canManageAccount(admin, sa)).toBe(false)
    expect(canManageAccount(superAdmin, sa)).toBe(true)
  })
})

describe('roleChangeProblem', () => {
  it('rejects roles that do not exist', () => {
    expect(roleChangeProblem(superAdmin, employee, 'root')).not.toBeNull()
    expect(roleChangeProblem(ceo, employee, '')).not.toBeNull()
  })
  it('allows a no-op', () => {
    expect(roleChangeProblem(admin, employee, 'employee')).toBeNull()
  })
  it('lets an admin set ordinary roles but not grant admin or CEO', () => {
    expect(roleChangeProblem(admin, employee, 'accounting_manager')).toBeNull()
    expect(roleChangeProblem(admin, employee, 'ceo')).not.toBeNull()
    expect(roleChangeProblem(admin, employee, 'admin')).not.toBeNull()
  })
  it('stops an admin demoting another admin or the CEO', () => {
    expect(roleChangeProblem(admin, { id: 'y', role: 'admin' }, 'employee')).not.toBeNull()
    expect(roleChangeProblem(admin, { id: 'c2', role: 'ceo' }, 'employee')).not.toBeNull()
  })
  it('lets the CEO grant and remove admin access', () => {
    expect(roleChangeProblem(ceo, employee, 'admin')).toBeNull()
    expect(roleChangeProblem(ceo, { id: 'y', role: 'admin' }, 'employee')).toBeNull()
  })
  it('never lets a non-super-admin change their own role', () => {
    expect(roleChangeProblem(admin, { id: 'a', role: 'admin' }, 'ceo')).not.toBeNull()
    expect(roleChangeProblem(ceo, { id: 'c', role: 'ceo' }, 'employee')).not.toBeNull()
  })
  it('protects a super admin’s role', () => {
    expect(roleChangeProblem(ceo, { id: 'sa', role: 'admin', is_super_admin: true }, 'employee')).not.toBeNull()
    expect(roleChangeProblem(superAdmin, { id: 'sa2', role: 'admin', is_super_admin: true }, 'employee')).toBeNull()
  })
})

describe('emailChangeProblem', () => {
  it('allows a no-op and ordinary changes', () => {
    expect(emailChangeProblem(admin, employee, 'someone@example.org')).toBeNull()
    expect(emailChangeProblem(admin, employee, 'new@example.org')).toBeNull()
  })
  it('stops an admin moving a payroll email onto another account', () => {
    expect(emailChangeProblem(admin, employee, 'CEdwards@CommunityHousingMD.org')).not.toBeNull()
  })
  it('stops an admin changing away a payroll user’s email', () => {
    expect(emailChangeProblem(admin, { id: 'z', role: 'accounting_manager', email: 'cedwards@communityhousingmd.org' }, 'other@example.org')).not.toBeNull()
  })
  it('lets a super admin do either', () => {
    expect(emailChangeProblem(superAdmin, employee, 'cedwards@communityhousingmd.org')).toBeNull()
  })
  it('matches payroll emails case-insensitively', () => {
    expect(hasPayrollEmail('NSANDERS@communityhousingmd.org')).toBe(true)
    expect(hasPayrollEmail(null)).toBe(false)
  })
})
