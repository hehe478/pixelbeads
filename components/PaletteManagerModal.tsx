import React, { useState, useEffect, useMemo } from 'react';
import { useColorPalette } from '../context/ColorContext';

interface PaletteManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'edit_content';

const PaletteManagerModal: React.FC<PaletteManagerModalProps> = ({ isOpen, onClose }) => {
  const { 
    customPalettes, 
    createCustomPalette, 
    renameCustomPalette, 
    deleteCustomPalette, 
    selectCustomPalette,
    toggleBeadInPalette,
    updateCustomPaletteBeads,
    paletteConfig,
    allBeads,
    availableBrands
  } = useColorPalette();

  const [view, setView] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contentEditingId, setContentEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [activeBrand, setActiveBrand] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Rules of Hooks: All hooks must be at the top level
  const displayBeads = useMemo(() => allBeads.filter(bead => {
    if (!activeBrand) return false;
    return bead.brand === activeBrand && (searchTerm === '' || bead.code?.toLowerCase().includes(searchTerm.toLowerCase()));
  }), [activeBrand, searchTerm, allBeads]);

  const availableSetsForBrand = useMemo(() => {
    if (!activeBrand) return [];
    const brandBeads = allBeads.filter(b => b.brand === activeBrand);
    const sets = new Set<number>();
    brandBeads.forEach(b => b.sets?.forEach(s => sets.add(s)));
    return Array.from(sets).sort((a, b) => a - b);
  }, [activeBrand, allBeads]);

  useEffect(() => {
    if (isOpen) {
        setView('list');
        setContentEditingId(null);
        setEditingId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (view === 'edit_content' && availableBrands.length > 0 && !activeBrand) {
        setActiveBrand(availableBrands[0]);
    }
  }, [view, availableBrands, activeBrand]);

  // Early return must come AFTER all hook declarations
  if (!isOpen) return null;

  const handleCreate = () => createCustomPalette();

  const saveRenaming = (id: string) => {
    if (editName.trim()) renameCustomPalette(id, editName.trim());
    setEditingId(null);
  };

  const handleSelect = (id: string) => {
    selectCustomPalette(id);
    onClose();
  };

  const getPalettePreview = (beadIds: string[] = []) => {
    const ids = Array.isArray(beadIds) ? beadIds : [];
    const preview = ids.slice(0, 3).map(id => {
      const bead = allBeads.find(b => b.id === id);
      return bead ? (
        <div key={id} className="w-4 h-4 rounded-full shadow-sm border border-black/5" style={{ backgroundColor: bead.hex }} />
      ) : null;
    });
    if (ids.length > 3) {
        preview.push(<div key="more" className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[8px] text-gray-500 font-bold">...</div>);
    }
    return preview;
  };

  const getPaletteBrand = (beadIds: string[] = []) => {
      const ids = Array.isArray(beadIds) ? beadIds : [];
      const beads = allBeads.filter(b => ids.includes(b.id));
      const brands = new Set(beads.map(b => b.brand));
      if (brands.size === 0) return '空';
      if (brands.size === 1) return Array.from(brands)[0];
      return '自定义';
  }

  const currentEditingPalette = customPalettes.find(p => p.id === contentEditingId);

  const toggleSet = (setSize: number) => {
    if (!currentEditingPalette || !activeBrand) return;
    const setIds = allBeads.filter(b => b.brand === activeBrand && b.sets.includes(setSize)).map(b => b.id);
    const currentIds = Array.isArray(currentEditingPalette.beadIds) ? currentEditingPalette.beadIds : [];
    const allIn = setIds.every(id => currentIds.includes(id));
    const nextIds = allIn ? currentIds.filter(id => !setIds.includes(id)) : Array.from(new Set([...currentIds, ...setIds]));
    updateCustomPaletteBeads(currentEditingPalette.id, nextIds);
  };

  const renderContentEditor = () => {
      if (!currentEditingPalette) return <div className="p-8 text-center text-gray-500">加载失败...</div>;
      const paletteIds = Array.isArray(currentEditingPalette.beadIds) ? currentEditingPalette.beadIds : [];
      return (
        <div className="flex flex-col h-full bg-white dark:bg-surface-dark">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-surface-dark shrink-0 z-10 flex items-center gap-2">
                <button onClick={() => setView('list')} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 -ml-2"><span className="material-symbols-outlined">arrow_back</span></button>
                <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">{currentEditingPalette.name}</h3>
                    <p className="text-xs text-gray-500">{paletteIds.length} 个颜色</p>
                </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-black/10 shrink-0 space-y-3">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 material-symbols-outlined text-[18px]">search</span>
                    <input type="text" placeholder="搜索色号..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg pl-9 py-2 text-sm text-gray-900 dark:text-white"/>
                </div>
                
                {/* Brand Tabs with custom scrollbar */}
                <div className="flex gap-2 overflow-x-auto pb-2 custom-horizontal-scrollbar">
                    {availableBrands.map(brand => (
                    <button key={brand} onClick={() => setActiveBrand(brand)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all border shrink-0 ${activeBrand === brand ? 'bg-primary border-primary text-white' : 'bg-white dark:bg-transparent border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100'}`}>{brand}</button>
                    ))}
                </div>

                {/* Shortcut row with custom scrollbar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-horizontal-scrollbar">
                    <span className="text-[10px] text-gray-400 font-bold uppercase shrink-0">快捷:</span>
                    {availableSetsForBrand.map(setSize => {
                        const isFull = allBeads.filter(b => b.brand === activeBrand && b.sets.includes(setSize)).every(b => paletteIds.includes(b.id));
                        return (
                            <button key={setSize} onClick={() => toggleSet(setSize)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border shrink-0 flex items-center gap-1 ${isFull ? 'bg-indigo-500 border-indigo-500 text-white shadow-sm' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-indigo-300'}`}>
                                {isFull && <span className="material-symbols-outlined text-[12px]">done_all</span>}
                                {setSize}色
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-surface-dark">
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-3 pb-safe">
                    {displayBeads.map(bead => {
                        const isSelected = paletteIds.includes(bead.id);
                        return (
                            <button key={bead.id} onClick={() => toggleBeadInPalette(currentEditingPalette.id, bead.id)} className="flex flex-col items-center gap-1 group relative">
                                <div className={`w-full aspect-square rounded-full shadow-sm border transition-transform active:scale-90 relative overflow-hidden ${isSelected ? 'ring-2 ring-primary ring-offset-2 border-transparent' : 'border-black/5 dark:border-white/10'}`} style={{ backgroundColor: bead.hex }}>
                                    {isSelected && <div className="absolute inset-0 flex items-center justify-center bg-black/10"><span className="material-symbols-outlined text-white text-lg drop-shadow-md">check</span></div>}
                                </div>
                                <span className={`text-[10px] font-medium truncate w-full text-center ${isSelected ? 'text-primary font-bold' : 'text-gray-600 dark:text-gray-400'}`}>{bead.code}</span>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh]">
        {view === 'edit_content' ? renderContentEditor() : (
            <>
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-surface-dark shrink-0">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">我的色盘库</h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><span className="material-symbols-outlined text-gray-500">close</span></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-black/20">
                <button onClick={handleCreate} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 group mb-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform"><span className="material-symbols-outlined text-[20px]">add</span></div>
                    <span className="font-bold text-sm">创建新配色方案</span>
                </button>
                {customPalettes.map(palette => {
                    const isActive = paletteConfig.activeCustomId === palette.id;
                    const brandLabel = getPaletteBrand(palette.beadIds);
                    return (
                    <div key={palette.id} className={`group relative p-3 rounded-xl border transition-all ${isActive ? 'bg-white dark:bg-surface-dark border-primary shadow-sm ring-1 ring-primary' : 'bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between mb-2">
                        {editingId === palette.id ? (
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} onBlur={() => saveRenaming(palette.id)} onKeyDown={(e) => e.key === 'Enter' && saveRenaming(palette.id)} className="text-sm font-bold bg-gray-100 dark:bg-black/20 rounded px-2 py-1 w-full mr-2" autoFocus/>
                        ) : (
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                <span onClick={() => handleSelect(palette.id)} className="font-bold text-gray-800 dark:text-white truncate cursor-pointer text-sm">{palette.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${brandLabel === '自定义' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>{brandLabel}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { setContentEditingId(palette.id); setView('edit_content'); }} className="p-1.5 rounded-full hover:bg-blue-50 text-blue-500" title="编辑颜色"><span className="material-symbols-outlined text-[18px]">palette</span></button>
                            <button onClick={() => { setEditingId(palette.id); setEditName(palette.name); }} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400" title="重命名"><span className="material-symbols-outlined text-[18px]">edit_note</span></button>
                            <button onClick={() => deleteCustomPalette(palette.id)} className="p-1.5 rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500" title="删除"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                        </div>
                        </div>
                        <div onClick={() => handleSelect(palette.id)} className="flex items-center justify-between cursor-pointer mt-1">
                            <div className="flex gap-1.5 items-center">{getPalettePreview(palette.beadIds)}</div>
                            <span className="text-[10px] text-gray-400">{(palette.beadIds || []).length} 色</span>
                        </div>
                        {isActive && <div className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full shadow-sm"><span className="material-symbols-outlined text-[10px]">check</span></div>}
                    </div>
                    );
                })}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default PaletteManagerModal;