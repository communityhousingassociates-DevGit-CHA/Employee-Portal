// Portal invite / password-reset links are Supabase Auth email links; their lifetime is the project's "mailer_otp_exp" setting.
// Raised from 24 to 48 hours on 2026-09-29 (Management API). Links sent before that moment were issued with the old 24-hour life.
export const INVITE_VALID_HOURS = 48
const INVITE_48H_SINCE = Date.parse('2026-09-29T16:20:00Z')
const OLD_INVITE_VALID_HOURS = 24

/** When an invite sent at `sentAt` stops working. */
export function inviteExpiresAt(sentAt: string): Date {
  const hours = Date.parse(sentAt) >= INVITE_48H_SINCE ? INVITE_VALID_HOURS : OLD_INVITE_VALID_HOURS
  return new Date(Date.parse(sentAt) + hours * 3600000)
}
export const inviteExpired = (sentAt: string, now: number = Date.now()) => inviteExpiresAt(sentAt).getTime() < now
