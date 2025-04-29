import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { generateChoices } from '@/lib/novel';

// 生成小说新的选项
export async function POST(request: NextRequest) {
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
    const { novelId, historyId } = await request.json();

    // 处理获取特定历史记录的情况
    if(novelId === null || historyId === null || isNaN(Number(novelId)) || isNaN(Number(historyId))){
      return NextResponse.json(
        { error: '参数错误' },
        { status: 400 }
      );
    }else{
      const choices_list =  await generateChoices(Number(novelId),userId,Number(historyId));
      if (choices_list === null || choices_list.length === 0) {
        return NextResponse.json(
          { error: '生成选项失败' },
          { status: 500 }
        );
      }
      return NextResponse.json(choices_list);
    }
  } catch (error) {
    console.error('生成选项错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
