import { NextRequest, NextResponse } from 'next/server';
import { createNovel, deleteNovelById, getNovelById, getUserNovels } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { generateNewNovelStorySSE } from '@/lib/novel';

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

// 创建新小说 (使用SSE)
export async function POST(request: NextRequest) {
  try {
    // 从会话中获取用户信息，确保用户已经登录
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new Response(
        JSON.stringify({ error: '未授权，请先登录' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { genre, title } = await request.json();
    const userId = session.user.id;
    
    // 创建小说
    const novel = createNovel(userId, title, genre);
    if (!novel) {
      return new Response(
        JSON.stringify({ error: '创建小说失败' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json'}
        }
      );
    }

    // 创建一个可读流，用于SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();

          // 发送小说创建成功和SSE开始消息
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: "start", 
            novel: novel
          })}\n\n`));

          // 调用SSE生成函数
          await generateNewNovelStorySSE(
            novel,
            // 回调函数，用于发送流式消息
            (chunk) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                type: "chunk", 
                content: chunk 
              })}\n\n`));
            },
            // 结束回调，发送完整数据
            (novelHistory) => {
              if (novelHistory) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: "complete", 
                  novelHistory: novelHistory 
                })}\n\n`));
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: "error", 
                  error: "生成内容失败" 
                })}\n\n`));
              }
              controller.close();
            }
          );
        } catch (error) {
          console.error('SSE流处理错误:', error);
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: "error", 
            error: "服务器错误" 
          })}\n\n`));
          controller.close();
        }
      }
    });

    // 返回SSE响应
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering':'no'
      },
    });
  } catch (error) {
    console.error('创建小说错误:', error);
    return new Response(
      JSON.stringify({ error: '服务器错误' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
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

