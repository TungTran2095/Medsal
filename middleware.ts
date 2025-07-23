import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // Chỉ bảo vệ các route /dashboard và các route cần bảo vệ
  const protectedPaths = ['/dashboard'];
  const { pathname } = req.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  // Kiểm tra session Supabase
  const supabase = createMiddlewareClient({ req, res: NextResponse.next() });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
}; 