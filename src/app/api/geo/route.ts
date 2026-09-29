import { NextResponse, type NextRequest } from 'next/server'

// Diagnostic for the sign-in location rule: shows the visitor their OWN location as Vercel sees it (country, state, city). Reveals nothing
// about anyone else and needs no sign-in, so an administrator can check what a staff member's connection looks like before granting access.
export async function GET(request: NextRequest) {
  return NextResponse.json(
    { country: request.headers.get('x-vercel-ip-country'), region: request.headers.get('x-vercel-ip-country-region'), city: request.headers.get('x-vercel-ip-city') },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
