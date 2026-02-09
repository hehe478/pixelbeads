import React, { useState } from 'react';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor } from '../utils/colors';

interface PaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PaletteModal: React.FC<PaletteModalProps> = ({ isOpen, onClose }) => {
  const { 
    allBeads, 
    paletteConfig, 
    toggleHiddenColor, 
    toggleCustomColor, 
    setSet,
    resetCustomPalette
  } = useColorPalette();

  const [activeTab, setActiveTab] = useState<'current' | 'custom'>('current');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  // Filter beads for display based on tab
  const displayBeads = allBeads.filter(bead => {
    if (activeTab === 'current') {
       // Show beads belonging to current brand
       return bead.brand === paletteConfig.brand;
    } else {
       // Custom tab shows ALL beads (or could limit to brand, but allowing all is more powerful)
       return true; 
    }
  }).filter(bead => 
     bead.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
     bead.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isCustomMode = paletteConfig.set === 'custom';

  const handleToggle = (id: string) => {
    if (activeTab === 'custom') {
       toggleCustomColor(id);
       if (!isCustomMode) {
           // If user starts editing custom while in a standard set, auto-switch to custom set?
           // Or just let them build it in background. Let's just toggle.
       }
    } else {
       // In 'Current' tab, we are hiding/showing colors from the standard set
       // This implies modifying the 'hiddenIds' list.
       toggleHiddenColor(id);
    }
  };

  const switchToCustom = () => {
      setSet('custom');
      setActiveTab('custom');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">配置调色板</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <span className="material-symbols-outlined text-gray-500">close</span>
            </button>
          </div>
          
          <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
            <button 
              onClick={() => setActiveTab('current')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'current' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              当前套装微调
            </button>
            <button 
              onClick={() => { setActiveTab('custom'); if(!isCustomMode) setSet('custom'); }}
              className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'custom' ? 'bg-white dark:bg-gray-700 shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              完全自定义
            </button>
          </div>

          <div className="relative">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[18px]">search</span>
             <input 
               type="text" 
               placeholder="搜索颜色编号..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl pl-9 py-2 text-sm focus:ring-2 focus:ring-primary/50"
             />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 dark:bg-black/20">
           {activeTab === 'current' && isCustomMode && (
               <div className="text-center py-8 text-gray-500">
                   <p>当前处于自定义模式。</p>
                   <button onClick={() => setActiveTab('custom')} className="text-primary font-bold mt-2">去编辑自定义列表</button>
               </div>
           )}

           {activeTab === 'current' && !isCustomMode && (
               <div className="grid grid-cols-5 gap-3">
                   {displayBeads.map(bead => {
                       // Check if this bead is naturally in the current set
                       const isInSet = paletteConfig.set === 'all' || (typeof paletteConfig.set === 'number' && bead.sets.includes(paletteConfig.set));
                       if (!isInSet) return null;

                       const isHidden = paletteConfig.hiddenIds.includes(bead.id);
                       const textColor = getTextColor(bead.hex);

                       return (
                           <button 
                             key={bead.id}
                             onClick={() => toggleHiddenColor(bead.id)}
                             className={`aspect-square rounded-full flex items-center justify-center relative shadow-sm transition-transform active:scale-95 ${isHidden ? 'opacity-40 grayscale' : ''}`}
                             style={{ backgroundColor: bead.hex }}
                           >
                               <span className="text-[10px] font-bold" style={{ color: textColor }}>{bead.code}</span>
                               {isHidden && <div className="absolute inset-0 bg-white/50 dark:bg-black/50 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-gray-800 text-[16px]">visibility_off</span></div>}
                           </button>
                       )
                   })}
               </div>
           )}

           {activeTab === 'custom' && (
               <div className="space-y-4">
                   <div className="flex justify-between items-center text-xs text-gray-500">
                       <span>已选 {paletteConfig.customIds.length} 色</span>
                       <button onClick={resetCustomPalette} className="text-red-500 hover:underline">清空</button>
                   </div>
                   <div className="grid grid-cols-5 gap-3">
                       {displayBeads.map(bead => {
                           const isSelected = paletteConfig.customIds.includes(bead.id);
                           const textColor = getTextColor(bead.hex);

                           return (
                               <button 
                                 key={bead.id}
                                 onClick={() => toggleCustomColor(bead.id)}
                                 className={`aspect-square rounded-full flex items-center justify-center relative shadow-sm border-2 transition-all active:scale-95 ${isSelected ? 'border-primary ring-2 ring-primary/20 scale-105' : 'border-transparent opacity-60'}`}
                                 style={{ backgroundColor: bead.hex }}
                               >
                                   <span className="text-[10px] font-bold" style={{ color: textColor }}>{bead.code}</span>
                                   {isSelected && <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center"><span className="material-symbols-outlined text-[10px]">check</span></div>}
                               </button>
                           )
                       })}
                   </div>
               </div>
           )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark">
            <button onClick={onClose} className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/30 active:scale-95 transition-transform">
                完成设置
            </button>
        </div>
      </div>
    </div>
  );
};

export default PaletteModal;
