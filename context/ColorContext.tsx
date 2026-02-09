import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { beadsData } from '../data/beads_data';
import { BeadColor, BeadRaw, PaletteConfig } from '../types';
import { rgbToHex } from '../utils/colors';

interface ColorContextType {
  allBeads: BeadColor[];
  currentPalette: BeadColor[];
  paletteConfig: PaletteConfig;
  availableBrands: string[];
  availableSets: number[];
  setBrand: (brand: string) => void;
  setSet: (set: number | 'all' | 'custom') => void;
  toggleHiddenColor: (id: string) => void;
  toggleCustomColor: (id: string) => void;
  resetCustomPalette: () => void;
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

  // Persist config
  useEffect(() => {
    localStorage.setItem('pixelbead_palette_config', JSON.stringify(paletteConfig));
  }, [paletteConfig]);

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

  // Filter Logic
  const currentPalette = useMemo(() => {
    let baseList = processedBeads.filter(b => b.brand === paletteConfig.brand);

    if (paletteConfig.set === 'custom') {
      return processedBeads.filter(b => paletteConfig.customIds.includes(b.id)); // Allow cross-brand custom palettes in future? Currently restricted to filtered list logic usually, but here we can be flexible. 
      // For simplicity, let's keep custom restricted to current brand or allow global?
      // Requirement says "Custom scheme... completely free choice". Let's assume global access for custom.
      // Actually, step C says "User can see current set colors... or add from full set".
      // Let's implement: Custom Palette is a list of ANY ID.
      return processedBeads.filter(b => paletteConfig.customIds.includes(b.id));
    } else if (paletteConfig.set !== 'all') {
      baseList = baseList.filter(b => b.sets.includes(paletteConfig.set as number));
    }

    // Apply Hidden Mask (for standard sets)
    return baseList.filter(b => !paletteConfig.hiddenIds.includes(b.id));
  }, [paletteConfig]);

  // Actions
  const setBrand = (brand: string) => {
    // When switching brand, try to find a matching set or default to first available
    const brandBeads = processedBeads.filter(b => b.brand === brand);
    const brandSets = new Set<number>();
    brandBeads.forEach(b => b.sets?.forEach(s => brandSets.add(s)));
    const setsArr = Array.from(brandSets).sort((a, b) => a - b);
    
    // If current set exists in new brand, keep it. Else pick first set.
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

  return (
    <ColorContext.Provider value={{
      allBeads: processedBeads,
      currentPalette,
      paletteConfig,
      availableBrands,
      availableSets,
      setBrand,
      setSet,
      toggleHiddenColor,
      toggleCustomColor,
      resetCustomPalette
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
};