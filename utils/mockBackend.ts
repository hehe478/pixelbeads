
import { CustomPalette, Draft } from '../types';

// 模拟数据库接口
interface User {
  username: string;
  password: string; // 在真实后端中这应该是哈希过的
  id: string;
  avatar?: string;
  isVip?: boolean;
}

const DB_KEY = 'pixelbead_mock_users';
const PALETTE_DB_KEY = 'pixelbead_mock_palettes'; 
const DRAFT_DB_KEY = 'pixelbead_mock_drafts'; // 新增草稿云端存储
const ACTIVATION_CODE = '123456789';

// 预设管理员账户
const ADMIN_USER: User = {
  id: 'admin_001',
  username: 'admin',
  password: '123456', 
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
  isVip: true
};

const Validators = {
  username: (str: string) => /^[a-zA-Z0-9]{8,16}$/.test(str),
  password: (str: string) => /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,16}$/.test(str)
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getUsers = (): User[] => {
  const stored = localStorage.getItem(DB_KEY);
  const users: User[] = stored ? JSON.parse(stored) : [];
  if (!users.find(u => u.username === ADMIN_USER.username)) {
    return [ADMIN_USER, ...users];
  }
  return users;
};

const saveUser = (user: User) => {
  const stored = localStorage.getItem(DB_KEY);
  const users: User[] = stored ? JSON.parse(stored) : [];
  users.push(user);
  localStorage.setItem(DB_KEY, JSON.stringify(users));
};

export const MockAPI = {
  login: async (username: string, password: string): Promise<User> => {
    await delay(800);
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (!user) throw new Error('账号或密码错误');
    return user;
  },

  register: async (username: string, password: string, code: string): Promise<User> => {
    await delay(1000);
    if (code !== ACTIVATION_CODE) throw new Error('激活码错误，请联系管理员获取');
    if (!Validators.username(username)) throw new Error('账号格式错误：需8-16位，仅限数字和字母');
    if (!Validators.password(password)) throw new Error('密码格式错误：需8-16位，必须包含数字和字母');
    
    const users = getUsers();
    if (users.find(u => u.username === username)) throw new Error('该账号已被注册');

    const newUser: User = {
      id: Date.now().toString(),
      username,
      password,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      isVip: true 
    };
    saveUser(newUser);
    return newUser;
  }
};

// 配色库云端模拟接口
export const PaletteAPI = {
  getUserPalettes: async (userId: string): Promise<CustomPalette[]> => {
    await delay(400); 
    const allData = JSON.parse(localStorage.getItem(PALETTE_DB_KEY) || '{}');
    return allData[userId] || [];
  },

  saveUserPalettes: async (userId: string, palettes: CustomPalette[]): Promise<boolean> => {
    await delay(600); 
    const allData = JSON.parse(localStorage.getItem(PALETTE_DB_KEY) || '{}');
    allData[userId] = palettes;
    localStorage.setItem(PALETTE_DB_KEY, JSON.stringify(allData));
    return true;
  }
};

// 草稿库云端模拟接口
export const DraftAPI = {
  getUserDrafts: async (userId: string): Promise<Draft[]> => {
    await delay(500);
    const allData = JSON.parse(localStorage.getItem(DRAFT_DB_KEY) || '{}');
    return allData[userId] || [];
  },

  saveUserDrafts: async (userId: string, drafts: Draft[]): Promise<boolean> => {
    await delay(500); 
    const allData = JSON.parse(localStorage.getItem(DRAFT_DB_KEY) || '{}');
    allData[userId] = drafts;
    localStorage.setItem(DRAFT_DB_KEY, JSON.stringify(allData));
    return true;
  },

  // 合并本地数据到云端（去重）
  mergeLocalData: async (userId: string, localDrafts: Draft[], localPalettes: CustomPalette[]): Promise<void> => {
    await delay(1500); // 模拟较长的数据处理时间

    // 1. 处理草稿
    const allDraftsData = JSON.parse(localStorage.getItem(DRAFT_DB_KEY) || '{}');
    const cloudDrafts: Draft[] = allDraftsData[userId] || [];
    // 简单的合并策略：将本地作为新数据追加，可以通过ID去重
    const mergedDrafts = [...localDrafts, ...cloudDrafts]; 
    // 去重逻辑：保留本地版本（假设本地是最新的），或者保留云端？这里简化为ID唯一
    const uniqueDrafts = Array.from(new Map(mergedDrafts.map(item => [item.id, item])).values());
    // 按时间倒序
    uniqueDrafts.sort((a, b) => b.lastModified - a.lastModified);
    allDraftsData[userId] = uniqueDrafts;
    localStorage.setItem(DRAFT_DB_KEY, JSON.stringify(allDraftsData));

    // 2. 处理配色
    const allPalettesData = JSON.parse(localStorage.getItem(PALETTE_DB_KEY) || '{}');
    const cloudPalettes: CustomPalette[] = allPalettesData[userId] || [];
    const mergedPalettes = [...localPalettes, ...cloudPalettes];
    const uniquePalettes = Array.from(new Map(mergedPalettes.map(item => [item.id, item])).values());
    allPalettesData[userId] = uniquePalettes;
    localStorage.setItem(PALETTE_DB_KEY, JSON.stringify(allPalettesData));
  }
};
