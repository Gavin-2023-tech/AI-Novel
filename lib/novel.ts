import { callAI, callAISSE } from "./ai";
import { Novel, insertNovelHistory, NovelHistory, getNovelById, listNovelHistory, updateNovelHistorySelect, getNovelHistoryById, updateNovelHistoryChoices } from "./db";
import { CHOICE_SYSTEM_PROMPT, CHOICE_USER_PROMPT, START_USER_PROMPT, STOR_ING_USER_PROMPT, SYSTEM_PROMPT } from "./prompt";

export async function generateChoices(novelId: number, userId: number, novelHistoryId: number): Promise<string[] | null> {
  // 获取数据库novel
  const novel = getNovelById(novelId, userId);
  if (!novel) {
    return null;
  }
  
  const novelHistoryList = listNovelHistory(novelId, userId);
  if (!novelHistoryList.length) {
    return null;
  }

  // 构建消息数组
  const messages = [
    { role: "system", content: CHOICE_SYSTEM_PROMPT }
  ];
  
  // 添加历史消息
  novelHistoryList.forEach(history => {
    messages.push({ role: "assistant", content: history.story_content });
    if (history.selected_choice){
      messages.push({ role: "user", content: history.selected_choice });
    }
  });
  
  messages.push({ role: "user", content: CHOICE_USER_PROMPT });
  
  // 调用AI获取新的选项
  const choices_list = await callAI(messages);
  
  // 插入数据库novel_history
  const historyId = updateNovelHistoryChoices(novelHistoryId, userId, choices_list);
  
  // 返回新创建的历史记录
  return historyId ? choices_list : null;
}

export async function generateNewNovelStorySSE(
  novel: Novel,
  onChunk: (chunk: string) => void,
  onComplete: (novelHistory: NovelHistory | null) => void
): Promise<number | null> {
  try {
    // 构建消息数组
    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: START_USER_PROMPT(novel.genre)
      }
    ];

    // 调用AI获取新的故事节点，使用SSE流式响应
    let storyResult: string = '';
    
    try {
      storyResult = await callAISSE(messages, onChunk);
    } catch (error) {
      console.error('AI调用失败:', error);
      onComplete(null);
      return null;
    }
    
    // 插入数据库novel_history
    const historyId = insertNovelHistory(novel.id, novel.user_id, storyResult, '');
    
    // 获取并返回新创建的历史记录
    const newHistory = historyId ? getNovelHistoryById(historyId, novel.user_id) : null;
    onComplete(newHistory);
    return historyId;
  } catch (error) {
    console.error('生成小说开头SSE错误:', error);
    onComplete(null);
    return null;
  }
}

// 新增SSE实现的小说内容生成函数
export async function generateNovelStorySSE(
  novelId: number, 
  userId: number, 
  novelHistoryId: number, 
  selectedChoiceText: string,
  onChunk: (chunk: string) => void,
  onComplete: (novelHistory: NovelHistory | null) => void
): Promise<number | null> {
  try {
    // 获取数据库novel
    const novel = getNovelById(novelId, userId);
    if (!novel) {
      onComplete(null);
      return null;
    }
    
    const novelHistoryList = listNovelHistory(novelId, userId);
    if (!novelHistoryList.length) {
      onComplete(null);
      return null;
    }
      
    // 更新数据库novel_history
    if (!updateNovelHistorySelect(novelHistoryId, userId, selectedChoiceText)) {
      onComplete(null);
      return null;
    }
    
    // 更新本地缓存的选择
    const historyIndex = novelHistoryList.findIndex(history => history.id === novelHistoryId);
    if (historyIndex !== -1) {
      novelHistoryList[historyIndex].selected_choice = selectedChoiceText;
    }
    
    // 构建消息数组
    const messages = [
      { role: "system", content: SYSTEM_PROMPT }
    ];
    
    // 添加历史消息
    novelHistoryList.forEach(history => {
      messages.push({ role: "assistant", content: history.story_content });
      
      if (history.selected_choice) {
        messages.push({ role: "user", content: history.selected_choice });
      }
    });
    
    messages.push({ role: "user", content: STOR_ING_USER_PROMPT });
    
    // 调用AI获取新的故事节点，使用SSE流式响应
    let storyResult: string = '';
    
    try {
      storyResult = await callAISSE(messages, onChunk);
    } catch (error) {
      console.error('AI调用失败:', error);
      onComplete(null);
      return null;
    }
    
    // 插入数据库novel_history
    const historyId = insertNovelHistory(novelId, userId, storyResult, '');
    
    // 获取并返回新创建的历史记录
    const newHistory = historyId ? getNovelHistoryById(historyId, userId) : null;
    onComplete(newHistory);
    return historyId;
  } catch (error) {
    console.error('生成小说内容SSE错误:', error);
    onComplete(null);
    return null;
  }
}
