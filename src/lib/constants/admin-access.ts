import type { Role } from '@/types'

// Who has full Admin Console rights (user management, imports, grants, employee records). The President/CEO holds the same
// administrator rights as the Accounting Manager (`admin` role); the CEO's own permissions (final approver, closed-period override)
// stay keyed on the `ceo` role.
export const ADMIN_ROLES: Role[] = ['admin', 'ceo']
export const isAdminRole = (role: string | null | undefined) => ADMIN_ROLES.includes(role as Role)
