import React, { useState, useMemo, useEffect } from 'react';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor } from '../utils/colors';
import { BeadColor } from '../types';

interface PaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (color: BeadColor) => void;
}

const PaletteModal: React.FC<PaletteModalProps> = ({ isOpen, onClose, onSelect }) => {
  const { 
    allBeads, 
    availableBrands,
    paletteConfig
  } = useColorPalette();

  const [activeBrand, setActiveBrand] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Effect to safely set initial active brand once data is loaded
  useEffect(() => {
    if (isOpen && availableBrands && availableBrands.length > 0) {
      if (paletteConfig?.brand && availableBrands.includes(paletteConfig.brand)) {
        setActiveBrand(paletteConfig.brand);
      } else if (!activeBrand) {
        setActiveBrand(availableBrands[0]);
      }
    }
  }, [isOpen, availableBrands, paletteConfig]);

  // Defensive check: If data is missing, show loading or return null
  if (!isOpen) return null;
  
  // Check if critical data is missing or empty
  if (!allBeads || !availableBrands || availableBrands.length === 0) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
            <div className="bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        </div>
    );
  }

  // Filter beads for display based on active tab and search
  const displayBeads = allBeads.filter(bead => {
    // If activeBrand is not yet set, wait for effect
    if (!activeBrand) return false;

    const matchesBrand = bead.brand === activeBrand;
    const matchesSearch = searchTerm === '' || 
                          bead.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          bead.id?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
      {/* Container: Bottom sheet on mobile, Modal on desktop */}
      <div className="bg-white dark:bg-surface-dark w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh] sm:h-[85vh] transition-transform duration-300 transform translate-y-0">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark shrink-0 z-10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">选择颜色</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <span className="material-symbols-outlined text-gray-500">close</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[20px]">search</span>
             <input 
               type="text" 
               placeholder="搜索色号..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-gray-100 dark:bg-black/20 border-none rounded-xl pl-10 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white"
             />
          </div>

          {/* Brand Tabs with Scrollbar */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
            {availableBrands.map(brand => (
              <button
                key={brand}
                onClick={() => setActiveBrand(brand)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
                  activeBrand === brand 
                    ? 'bg-primary border-primary text-white shadow-md shadow-primary/20' 
                    : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-[#151520]">
           <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 sm:gap-4 pb-safe">
               {displayBeads.map(bead => {
                   const textColor = getTextColor(bead.hex);
                   return (
                       <button 
                         key={bead.id}
                         onClick={() => onSelect(bead)}
                         className="flex flex-col items-center gap-1 group"
                       >
                           <div 
                             className="w-full aspect-square rounded-full shadow-sm border border-black/5 dark:border-white/10 transition-transform active:scale-90 group-hover:scale-105 relative overflow-hidden"
                             style={{ backgroundColor: bead.hex }}
                           >
                             {/* Glossy effect overlay */}
                             <div className="absolute inset-0 bg-gradient-to-tr from-black/5 to-white/20 pointer-events-none"></div>
                           </div>
                           <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 truncate w-full text-center group-hover:text-primary transition-colors">
                             {bead.code}
                           </span>
                       </button>
                   )
               })}
               
               {displayBeads.length === 0 && (
                 <div className="col-span-5 sm:col-span-6 flex flex-col items-center justify-center py-12 text-gray-400">
                   <span className="material-symbols-outlined text-4xl mb-2 opacity-50">palette</span>
                   <p className="text-sm">未找到相关颜色</p>
                 </div>
               )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default PaletteModal;