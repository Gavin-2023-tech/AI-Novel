import { OpenAI } from 'openai';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    baseURL: process.env.BASE_URL || "https://api.openai.com/v1/",
    apiKey: process.env.API_KEY || "sk-xxxxxx",
});

export async function callAI(messages: any): Promise<string[]> {
    // 原有代码保持不变
    try {
        const response = await openai.chat.completions.create({
            model: process.env.MODEL || 'gpt-4-turbo',
            messages: messages,
            temperature: 0.8,
            top_p: 0.9,
            response_format: {
                type: 'json_object'
            },
            presence_penalty: 0.3,
            frequency_penalty: 0.3,
            max_tokens: 4000,
        });
        // 获取模型的响应文本
        const responseContent = response.choices[0].message.content || '';

        // 解析JSON响应
        try {
            // 尝试直接解析JSON
            const choices_list = JSON.parse(responseContent) as string[];

            // 验证解析的结果是否符合
            if (!Array.isArray(choices_list)) {
                console.error('返回的JSON结构不符合预期:', responseContent);
                throw new Error('返回的JSON结构不符合预期');
            }
            return choices_list;
        } catch (parseError) {
            console.error('JSON解析错误:', parseError,responseContent);
            throw new Error('返回的内容无法解析为JSON',);
        }
    } catch (error) {
        console.error('OpenAI API 请求出错:', error);
        throw error;
    }
}

// 新增SSE流式响应函数
export async function callAISSE(
    messages: any, 
    onChunk: (chunk: string) => void
): Promise<string> {
    try {
        let completeStory = '';

        const stream = await openai.chat.completions.create({
            model: process.env.MODEL || 'gpt-4-turbo',
            messages: messages,
            temperature: 0.8,
            top_p: 0.9,
            presence_penalty: 0.3,
            frequency_penalty: 0.3,
            max_tokens: 4000,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                completeStory += content;

                // 将每个块发送给客户端
                onChunk(content);
            }
        }
        return completeStory;
    } catch (error) {
        console.error('OpenAI 流式API请求出错:', error);
        throw error;
    }
}