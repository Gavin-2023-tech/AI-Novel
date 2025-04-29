import { OpenAI } from 'openai';

// 初始化 OpenAI 客户端
const openai = new OpenAI({
    baseURL: process.env.BASE_URL || "https://api.openai.com/v1/",
    apiKey: process.env.API_KEY || "sk-xxxxxx",
});

export async function callAI(messages: any): Promise<StoryNode> {
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
            const storyNode = JSON.parse(responseContent) as StoryNode;

            // 验证解析的结果是否符合StoryNode接口
            if (!storyNode.story || !Array.isArray(storyNode.choices)) {
                console.error('返回的JSON结构不符合预期:', storyNode);
                throw new Error('返回的JSON结构不符合预期');
            }

            return storyNode;
        } catch (parseError) {
            console.error('JSON解析错误:', parseError,responseContent);
            throw new Error('返回的内容无法解析为JSON',);
        }
    } catch (error) {
        console.error('OpenAI API 请求出错:', error);
        throw error;
    }
}

// 定义游戏故事节点的接口
interface StoryNode {
    story: string;
    choices: Choice[];
}
// 定义选项的接口
interface Choice {
    id: string;
    text: string;
}
