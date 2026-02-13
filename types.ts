
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
  category?: string; // Added for filtering
  dataUrl?: string; // URL to the remote JSON file containing grid data
}

export interface Draft {
  id: string;
  title: string;
  grid: { [key: string]: string };
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

export interface CustomPalette {
  id: string;
  name: string;
  beadIds: string[];
  createdAt: number;
}

export interface PaletteConfig {
  brand: string;
  set: number | 'all' | 'custom';
  activeCustomId?: string; 
  hiddenIds: string[]; 
}

export const ARTKAL_COLORS: BeadColor[] = []; 

export const CATEGORIES = ['全部', '卡通', '游戏', '吉卜力', '哈利波特', '三丽鸥', '宝可梦', '迪士尼'];
