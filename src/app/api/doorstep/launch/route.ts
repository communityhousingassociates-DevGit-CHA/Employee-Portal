import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentEmployee } from '@/lib/auth/session'
import { DOORSTEP_URL, signDoorstepToken } from '@/lib/doorstep-sso'

// "Open Doorstep" from the sidebar. Signed-in (and active) employees only: middleware sends anyone else to /login, and
// getCurrentEmployee() also refuses deactivated accounts. The token is good for 60 seconds and goes in the redirect URL.
export async function GET(request: NextRequest) {
  const secret = process.env.DOORSTEP_SSO_SECRET
  if (!secret) return new NextResponse('Doorstep sign-in is not configured yet.', { status: 503 })

  const employee = await getCurrentEmployee()
  if (!employee || !employee.email) return NextResponse.redirect(new URL('/login', request.url))

  const token = signDoorstepToken(employee, secret)
  const res = NextResponse.redirect(`${DOORSTEP_URL}/api/auth/sso?token=${encodeURIComponent(token)}`)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
