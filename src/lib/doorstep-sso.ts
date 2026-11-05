import { createHmac } from 'node:crypto'
import type { Employee } from '@/types'

/**
 * Single sign-on into Doorstep (the maintenance app, a separate Cloudflare app on its own subdomain).
 * The portal vouches for a signed-in employee with a short-lived HS256 token; Doorstep verifies it with the same
 * secret (DOORSTEP_SSO_SECRET here, SSO_SECRET there) and starts its own session. Outside users (tenants, contractors)
 * never go through this; they have separate Doorstep passwords.
 */
export const DOORSTEP_URL = (process.env.DOORSTEP_URL ?? 'https://doorstep.communityhousingassociates.org').replace(/\/$/, '')

/** Doorstep 'admin' (super user) is decided by CHA's CEO, so for now only portal super admins get it; every other active employee is office staff. */
export function doorstepRoleFor(employee: Pick<Employee, 'is_super_admin'>): 'admin' | 'staff' {
  return employee.is_super_admin ? 'admin' : 'staff'
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString('base64url')

export function signDoorstepToken(employee: Pick<Employee, 'email' | 'name' | 'is_super_admin'>, secret: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss: 'cha-employee-portal',
    aud: 'doorstep',
    iat: now,
    exp: now + 60,
    email: employee.email,
    name: employee.name,
    role: doorstepRoleFor(employee),
  }))
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}
