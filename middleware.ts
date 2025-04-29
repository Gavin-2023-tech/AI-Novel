import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// 需要保护的路由
const protectedRoutes = [
  '/',
];

// API路由保护
const protectedApiRoutes = [
  '/api/novel',
  '/api/novel/history',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 检查是否是受保护的API路由
  const isApiRoute = pathname.startsWith('/api/');
  const isProtectedApiRoute = protectedApiRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // 检查是否是受保护的页面路由
  const isProtectedPageRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );
  
  // 如果不是受保护的路由，直接放行
  if (!(isProtectedApiRoute || isProtectedPageRoute)) {
    return NextResponse.next();
  }
  
  // 获取JWT令牌
  const token = await getToken({ 
    req: request,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
  });
  
  // 如果没有令牌，重定向到登录页面或返回未授权响应
  if (!token) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  // 用户已认证，继续处理请求
  return NextResponse.next();
}

// 配置中间件应用的路由
export const config = {
  matcher: [
    /*
     * 匹配所有需要保护的路由:
     * - /create, /history, /novel 开头的路由
     * - /api/novel 开头的API路由
     */
    '/',
    '/api/novel/:path*',
  ],
};