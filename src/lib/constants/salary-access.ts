// Who may see and change salary amounts (CHA policy, 2026-09-25): ONLY Carrileen Edwards (Accounting Manager)
// and Nico Sanders (President/CEO) — deliberately narrower than the admin/CEO/accounting roles, so another
// admin (or the dev account) can't see pay. Keyed by portal email. To change who has access, edit this list.
export const SALARY_VIEWER_EMAILS: string[] = [
  'cedwards@communityhousingmd.org',
  'nsanders@communityhousingmd.org',
]

export function canViewSalaries(employee: { email: string } | null | undefined): boolean {
  return !!employee && SALARY_VIEWER_EMAILS.includes(employee.email.toLowerCase())
}
