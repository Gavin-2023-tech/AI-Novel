import { callAI } from "./ai";
import { Novel, insertNovelHistory, NovelHistory, getNovelById, listNovelHistory, updateNovelHistorySelect, getNovelHistoryById } from "./db";
import { ING_USER_PROMPT, START_USER_PROMPT, SYSTEM_PROMPT } from "./prompt";

export async function generateNewNovelContent(novel: Novel) {
  let messages = [];
  messages.push({
    role: "system",
    content: SYSTEM_PROMPT
  });
  messages.push({
    role: "user",
    content: START_USER_PROMPT(novel.genre)
  })

  const storyNode = await callAI(messages);
  if (insertNovelHistory(novel.id, novel.user_id, storyNode.story, JSON.stringify(storyNode.choices))) {
    return true;
  } else {
    return false;
  }
}
export async function generateNovelContent(novelId: number, userId: number, novelHistoryId: number, selectedChoiceText: string): Promise<NovelHistory | null> {
  // 获取数据库novel
  const novel = getNovelById(novelId, userId);
  if (!novel) {
    return null;
  }
  
  const novelHistoryList = listNovelHistory(novelId, userId);
  if (!novelHistoryList.length) {
    return null;
  }
    
  // 更新数据库novel_history
  if (!updateNovelHistorySelect(novelHistoryId, userId, selectedChoiceText)) {
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
  
  messages.push({ role: "user", content: ING_USER_PROMPT() });
  
  // 调用AI获取新的故事节点
  const storyNode = await callAI(messages);
  
  // 插入数据库novel_history
  const historyId = insertNovelHistory(novelId, userId, storyNode.story, JSON.stringify(storyNode.choices));
  
  // 返回新创建的历史记录
  return historyId ? getNovelHistoryById(historyId, userId) : null;
}
