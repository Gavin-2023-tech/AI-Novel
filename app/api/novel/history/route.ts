import { NextRequest, NextResponse } from 'next/server';
import { getNovelHistoryById, listNovelHistory } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';

// 获取用户的小说历史记录或特定历史记录详情
export async function GET(request: NextRequest) {
  try {
    // 确认用户已登录
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    
    if (!userId) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }
    
    const searchParams = request.nextUrl.searchParams;
    const historyIdStr = searchParams.get("history_id");
    const novelIdStr = searchParams.get("novel_id");
    
    // 处理获取特定历史记录的情况
    if (historyIdStr) {
      const historyId = Number(historyIdStr);
      
      if (isNaN(historyId)) {
        return NextResponse.json(
          { error: '历史记录ID格式错误' },
          { status: 400 }
        );
      }
      
      const novelHistory = getNovelHistoryById(historyId, userId);
      
      if (!novelHistory) {
        return NextResponse.json(
          { error: '未找到小说记录' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(novelHistory);
    } 
    // 处理获取小说所有历史记录的情况
    else{
      const novelId = Number(novelIdStr);
      
      if (isNaN(novelId)) {
        return NextResponse.json(
          { error: '小说ID格式错误' },
          { status: 400 }
        );
      }
      
      const novels = listNovelHistory(novelId, userId);
      return NextResponse.json(novels);
    }
  } catch (error) {
    console.error('获取小说记录错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
