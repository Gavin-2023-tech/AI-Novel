import sqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbPath = path.join(process.cwd(), 'data/data.db');

// 确保目录存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`数据库目录创建成功: ${dbDir}`);
}

// 初始化数据库连接
export const db = sqlite3(dbPath);

// 初始化数据库表
function initDb() {
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 小说表
  db.exec(`
    CREATE TABLE IF NOT EXISTS novels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // 小说历史记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id INTEGER NOT NULL,
      story_content TEXT NOT NULL,
      choices TEXT NOT NULL,
      selected_choice TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
    );
  `);

  console.log('数据库初始化完成');
}

// 初始化数据库
initDb();


export interface Novel {
  id: number;
  user_id: number;
  title: string;
  genre: string;
  created_at: string;
}
export interface NovelHistory {
  id: number;
  novel_id: number;
  story_content: string;
  choices: string;
  selected_choice: string | null;
  created_at: string;
}

/**
 * 创建新小说
 * @param userId - 用户ID
 * @param title - 小说标题
 * @param genre - 小说类型
 * @returns 创建的小说对象
 */
export function createNovel(userId: number, title: string, genre: string): Novel | null {
  try {
    const stmt = db.prepare(`
      INSERT INTO novels (user_id, title, genre)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(userId, title, genre);

    if (info.changes > 0) {
      // 返回新创建的小说对象
      return {
        id: Number(info.lastInsertRowid),
        user_id: userId,
        title,
        genre,
        created_at: new Date().toISOString()
      };
    }
    return null;
  } catch (error) {
    console.error('创建小说失败:', error);
    throw error;
  }
}
/**
 * 获取用户所有小说
 * @param userId - 用户ID
 * @returns 小说数组
 */
export function getUserNovels(userId: number): Novel[] {
  try {
    const stmt = db.prepare(`
      SELECT * FROM novels
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(userId) as Novel[];
  } catch (error) {
    console.error('获取用户小说失败:', error);
    throw error;
  }
}
/**
 * 根据ID获取小说
 * @param novelId - 小说ID
 * @returns 小说对象或null
 */
export function getNovelById(novelId: number, userId: number): Novel | null {
  try {
    const stmt = db.prepare(`
      SELECT * FROM novels
      WHERE id = ? AND user_id = ?
    `);

    return (stmt.get(novelId, userId) as Novel | undefined) || null;
  } catch (error) {
    console.error('获取小说详情失败:', error);
    throw error;
  }
}

/**
 * 根据ID删除小说
 * @param novelId - 小说ID
 * @returns boolean
 */
export function deleteNovelById(novelId: number, userId: number): boolean {
  try {
    const stmt = db.prepare(`
      DELETE FROM novels
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(novelId, userId);
    ;
    return result.changes > 0;
  } catch (error) {
    console.error('删除小说失败:', error);
    throw error;
  }
}

/**
 * 更新小说的标题
 * @param novelId - 历史记录ID
 * @param userId - 用户ID，用于验证权限
 * @param title - 标题字符串
 * @returns 更新是否成功
 */
export function updateNovelTitle(
  novelId: number,
  userId:number,
  title: string
): boolean {
  try {
    // 通过验证后，更新选择项
    const updateStmt = db.prepare(`UPDATE novels SET title = ? WHERE id = ? AND user_id = ?`);

    const result = updateStmt.run(title,novelId, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('更新历史记录选择项失败:', error);
    throw error;
  }
}

/**
 * 插入小说历史记录，并验证用户权限
 * @param novelId - 小说ID
 * @param userId - 用户ID，用于验证权限
 * @param content - 历史内容
 * @param choices - 选择项
 * @returns 插入的历史记录ID，如果用户无权限则返回null
 */
export function insertNovelHistory(
  novelId: number,
  userId: number,
  story_content: string,
  choices: string
): number | null {
  try {
    // 首先验证该小说是否属于该用户
    const checkStmt = db.prepare(`
      SELECT id FROM novels
      WHERE id = ? AND user_id = ?
    `);

    const novel = checkStmt.get(novelId, userId);

    // 如果小说不存在或不属于该用户，返回null
    if (!novel) {
      console.warn(`用户 ${userId} 尝试为不属于他的小说 ${novelId} 添加历史记录`);
      return null;
    }

    // 通过验证后，插入历史记录
    const insertStmt = db.prepare(`
      INSERT INTO novel_history (novel_id, story_content, choices, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    const result = insertStmt.run(novelId, story_content, choices);
    return result.lastInsertRowid as number;
  } catch (error) {
    console.error('插入小说历史记录失败:', error);
    throw error;
  }
}

/**
 * 更新小说历史记录中的选择项
 * @param historyId - 历史记录ID
 * @param userId - 用户ID，用于验证权限
 * @param selectedChoice - 用户选择的选项
 * @returns 更新是否成功
 */
export function updateNovelHistorySelect(
  historyId: number,
  userId: number,
  selectedChoiceText: string
): boolean {
  try {
    // 首先验证该历史记录是否属于该用户的小说
    const checkStmt = db.prepare(`
      SELECT nh.id 
      FROM novel_history nh
      JOIN novels n ON nh.novel_id = n.id
      WHERE nh.id = ? AND n.user_id = ?
    `);

    const history = checkStmt.get(historyId, userId);

    // 如果历史记录不存在或不属于该用户的小说，返回false
    if (!history) {
      console.warn(`用户 ${userId} 尝试更新不属于他的历史记录 ${historyId}`);
      return false;
    }

    // 通过验证后，更新选择项
    const updateStmt = db.prepare(`UPDATE novel_history SET selected_choice = ? WHERE id = ?`);

    const result = updateStmt.run(selectedChoiceText, historyId);
    return result.changes > 0;
  } catch (error) {
    console.error('更新历史记录选择项失败:', error);
    throw error;
  }
}

/**
 * 获取特定ID的历史记录，并验证用户权限
 * @param historyId - 历史记录ID
 * @param userId - 用户ID，用于验证权限
 * @returns 历史记录对象或null（如果不存在或用户无权限）
 */
export function getNovelHistoryById(historyId: number, userId: number): NovelHistory | null {
  try {
    // 使用JOIN查询验证该历史记录是否属于该用户的小说
    const stmt = db.prepare(`
      SELECT nh.* 
      FROM novel_history nh
      JOIN novels n ON nh.novel_id = n.id
      WHERE nh.id = ? AND n.user_id = ?
    `);

    const result = stmt.get(historyId, userId) as NovelHistory | undefined;
    return result || null;
  } catch (error) {
    console.error('获取历史记录详情失败:', error);
    throw error;
  }
}

/**
 * 获取指定Novel的所有历史记录，并验证用户权限
 * @param novelId - 小说ID
 * @param userId - 用户ID，用于验证权限
 * @returns 历史记录对象列表
 */
export function listNovelHistory(novelId: number, userId: number): NovelHistory[] {
  try {
    // 首先验证该小说是否属于该用户
    const checkStmt = db.prepare(`
      SELECT id FROM novels
      WHERE id = ? AND user_id = ?
    `);

    const novel = checkStmt.get(novelId, userId);

    // 如果小说不存在或不属于该用户，返回空数组
    if (!novel) {
      console.warn(`用户 ${userId} 尝试访问不属于他的小说 ${novelId} 的历史记录`);
      return [];
    }

    // 通过验证后，查询历史记录
    const historyStmt = db.prepare(`
      SELECT * FROM novel_history
      WHERE novel_id = ?
      ORDER BY created_at ASC
    `);

    return historyStmt.all(novelId) as NovelHistory[];
  } catch (error) {
    console.error('获取小说历史记录失败:', error);
    throw error;
  }
}
