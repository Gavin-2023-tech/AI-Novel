import { authOptions } from "@/lib/auth/authOptions";
import { generateNovelContent } from "@/lib/novel";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// 处理小说生成请求
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
  
      const { novelId, novelHistoryId, selectedChoiceText } = await request.json();
      const userId = session.user.id;
  
      const novel_history = await generateNovelContent(novelId, userId, novelHistoryId, selectedChoiceText);
      if (!novel_history) {
        return NextResponse.json(
          { error: '生成小说内容失败' },
          { status: 500 }
        );
      }
      return NextResponse.json(novel_history);
    } catch (error) {
      console.error('生成小说内容错误:', error);
      return NextResponse.json(
        { error: '服务器错误' },
        { status: 500 }
      );
    }
  }
  