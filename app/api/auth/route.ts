import { NextRequest, NextResponse } from 'next/server';
import { registerUser, loginUser } from '@/lib/auth';

// 处理用户注册
export async function POST(request: NextRequest) {
  try {
    const { email, password, action } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 根据action决定是注册还是登录
    if (action === 'register') {
      const user = await registerUser(email, password);
      if (!user) {
        return NextResponse.json(
          { error: '注册失败，该邮箱可能已被注册' },
          { status: 400 }
        );
      }
      return NextResponse.json({ user });
    } else if (action === 'login') {
      const user = await loginUser(email, password);
      if (!user) {
        return NextResponse.json(
          { error: '登录失败，邮箱或密码错误' },
          { status: 401 }
        );
      }
      return NextResponse.json({ user });
    } else {
      return NextResponse.json(
        { error: '无效的操作' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('认证错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}