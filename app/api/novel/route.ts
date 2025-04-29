import { NextRequest, NextResponse } from 'next/server';
import { createNovel, deleteNovelById, getNovelById, getUserNovels, updateNovelTitle } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { generateNewNovelContent } from '@/lib/novel';

// 获取用户的所有小说 或 获取特定小说详情
export async function GET(
  request: NextRequest
) {
  try {
    const searchParams = request.nextUrl.searchParams
    // 从会话中获取用户信息，确保用户已经登录
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const id = searchParams.get("id");
    if (id) {
      const novelId = Number(id);
      if (!isNaN(novelId)) {
        const novel = getNovelById(novelId, userId);
        if (!novel) {
          return NextResponse.json(
            { error: '未找到小说' },
            { status: 404 }
          );
        }
        return NextResponse.json(novel);
      }
    } else {
      // 如果没有 id 或 id 不是数字，则返回所有小说
      const novels = getUserNovels(userId);
      return NextResponse.json(novels);
    }
  } catch (error) {
    console.error('获取小说错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 创建新小说
export async function PUT(request: NextRequest) {
  try {
    // 从会话中获取用户信息，确保用户已经登录
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const { genre, title } = await request.json();
    const userId = session.user.id;
    const novel_result = createNovel(userId, title, genre);
    if (!novel_result) {
      return NextResponse.json(
        { error: '创建小说失败' },
        { status: 500 }
      );
    }
    if (!await generateNewNovelContent(novel_result)) {
      return NextResponse.json(
        { error: '生成小说失败' },
        { status: 500 }
      )
    }
    return NextResponse.json(novel_result);
  } catch (error) {
    console.error('创建小说错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

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

// 删除指定的小说
export async function DELETE(
  request: NextRequest
) {
  try {
    const searchParams = request.nextUrl.searchParams
    // 从会话中获取用户信息，确保用户已经登录
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const id = searchParams.get("id");
    // 检查是否有 id 参数
    if (id) {
      const novelId = Number(id);
      if (!isNaN(novelId)) {
        const result = deleteNovelById(novelId, userId);
        if (result) {
          return NextResponse.json(
            { message: '小说删除成功' },
            { status: 200 }
          );
        }
      }
    }
    return NextResponse.json(
      { error: '未找到小说' },
      { status: 404 }
    )
  } catch (error) {
    console.error('获取小说错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

