import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { beadsData } from '../data/beads_data';
import { BeadColor, BeadRaw, PaletteConfig } from '../types';
import { rgbToHex } from '../utils/colors';

interface ColorContextType {
  allBeads: BeadColor[];
  currentPalette: BeadColor[]; // Kept for backward compatibility if needed, but primary usage moves to allBeads + filtering
  recentColors: BeadColor[];
  paletteConfig: PaletteConfig;
  availableBrands: string[];
  availableSets: number[];
  setBrand: (brand: string) => void;
  setSet: (set: number | 'all' | 'custom') => void;
  toggleHiddenColor: (id: string) => void;
  toggleCustomColor: (id: string) => void;
  resetCustomPalette: () => void;
  addToRecent: (color: BeadColor) => void;
}

const ColorContext = createContext<ColorContextType | undefined>(undefined);

// Transform Raw Data
const processedBeads: BeadColor[] = (beadsData as BeadRaw[]).map(bead => {
  const brand = bead.id.split('_')[0];
  return {
    id: bead.id,
    code: bead.code,
    hex: rgbToHex(bead.rgb[0], bead.rgb[1], bead.rgb[2]),
    sets: bead.sets,
    brand: brand,
    name: `${brand} ${bead.code}`
  };
});

const DEFAULT_CONFIG: PaletteConfig = {
  brand: 'COCO', // Default brand
  set: 24,       // Default set
  customIds: [],
  hiddenIds: []
};

export const ColorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
        // Rehydrate full objects from IDs
        return parsedIds.map(id => processedBeads.find(b => b.id === id)).filter((b): b is BeadColor => !!b);
      }
      return [];
    } catch {
      return [];
    }
  });

  // Persist config
  useEffect(() => {
    localStorage.setItem('pixelbead_palette_config', JSON.stringify(paletteConfig));
  }, [paletteConfig]);

  // Persist recents
  useEffect(() => {
    const ids = recentColors.map(c => c.id);
    localStorage.setItem('pixelbead_recent_colors', JSON.stringify(ids));
  }, [recentColors]);

  // Derived Data
  const availableBrands = useMemo(() => {
    return Array.from(new Set(processedBeads.map(b => b.brand)));
  }, []);

  const availableSets = useMemo(() => {
    const brandBeads = processedBeads.filter(b => b.brand === paletteConfig.brand);
    const sets = new Set<number>();
    brandBeads.forEach(b => b.sets?.forEach(s => sets.add(s)));
    return Array.from(sets).sort((a, b) => a - b);
  }, [paletteConfig.brand]);

  // Legacy Filter Logic (Still useful for quick filtering if needed)
  const currentPalette = useMemo(() => {
    let baseList = processedBeads.filter(b => b.brand === paletteConfig.brand);

    if (paletteConfig.set === 'custom') {
      return processedBeads.filter(b => paletteConfig.customIds.includes(b.id));
    } else if (paletteConfig.set !== 'all') {
      baseList = baseList.filter(b => b.sets.includes(paletteConfig.set as number));
    }

    // Apply Hidden Mask (for standard sets)
    return baseList.filter(b => !paletteConfig.hiddenIds.includes(b.id));
  }, [paletteConfig]);

  // Actions
  const setBrand = (brand: string) => {
    const brandBeads = processedBeads.filter(b => b.brand === brand);
    const brandSets = new Set<number>();
    brandBeads.forEach(b => b.sets?.forEach(s => brandSets.add(s)));
    const setsArr = Array.from(brandSets).sort((a, b) => a - b);
    
    let newSet = paletteConfig.set;
    if (newSet !== 'all' && newSet !== 'custom' && !brandSets.has(newSet as number)) {
        newSet = setsArr.length > 0 ? setsArr[0] : 'all';
    }

    setPaletteConfig(prev => ({ ...prev, brand, set: newSet }));
  };

  const setSet = (set: number | 'all' | 'custom') => {
    setPaletteConfig(prev => ({ ...prev, set }));
  };

  const toggleHiddenColor = (id: string) => {
    setPaletteConfig(prev => {
      const isHidden = prev.hiddenIds.includes(id);
      return {
        ...prev,
        hiddenIds: isHidden 
          ? prev.hiddenIds.filter(hid => hid !== id)
          : [...prev.hiddenIds, id]
      };
    });
  };

  const toggleCustomColor = (id: string) => {
    setPaletteConfig(prev => {
      const isSelected = prev.customIds.includes(id);
      return {
        ...prev,
        customIds: isSelected
          ? prev.customIds.filter(cid => cid !== id)
          : [...prev.customIds, id]
      };
    });
  };

  const resetCustomPalette = () => {
      setPaletteConfig(prev => ({...prev, customIds: []}));
  }

  const addToRecent = (color: BeadColor) => {
    setRecentColors(prev => {
      const filtered = prev.filter(c => c.id !== color.id);
      return [color, ...filtered].slice(0, 20); // Keep last 20
    });
  };

  return (
    <ColorContext.Provider value={{
      allBeads: processedBeads,
      currentPalette,
      recentColors,
      paletteConfig,
      availableBrands,
      availableSets,
      setBrand,
      setSet,
      toggleHiddenColor,
      toggleCustomColor,
      resetCustomPalette,
      addToRecent
    }}>
      {children}
    </ColorContext.Provider>
  );
};

export const useColorPalette = () => {
  const context = useContext(ColorContext);
  if (context === undefined) {
    throw new Error('useColorPalette must be used within a ColorProvider');
  }
  return context;
}