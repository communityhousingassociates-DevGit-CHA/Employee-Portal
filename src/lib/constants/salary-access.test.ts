import { describe, it, expect } from 'vitest'
import { hasPayrollAccess } from './salary-access'

describe('hasPayrollAccess', () => {
  it('trusts the flag once the column exists, even for an address that used to be on the list', () => {
    expect(hasPayrollAccess({ email: 'cedwards@communityhousingmd.org', has_payroll_access: false })).toBe(false)
    expect(hasPayrollAccess({ email: 'someone@example.org', has_payroll_access: true })).toBe(true)
  })
  it('falls back to the old email list only while the column is absent', () => {
    expect(hasPayrollAccess({ email: 'NSANDERS@communityhousingmd.org' })).toBe(true)
    expect(hasPayrollAccess({ email: 'someone@example.org' })).toBe(false)
  })
  it('always allows a super admin and never an empty user', () => {
    expect(hasPayrollAccess({ email: 'x@example.org', is_super_admin: true, has_payroll_access: false })).toBe(true)
    expect(hasPayrollAccess(null)).toBe(false)
    expect(hasPayrollAccess(undefined)).toBe(false)
  })
})
