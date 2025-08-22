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
  const publicPaths = ['/login', '/_next', '/favicon.ico'];
  const isPublicPath = publicPaths.some((path) => pathname.startsWith(path));

  // API routes cần xử lý đặc biệt
  const isApiRoute = pathname.startsWith('/api');
  const isAuthApiRoute = pathname.startsWith('/api/auth');
  const isWebhookRoute = pathname.startsWith('/api/webhooks');

  // Nếu đã đăng nhập và đang ở trang login, redirect về dashboard
  if (session && pathname === '/login') {
    const redirectTo = req.nextUrl.searchParams.get('redirectedFrom') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, req.url));
  }

  // Bảo vệ API routes (trừ auth và webhooks)
  if (isApiRoute && !isAuthApiRoute && !isWebhookRoute) {
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Nếu chưa đăng nhập và không ở public path, redirect về login
  if (!session && !isPublicPath && !isApiRoute) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Thêm security headers
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('X-Download-Options', 'noopen');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  // Content Security Policy
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://*.supabase.co https://www.google-analytics.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');

  res.headers.set('Content-Security-Policy', cspHeader);

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