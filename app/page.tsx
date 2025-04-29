// app/page.tsx（使用状态管理替代路由）
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

  // 当选择查看特定小说时
  useEffect(() => {
    if (currentNovelId && appMode === APP_MODE.VIEW && !initialLoadComplete.current) {
      fetchNovel(currentNovelId);
      initialLoadComplete.current = true;
    }
  }, [currentNovelId, appMode]);

  // 重置应用状态的函数
  const resetAppState = () => {
    setNovel(null);
    setNovelHistoryList([]);
    setCurrentHistory(null);
    setSelectedChoice(null);
    setEditedTitle('');
    setIsEditingTitle(false);
    setCustomChoice('');
    initialLoadComplete.current = false;
  };

  // 获取风格名称
  const getGenreName = (genreId: string) => {
    const genre = genreOptions.find(g => g.id === genreId);
    return genre ? genre.name : '武侠江湖';
  };

  // 直接开始创作
  const startNovel = async (genreId?: string) => {
    // 使用传入的genreId或已选择的风格
    const genre = genreId || selectedGenre;

    if (!genre || !session?.user?.id) {
      if (!session) {
        // 显示登录提示或重定向到登录页
        window.location.href = '/login';
        return;
      }
      return;
    }

    setIsGenerating(true);

    try {
      const genreName = getGenreName(genre);

      // 创建新小说
      const response = await fetch('/api/novel', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genre: genreName,
          title: `我的${genreName}小说`
        }),
      });

      if (!response.ok) {
        toast.error('创建小说失败');
        return;
      }

      const novelData = await response.json();

      // 保存小说ID并获取详情
      setCurrentNovelId(novelData.id);
      setNovel(novelData);
      setEditedTitle(novelData.title);

      // 切换到查看模式
      setAppMode(APP_MODE.VIEW);

      // 获取小说历史记录
      await fetchNovelHistory(novelData.id);
    } catch (error) {
      console.error('获取小说历史记录错误:', error);
      toast.error('获取小说历史记录错误');
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

        // 尝试解析选项
        try {
          // 根据实际API返回格式调整
          if (typeof latestHistory.choices === 'string') {
            const parsedChoices = JSON.parse(latestHistory.choices);
            // 重置选择状态
            setSelectedChoice(null);
          }
        } catch (e) {
          toast.error('解析选项错误');
          console.error('解析选项错误:', e);
          return;
        }
      }
    } catch (error) {
      console.error('获取小说历史记录错误:', error);
      toast.error('获取小说历史记录错误');
    }
  };

  // 更新小说标题
  const updateNovelTitle = async () => {
    if (!currentNovelId || !editedTitle.trim()) return;

    try {
      const response = await fetch('/api/novel', {
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
      setNovel(updatedNovel);
      toast.success('小说标题已更新');
    } catch (error) {
      console.error('更新小说标题失败:', error);
      toast.error('更新小说标题失败');
    } finally {
      setIsEditingTitle(false);
    }
  };

  // 选择剧情选项并直接继续故事
  const handleChoiceSelect = (choice: { id: string, text: string }) => {
    setSelectedChoice(choice.id);
    // 选择后直接触发继续故事
    continueStory(choice.text);
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
  const continueStory = async (choiceText: string) => {
    if (!choiceText || !session?.user?.id || isGenerating || !currentHistory || !currentNovelId) return;

    setIsGenerating(true);
    try {
      // 先更新当前历史记录中的选择
      const updatedCurrentHistory = {
        ...currentHistory,
        selected_choice: choiceText
      };

      // 更新历史记录列表中的当前记录
      setNovelHistoryList(prev =>
        prev.map(history =>
          history.id === currentHistory.id ? updatedCurrentHistory : history
        )
      );

      // 设置当前历史为更新后的历史
      setCurrentHistory(updatedCurrentHistory);

      // 调用API继续生成故事
      const response = await fetch('/api/novel/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          novelId: currentNovelId,
          novelHistoryId: currentHistory.id,
          selectedChoiceText: choiceText
        }),
      });

      if (!response.ok) {
        toast.error('生成故事失败');
        throw new Error('生成故事失败');
      }

      const newHistory = await response.json();

      // 将新的历史记录添加到列表中
      setNovelHistoryList(prev => [...prev, newHistory]);
      setCurrentHistory(newHistory);
      setSelectedChoice(null);
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

  // 获取当前选项
  const getCurrentChoices = () => {
    if (!currentHistory?.choices) return [];

    try {
      if (typeof currentHistory.choices === 'string') {
        return JSON.parse(currentHistory.choices);
      }
      return currentHistory.choices;
    } catch (e) {
      console.error('解析选项失败:', e);
      return [];
    }
  };

  // 根据应用模式显示不同内容
  if (appMode === APP_MODE.VIEW) {
    // 小说查看/编辑
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
          <div className="text-sm text-slate-500 dark:text-slate-400">

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
                  {history.selected_choice && (
                    <div className="mb-2 p-3 bg-primary/5 border border-primary/10 rounded-md text-sm font-medium">
                      {history.selected_choice}
                    </div>
                  )}
                </div>
              ))}

              {/* 如果没有历史记录 */}
              {novelHistoryList.length === 0 && (
                <p>等待故事生成...</p>
              )}
              {/* 选项区域 */}
              {currentHistory && !isGenerating && (
                <div className="mb-8">
                  <div className="my-6">
                    <Separator />
                  </div>
                  <h2 className="text-xl font-semibold mb-4">接下来的剧情发展:</h2>
                  <div className="space-y-3">
                    {getCurrentChoices().map((choice: { id: string, text: string }) => (
                      <div
                        key={choice.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedChoice === choice.id
                          ? 'border-primary bg-primary/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                          }`}
                        onClick={() => handleChoiceSelect(choice)}
                      >
                        {choice.text}
                      </div>
                    ))}

                    {/* 自定义剧情输入区域 */}
                    <div className="flex items-center gap-2 mt-4">
                      <div className="relative flex-1">
                        <Textarea
                          placeholder="自定义输入下一步剧情发展..."
                          value={customChoice}
                          onChange={(e) => setCustomChoice(e.target.value)}
                          className="p-3 pr-12 min-h-[50px] border-2 rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 transition-all hover:border-slate-300 dark:hover:border-slate-600 focus-visible:ring-1 focus-visible:ring-slate-400 resize-none"
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
                            className={`w-10 h-10 ${customChoice.trim() && !isGenerating
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
              {isGenerating && (
                <div className="flex justify-center items-center py-4">
                  <span className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                  <span>正在生成故事...</span>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-10"
            >
              <LogOut />
            </Button>
          </div>
        </header>

        <main className="w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {genreOptions.map((genre) => (
              <div
                key={genre.id}
                className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${isGenerating ? 'opacity-50 pointer-events-none' : selectedGenre === genre.id ? 'border-primary bg-primary/10' : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
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
