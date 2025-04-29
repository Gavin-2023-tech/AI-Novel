// components/novel-history-drawer.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Novel } from '@/lib/db';
import { useSession } from "next-auth/react";
import { Trash2 } from 'lucide-react'; // 引入删除图标

interface NovelHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNovel?: (novel: Novel) => void; // 选择小说回调
}

export function NovelHistoryDrawer({ open, onOpenChange, onSelectNovel }: NovelHistoryDrawerProps) {
  const { data: session } = useSession();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null); // 跟踪正在删除的小说ID
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);

  useEffect(() => {
    // 只有在抽屉打开且用户已登录的情况下加载数据
    if (open && session?.user?.id) {
      fetchNovels();
    }
  }, [open, session]);

  // 获取用户的小说列表
  const fetchNovels = async () => {
    setLoading(true);
    try {
      // 调用API获取用户的所有小说
      const response = await fetch(`/api/novel`);
      if (!response.ok) {
        throw new Error('获取小说列表失败');
      }
      const data = await response.json();
      setNovels(data);
    } catch (error) {
      console.error('获取小说列表失败:', error);
      setNovels([]); // 出错时设为空数组
    } finally {
      setLoading(false);
    }
  };

  // 选择小说
  const selectNovel = (novel: Novel) => {
    if (onSelectNovel) {
      onSelectNovel(novel);
    } else {
      // 如果没有提供回调，则默认关闭抽屉
      onOpenChange(false);
    }
  };
  
  // 打开/关闭popover
  const togglePopover = (e: React.MouseEvent, novelId: number) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发selectNovel
    setOpenPopoverId(openPopoverId === novelId ? null : novelId);
  };
  
  // 删除小说
  const deleteNovel = async (e: React.MouseEvent, novelId: number) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发selectNovel
    
    setDeleting(novelId);
    setOpenPopoverId(null); // 关闭popover
    
    try {
      const response = await fetch(`/api/novel?id=${novelId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('删除小说失败');
      }
      
      // 删除成功，从列表中移除
      setNovels(novels.filter(novel => novel.id !== novelId));
    } catch (error) {
      console.error('删除小说失败:', error);
      alert('删除小说失败，请重试');
    } finally {
      setDeleting(null);
    }
  };
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '日期格式错误';
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-full sm:w-3/4 md:w-1/2 lg:max-w-lg">
        <DrawerHeader>
          <DrawerTitle className="text-2xl">我的作品集</DrawerTitle>
          <DrawerDescription>查看并继续你的创作</DrawerDescription>
        </DrawerHeader>
        
        <div className="px-4 py-2 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p>加载中...</p>
            </div>
          ) : novels.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <p className="text-lg mb-4">你还没有创作任何小说</p>
              <DrawerClose asChild>
                <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
              </DrawerClose>
            </div>
          ) : (
            <div className="space-y-4">
              {novels.map((novel) => (
                <div 
                  key={novel.id}
                  className="relative bg-white dark:bg-slate-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => selectNovel(novel)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h2 className="text-lg font-semibold">{novel.title || '无标题'}</h2>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-sm">
                      {novel.genre || '未分类'}
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 py-2">
                    点击查看故事内容
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      <span>创建于: {formatDate(novel.created_at)}</span>
                    </div>
                    
                    {deleting === novel.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-slate-100 dark:hover:bg-slate-700"
                        disabled
                      >
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
                      </Button>
                    ) : (
                      <Popover open={openPopoverId === novel.id} onOpenChange={(open) => {
                        if (!open) setOpenPopoverId(null);
                      }}>
                        <PopoverTrigger asChild onClick={(e) => togglePopover(e, novel.id)}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-slate-100 dark:hover:bg-slate-700"
                            aria-label="删除小说"
                          >
                            <Trash2 size={18} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-auto p-3" 
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-center space-y-3">
                            <p className="font-medium">确定要删除这个小说吗？</p>
                            <div className="flex justify-end space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenPopoverId(null);
                                }}
                              >
                                取消
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => deleteNovel(e, novel.id)}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">关闭</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
