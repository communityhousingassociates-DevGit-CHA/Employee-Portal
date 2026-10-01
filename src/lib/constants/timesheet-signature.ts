import { onBehalfAttestation } from '@/lib/constants/on-behalf'

// The wording a signer agrees to when submitting a timesheet. The form shows exactly this and the server stores exactly this
// on the audit event, so the record keeps the wording it was signed under even if these change later.

export const TIMESHEET_ATTESTATION = 'By signing, I certify that the hours above are accurate and complete. This timesheet will be sent for approval.'

export function timesheetOnBehalfAttestation(employeeName: string): string {
  return `${onBehalfAttestation(employeeName)} This timesheet will be sent for approval.`
}
