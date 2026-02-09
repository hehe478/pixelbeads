
export interface PixelArt {
  id: string;
  title: string;
  author: string;
  likes: string;
  difficulty: 'Simple' | 'Medium' | 'Hard';
  imageUrl: string;
  tags?: string[];
  size?: string;
  colorCount?: number;
}

export interface BeadRaw {
  id: string;
  code: string;
  rgb: number[];
  sets: number[];
}

export interface BeadColor {
  id: string;
  name?: string;
  hex: string;
  code: string;
  brand: string;
  sets: number[];
}

export interface PaletteConfig {
  brand: string;
  set: number | 'all' | 'custom';
  customIds: string[]; // List of IDs if set is 'custom'
  hiddenIds: string[]; // List of IDs to hide from standard sets
}

export interface Draft {
  id: string;
  title: string;
  grid: {[key: string]: string};
  width: number;
  height: number;
  lastModified: number;
  thumbnail?: string;
  minX?: number;
  minY?: number;
  isFreeMode?: boolean;
  offsetX?: number;
  offsetY?: number;
  zoom?: number;
}

// Fallback constant removed, will be loaded from JSON via Context
export const ARTKAL_COLORS: BeadColor[] = []; 

export const DEMO_ARTS: PixelArt[] = [
  {
    id: '1',
    title: '电气鼠',
    author: '像素艺术家',
    likes: '2.4k',
    difficulty: 'Simple',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrHAJNZnrdBZzylYsD3d9Lqcy8rRLsa2bK9Rs6Y6HbZmknT4CSEUfraVOvlP1nvgI2GJlYXLDSIqo8nraz1un15Mnvd1ZMKiKW0GTKvVIqQ-YI_ZnUgAv8BXu-9UrMhShOyYvELbT_dpcz-N36sjLyN80sGRBHt6focIlQdgNiLAZNrz-x0sMzODLlOzc8jHcim6w1a5iJpjwliEjy3s79Dy7mJmj7mAEIQlHFuP9JADJFVyJQ6AsNExwn4GR9MNpY7lbVm0xqK1Rx',
    size: '32x32',
    colorCount: 4
  },
  {
    id: '2',
    title: '跳跃水管工',
    author: '复古之王',
    likes: '892',
    difficulty: 'Medium',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP_UyiskNARwavtuVCBVMuiV1FMhgicJUXiiTEsT27uJasYnpLON8hk85r6h0BTz-qfe9DBjHOHOeU9wF6YFwSVO94RijgSQksHOfO9SWA9TP7gVUDcKyF7aEcbLZOUPupDEccgpxxONR375vCkQRifQVdGTF1_8YlKXT9DWF2ir7t-lDXgnPcUToDs5cTfgjcyAZNMutn8pJfZDsDmZO-wrm6MPlTkW3J8fYbAG3OLtl2_Rdlo0TOxkk0T-VVvZAsvMBWa6eqnrTg',
    size: '32x32',
    colorCount: 8
  },
  {
    id: '3',
    title: '森林之灵',
    author: '吉卜力迷',
    likes: '5.1k',
    difficulty: 'Hard',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIqkMa-cQayr45d2dixbZarrSWD-a2YEJWZgbOs2b0bzzjm4UAue3_c1fH6BqDv7YNZH6n-t6bFy27fqbUtXbfC5dGBzKXIfCZglpxNTMlOk9aGMT4ccJZ1HolzKqAvDJgHnxbPOlqG2Hwh5Us4GRZUKqPBiSDm6SQvkmF6BcGmPTV_M9_UVmLFe07-BtSpm5Fw4uO51jEVC2hxpqYTEL_yr1brOs8WRALPYHctnqay51taQ74JZ_2hXi_tFnNots1-3anGmj9ecjM'
  },
  {
    id: '4',
    title: '哈利波特',
    author: '魔法豆',
    likes: '1.2k',
    difficulty: 'Medium',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALe-J9qDSzQQMWOR2fvUsitffY9fiPEa0MO9O4i9802aNteZkL8Oxw-iIrvVZihRJUTATj_fYp_12i_EVQA22JRstmjF3aZOQW5Ax0x8gmHd1AH7ZO1Uza2Z_TCKovTwgao4VNF7os8M72MiRhzuoLthsM6Chf4_BZekI8PNeMJNzbMkGiBn2FSFptnXZWSPKGjYZszcVbnxpYUXfI1MDA836Bo3D_rLDpy-0l9uFUtW8fDLCtjsYyi5rcOSsCELJk-YKXyatppRoC'
  },
  {
    id: '5',
    title: '凯蒂猫蝴蝶结',
    author: '可爱像素',
    likes: '3.8k',
    difficulty: 'Simple',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBGneDhD3Q_9z6PUqQkD_YVWEtz019qfF2kuYRm5ZNuyG98sFs3S_aC4NbXP5YYPma8Zj8FRujy-WWdxEaaR89EX8evXZ8kxX7Ms-gdTBDlV8nu21iZmABFodnClBI8Jj_O6K6ahO9SXlF_M_yhDsVSs91ypV3ZWahs1QXTLa4Lf-H3QxEB7jTLbuYSmbrWUBj5N3NnyWkMuyY2vC81FNltZe2ASY9WtEMnSJb4fsmVH2_zFv15KixxBXOaHpxZs0aq6v62j5WEMstW'
  }
];

export const CATEGORIES = ['卡通', '明星', '热门综艺', '游戏', '风景', '三丽鸥', '宝可梦', '迪士尼'];
