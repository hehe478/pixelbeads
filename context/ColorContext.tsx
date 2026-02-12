
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { beadsData } from '../data/beads_data';
import { BeadColor, BeadRaw, PaletteConfig, CustomPalette } from '../types';
import { rgbToHex } from '../utils/colors';
import { useAuth } from './AuthContext';
import { PaletteAPI } from '../utils/mockBackend';

interface ColorContextType {
  allBeads: BeadColor[];
  currentPalette: BeadColor[];
  recentColors: BeadColor[];
  customPalettes: CustomPalette[];
  paletteConfig: PaletteConfig;
  availableBrands: string[];
  availableSets: number[];
  setBrand: (brand: string) => void;
  setSet: (set: number | 'all' | 'custom') => void;
  toggleHiddenColor: (id: string) => void;
  toggleCustomColor: (id: string) => void;
  toggleBeadInPalette: (paletteId: string, beadId: string) => void;
  updateCustomPaletteBeads: (paletteId: string, beadIds: string[]) => void;
  resetCustomPalette: () => void;
  addToRecent: (color: BeadColor) => void;
  createCustomPalette: () => void;
  renameCustomPalette: (id: string, name: string) => void;
  deleteCustomPalette: (id: string) => void;
  selectCustomPalette: (id: string) => void;
  getActiveCustomPalette: () => CustomPalette | undefined;
  importPalettes: (jsonString: string) => void;
  syncToCloud: () => Promise<void>;
}

const ColorContext = createContext<ColorContextType | undefined>(undefined);

// Transform Raw Data - Done once at module level
const processedBeads: BeadColor[] = (beadsData as BeadRaw[]).map(bead => {
  const brand = bead.id.split('_')[0];
  return {
    id: bead.id,
    code: bead.code,
    hex: rgbToHex(bead.rgb[0], bead.rgb[1], bead.rgb[2]),
    sets: bead.sets || [],
    brand: brand,
    name: `${brand} ${bead.code}`
  };
});

const DEFAULT_CONFIG: PaletteConfig = {
  brand: 'COCO',
  set: 24,
  hiddenIds: []
};

export const ColorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [paletteConfig, setPaletteConfig] = useState<PaletteConfig>(() => {
    try {
      const saved = localStorage.getItem('pixelbead_palette_config');
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [recentColors, setRecentColors] = useState<BeadColor[]>(() => {
    try {
      const saved = localStorage.getItem('pixelbead_recent_colors');
      if (saved) {
        const parsedIds = JSON.parse(saved) as string[];
        return parsedIds.map(id => processedBeads.find(b => b.id === id)).filter((b): b is BeadColor => !!b);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
  // Use a flag to avoid saving empty state to local storage during initial load
  const [isInitialized, setIsInitialized] = useState(false);

  // 初始化：根据登录状态加载数据
  useEffect(() => {
    const loadPalettes = async () => {
      setIsInitialized(false);
      if (isAuthenticated && user) {
        try {
          const cloudData = await PaletteAPI.getUserPalettes(user.id);
          setCustomPalettes(cloudData);
        } catch (e) {
          console.error("Failed to load cloud palettes", e);
          // Fallback or error handling
        }
      } else {
        // Not logged in: Load from LocalStorage
        try {
          const saved = localStorage.getItem('pixelbead_custom_palettes');
          const parsed = saved ? JSON.parse(saved) : [];
          setCustomPalettes(Array.isArray(parsed) ? parsed.map((p: any) => ({
            ...p,
            beadIds: Array.isArray(p.beadIds) ? p.beadIds : []
          })) : []);
        } catch {
          setCustomPalettes([]);
        }
      }
      setIsInitialized(true);
    };

    loadPalettes();
  }, [isAuthenticated, user?.id]);

  // 监听变化：未登录时保存到 LocalStorage
  useEffect(() => {
    if (!isAuthenticated && isInitialized) {
      localStorage.setItem('pixelbead_custom_palettes', JSON.stringify(customPalettes));
    }
  }, [customPalettes, isAuthenticated, isInitialized]);

  // 配置和最近使用的颜色总是保存在本地
  useEffect(() => {
    localStorage.setItem('pixelbead_palette_config', JSON.stringify(paletteConfig));
  }, [paletteConfig]);

  useEffect(() => {
    localStorage.setItem('pixelbead_recent_colors', JSON.stringify(recentColors.map(c => c.id)));
  }, [recentColors]);

  // 手动/自动同步到云端
  const syncToCloud = async () => {
    if (isAuthenticated && user) {
      await PaletteAPI.saveUserPalettes(user.id, customPalettes);
    }
  };

  const importPalettes = (jsonString: string) => {
    try {
      const imported = JSON.parse(jsonString);
      if (!Array.isArray(imported)) throw new Error('Format error');
      
      // Basic validation and cleaning
      const cleanPalettes: CustomPalette[] = imported.map((p: any) => ({
        id: p.id || Date.now().toString() + Math.random(),
        name: p.name || '导入的配色',
        beadIds: Array.isArray(p.beadIds) ? p.beadIds : [],
        createdAt: p.createdAt || Date.now()
      }));

      // Merge: append imported palettes
      setCustomPalettes(prev => [...cleanPalettes, ...prev]);
      alert(`成功导入 ${cleanPalettes.length} 个配色方案`);
    } catch (e) {
      alert('导入失败：文件格式不正确');
    }
  };

  const availableBrands = useMemo(() => Array.from(new Set(processedBeads.map(b => b.brand))), []);

  const availableSets = useMemo(() => {
    if (paletteConfig.brand === '自定义') return [];
    const brandBeads = processedBeads.filter(b => b.brand === paletteConfig.brand);
    const sets = new Set<number>();
    brandBeads.forEach(b => b.sets?.forEach(s => sets.add(s)));
    return Array.from(sets).sort((a, b) => a - b);
  }, [paletteConfig.brand]);

  const currentPalette = useMemo(() => {
    if (paletteConfig.set === 'custom') {
      const activePalette = customPalettes.find(p => p.id === paletteConfig.activeCustomId);
      if (activePalette && Array.isArray(activePalette.beadIds)) {
        return processedBeads.filter(b => activePalette.beadIds.includes(b.id));
      }
      return [];
    } 
    let baseList = processedBeads.filter(b => b.brand === paletteConfig.brand);
    if (paletteConfig.set !== 'all') {
      baseList = baseList.filter(b => b.sets.includes(paletteConfig.set as number));
    }
    return baseList.filter(b => !paletteConfig.hiddenIds.includes(b.id));
  }, [paletteConfig, customPalettes]);

  const setBrand = (brand: string) => {
    if (brand === '自定义') return;
    const brandBeads = processedBeads.filter(b => b.brand === brand);
    const brandSets = new Set<number>();
    brandBeads.forEach(b => b.sets?.forEach(s => brandSets.add(s)));
    const setsArr = Array.from(brandSets).sort((a, b) => a - b);
    let newSet = paletteConfig.set;
    if (newSet === 'custom' || (newSet !== 'all' && !brandSets.has(newSet as number))) {
        newSet = setsArr.length > 0 ? setsArr[0] : 'all';
    }
    setPaletteConfig(prev => ({ ...prev, brand, set: newSet, activeCustomId: undefined }));
  };

  const setSet = (set: number | 'all' | 'custom') => {
    setPaletteConfig(prev => ({ ...prev, set }));
  };

  const toggleHiddenColor = (id: string) => {
    setPaletteConfig(prev => ({
      ...prev,
      hiddenIds: prev.hiddenIds.includes(id) ? prev.hiddenIds.filter(hid => hid !== id) : [...prev.hiddenIds, id]
    }));
  };

  const getActiveCustomPalette = () => customPalettes.find(p => p.id === paletteConfig.activeCustomId);

  const createCustomPalette = () => {
    const newPalette: CustomPalette = {
      id: Date.now().toString(),
      name: `我的配色 ${customPalettes.length + 1}`,
      beadIds: [],
      createdAt: Date.now()
    };
    setCustomPalettes(prev => [newPalette, ...prev]);
    selectCustomPalette(newPalette.id);
  };

  const renameCustomPalette = (id: string, name: string) => {
    setCustomPalettes(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const deleteCustomPalette = (id: string) => {
    setCustomPalettes(prev => {
      const newState = prev.filter(p => p.id !== id);
      if (paletteConfig.activeCustomId === id) {
        if (newState.length > 0) selectCustomPalette(newState[0].id);
        else setPaletteConfig({ ...DEFAULT_CONFIG });
      }
      return newState;
    });
  };

  const selectCustomPalette = (id: string) => {
    const palette = customPalettes.find(p => p.id === id);
    if (!palette) return;
    const beads = processedBeads.filter(b => (palette.beadIds || []).includes(b.id));
    const uniqueBrands = new Set(beads.map(b => b.brand));
    let displayBrand = uniqueBrands.size === 1 ? Array.from(uniqueBrands)[0] : '自定义';
    setPaletteConfig(prev => ({ ...prev, brand: displayBrand, set: 'custom', activeCustomId: id }));
  };

  const toggleCustomColor = (id: string) => {
    if (paletteConfig.set !== 'custom' || !paletteConfig.activeCustomId) return;
    toggleBeadInPalette(paletteConfig.activeCustomId, id);
  };

  const toggleBeadInPalette = (paletteId: string, beadId: string) => {
    setCustomPalettes(prev => prev.map(p => {
      if (p.id === paletteId) {
        const ids = Array.isArray(p.beadIds) ? p.beadIds : [];
        const nextIds = ids.includes(beadId) ? ids.filter(bid => bid !== beadId) : [...ids, beadId];
        return { ...p, beadIds: nextIds };
      }
      return p;
    }));
  };

  const updateCustomPaletteBeads = (paletteId: string, beadIds: string[]) => {
    setCustomPalettes(prev => prev.map(p => p.id === paletteId ? { ...p, beadIds } : p));
  };

  const resetCustomPalette = () => {
    if (paletteConfig.activeCustomId) updateCustomPaletteBeads(paletteConfig.activeCustomId, []);
  };

  const addToRecent = (color: BeadColor) => {
    setRecentColors(prev => [color, ...prev.filter(c => c.id !== color.id)].slice(0, 20));
  };

  return (
    <ColorContext.Provider value={{
      allBeads: processedBeads,
      currentPalette,
      recentColors,
      customPalettes,
      paletteConfig,
      availableBrands,
      availableSets,
      setBrand,
      setSet,
      toggleHiddenColor,
      toggleCustomColor,
      toggleBeadInPalette,
      updateCustomPaletteBeads,
      resetCustomPalette,
      addToRecent,
      createCustomPalette,
      renameCustomPalette,
      deleteCustomPalette,
      selectCustomPalette,
      getActiveCustomPalette,
      importPalettes,
      syncToCloud
    }}>
      {children}
    </ColorContext.Provider>
  );
};

export const useColorPalette = () => {
  const context = useContext(ColorContext);
  if (context === undefined) throw new Error('useColorPalette must be used within a ColorProvider');
  return context;
}
