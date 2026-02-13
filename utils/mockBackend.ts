
import { CustomPalette, Draft, PixelArt } from '../types';

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

// --- MOCK OSS DATA START ---
// 实际上这些数据应该存在你的 OSS index.json 中
const MOCK_OSS_INDEX: PixelArt[] = [
  {
    id: 'template_001',
    title: '电气鼠',
    author: '官方图纸',
    likes: '2.4k',
    difficulty: 'Simple',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrHAJNZnrdBZzylYsD3d9Lqcy8rRLsa2bK9Rs6Y6HbZmknT4CSEUfraVOvlP1nvgI2GJlYXLDSIqo8nraz1un15Mnvd1ZMKiKW0GTKvVIqQ-YI_ZnUgAv8BXu-9UrMhShOyYvELbT_dpcz-N36sjLyN80sGRBHt6focIlQdgNiLAZNrz-x0sMzODLlOzc8jHcim6w1a5iJpjwliEjy3s79Dy7mJmj7mAEIQlHFuP9JADJFVyJQ6AsNExwn4GR9MNpY7lbVm0xqK1Rx',
    size: '32x32',
    colorCount: 4,
    category: '宝可梦',
    dataUrl: 'mock://oss/templates/pikachu.json' 
  },
  {
    id: 'template_002',
    title: '跳跃水管工',
    author: '复古之王',
    likes: '892',
    difficulty: 'Medium',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP_UyiskNARwavtuVCBVMuiV1FMhgicJUXiiTEsT27uJasYnpLON8hk85r6h0BTz-qfe9DBjHOHOeU9wF6YFwSVO94RijgSQksHOfO9SWA9TP7gVUDcKyF7aEcbLZOUPupDEccgpxxONR375vCkQRifQVdGTF1_8YlKXT9DWF2ir7t-lDXgnPcUToDs5cTfgjcyAZNMutn8pJfZDsDmZO-wrm6MPlTkW3J8fYbAG3OLtl2_Rdlo0TOxkk0T-VVvZAsvMBWa6eqnrTg',
    size: '32x32',
    colorCount: 8,
    category: '游戏',
    dataUrl: 'mock://oss/templates/mario.json'
  },
  {
    id: 'template_003',
    title: '森林之灵',
    author: '吉卜力迷',
    likes: '5.1k',
    difficulty: 'Hard',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIqkMa-cQayr45d2dixbZarrSWD-a2YEJWZgbOs2b0bzzjm4UAue3_c1fH6BqDv7YNZH6n-t6bFy27fqbUtXbfC5dGBzKXIfCZglpxNTMlOk9aGMT4ccJZ1HolzKqAvDJgHnxbPOlqG2Hwh5Us4GRZUKqPBiSDm6SQvkmF6BcGmPTV_M9_UVmLFe07-BtSpm5Fw4uO51jEVC2hxpqYTEL_yr1brOs8WRALPYHctnqay51taQ74JZ_2hXi_tFnNots1-3anGmj9ecjM',
    category: '吉卜力',
    dataUrl: 'mock://oss/templates/totoro.json'
  },
  {
    id: 'template_004',
    title: '魔法男孩',
    author: '魔法豆',
    likes: '1.2k',
    difficulty: 'Medium',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALe-J9qDSzQQMWOR2fvUsitffY9fiPEa0MO9O4i9802aNteZkL8Oxw-iIrvVZihRJUTATj_fYp_12i_EVQA22JRstmjF3aZOQW5Ax0x8gmHd1AH7ZO1Uza2Z_TCKovTwgao4VNF7os8M72MiRhzuoLthsM6Chf4_BZekI8PNeMJNzbMkGiBn2FSFptnXZWSPKGjYZszcVbnxpYUXfI1MDA836Bo3D_rLDpy-0l9uFUtW8fDLCtjsYyi5rcOSsCELJk-YKXyatppRoC',
    category: '哈利波特',
    dataUrl: 'mock://oss/templates/harry.json'
  },
  {
    id: 'template_005',
    title: '凯蒂猫蝴蝶结',
    author: '可爱像素',
    likes: '3.8k',
    difficulty: 'Simple',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGneDhD3Q_9z6PUqQkD_YVWEtz019qfF2kuYRm5ZNuyG98sFs3S_aC4NbXP5YYPma8Zj8FRujy-WWdxEaaR89EX8evXZ8kxX7Ms-gdTBDlV8nu21iZmABFodnClBI8Jj_O6K6ahO9SXlF_M_yhDsVSs91ypV3ZWahs1QXTLa4Lf-H3QxEB7jTLbuYSmbrWUBj5N3NnyWkMuyY2vC81FNltZe2ASY9WtEMnSJb4fsmVH2_zFv15KixxBXOaHpxZs0aq6v62j5WEMstW',
    category: '三丽鸥',
    dataUrl: 'mock://oss/templates/kitty.json'
  }
];

// 模拟 OSS 中的具体文件内容
// 实际上这是你在编辑器“导出 JSON”后上传到 OSS 的文件内容
const MOCK_OSS_FILES: Record<string, any> = {
  'mock://oss/templates/pikachu.json': {
    width: 32,
    height: 32,
    grid: {
      "15,10": "COCO_E08", "16,10": "COCO_E08",
      "14,11": "COCO_E08", "17,11": "COCO_E08",
      "13,12": "COCO_B09", "18,12": "COCO_B09",
      "15,13": "COCO_B09",
      "14,14": "COCO_C02", "17,14": "COCO_C02"
    }
  },
  'mock://oss/templates/mario.json': {
    width: 32,
    height: 32,
    grid: {
      "16,16": "COCO_C07", "16,17": "COCO_C07",
      "15,18": "COCO_H14", "16,18": "COCO_H14", "17,18": "COCO_H14"
    }
  }
};
// --- MOCK OSS DATA END ---


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
    const mergedDrafts = [...localDrafts, ...cloudDrafts]; 
    const uniqueDrafts = Array.from(new Map(mergedDrafts.map(item => [item.id, item])).values());
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

// --- NEW CLOUD TEMPLATE API ---
// This allows fetching templates dynamically instead of hardcoding them
export const CloudTemplateAPI = {
  // 1. Fetch the list of templates (simulating GET /index.json)
  fetchIndex: async (): Promise<PixelArt[]> => {
    // In production, replace with:
    // const res = await fetch('https://your-oss-bucket.com/index.json');
    // return await res.json();
    await delay(600); // Simulate network latency
    return MOCK_OSS_INDEX;
  },

  // 2. Fetch the detailed grid data for a specific template (simulating GET /template.json)
  fetchTemplateData: async (dataUrl: string): Promise<{grid: any, width: number, height: number}> => {
    // In production, replace with:
    // const res = await fetch(dataUrl);
    // return await res.json();
    await delay(800); // Simulate network latency
    
    const data = MOCK_OSS_FILES[dataUrl];
    if (!data) {
        // Return a default blank if not found in mock
        return { width: 32, height: 32, grid: {} };
    }
    return data;
  }
};
