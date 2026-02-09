import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import PaletteModal from '../components/PaletteModal';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move';

const MobileEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const state = location.state as { grid?: {[key: string]: string}, width?: number, height?: number, title?: string, minX?: number, minY?: number, isFreeMode?: boolean };

  const { allBeads, addToRecent } = useColorPalette();

  // Initialize size
  const paramSize = searchParams.get('size');
  const initialSize = paramSize ? parseInt(paramSize) : 50;

  const initialIsFree = state?.isFreeMode ?? (id === 'new' && initialSize === 100);

  const [grid, setGrid] = useState<{[key: string]: string}>(state?.grid || {});
  const [title, setTitle] = useState(state?.title || '未命名作品');
  const [isFreeMode, setIsFreeMode] = useState(initialIsFree);

  // Canvas Bounds
  const [bounds, setBounds] = useState({
    minX: state?.minX ?? 0,
    minY: state?.minY ?? 0,
    maxX: state?.width ?? initialSize,
    maxY: state?.height ?? initialSize
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const draftIdRef = useRef<string>((id && id !== 'new' && id !== 'imported') ? id : '');
  
  // Canvas Transform State
  const [scale, setScale] = useState(0.8);
  const CELL_SIZE = 24;
  
  // Center grid initially - Using Top-Left Origin Logic
  const [offset, setOffset] = useState(() => {
     // Default centering for Top-Left origin
     const contentWidth = (state?.width || initialSize) * CELL_SIZE;
     const contentHeight = (state?.height || initialSize) * CELL_SIZE;
     const initialScale = 0.8;
     
     // Calculate centered position based on viewport
     const x = (window.innerWidth - contentWidth * initialScale) / 2;
     const y = (window.innerHeight - 136 - contentHeight * initialScale) / 2; // ~136px for UI bars
     
     return { x, y };
  });

  const [tool, setTool] = useState<Tool>('pen');
  const [selectedBead, setSelectedBead] = useState<BeadColor | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // History
  const [history, setHistory] = useState<{[key: string]: string}[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const isDragging = useRef(false);
  const isDrawing = useRef(false);
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const startStrokeGrid = useRef<{[key: string]: string} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const autoSaveRef = useRef({ grid, title, bounds, isFreeMode, offset, scale });

  // Initialize selected color
  useEffect(() => {
    if (!selectedBead && allBeads && allBeads.length > 0) {
      const defaultBead = allBeads.find(b => b.code === 'B09' || b.hex === '#000000') || allBeads[0];
      if (defaultBead) setSelectedBead(defaultBead);
    }
  }, [allBeads]);

  // Init history
  useEffect(() => {
    if (state?.grid && history.length === 1 && Object.keys(history[0]).length === 0) {
       setHistory([state.grid]);
       setHistoryIndex(0);
    }
  }, []);

  // Sync ref for autosave
  useEffect(() => {
    autoSaveRef.current = { grid, title, bounds, isFreeMode, offset, scale };
  }, [grid, title, bounds, isFreeMode, offset, scale]);

  // Load Draft
  useEffect(() => {
    if (!state?.grid && id && id !== 'new' && id !== 'imported') {
       try {
         const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
         const draft = drafts.find((d: Draft) => d.id === id);
         if (draft) {
           setGrid(draft.grid);
           setTitle(draft.title);
           setHistory([draft.grid]);
           setHistoryIndex(0);
           
           const loadedIsFree = draft.isFreeMode ?? (draft.width === 100);
           setIsFreeMode(loadedIsFree);
           setBounds({
             minX: draft.minX ?? 0,
             minY: draft.minY ?? 0,
             maxX: draft.minX !== undefined ? (draft.minX + draft.width) : draft.width,
             maxY: draft.minY !== undefined ? (draft.minY + draft.height) : draft.height,
           });
           
           if (draft.offsetX !== undefined && draft.offsetY !== undefined) {
             setOffset({ x: draft.offsetX, y: draft.offsetY });
             if (draft.zoom) setScale(draft.zoom);
           }
         }
       } catch (e) {
         console.error("Failed to load draft", e);
       }
    }
  }, [id]);

  // Auto save
  useEffect(() => {
    const timer = setInterval(() => handleSave(true), 10000); 
    return () => clearInterval(timer);
  }, []);

  const handleSave = (silent = false) => {
    setSaveStatus('saving');
    const currentData = autoSaveRef.current;
    
    let currentId = draftIdRef.current;
    if (!currentId) {
       currentId = (id && id !== 'new' && id !== 'imported') ? id : Date.now().toString();
       draftIdRef.current = currentId;
    }

    const width = currentData.bounds.maxX - currentData.bounds.minX;
    const height = currentData.bounds.maxY - currentData.bounds.minY;
    const canvas = document.createElement('canvas');
    const thumbSize = 5;
    canvas.width = Math.max(1, width * thumbSize);
    canvas.height = Math.max(1, height * thumbSize);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      Object.entries(currentData.grid).forEach(([key, colorId]) => {
        const [x, y] = key.split(',').map(Number);
        const drawX = x - currentData.bounds.minX;
        const drawY = y - currentData.bounds.minY;
        const color = allBeads.find(c => c.id === colorId);
        if (color) {
          ctx.fillStyle = color.hex;
          ctx.fillRect(drawX * thumbSize, drawY * thumbSize, thumbSize, thumbSize);
        }
      });
    }

    const draft: Draft = {
      id: currentId,
      title: currentData.title,
      grid: currentData.grid,
      width: width,
      height: height,
      minX: currentData.bounds.minX,
      minY: currentData.bounds.minY,
      isFreeMode: currentData.isFreeMode,
      offsetX: currentData.offset.x,
      offsetY: currentData.offset.y,
      zoom: currentData.scale,
      lastModified: Date.now(),
      thumbnail: canvas.toDataURL('image/png', 0.5)
    };

    try {
      const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
      const existingIndex = drafts.findIndex((d: Draft) => d.id === draft.id);
      if (existingIndex >= 0) drafts[existingIndex] = draft;
      else drafts.unshift(draft);
      localStorage.setItem('pixelbead_drafts', JSON.stringify(drafts));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus('idle');
    }
  };

  const handleExport = () => {
     // Save first to ensure draft ID is stable and state is persisted
     handleSave(true);
     
     const width = bounds.maxX - bounds.minX;
     const height = bounds.maxY - bounds.minY;
     const normalizedGrid: {[key: string]: string} = {};
     Object.entries(grid).forEach(([key, val]) => {
         const [x, y] = key.split(',').map(Number);
         normalizedGrid[`${x - bounds.minX},${y - bounds.minY}`] = val as string;
     });
     
     // Use the stable draft ID for the preview URL
     const targetId = draftIdRef.current || 'custom';
     
     navigate(`/preview/${targetId}`, { 
         state: { 
             grid: normalizedGrid, 
             width, 
             height, 
             title 
         }
     });
  };

  const commitHistory = (finalGrid: {[key: string]: string}) => {
    if (JSON.stringify(finalGrid) !== JSON.stringify(history[historyIndex])) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(finalGrid);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }
    isDrawing.current = false;
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setGrid(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setGrid(history[historyIndex + 1]);
    }
  };

  const getGridCoord = (clientX: number, clientY: number) => {
     if (!containerRef.current) return { x: 0, y: 0 };
     
     const rect = containerRef.current.getBoundingClientRect();
     
     const gridPixelX = (clientX - rect.left - offset.x) / scale;
     const gridPixelY = (clientY - rect.top - offset.y) / scale;
     
     return {
        x: Math.floor(gridPixelX / CELL_SIZE) + bounds.minX, 
        y: Math.floor(gridPixelY / CELL_SIZE) + bounds.minY
     };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
     if (e.touches.length === 2) {
         isDragging.current = true;
         return;
     }
     
     if (tool === 'move') {
         isDragging.current = true;
         lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
         return;
     }

     const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
     handleCellAction(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2 || (tool === 'move' && isDragging.current)) {
          if (tool === 'move' && e.touches.length === 1) {
              const dx = e.touches[0].clientX - lastTouchPos.current.x;
              const dy = e.touches[0].clientY - lastTouchPos.current.y;
              setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }
          return;
      }

      if (tool !== 'move' && !isDragging.current) {
          const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
          if (isDrawing.current && (tool === 'pen' || tool === 'eraser')) {
              handleCellAction(x, y);
          }
      }
  };
  
  const handleTouchEnd = () => {
      isDragging.current = false;
      if (isDrawing.current) {
          commitHistory(grid);
      }
  };

  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move' || !selectedBead) return;

    if (!isFreeMode) {
        if (x < bounds.minX || y < bounds.minY || x >= bounds.maxX || y >= bounds.maxY) return;
    } else {
        let newMinX = bounds.minX;
        let newMaxX = bounds.maxX;
        let newMinY = bounds.minY;
        let newMaxY = bounds.maxY;
        let changed = false;
        
        let addedLeft = 0;
        let addedTop = 0;
        const EXPAND_CHUNK = 20;

        if (x < bounds.minX + 5) {
            newMinX = bounds.minX - EXPAND_CHUNK;
            addedLeft = EXPAND_CHUNK;
            changed = true;
        }
        if (x >= bounds.maxX - 5) {
            newMaxX = bounds.maxX + EXPAND_CHUNK;
            changed = true;
        }
        if (y < bounds.minY + 5) {
            newMinY = bounds.minY - EXPAND_CHUNK;
            addedTop = EXPAND_CHUNK;
            changed = true;
        }
        if (y >= bounds.maxY - 5) {
            newMaxY = bounds.maxY + EXPAND_CHUNK;
            changed = true;
        }
        
        if (changed) {
            setBounds({ minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY });
            if (addedLeft > 0 || addedTop > 0) {
                setOffset(prev => ({
                    x: prev.x - (addedLeft * CELL_SIZE * scale),
                    y: prev.y - (addedTop * CELL_SIZE * scale)
                }));
            }
        }
    }

    if (!isDrawing.current) {
        isDrawing.current = true;
        startStrokeGrid.current = { ...grid };
    }

    const key = `${x},${y}`;
    const newGrid = { ...grid };

    if (tool === 'pen') {
      newGrid[key] = selectedBead.id;
      setGrid(newGrid);
    } else if (tool === 'eraser') {
      delete newGrid[key];
      setGrid(newGrid);
    } else if (tool === 'picker') {
      const colorId = grid[key];
      if (colorId) {
        const found = allBeads.find(b => b.id === colorId);
        if (found) {
            setSelectedBead(found);
            addToRecent(found);
            setTool('pen');
        }
      }
      isDrawing.current = false;
    } else if (tool === 'fill') {
      const targetColor = grid[key];
      if (targetColor === selectedBead.id) return;
      
      const queue = [[x, y]];
      const visited = new Set([key]);
      let safetyCount = 0;
      const MAX_FILL = 1000; 

      while (queue.length > 0 && safetyCount < MAX_FILL) {
        const [cx, cy] = queue.shift()!;
        const cKey = `${cx},${cy}`;
        newGrid[cKey] = selectedBead.id;
        safetyCount++;

        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neighbors) {
           const nKey = `${nx},${ny}`;
           if (!isFreeMode) {
              if (nx < bounds.minX || ny < bounds.minY || nx >= bounds.maxX || ny >= bounds.maxY) continue;
           }

           if (!visited.has(nKey)) {
             if (targetColor === undefined) {
                 if (!grid[nKey]) { visited.add(nKey); queue.push([nx, ny]); }
             } else if (grid[nKey] === targetColor) {
                 visited.add(nKey);
                 queue.push([nx, ny]);
             }
           }
        }
      }
      setGrid(newGrid);
      commitHistory(newGrid);
    }
  };

  const handleColorSelect = (color: BeadColor) => {
      setSelectedBead(color);
      addToRecent(color);
      setTool('pen');
      setIsPaletteOpen(false);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden select-none">
       {/* Top Bar */}
       <div className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-20 shrink-0">
           <button onClick={() => navigate('/create')} className="p-2 -ml-2 text-slate-600">
               <span className="material-symbols-outlined">arrow_back</span>
           </button>
           
           <div className="flex gap-2">
                <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 text-slate-600 disabled:opacity-30">
                    <span className="material-symbols-outlined">undo</span>
                </button>
                <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 text-slate-600 disabled:opacity-30">
                    <span className="material-symbols-outlined">redo</span>
                </button>
                <button onClick={() => handleSave(false)} className={`p-2 transition-colors ${saveStatus === 'saved' ? 'text-green-500' : 'text-primary'}`}>
                    <span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check_circle' : 'save'}</span>
                </button>
                <button onClick={handleExport} className="p-2 text-slate-600">
                    <span className="material-symbols-outlined">ios_share</span>
                </button>
           </div>
       </div>

       {/* Canvas Container with touch-action: none */}
       <div 
         ref={containerRef}
         className="flex-1 relative overflow-hidden bg-slate-200 touch-none"
         style={{ touchAction: 'none' }} 
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
       >
          <div 
             className="absolute origin-top-left transition-transform duration-75 ease-out"
             style={{ 
               transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` 
             }}
          >
              <div 
                  className="bg-white shadow-xl relative"
                  style={{ 
                    width: (bounds.maxX - bounds.minX) * CELL_SIZE,
                    height: (bounds.maxY - bounds.minY) * CELL_SIZE
                  }}
              >
                  {showGrid && (
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-30"
                      style={{
                        backgroundImage: `linear-gradient(to right, #ccc 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)`,
                        backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
                      }}
                    />
                  )}
                  
                  {Object.entries(grid).map(([key, colorId]) => {
                      const [x, y] = key.split(',').map(Number);
                      if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return null;
                      
                      const color = allBeads.find(c => c.id === colorId);
                      
                      return (
                          <div 
                            key={key}
                            style={{
                                position: 'absolute',
                                left: (x - bounds.minX) * CELL_SIZE,
                                top: (y - bounds.minY) * CELL_SIZE,
                                width: CELL_SIZE,
                                height: CELL_SIZE,
                                backgroundColor: color?.hex || '#000'
                            }}
                          />
                      )
                  })}
              </div>
          </div>
       </div>

       {/* Fixed Bottom Toolbar */}
       <div className="bg-white border-t border-slate-200 shrink-0 h-20 pb-safe flex items-center justify-between px-6 z-30">
           {/* Current Color Indicator */}
           <div className="flex flex-col items-center gap-1">
               <button 
                 onClick={() => setIsPaletteOpen(true)}
                 className="w-10 h-10 rounded-full shadow-md border-2 border-white ring-2 ring-gray-200 relative overflow-hidden"
                 style={{ backgroundColor: selectedBead?.hex || '#ccc' }}
               >
                 <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none"></div>
               </button>
               <span className="text-[10px] font-bold text-gray-500 max-w-[4rem] truncate">{selectedBead?.code || '选择'}</span>
           </div>

           <div className="w-[1px] h-8 bg-gray-200 mx-2"></div>

           {/* Tools */}
           <div className="flex flex-1 justify-between text-slate-500 max-w-xs">
               <button onClick={() => setTool('move')} className={`flex flex-col items-center transition-colors ${tool === 'move' ? 'text-primary' : 'hover:text-gray-700'}`}>
                   <span className={`material-symbols-outlined text-2xl ${tool === 'move' ? 'filled' : ''}`}>pan_tool_alt</span>
               </button>
               <button onClick={() => setTool('pen')} className={`flex flex-col items-center transition-colors ${tool === 'pen' ? 'text-primary' : 'hover:text-gray-700'}`}>
                   <span className={`material-symbols-outlined text-2xl ${tool === 'pen' ? 'filled' : ''}`}>edit</span>
               </button>
               <button onClick={() => setTool('eraser')} className={`flex flex-col items-center transition-colors ${tool === 'eraser' ? 'text-primary' : 'hover:text-gray-700'}`}>
                   <span className={`material-symbols-outlined text-2xl ${tool === 'eraser' ? 'filled' : ''}`}>ink_eraser</span>
               </button>
               <button onClick={() => setTool('fill')} className={`flex flex-col items-center transition-colors ${tool === 'fill' ? 'text-primary' : 'hover:text-gray-700'}`}>
                   <span className={`material-symbols-outlined text-2xl ${tool === 'fill' ? 'filled' : ''}`}>format_color_fill</span>
               </button>
               <button onClick={() => setTool('picker')} className={`flex flex-col items-center transition-colors ${tool === 'picker' ? 'text-primary' : 'hover:text-gray-700'}`}>
                   <span className={`material-symbols-outlined text-2xl ${tool === 'picker' ? 'filled' : ''}`}>colorize</span>
               </button>
           </div>
       </div>

       <PaletteModal 
         isOpen={isPaletteOpen} 
         onClose={() => setIsPaletteOpen(false)}
         onSelect={handleColorSelect}
       />
    </div>
  );
};

export default MobileEditor;