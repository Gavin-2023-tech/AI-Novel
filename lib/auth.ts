import { db } from './db';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  email: string;
}

export interface UserWithPassword extends User {
  password: string;
}

// 用户注册
export async function registerUser(email: string, password: string): Promise<User | null> {
  try {
    // 检查用户是否已存在
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return null; // 用户已存在
    }

    // 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 插入新用户
    const result = db.prepare(
      'INSERT INTO users (email, password) VALUES (?, ?)'
    ).run(email, hashedPassword);

    if (result.lastInsertRowid) {
      return {
        id: Number(result.lastInsertRowid),
        email
      };
    }
    return null;
  } catch (error) {
    console.error('注册用户时出错:', error);
    return null;
  }
}

// 用户登录
export async function loginUser(email: string, password: string): Promise<User | null> {
  try {
    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserWithPassword | undefined;
    
    if (!user) {
      return null; // 用户不存在
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null; // 密码错误
    }

    // 返回不包含密码的用户信息
    return {
      id: user.id,
      email: user.email
    };
  } catch (error) {
    console.error('登录用户时出错:', error);
    return null;
  }
}

// 根据ID获取用户
export function getUserById(id: number): User | null {
  try {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id) as User | undefined;
    return user || null;
  } catch (error) {
    console.error('获取用户时出错:', error);
    return null;
  }
}