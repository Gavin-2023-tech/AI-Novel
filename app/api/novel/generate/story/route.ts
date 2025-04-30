import { authOptions } from "@/lib/auth/authOptions";
import { generateNovelStorySSE } from "@/lib/novel";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// 处理小说生成请求 (SSE实现)
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

    const { novelId, historyId, userChoice } = await request.json();
    const userId = session.user.id;

    // 创建一个可读流，用于SSE
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();

          // 发送SSE开始消息
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`));
          if (!novelId || !userId) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "缺少必要参数" })}\n\n`));
            controller.close();
            return;
          }
          // 调用SSE生成函数
          await generateNovelStorySSE(
            novelId, 
            userId, 
            historyId, 
            userChoice,
            // 回调函数，用于发送流式消息
            (chunk) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`));
            },
            // 结束回调，发送完整数据
            (novelHistory) => {
              if (novelHistory) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "complete", novelHistory })}\n\n`));
              } else {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "生成内容失败" })}\n\n`));
              }
              controller.close();
            }
          );
        } catch (error) {
          console.error('SSE流处理错误:', error);
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: "服务器错误" })}\n\n`));
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
    console.error('生成小说内容错误:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
