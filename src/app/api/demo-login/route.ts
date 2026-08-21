import { NextResponse } from 'next/server'
import { DEMO_MODE_ENABLED } from '@/lib/demo-mode'

export async function POST() {
  const nodeEnv: string = process.env.NODE_ENV
  if (nodeEnv === 'production' || !DEMO_MODE_ENABLED) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const response = NextResponse.json({ success: true })
  response.cookies.set('cha-demo', 'true', {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })
  return response
}
