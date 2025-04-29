import { authOptions } from "@/lib/auth/authOptions";
import { updateNovelTitle } from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// 小说标题修改
export async function POST(request: NextRequest) {
    try {
      // 从会话中获取用户信息，确保用户已经登录
      const session = await getServerSession(authOptions);
  
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: '未授权，请先登录' },
          { status: 401 }
        );
      }
  
      const { novelId, title } = await request.json();
      const userId = session.user.id;
      const result = updateNovelTitle(novelId, userId, title);
      if (!result) {
        return NextResponse.json(
          { error: '更新小说标题失败' },
          { status: 500 }
        );
      }
      return NextResponse.json({ message: '小说标题更新成功' },{status:200});
    } catch (error) {
      console.error('生成小说内容错误:', error);
      return NextResponse.json(
        { error: '服务器错误' },
        { status: 500 }
      );
    }
  }