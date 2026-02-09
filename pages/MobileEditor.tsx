import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { ARTKAL_COLORS, Draft } from '../types';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move';

const MobileEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const state = location.state as { grid?: {[key: string]: string}, width?: number, height?: number, title?: string, minX?: number, minY?: number, isFreeMode?: boolean };

  // Initialize size
  const paramSize = searchParams.get('size');
  const initialSize = paramSize ? parseInt(paramSize) : 50;

  const initialIsFree = state?.isFreeMode ?? (id === 'new' && initialSize === 100);

  const [grid, setGrid] = useState<{[key: string]: string}>(state?.grid || {});
  const [title, setTitle] = useState(state?.title || '未命名作品');
  const [isFreeMode, setIsFreeMode] = useState(initialIsFree);

  // Canvas Bounds (Min/Max X/Y)
  const [bounds, setBounds] = useState({
    minX: state?.minX ?? 0,
    minY: state?.minY ?? 0,
    maxX: state?.width ?? initialSize,
    maxY: state?.height ?? initialSize
  });

  const [isRenaming, setIsRenaming] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  // Canvas Transform State
  const [scale, setScale] = useState(0.8);
  const CELL_SIZE = 24;
  
  // Center grid initially
  const [offset, setOffset] = useState({ 
     x: -((state?.width || initialSize) * CELL_SIZE) / 2 + (window.innerWidth / 2),
     y: -((state?.height || initialSize) * CELL_SIZE) / 2 + (window.innerHeight / 2)
  });

  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  
  // Tools & Settings
  const [tool, setTool] = useState<Tool>('pen');
  const [selectedColor, setSelectedColor] = useState(ARTKAL_COLORS[2].id); 
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  
  // Rulers
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // History
  const [history, setHistory] = useState<{[key: string]: string}[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Refs for interactions
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isDrawing = useRef(false); // Track if we are currently drawing a stroke
  const startStrokeGrid = useRef<{[key: string]: string} | null>(null); // Snapshot before stroke
  const lastPos = useRef({ x: 0, y: 0 });

  // Ref to hold latest state for auto-save
  const autoSaveRef = useRef({ grid, title, bounds, isFreeMode, offset, scale });

  // Initialize history with initial grid
  useEffect(() => {
    if (state?.grid && history.length === 1 && Object.keys(history[0]).length === 0) {
       setHistory([state.grid]);
       setHistoryIndex(0);
    }
  }, []);

  // Update ref when state changes
  useEffect(() => {
    autoSaveRef.current = { grid, title, bounds, isFreeMode, offset, scale };
  }, [grid, title, bounds, isFreeMode, offset, scale]);

  // Load from draft if needed
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
           
            // Restore bounds and mode
           const loadedIsFree = draft.isFreeMode ?? (draft.width === 100);
           setIsFreeMode(loadedIsFree);
           setBounds({
             minX: draft.minX ?? 0,
             minY: draft.minY ?? 0,
             maxX: draft.minX !== undefined ? (draft.minX + draft.width) : draft.width,
             maxY: draft.minY !== undefined ? (draft.minY + draft.height) : draft.height,
           });

           // Restore Viewport
           if (draft.offsetX !== undefined && draft.offsetY !== undefined) {
             setOffset({ x: draft.offsetX, y: draft.offsetY });
             if (draft.zoom) setScale(draft.zoom);
           } else {
             const width = draft.width * CELL_SIZE;
             const height = draft.height * CELL_SIZE;
             setOffset({
               x: -width/2 + (window.innerWidth/2),
               y: -height/2 + (window.innerHeight/2)
             });
           }
         }
       } catch (e) {
         console.error("Failed to load draft", e);
       }
    } else if (id === 'new') {
        const width = (bounds.maxX - bounds.minX) * CELL_SIZE;
        const height = (bounds.maxY - bounds.minY) * CELL_SIZE;
        setOffset({
             x: -width/2 + (window.innerWidth/2),
             y: -height/2 + (window.innerHeight/2)
        });
    }
  }, [id]);

  // Auto-save Interval
  useEffect(() => {
    const timer = setInterval(() => {
      handleSave(true);
    }, 10000); // 10 seconds
    return () => clearInterval(timer);
  }, []); // Empty dependency array

  // Focus title input when renaming starts
  useEffect(() => {
    if (isRenaming && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isRenaming]);

  // Draw Rulers
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
        
        const RULER_THICKNESS = 20;
        
        // --- Draw Backgrounds ---
        ctx.fillStyle = 'rgba(248, 250, 252, 0.9)'; // slate-50 backdrop
        ctx.fillRect(0, 0, width, RULER_THICKNESS); // Top
        ctx.fillRect(0, 0, RULER_THICKNESS, height); // Left
        
        // Borders
        ctx.strokeStyle = '#cbd5e1'; // slate-300
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, RULER_THICKNESS); ctx.lineTo(width, RULER_THICKNESS);
        ctx.moveTo(RULER_THICKNESS, 0); ctx.lineTo(RULER_THICKNESS, height);
        ctx.stroke();

        ctx.fillStyle = '#64748b'; // slate-500
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const originX = offset.x;
        const originY = offset.y;

        // --- Draw Top Ruler (X) ---
        const startVal = Math.floor((RULER_THICKNESS - originX) / (CELL_SIZE * scale));
        const endVal = Math.ceil((width - originX) / (CELL_SIZE * scale));
        
        const renderStart = startVal - 2;
        const renderEnd = endVal + 2;

        for (let i = renderStart; i <= renderEnd; i++) {
            const screenX = originX + i * CELL_SIZE * scale;
            if (screenX < RULER_THICKNESS) continue;

            const isMajor = Math.abs(i) % 5 === 0;
            const isOrigin = i === 0;
            
            if (scale < 0.5 && !isMajor && !isOrigin) continue;

            ctx.beginPath();
            if (isMajor || isOrigin) {
                ctx.moveTo(screenX, RULER_THICKNESS - 10);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8';
                ctx.lineWidth = isOrigin ? 1.5 : 1;
                ctx.stroke();
                
                ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b';
                ctx.fillText(i.toString(), screenX + (CELL_SIZE*scale)/2, RULER_THICKNESS / 2);
            } else {
                ctx.moveTo(screenX, RULER_THICKNESS - 5);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // --- Draw Left Ruler (Y) ---
        const startRow = Math.floor((RULER_THICKNESS - originY) / (CELL_SIZE * scale));
        const endRow = Math.ceil((height - originY) / (CELL_SIZE * scale));
        const renderRowStart = startRow - 2;
        const renderRowEnd = endRow + 2;

        for (let i = renderRowStart; i <= renderRowEnd; i++) {
            const screenY = originY + i * CELL_SIZE * scale;
            if (screenY < RULER_THICKNESS) continue;

            const isMajor = Math.abs(i) % 5 === 0;
            const isOrigin = i === 0;
            
            if (scale < 0.5 && !isMajor && !isOrigin) continue;

            ctx.beginPath();
            if (isMajor || isOrigin) {
                ctx.moveTo(RULER_THICKNESS - 10, screenY);
                ctx.lineTo(RULER_THICKNESS, screenY);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8';
                ctx.lineWidth = isOrigin ? 1.5 : 1;
                ctx.stroke();
                 // Draw number
                 ctx.save();
                 ctx.translate(RULER_THICKNESS / 2, screenY + (CELL_SIZE*scale)/2);
                 ctx.rotate(-Math.PI / 2);
                 ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b';
                 ctx.fillText(i.toString(), 0, 0);
                 ctx.restore();
            } else {
                ctx.moveTo(RULER_THICKNESS - 5, screenY);
                ctx.lineTo(RULER_THICKNESS, screenY);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        // --- Corner Box ---
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
    };

    updateRulers();
    window.addEventListener('resize', updateRulers);
    return () => window.removeEventListener('resize', updateRulers);

  }, [scale, offset, bounds, isFreeMode]);

  // Commit history (called on Pointer Up)
  const commitHistory = (finalGrid: {[key: string]: string}) => {
    // Only commit if grid actually changed
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
    // Use the latest data from ref if silent (auto-save), or current state
    const currentData = autoSaveRef.current;

    // Determine ID: use existing params ID if valid, or create new timestamp ID
    const currentId = (id && id !== 'new' && id !== 'imported') ? id : Date.now().toString();
    const isNew = !id || id === 'new' || id === 'imported';

     // Calculate dimensions for thumbnail
    const width = currentData.bounds.maxX - currentData.bounds.minX;
    const height = currentData.bounds.maxY - currentData.bounds.minY;

    // Generate thumbnail
    const canvas = document.createElement('canvas');
    const thumbSize = 5; // Low res thumbnail
    canvas.width = Math.max(1, width * thumbSize);
    canvas.height = Math.max(1, height * thumbSize);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      Object.entries(currentData.grid).forEach(([key, colorId]) => {
        const [x, y] = key.split(',').map(Number);
        // Normalize
        const drawX = x - currentData.bounds.minX;
        const drawY = y - currentData.bounds.minY;
        const color = ARTKAL_COLORS.find(c => c.id === colorId);
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
      
      // If new, update URL to persistent draft URL
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
     // Create a normalized grid for export
     const width = bounds.maxX - bounds.minX;
     const height = bounds.maxY - bounds.minY;
     
     const normalizedGrid: {[key: string]: string} = {};
     Object.entries(grid).forEach(([key, val]) => {
         const [x, y] = key.split(',').map(Number);
         normalizedGrid[`${x - bounds.minX},${y - bounds.minY}`] = val as string;
     });

    navigate('/preview/custom', {
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
       // Force update ref immediately so auto-save picks it up
       autoSaveRef.current.title = title;
       handleSave(true); // Save immediately on rename finish
    }
  };

  // Tool Switching Logic
  const changeTool = (newTool: Tool) => {
    setTool(newTool);
    isDragging.current = false; // Reset drag state
    isDrawing.current = false;
  };

  // Helper to calculate grid coordinates from screen event
  const getGridCoord = (clientX: number, clientY: number) => {
    if (!mainContainerRef.current) return { x: 0, y: 0 };
    const rect = mainContainerRef.current.getBoundingClientRect();
    
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;
    
    const gridPixelX = (relativeX - offset.x) / scale;
    const gridPixelY = (relativeY - offset.y) / scale;
    
    return {
        x: Math.floor(gridPixelX / CELL_SIZE),
        y: Math.floor(gridPixelY / CELL_SIZE)
    };
  };

  // Tool Actions
  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move') return;

    // Boundary Checks
    if (!isFreeMode) {
        // Fixed Mode
        if (x < 0 || y < 0 || x >= bounds.maxX || y >= bounds.maxY) return;
    } else {
        // Free Mode Dynamic Expansion
        let newMinX = bounds.minX;
        let newMaxX = bounds.maxX;
        let newMinY = bounds.minY;
        let newMaxY = bounds.maxY;
        let changed = false;

        // Expand Left
        if (x < bounds.minX + 5) {
            newMinX = bounds.minX - 20;
            changed = true;
        }
        // Expand Right
        if (x >= bounds.maxX - 5) {
            newMaxX = bounds.maxX + 20;
            changed = true;
        }
        // Expand Top
        if (y < bounds.minY + 5) {
            newMinY = bounds.minY - 20;
            changed = true;
        }
        // Expand Bottom
        if (y >= bounds.maxY - 5) {
            newMaxY = bounds.maxY + 20;
            changed = true;
        }

        if (changed) {
            setBounds({ minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY });
        }
    }

    // Start of stroke?
    if (!isDrawing.current) {
        isDrawing.current = true;
        startStrokeGrid.current = { ...grid };
    }

    const key = `${x},${y}`;
    const newGrid = { ...grid };

    if (tool === 'pen') {
      newGrid[key] = selectedColor;
      setGrid(newGrid);
    } else if (tool === 'eraser') {
      delete newGrid[key];
      setGrid(newGrid);
    } else if (tool === 'picker') {
      const colorId = grid[key];
      if (colorId) {
        setSelectedColor(colorId);
        changeTool('pen');
      }
      isDrawing.current = false; // Picker is instant, no stroke
    } else if (tool === 'fill') {
      const targetColor = grid[key];
      if (targetColor === selectedColor) return;
      
      const queue = [[x, y]];
      const visited = new Set([key]);
      
      let safetyCount = 0;
      const MAX_FILL = 2000;

      while (queue.length > 0 && safetyCount < MAX_FILL) {
        const [cx, cy] = queue.shift()!;
        const cKey = `${cx},${cy}`;
        newGrid[cKey] = selectedColor;
        safetyCount++;

        const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neighbors) {
            const nKey = `${nx},${ny}`;
            
            // Check bounds based on mode
            if (!isFreeMode) {
               if (nx < 0 || ny < 0 || nx >= bounds.maxX || ny >= bounds.maxY) continue;
            }

            if (!visited.has(nKey)) {
               if (targetColor === undefined) {
                   // Do not fill empty void
               } else if (grid[nKey] === targetColor) {
                   visited.add(nKey);
                   queue.push([nx, ny]);
               }
            }
        }
      }
      setGrid(newGrid);
      commitHistory(newGrid); // Fill is instant
    }
  };

  // Pointer Events
  const handlePointerDown = (e: React.PointerEvent) => {
    // Explicitly prevent default browser behavior (scroll/zoom) during interactions
    // This is crucial for Move tool on mobile to work on top of the grid
    if (tool === 'move' || tool === 'pen' || tool === 'eraser') {
       e.preventDefault(); 
    }

    if (tool === 'move' || e.button === 1) {
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
       const {x, y} = getGridCoord(e.clientX, e.clientY);
       handleCellAction(x, y);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // If moving, prevent default as well to stop potential scroll chaining
    if (isDragging.current) e.preventDefault();

    if (isDragging.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    } else {
       const {x, y} = getGridCoord(e.clientX, e.clientY);
       setCursorPos({x, y});
       if (isDrawing.current && (tool === 'pen' || tool === 'eraser')) {
           handleCellAction(x, y);
       }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    // If we were drawing (Pen/Eraser), commit the stroke now
    if (isDrawing.current) {
        commitHistory(grid);
    }
  };

  const getTextColor = (hex: string | undefined) => {
    if (!hex) return 'black';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? '#000000' : '#ffffff';
  };

  const beadCounts = (() => {
    const counts: {[key: string]: number} = {};
    Object.keys(grid).forEach((key) => {
      const colorId = grid[key];
      counts[colorId] = (counts[colorId] || 0) + 1;
    });
    return counts;
  })();

  return (
    <div className="bg-slate-50 text-slate-900 font-display min-h-screen flex flex-col overflow-hidden relative select-none max-w-md mx-auto shadow-2xl">
      <header className="bg-surface-light border-b border-slate-200 z-30 shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 h-14">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-slate-100 active:bg-slate-200 text-slate-700">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            {isRenaming ? (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                className="text-sm font-bold text-slate-800 text-center bg-slate-100 border-none rounded py-0.5 px-2 w-full focus:ring-2 focus:ring-primary/50"
              />
            ) : (
              <h1 
                onClick={() => setIsRenaming(true)}
                className="text-sm font-bold text-slate-800 cursor-text hover:bg-slate-100 px-2 py-0.5 rounded transition-colors truncate max-w-[160px]"
              >
                {title}
              </h1>
            )}
            <div className="text-[10px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full mt-0.5 flex items-center gap-1">
               <span>{(bounds.maxX - bounds.minX)}x{(bounds.maxY - bounds.minY)}</span>
               {cursorPos && (
                   <>
                    <span className="text-slate-300">|</span>
                    <span className="text-primary font-mono">{cursorPos.x},{cursorPos.y}</span>
                   </>
               )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button id="save-btn" onClick={() => handleSave(false)} className="flex items-center gap-1 p-2 text-slate-600 hover:text-primary active:bg-slate-100 rounded-lg transition-all" title="保存到草稿箱">
               {saveStatus === 'saving' ? (
                <span className="material-symbols-outlined text-[22px] animate-spin text-primary">refresh</span>
              ) : saveStatus === 'saved' ? (
                <span className="material-symbols-outlined text-[22px] text-green-500">check_circle</span>
              ) : (
                <span className="material-symbols-outlined text-[22px]">save</span>
              )}
            </button>
            <button 
              onClick={handleExport}
              className="bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 hover:bg-blue-700 active:scale-95 transition-transform"
            >
              <span>导出</span>
              <span className="material-symbols-outlined text-[14px]">ios_share</span>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 overflow-x-auto hide-scrollbar gap-4">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowGrid(!showGrid)}
              className={`flex flex-col items-center gap-0.5 p-1 rounded hover:bg-white min-w-[36px] ${showGrid ? 'text-primary' : ''}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${showGrid ? 'filled' : ''}`}>grid_4x4</span>
              <span className="scale-90">网格</span>
            </button>
            <button 
              onClick={() => setShowNumbers(!showNumbers)}
              className={`flex flex-col items-center gap-0.5 p-1 rounded hover:bg-white min-w-[36px] ${showNumbers ? 'text-primary' : ''}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${showNumbers ? 'filled' : ''}`}>123</span>
              <span className="scale-90">编号</span>
            </button>
          </div>
          <div className="h-6 w-[1px] bg-slate-300"></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.1))} className="w-8 h-8 flex items-center justify-center rounded bg-white border border-slate-200 shadow-sm active:bg-slate-50">
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span className="font-mono text-slate-400 w-10 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(4, s + 0.1))} className="w-8 h-8 flex items-center justify-center rounded bg-white border border-slate-200 shadow-sm active:bg-slate-50">
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>
        </div>
      </header>

      <main 
        ref={mainContainerRef}
        className="flex-1 relative overflow-hidden bg-slate-200 touch-none cursor-crosshair"
      >
        {/* Floating Ruler Canvas */}
        <canvas 
            ref={rulerCanvasRef}
            className="absolute inset-0 pointer-events-none z-20"
        />

        <div 
          ref={containerRef}
          className="w-full h-full touch-none" 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={(e) => { 
            handlePointerUp(e); 
            setCursorPos(null);
          }}
          style={{ 
            backgroundSize: '40px 40px', 
            backgroundImage: 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)' 
          }}
        >
        
        <aside className="absolute left-3 top-4 flex flex-col gap-2 z-20 pointer-events-none">
          <div 
            className="bg-white/95 backdrop-blur shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-slate-200 rounded-lg flex flex-col p-1.5 gap-2 w-11 items-center pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
             <button 
              onClick={() => changeTool(tool === 'move' ? 'pen' : 'move')}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 ${tool === 'move' ? 'text-primary bg-blue-50' : 'text-slate-500'}`}
              title="移动画布"
            >
              <span className={`material-symbols-outlined text-[20px] ${tool === 'move' ? 'filled' : ''}`}>pan_tool</span>
            </button>
            <div className="w-6 h-[1px] bg-slate-200 my-0.5"></div>
            <button 
              onClick={() => changeTool('pen')}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 relative group ${tool === 'pen' ? 'text-primary bg-blue-50' : 'text-slate-500'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${tool === 'pen' ? 'filled' : ''}`}>edit</span>
              {tool === 'pen' && <div className="absolute -right-1 -bottom-1 w-2.5 h-2.5 rounded-full border border-white" style={{ backgroundColor: ARTKAL_COLORS.find(c => c.id === selectedColor)?.hex }}></div>}
            </button>
            <button 
              onClick={() => changeTool('eraser')}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 ${tool === 'eraser' ? 'text-primary bg-blue-50' : 'text-slate-500'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${tool === 'eraser' ? 'filled' : ''}`}>ink_eraser</span>
            </button>
            <button 
              onClick={() => changeTool('fill')}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 ${tool === 'fill' ? 'text-primary bg-blue-50' : 'text-slate-500'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${tool === 'fill' ? 'filled' : ''}`}>format_color_fill</span>
            </button>
            <button 
              onClick={() => changeTool('picker')}
              className={`w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 ${tool === 'picker' ? 'text-primary bg-blue-50' : 'text-slate-500'}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${tool === 'picker' ? 'filled' : ''}`}>colorize</span>
            </button>
          </div>
          <div 
            className="bg-white/95 backdrop-blur shadow-[0_4px_12px_rgba(0,0,0,0.1)] border border-slate-200 rounded-lg flex flex-col p-1.5 gap-2 w-11 items-center mt-2 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button onClick={handleUndo} disabled={historyIndex === 0} className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30">
              <span className="material-symbols-outlined text-[20px]">undo</span>
            </button>
            <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30">
              <span className="material-symbols-outlined text-[20px]">redo</span>
            </button>
          </div>
        </aside>

        {/* Infinite Canvas Stage */}
        <div 
          className="absolute origin-center transition-transform duration-75 ease-out"
          style={{ 
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` 
          }}
        >
          {/* Centered Grid Container */}
          <div 
            className="absolute bg-white shadow-2xl border border-slate-300 touch-none"
            style={{ 
              left: bounds.minX * CELL_SIZE,
              top: bounds.minY * CELL_SIZE,
              width: (bounds.maxX - bounds.minX) * CELL_SIZE,
              height: (bounds.maxY - bounds.minY) * CELL_SIZE
            }}
          >
             {/* Grid Lines */}
             {showGrid && (
              <div 
                className="absolute inset-0 pointer-events-none z-10 opacity-50"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #94a3b8 1px, transparent 1px),
                    linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
                  `,
                  backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
                  backgroundPosition: `0 0`
                }}
              />
            )}
            
            {/* Beads Rendering */}
            <div className="w-full h-full relative">
              {Object.entries(grid).map(([key, colorId]) => {
                const [x, y] = key.split(',').map(Number);

                if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return null;

                const color = ARTKAL_COLORS.find(c => c.id === colorId);
                const textColor = getTextColor(color?.hex);
                return (
                  <div 
                    key={key}
                    style={{ 
                      position: 'absolute',
                      left: (x - bounds.minX) * CELL_SIZE,
                      top: (y - bounds.minY) * CELL_SIZE,
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: color?.hex,
                      boxShadow: 'inset 0 0 2px rgba(0,0,0,0.2)'
                    }}
                    className="flex items-center justify-center"
                  >
                    {/* Bead Highlight */}
                    <div className="absolute inset-[1px] rounded-full border border-black/5 opacity-50 pointer-events-none"></div>
                    
                    {/* Numbers */}
                    {showNumbers && color && (
                      <span 
                        className="text-[7px] font-bold font-mono pointer-events-none z-20"
                        style={{ color: textColor }}
                      >
                        {color.code}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            
             {/* Origin Marker for reference (0,0) */}
             <div className="absolute w-2 h-2 bg-indigo-500 rounded-full -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none" style={{ left: 0 - (bounds.minX * CELL_SIZE), top: 0 - (bounds.minY * CELL_SIZE) }}></div>

          </div>
        </div>

        <aside className="absolute right-3 top-4 bottom-20 w-16 z-20 flex flex-col pointer-events-none">
          <div 
            className="bg-white/95 backdrop-blur shadow-lg border border-slate-200 rounded-lg flex flex-col pointer-events-auto h-full overflow-hidden"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-slate-100 flex justify-center">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">palette</span>
            </div>
            <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col items-center py-2 gap-3">
              {ARTKAL_COLORS.map(color => (
                <button 
                  key={color.id}
                  onClick={() => { setSelectedColor(color.id); changeTool('pen'); }}
                  className={`group relative flex flex-col items-center gap-1 transition-transform active:scale-95 ${selectedColor === color.id ? 'scale-105' : 'opacity-80 hover:opacity-100'}`}
                >
                  <div 
                    className={`w-8 h-8 rounded-full shadow-sm flex items-center justify-center border ${selectedColor === color.id ? 'ring-2 ring-primary ring-offset-2 border-transparent' : 'border-slate-200'}`}
                    style={{ backgroundColor: color.hex }}
                  >
                    <span className="text-[8px] font-bold text-white/90 drop-shadow-md mix-blend-difference">{color.code}</span>
                  </div>
                  {beadCounts[color.id] ? (
                    <span className="text-[9px] text-slate-500 font-medium bg-slate-100 px-1 rounded">{beadCounts[color.id]}</span>
                  ) : (
                    <span className="h-3"></span>
                  )}
                </button>
              ))}
              <button className="w-8 h-8 mt-2 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary">
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
          </div>
        </aside>
        </div>
      </main>
    </div>
  );
};

export default MobileEditor;