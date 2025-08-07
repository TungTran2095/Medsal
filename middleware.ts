import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Tạo response để sử dụng với Supabase client
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Kiểm tra session
  const { data: { session } } = await supabase.auth.getSession();

  // Các route không cần authentication
  const publicPaths = ['/login', '/api', '/_next', '/favicon.ico'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // Nếu đã đăng nhập và đang ở trang login, redirect về dashboard
  if (session && pathname === '/login') {
    const redirectTo = req.nextUrl.searchParams.get('redirectedFrom') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // Nếu chưa đăng nhập và không ở public path, redirect về login
  if (!session && !isPublicPath) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 