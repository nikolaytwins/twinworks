import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Редирект с корректным хостом за nginx (иначе Location = localhost:3001). */
function absolutePathUrl(request: NextRequest, pathname: string): URL {
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    request.nextUrl.host
  const protoHeader = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol =
    protoHeader === 'http' || protoHeader === 'https'
      ? `${protoHeader}:`
      : request.nextUrl.protocol
  return new URL(pathname, `${protocol}//${host}`)
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(absolutePathUrl(request, '/me/dashboard'))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
}
