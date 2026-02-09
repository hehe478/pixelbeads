import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor } from '../utils/colors';
import PaletteModal from '../components/PaletteModal';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move';

const DesktopEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const state = location.state as { grid?: {[key: string]: string}, width?: number, height?: number, title?: string, minX?: number, minY?: number, isFreeMode?: boolean };

  const { allBeads, recentColors, addToRecent } = useColorPalette();

  const paramSize = searchParams.get('size');
  const initialSize = paramSize ? parseInt(paramSize) : 50;
  
  const initialIsFree = state?.isFreeMode ?? (id === 'new' && initialSize === 100);

  const [grid, setGrid] = useState<{[key: string]: string}>(state?.grid || {});
  const [title, setTitle] = useState(state?.title || '未命名作品');
  const [isFreeMode, setIsFreeMode] = useState(initialIsFree);
  
  const [bounds, setBounds] = useState({
    minX: state?.minX ?? 0,
    minY: state?.minY ?? 0,
    maxX: state?.width ?? initialSize,
    maxY: state?.height ?? initialSize
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  const draftIdRef = useRef<string>((id && id !== 'new' && id !== 'imported') ? id : '');

  const [scale, setScale] = useState(1);
  const CELL_SIZE = 24;
  
  const [offset, setOffset] = useState({ 
     x: -((state?.width || initialSize) * CELL_SIZE) / 2 + (window.innerWidth / 2) - 150, 
     y: -((state?.height || initialSize) * CELL_SIZE) / 2 + (window.innerHeight / 2)
  });
  
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [selectedBead, setSelectedBead] = useState<BeadColor | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<{[key: string]: string}[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const isDragging = useRef(false);
  const isDrawing = useRef(false);
  const startStrokeGrid = useRef<{[key: string]: string} | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  
  const autoSaveRef = useRef({ grid, title, bounds, isFreeMode, offset, scale });

  // Init selected color
  useEffect(() => {
    if (!selectedBead) {
      // Default to Black or first bead
      const defaultBead = allBeads.find(b => b.code === 'B09' || b.hex === '#000000') || allBeads[0];
      if (defaultBead) setSelectedBead(defaultBead);
    }
  }, [allBeads]);

  useEffect(() => {
    if (id && id !== 'new' && id !== 'imported') {
      draftIdRef.current = id;
    }
  }, [id]);

  useEffect(() => {
    if (state?.grid && history.length === 1 && Object.keys(history[0]).length === 0) {
       setHistory([state.grid]);
       setHistoryIndex(0);
    }
  }, []);

  useEffect(() => {
    autoSaveRef.current = { grid, title, bounds, isFreeMode, offset, scale };
  }, [grid, title, bounds, isFreeMode, offset, scale]);

  useEffect(() => {
    if (!state?.grid && id && id !== 'new' && id !== 'imported') {
       try {
         const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
         const draft = drafts.find((d: any) => d.id === id);
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
           } else {
             const width = draft.width * CELL_SIZE;
             const height = draft.height * CELL_SIZE;
             setOffset({
               x: -width/2 + (window.innerWidth/2) - 150,
               y: -height/2 + (window.innerHeight/2)
             });
           }
         }
       } catch (e) {
         console.error("Failed to load draft", e);
       }
    }
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => {
      handleSave(true);
    }, 10000); 
    return () => clearInterval(timer);
  }, []); 

  useEffect(() => {
    if (isRenaming && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isRenaming]);

  // Rulers Logic (Same as before)
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    const container = mainContainerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateRulers = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        const width = canvas.width;
        const height = canvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const RULER_THICKNESS = 24;
        
        ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
        ctx.fillRect(0, 0, width, RULER_THICKNESS);
        ctx.fillRect(0, 0, RULER_THICKNESS, height);
        
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, RULER_THICKNESS); ctx.lineTo(width, RULER_THICKNESS);
        ctx.moveTo(RULER_THICKNESS, 0); ctx.lineTo(RULER_THICKNESS, height);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const originX = offset.x;
        const originY = offset.y;

        const startVal = Math.floor((RULER_THICKNESS - originX) / (CELL_SIZE * scale));
        const endVal = Math.ceil((width - originX) / (CELL_SIZE * scale));
        
        const renderStart = startVal - 2;
        const renderEnd = endVal + 2;

        for (let i = renderStart; i <= renderEnd; i++) {
            const screenX = originX + i * CELL_SIZE * scale;
            if (screenX < RULER_THICKNESS) continue; 

            const isMajor = Math.abs(i) % 5 === 0;
            const isOrigin = i === 0;
            
            if (scale < 0.4 && !isMajor && !isOrigin) continue;

            ctx.beginPath();
            if (isMajor || isOrigin) {
                ctx.moveTo(screenX, RULER_THICKNESS - 12);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8';
                ctx.lineWidth = isOrigin ? 1.5 : 1;
                ctx.stroke();
                
                ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b';
                if (scale > 0.3) {
                     ctx.fillText(i.toString(), screenX + (CELL_SIZE*scale)/2, RULER_THICKNESS / 2);
                }
            } else {
                ctx.moveTo(screenX, RULER_THICKNESS - 6);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        const startRow = Math.floor((RULER_THICKNESS - originY) / (CELL_SIZE * scale));
        const endRow = Math.ceil((height - originY) / (CELL_SIZE * scale));
        const renderRowStart = startRow - 2;
        const renderRowEnd = endRow + 2;

        for (let i = renderRowStart; i <= renderRowEnd; i++) {
            const screenY = originY + i * CELL_SIZE * scale;
            if (screenY < RULER_THICKNESS) continue;

            const isMajor = Math.abs(i) % 5 === 0;
            const isOrigin = i === 0;
            
            if (scale < 0.4 && !isMajor && !isOrigin) continue;

            ctx.beginPath();
            if (isMajor || isOrigin) {
                ctx.moveTo(RULER_THICKNESS - 12, screenY);
                ctx.lineTo(RULER_THICKNESS, screenY);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8';
                ctx.lineWidth = isOrigin ? 1.5 : 1;
                ctx.stroke();
                 ctx.save();
                 ctx.translate(RULER_THICKNESS / 2, screenY + (CELL_SIZE*scale)/2);
                 ctx.rotate(-Math.PI / 2);
                 ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b';
                 if (scale > 0.3) {
                    ctx.fillText(i.toString(), 0, 0);
                 }
                 ctx.restore();
            } else {
                ctx.moveTo(RULER_THICKNESS - 6, screenY);
                ctx.lineTo(RULER_THICKNESS, screenY);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('px', RULER_THICKNESS/2, RULER_THICKNESS/2);
    };

    updateRulers();
    window.addEventListener('resize', updateRulers);
    return () => window.removeEventListener('resize', updateRulers);

  }, [scale, offset, bounds, isFreeMode]);

  const commitHistory = (finalGrid: {[key: string]: string}) => {
    if (JSON.stringify(finalGrid) !== JSON.stringify(history[historyIndex])) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(finalGrid);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }
    isDrawing.current = false;
    startStrokeGrid.current = null;
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

  const handleSave = (silent = false) => {
    setSaveStatus('saving');
    const currentData = autoSaveRef.current;
    let currentId = draftIdRef.current;
    if (!currentId) {
       currentId = (id && id !== 'new' && id !== 'imported') ? id : Date.now().toString();
       draftIdRef.current = currentId;
    }

    const isNew = !id || id === 'new' || id === 'imported';
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
      
      if (existingIndex >= 0) {
        drafts[existingIndex] = draft;
      } else {
        drafts.unshift(draft);
      }
      
      localStorage.setItem('pixelbead_drafts', JSON.stringify(drafts));
      
      if (isNew && !silent) {
        navigate(`/editor/${draft.id}`, { replace: true, state: { ...state, grid: currentData.grid, width: width, height: height, title: currentData.title, minX: currentData.bounds.minX, minY: currentData.bounds.minY, isFreeMode: currentData.isFreeMode } });
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);

    } catch (e) {
      console.error("Save failed", e);
      if (!silent) alert("保存失败，可能是存储空间不足");
      setSaveStatus('idle');
    }
  };

  const handleExport = () => {
     // Save before export
     handleSave(true);
     
     const width = bounds.maxX - bounds.minX;
     const height = bounds.maxY - bounds.minY;
     
     const normalizedGrid: {[key: string]: string} = {};
     Object.entries(grid).forEach(([key, val]) => {
         const [x, y] = key.split(',').map(Number);
         normalizedGrid[`${x - bounds.minX},${y - bounds.minY}`] = val as string;
     });

    // Use stable ID for export URL
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

  const handleRename = () => {
    setIsRenaming(false);
    if (!title.trim()) {
       setTitle('未命名作品');
       autoSaveRef.current.title = '未命名作品';
    } else {
       autoSaveRef.current.title = title;
       handleSave(true);
    }
  };

  const changeTool = (newTool: Tool) => {
    setTool(newTool);
    isDragging.current = false;
    isDrawing.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom Logic
    e.preventDefault();
    if (!mainContainerRef.current) return;
    
    // Zoom toward cursor
    const rect = mainContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomSensitivity = 0.001;
    const delta = -e.deltaY; // Standard: scroll down (positive) zooms out (negative delta for scale)
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta * zoomSensitivity)), 5);
    
    // Point in world coordinates before zoom
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;
    
    // New offset to keep world point under mouse
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const getGridCoord = (clientX: number, clientY: number) => {
    if (!mainContainerRef.current) return { x: 0, y: 0 };
    
    const rect = mainContainerRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    const gridPixelX = (relativeX - offset.x) / scale;
    const gridPixelY = (relativeY - offset.y) / scale;
    
    return {
        x: Math.floor(gridPixelX / CELL_SIZE) + bounds.minX,
        y: Math.floor(gridPixelY / CELL_SIZE) + bounds.minY
    };
  };

  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move' || !selectedBead) return;

    if (!isFreeMode) {
        if (x < bounds.minX || y < bounds.minY || x >= bounds.maxX || y >= bounds.maxY) return;
    } else {
        // Free Mode Expansion Logic with Offset Compensation
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
            // Counter-Offset Logic to prevent visual jumping
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
            changeTool('pen');
        }
      }
      isDrawing.current = false;
    } else if (tool === 'fill') {
      const targetColor = grid[key];
      if (targetColor === selectedBead.id) return;
      
      const queue = [[x, y]];
      const visited = new Set([key]);
      
      let safetyCount = 0;
      const MAX_FILL = 2000;

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

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 1 || tool === 'move') { 
          isDragging.current = true;
          lastPos.current = { x: e.clientX, y: e.clientY };
          return;
      }
      
      const {x, y} = getGridCoord(e.clientX, e.clientY);
      handleCellAction(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const {x, y} = getGridCoord(e.clientX, e.clientY);
      setCursorPos({x, y});

      if (isDragging.current) {
          const dx = e.clientX - lastPos.current.x;
          const dy = e.clientY - lastPos.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          lastPos.current = { x: e.clientX, y: e.clientY };
          return;
      }

      if (isDrawing.current && (tool === 'pen' || tool === 'eraser')) {
          handleCellAction(x, y);
      }
  };

  const handleMouseUp = () => {
      isDragging.current = false;
      if (isDrawing.current) {
          commitHistory(grid);
      }
  };

  const handleColorSelect = (color: BeadColor) => {
      setSelectedBead(color);
      addToRecent(color);
      setIsPaletteOpen(false);
      setTool('pen');
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden select-none">
       {/* Left Sidebar - Color Control */}
       <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-sm">
          {/* Header/Back */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
             <button onClick={() => navigate('/create')} className="hover:bg-slate-100 p-1 rounded-full text-slate-500">
                <span className="material-symbols-outlined">arrow_back</span>
             </button>
             {isRenaming ? (
               <input 
                 ref={titleInputRef}
                 value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 onBlur={handleRename}
                 onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                 className="font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded w-full outline-none"
                 autoFocus
               />
             ) : (
               <h1 
                 onClick={() => setIsRenaming(true)}
                 className="font-bold text-gray-900 truncate cursor-text hover:bg-slate-50 px-2 py-0.5 rounded"
               >
                 {title}
               </h1>
             )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
             {/* Current Color Details */}
             <div className="p-6 flex flex-col items-center border-b border-slate-100 bg-slate-50/50">
                 <div className="w-24 h-24 rounded-full shadow-md border-4 border-white mb-3 relative overflow-hidden" style={{ backgroundColor: selectedBead?.hex }}>
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none"></div>
                 </div>
                 <h2 className="text-2xl font-black text-slate-800">{selectedBead?.code}</h2>
                 <p className="text-xs text-slate-500 font-medium mt-1">{selectedBead?.brand} • {selectedBead?.hex}</p>
             </div>

             {/* Actions */}
             <div className="p-4">
                 <button 
                   onClick={() => setIsPaletteOpen(true)}
                   className="w-full py-3 px-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm text-slate-700 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"
                 >
                    <span className="material-symbols-outlined">palette</span>
                    打开调色板
                 </button>
             </div>

             {/* Recent Colors */}
             <div className="px-4 pb-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">最近使用</h3>
                 <div className="grid grid-cols-5 gap-2">
                     {recentColors.slice(0, 20).map(color => (
                         <button
                           key={color.id}
                           onClick={() => { setSelectedBead(color); setTool('pen'); }}
                           className={`aspect-square rounded-lg border border-slate-200 relative group transition-transform hover:scale-105 ${selectedBead?.id === color.id ? 'ring-2 ring-primary ring-offset-2 z-10' : ''}`}
                           style={{ backgroundColor: color.hex }}
                           title={`${color.code}`}
                         >
                         </button>
                     ))}
                 </div>
             </div>
          </div>
          
          <div className="p-2 border-t border-slate-100 text-center text-[10px] text-slate-400">
             <span>{bounds.maxX - bounds.minX}x{bounds.maxY - bounds.minY}</span>
             <span className={`ml-2 ${saveStatus === 'saved' ? 'text-green-500' : ''}`}>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
             </span>
          </div>
       </div>

       {/* Main Editor Area */}
       <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Top Toolbar */}
          <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => changeTool('move')} className={`p-2 rounded-md transition-colors ${tool === 'move' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="移动画布 (Space)">
                      <span className="material-symbols-outlined text-[20px]">pan_tool_alt</span>
                  </button>
                  <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                  <button onClick={() => changeTool('pen')} className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="画笔 (B)">
                      <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button onClick={() => changeTool('eraser')} className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="橡皮擦 (E)">
                      <span className="material-symbols-outlined text-[20px]">ink_eraser</span>
                  </button>
                  <button onClick={() => changeTool('fill')} className={`p-2 rounded-md transition-colors ${tool === 'fill' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="油漆桶 (F)">
                      <span className="material-symbols-outlined text-[20px]">format_color_fill</span>
                  </button>
                  <button onClick={() => changeTool('picker')} className={`p-2 rounded-md transition-colors ${tool === 'picker' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="吸管 (I)">
                      <span className="material-symbols-outlined text-[20px]">colorize</span>
                  </button>
              </div>

              <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-2">
                      <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-md transition-colors ${showGrid ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="显示网格">
                          <span className="material-symbols-outlined text-[20px]">grid_4x4</span>
                      </button>
                      <button onClick={() => setShowNumbers(!showNumbers)} className={`p-2 rounded-md transition-colors ${showNumbers ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="显示编号">
                          <span className="material-symbols-outlined text-[20px]">123</span>
                      </button>
                  </div>

                  <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors text-slate-600">
                      <span className="material-symbols-outlined">undo</span>
                  </button>
                  <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors text-slate-600">
                      <span className="material-symbols-outlined">redo</span>
                  </button>
                  
                  {/* Save Button */}
                  <button onClick={() => handleSave(false)} className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${saveStatus === 'saved' ? 'text-green-500' : 'text-primary'}`} title="保存">
                      <span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check_circle' : 'save'}</span>
                  </button>

                  <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                  <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/30">
                      <span className="material-symbols-outlined text-[20px]">ios_share</span>
                      <span className="text-sm font-bold">导出</span>
                  </button>
              </div>
          </div>

          <div 
             ref={mainContainerRef}
             className="flex-1 relative bg-slate-50 overflow-hidden cursor-crosshair"
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
             onWheel={handleWheel}
          >
             <canvas ref={rulerCanvasRef} className="absolute inset-0 pointer-events-none z-10" />

             <div 
                className="absolute origin-top-left transition-transform duration-75 ease-out"
                style={{ 
                   transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` 
                }}
             >
                 <div 
                    className="bg-white shadow-2xl relative"
                    style={{ 
                      width: (bounds.maxX - bounds.minX) * CELL_SIZE,
                      height: (bounds.maxY - bounds.minY) * CELL_SIZE
                    }}
                 >
                     {showGrid && (
                       <div 
                         className="absolute inset-0 pointer-events-none opacity-20"
                         style={{
                           backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`,
                           backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
                         }}
                       />
                     )}

                     {Object.entries(grid).map(([key, colorId]) => {
                         const [x, y] = key.split(',').map(Number);
                         if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return null;
                         
                         const color = allBeads.find(c => c.id === colorId);
                         if (!color) return null;

                         return (
                             <div 
                               key={key}
                               className="absolute flex items-center justify-center"
                               style={{
                                   left: (x - bounds.minX) * CELL_SIZE,
                                   top: (y - bounds.minY) * CELL_SIZE,
                                   width: CELL_SIZE,
                                   height: CELL_SIZE,
                                   backgroundColor: color.hex
                               }}
                             >
                                {showNumbers && (
                                   <span 
                                     className="text-[8px] font-bold select-none pointer-events-none"
                                     style={{ color: getTextColor(color.hex) }}
                                   >
                                     {color.code}
                                   </span>
                                )}
                             </div>
                         );
                     })}
                 </div>
             </div>
             
             <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm text-xs font-mono text-slate-600 pointer-events-none z-20 flex gap-4">
                 <span>X: {cursorPos?.x ?? 0}</span>
                 <span>Y: {cursorPos?.y ?? 0}</span>
                 <span>Zoom: {Math.round(scale * 100)}%</span>
             </div>
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

export default DesktopEditor;