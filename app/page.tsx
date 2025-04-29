// app/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NovelHistoryDrawer } from "@/components/novel-history-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession, signOut } from "next-auth/react";
import { Novel, NovelHistory } from '@/lib/db';
import { History, House, LogOut, Pencil, Check, CircleArrowRight } from 'lucide-react';
import { toast } from "sonner";
import { genreOptions } from '@/lib/prompt';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// 应用模式枚举
const APP_MODE = {
  HOME: 'home',
  VIEW: 'view'
};

export default function HomePage() {
  const { data: session, status } = useSession();

  // 核心状态管理
  const [appMode, setAppMode] = useState(APP_MODE.HOME);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [currentNovelId, setCurrentNovelId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingChoices, setIsGeneratingChoices] = useState(false);

  // 标题编辑状态
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // 自定义剧情输入
  const [customChoice, setCustomChoice] = useState('');

  const initialLoadComplete = useRef(false);

  // 小说详情相关状态
  const [novel, setNovel] = useState<Novel | null>(null);
  const [novelHistoryList, setNovelHistoryList] = useState<NovelHistory[]>([]);
  const [currentHistory, setCurrentHistory] = useState<NovelHistory | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [currentChoices, setCurrentChoices] = useState<string[]>([]);
  
  // 流式生成的内容
  const [generatedContent, setGeneratedContent] = useState("");
  
  // 用于存储SSE控制器的引用
  const sseController = useRef<AbortController | null>(null);

  // 当选择查看特定小说时
  useEffect(() => {
    if (currentNovelId && appMode === APP_MODE.VIEW && !initialLoadComplete.current) {
      fetchNovel(currentNovelId);
      initialLoadComplete.current = true;
    }
  }, [currentNovelId, appMode]);

  // 清理SSE连接
  useEffect(() => {
    return () => {
      if (sseController.current) {
        sseController.current.abort();
      }
    };
  }, []);

  // 重置应用状态的函数
  const resetAppState = () => {
    setNovel(null);
    setNovelHistoryList([]);
    setCurrentHistory(null);
    setSelectedChoice(null);
    setEditedTitle('');
    setIsEditingTitle(false);
    setCustomChoice('');
    setCurrentChoices([]);
    setGeneratedContent("");
    initialLoadComplete.current = false;
    
    // 中断任何进行中的SSE连接
    if (sseController.current) {
      sseController.current.abort();
      sseController.current = null;
    }
  };

  // 获取风格名称
  const getGenreName = (genreId: string) => {
    const genre = genreOptions.find(g => g.id === genreId);
    return genre ? genre.name : '武侠江湖';
  };

  // 通用处理SSE响应的函数
  const handleSSEResponse = async (url: string, method: string = 'GET', body: any = null) => {
    return new Promise<NovelHistory | null>((resolve, reject) => {
      // 重置生成内容
      setGeneratedContent("");
      
      // 创建新的AbortController
      if (sseController.current) {
        sseController.current.abort();
      }
      sseController.current = new AbortController();
      
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        signal: sseController.current.signal,
      };
        console.log("使用的URL:", url);
        console.log("使用的方法:", method);
        console.log("使用的body:", body);
      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }
      
      fetch(url, fetchOptions)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const reader = response.body?.getReader();

          
          const decoder = new TextDecoder();
          let buffer = "";
          let novelHistoryResult: NovelHistory | null = null;
          
          function readStream() {
            if (!reader) {
              throw new Error("Response body is not readable");
            }
            reader.read().then(({ done, value }) => {
              if (done) {
                if (novelHistoryResult) {
                  resolve(novelHistoryResult);
                } else {
                  reject(new Error("完成但未收到有效的历史记录"));
                }
                return;
              }
              
              buffer += decoder.decode(value, { stream: true });
              
              // 处理事件数据
              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";
              
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  console.log("Received SSE data:", line);
                  try {
                    const data = JSON.parse(line.substring(6));
                    
                    switch (data.type) {
                      case "start":
                        // 处理开始消息，可能包含小说数据
                        if (data.novel) {
                          setNovel(data.novel);
                          setEditedTitle(data.novel.title);
                          setCurrentNovelId(data.novel.id);
                        }
                        break;
                        
                      case "chunk":
                        // 处理内容块
                        if (data.content) {
                          setGeneratedContent(prev => prev + data.content);
                        }
                        break;
                        
                      case "complete":
                        // 处理完成消息，包含完整的历史记录
                        if (data.novelHistory) {
                          // 保存结果以便在流结束时返回
                          novelHistoryResult = data.novelHistory;
                        }
                        break;
                        
                      case "error":
                        // 处理错误消息
                        const errorMsg = data.error || "生成内容时出错";
                        toast.error(errorMsg);
                        reject(new Error(errorMsg));
                        break;
                    }
                  } catch (e) {
                    console.error("解析SSE数据失败:", e, line);
                  }
                }
              }
              
              readStream();
            }).catch(error => {
              // 如果是因为中止请求导致的错误，不显示错误提示
              if (error.name !== 'AbortError') {
                console.error("读取流错误:", error);
                reject(error);
              }
            });
          }
          
          readStream();
        })
        .catch(error => {
          // 如果是因为中止请求导致的错误，不显示错误提示
          if (error.name !== 'AbortError') {
            console.error("SSE连接错误:", error);
            toast.error("连接服务器失败");
            reject(error);
          }
        });
    });
  };
  
  // 直接开始创作
  const startNovel = async (genreId?: string) => {
    // 使用传入的genreId或已选择的风格
    const genre = genreId || selectedGenre;

    if (!genre || !session?.user?.id) {
      if (!session) {
        window.location.href = '/login';
        return;
      }
      return;
    }

    setIsGenerating(true);

    try {
      const genreName = getGenreName(genre);
      
      // 切换到查看模式
      setAppMode(APP_MODE.VIEW);
      
      // 使用SSE获取生成的内容
      const novelHistory = await handleSSEResponse(
        '/api/novel', 
        'POST', 
        {
          genre: genreName,
          title: `我的${genreName}小说`
        }
      );
      
      // 流程完成后，将历史记录添加到列表
      if (novelHistory) {
        console.log("成功创建小说和初始历史:", novelHistory);
        
        // 清空生成内容状态，避免重复显示
        setGeneratedContent("");
        
        // 更新历史记录列表
        setNovelHistoryList([novelHistory]);
        setCurrentHistory(novelHistory);
        
          console.log(`准备为小说ID ${novelHistory.novel_id} 历史ID ${novelHistory.id} 生成选项`);
          await generateChoices(novelHistory.novel_id, novelHistory.id);
      } else {
        toast.error("创建小说失败，未获得有效的历史记录");
      }
      
    } catch (error) {
      console.error('创建小说错误:', error);
      toast.error('创建小说失败');
      goToHome();
    } finally {
      setIsGenerating(false);
    }
  };

  // 获取小说详情
  const fetchNovel = async (novelId: number) => {
    try {
      // 获取小说详情
      const response = await fetch(`/api/novel?id=${novelId}`);

      if (!response.ok) {
        toast.error('获取小说详情失败');
        return;
      }

      const novelData = await response.json();
      setNovel(novelData);
      setEditedTitle(novelData.title);

      // 获取小说历史记录
      await fetchNovelHistory(novelId);
    } catch (error) {
      console.error('获取小说详情失败:', error);
      toast.error('获取小说详情错误');
      goToHome();
    }
  };

  // 获取小说历史记录
  const fetchNovelHistory = async (novelId: number) => {
    try {
      const response = await fetch(`/api/novel/history?novel_id=${novelId}`);

      if (!response.ok) {
        toast.error('获取小说历史记录失败');
        return;
      }

      const historyData = await response.json();
      setNovelHistoryList(historyData);

      // 设置当前显示的历史记录为最新的一条
      if (historyData.length > 0) {
        const latestHistory = historyData[historyData.length - 1];
        setCurrentHistory(latestHistory);

        // 如果有选项，直接设置
        if (latestHistory.choices && Array.isArray(latestHistory.choices) && latestHistory.choices.length > 0) {
          setCurrentChoices(latestHistory.choices);
        } else {
          // 否则获取选项
          generateChoices(novelId, latestHistory.id);
        }
      }
    } catch (error) {
      console.error('获取小说历史记录错误:', error);
      toast.error('获取小说历史记录错误');
    }
  };
  
  // 生成选项
  const generateChoices = async (novelId: number, historyId: number) => {
    if (!novelId || !historyId) {
      console.warn("无法生成选项：缺少小说ID或历史ID", { novelId, historyId });
      return;
    }
    
    setIsGeneratingChoices(true);
    try {
      console.log(`正在为小说ID ${novelId} 的历史记录ID ${historyId} 生成选项`);
      
      const response = await fetch('/api/novel/generate/choice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          novelId,
          historyId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '获取故事选项失败' }));
        console.error('获取选项失败, 状态码:', response.status, errorData);
        toast.error(errorData.error || '获取故事选项失败');
        return;
      }

      let choices:string[] = await response.json();
      console.log('获取到的选项:', choices);
      
      // 确保choices是数组，并且有内容
      if (Array.isArray(choices) && choices.length > 0) {
        // 更新选项
        setCurrentChoices(choices);
        
        // 更新历史记录中的选项
        if (currentHistory && currentHistory.id === historyId) {
          const updatedHistory = {...currentHistory, choices};
          setCurrentHistory(updatedHistory);
          setNovelHistoryList(prev => 
            prev.map(h => h.id === historyId ? updatedHistory : h)
          );
        }
      } else {
        console.warn('服务器返回了空的选项列表', choices);
        toast.error('无法生成故事选项，请刷新页面或使用自定义输入');
      }
      
    } catch (error) {
      console.error('获取故事选项失败:', error);
      toast.error('获取故事选项失败');
    } finally {
      setIsGeneratingChoices(false);
    }
  };

  // 更新小说标题
  const updateNovelTitle = async () => {
    if (!currentNovelId || !editedTitle.trim()) return;

    try {
      const response = await fetch('/api/novel/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          novelId: currentNovelId,
          title: editedTitle.trim()
        }),
      });

      if (!response.ok) {
        toast.error('更新小说标题失败');
        return;
      }

      const updatedNovel = await response.json();
      
      // 直接更新本地状态以立即显示修改后的标题
      setNovel(prev => prev ? {...prev, title: editedTitle.trim()} : null);
      toast.success('小说标题已更新');
    } catch (error) {
      console.error('更新小说标题失败:', error);
      toast.error('更新小说标题失败');
    } finally {
      setIsEditingTitle(false);
    }
  };

  // 选择剧情选项并直接继续故事
  const handleChoiceSelect = (choice: string) => {
    setSelectedChoice(choice);
    // 选择后直接触发继续故事
    continueStory(choice);
  };

  // 提交自定义剧情
  const handleCustomChoiceSubmit = () => {
    if (!customChoice.trim()) {
      toast.error('请输入剧情内容');
      return;
    }
    continueStory(customChoice.trim());
    setCustomChoice('');
  };

  // 继续生成故事
  const continueStory = async (userChoice: string) => {
    if (!userChoice || !session?.user?.id || isGenerating || !currentHistory || !currentNovelId) {
      console.warn('继续故事失败: 缺少必要参数', {
        hasUserChoice: !!userChoice,
        isLoggedIn: !!session?.user?.id,
        isGenerating,
        hasCurrentHistory: !!currentHistory,
        currentNovelId
      });
      return;
    }

    setIsGenerating(true);
    try {
      // 先更新当前历史记录中的选择
      const updatedCurrentHistory = {
        ...currentHistory,
        selected_choice: userChoice
      };

      // 更新历史记录列表中的当前记录
      setNovelHistoryList(prev =>
        prev.map(history =>
          history.id === currentHistory.id ? updatedCurrentHistory : history
        )
      );

      // 设置当前历史为更新后的历史
      setCurrentHistory(updatedCurrentHistory);

      console.log(`开始为小说ID ${currentNovelId} 历史ID ${currentHistory.id} 生成新故事, 用户选择: ${userChoice}`);

      // 使用SSE生成故事
      const newNovelHistory = await handleSSEResponse(
        '/api/novel/generate/story',
        'POST',
        {
          novelId: currentNovelId,
          historyId: currentHistory.id,
          userChoice
        }
      );
      
      // 流程完成后，将历史记录添加到列表
      if (newNovelHistory) {
        console.log("生成的新历史记录:", newNovelHistory);
        
        // 清空生成内容状态，避免重复显示
        setGeneratedContent("");
        
        // 更新历史记录列表
        setNovelHistoryList(prev => [...prev, newNovelHistory]);
        setCurrentHistory(newNovelHistory);
        
        // 重置选择状态
        setSelectedChoice(null);
        
        // 生成选项
        if (currentNovelId && newNovelHistory.id) {
          console.log(`准备为历史ID ${newNovelHistory.id} 生成选项`);
          await generateChoices(currentNovelId, newNovelHistory.id);
        } else {
          console.warn("无法生成选项：缺少小说ID或历史ID", {
            novelId: currentNovelId,
            historyId: newNovelHistory?.id
          });
        }
      } else {
        toast.error("生成故事失败，未获得有效的历史记录");
      }
      
    } catch (error) {
      toast.error('生成故事失败');
      console.error('生成故事失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // 主页功能 - 选择风格并直接开始创作
  const handleGenreSelect = (genreId: string) => {
    setSelectedGenre(genreId);
    // 直接开始创作
    startNovel(genreId);
  };

  // 去历史页面
  const goToHistory = () => {
    // 如果用户未登录，跳转到登录页
    if (!session) {
      window.location.href = '/login';
      return;
    }

    // 打开抽屉组件显示历史
    setHistoryDrawerOpen(true);
  };

  // 通过novel-history-drawer组件选中特定小说时触发
  const selectNovelFromHistory = (novel: Novel) => {
    resetAppState();
    setCurrentNovelId(novel.id);
    setHistoryDrawerOpen(false);
    setAppMode(APP_MODE.VIEW);
  };

  // 返回主页
  const goToHome = () => {
    resetAppState();
    setAppMode(APP_MODE.HOME);
    setCurrentNovelId(null);
  };

  // 登出功能
  const handleLogout = async () => {
    await signOut({ redirect: false });
    window.location.href = '/login';
  };

  // 根据应用模式显示不同内容
  if (appMode === APP_MODE.VIEW) {
    // 小说查看/编辑模式
    return (
      <div className="min-h-screen flex flex-col p-3 bg-slate-50 dark:bg-slate-900">
        <header className="mb-4">
          <div className="flex justify-between items-center">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-bold"
                  placeholder="输入小说标题"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={updateNovelTitle}
                  disabled={!editedTitle.trim()}
                >
                  <Check className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h1 className="text-xl font-bold">{novel?.title || '我的小说'}</h1>
                <Pencil className="h-4 w-4 text-slate-500" />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={goToHome}><House /></Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut /></Button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl mx-auto w-full">
          {/* 故事内容 */}
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm">
            <div className="prose dark:prose-invert max-w-none">
              {novelHistoryList.map((history, index) => (
                <div key={history.id} className="mb-3">
                  {/* 故事段落内容 */}
                  {history.story_content.split('\n\n').map((paragraph, pIndex) => (
                    <p key={`${history.id}-p${pIndex}`} style={{ textIndent: '1em' }}>{paragraph}</p>
                  ))}
                  {/* 如果有用户选择，显示用户选择卡片 */}
                  {history.selected_choice && index <= novelHistoryList.length - 1 && (
                    <div className="mb-4 mt-2 p-3 bg-primary/5 border border-primary/10 rounded-md text-sm font-medium">
                      {history.selected_choice}
                    </div>
                  )}
                </div>
              ))}

              {/* 如果没有历史记录 */}
              {novelHistoryList.length === 0 && !generatedContent && (
                <p>等待故事生成...</p>
              )}
              
              {/* 实时生成的内容 */}
              {generatedContent && (
                <div className="animate-pulse">
                  {generatedContent.split('\n\n').map((paragraph, pIndex) => (
                    <p key={`generated-${pIndex}`} style={{ textIndent: '1em' }}>{paragraph}</p>
                  ))}
                </div>
              )}
              
              {/* 选项区域 */}
              {currentHistory && !isGenerating && (
                <div className="mt-8">
                  <div className="my-6">
                    <Separator />
                  </div>
                  <h2 className="text-xl font-semibold mb-4">接下来的剧情发展:</h2>
                  <div className="space-y-3">
                    {isGeneratingChoices ? (
                      <div className="flex justify-center py-4">
                        <span className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                        <span>生成选项中...</span>
                      </div>
                    ) : currentChoices.length > 0 ? (
                      currentChoices.map((choice, index) => (
                        <div
                          key={index}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedChoice === choice
                              ? 'border-primary bg-primary/10'
                              : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                          }`}
                          onClick={() => handleChoiceSelect(choice)}
                        >
                          {choice}
                        </div>
                      ))
                    ) : (
                      <div className="text-center p-4 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        暂无选项，请使用自定义输入继续剧情
                      </div>
                    )}

                    {/* 自定义剧情输入区域 */}
                    <div className="flex items-center gap-2 mt-4">
                      <div className="relative flex-1">
                        <Textarea
                          placeholder="自定义输入下一步剧情发展..."
                          value={customChoice}
                          onChange={(e) => setCustomChoice(e.target.value)}
                          className="p-3 pr-12 min-h-[80px] border-2 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-1 focus-visible:ring-slate-400 resize-none"
                        />
                        <Button
                          onClick={handleCustomChoiceSubmit}
                          variant="ghost"
                          size="icon"
                          disabled={!customChoice.trim() || isGenerating}
                          className="absolute right-2 bottom-2 h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                          aria-label="提交剧情"
                        >
                          <CircleArrowRight
                            className={`w-5 h-5 ${
                              customChoice.trim() && !isGenerating
                                ? 'text-primary animate-pulse'
                                : 'text-muted-foreground'
                            }`}
                          />
                        </Button>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 生成中提示 */}
              {isGenerating && !generatedContent && (
                <div className="flex justify-center items-center py-8">
                  <span className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                  <span>正在生成...</span>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* 小说历史抽屉组件 */}
        <NovelHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          onSelectNovel={selectNovelFromHistory}
        />
      </div>
    );
  } else {
    // 主页
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <header className="w-full max-w-4xl flex justify-between items-center mb-12">
          <div className="text-center flex-1">
            <h1 className="text-4xl font-bold mb-2">AI小说创作</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">选择一种风格，开始你的创作之旅</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goToHistory}
              className="h-10"
            >
              <History />
            </Button>
            <ThemeToggle />
            {session ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-10"
              >
                <LogOut />
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => window.location.href = '/login'}
                className="h-10"
              >
                登录
              </Button>
            )}
          </div>
        </header>

        <main className="w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {genreOptions.map((genre) => (
              <div
                key={genre.id}
                className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                  isGenerating 
                    ? 'opacity-50 pointer-events-none' 
                    : selectedGenre === genre.id 
                      ? 'border-primary bg-primary/10' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`}
                onClick={() => !isGenerating && handleGenreSelect(genre.id)}
              >
                <div className="flex items-center mb-3">
                  <span className="text-3xl mr-3">{genre.icon}</span>
                  <h2 className="text-xl font-semibold">{genre.name}</h2>
                </div>
                <p className="text-slate-600 dark:text-slate-300">{genre.description}</p>
                {selectedGenre === genre.id && isGenerating && (
                  <div className="mt-3 flex items-center justify-center">
                    <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                    <span>创作中...</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>

        <footer className="mt-auto pt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={() => window.open('https://github.com/shuaihaoV/AI-Novel')}
            className="text-sm text-slate-600 dark:text-slate-400 hover:underline"
          >
            Ai-Novel
          </button> &copy; {new Date().getFullYear()}
        </footer>

        {/* 小说历史抽屉组件 */}
        <NovelHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          onSelectNovel={selectNovelFromHistory}
        />
      </div>
    );
  }
}
