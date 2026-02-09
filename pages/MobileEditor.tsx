import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor } from '../utils/colors';
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
  const [showNumbers, setShowNumbers] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // History
  const [history, setHistory] = useState<{[key: string]: string}[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const isDragging = useRef(false);
  const isDrawing = useRef(false);
  const isPinching = useRef(false);
  const lastPinchRef = useRef<{ distance: number; center: { x: number; y: number } } | null>(null);
  
  const lastTouchPos = useRef({ x: 0, y: 0 });
  const startStrokeGrid = useRef<{[key: string]: string} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  
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

  // Rulers Rendering Logic
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    const container = containerRef.current;
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
        
        // Draw backgrounds
        ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
        ctx.fillRect(0, 0, width, RULER_THICKNESS);
        ctx.fillRect(0, 0, RULER_THICKNESS, height);
        
        // Lines
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, RULER_THICKNESS); ctx.lineTo(width, RULER_THICKNESS);
        ctx.moveTo(RULER_THICKNESS, 0); ctx.lineTo(RULER_THICKNESS, height);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const originX = offset.x;
        const originY = offset.y;

        // X-Axis Ruler
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
                ctx.moveTo(screenX, RULER_THICKNESS - 8);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8';
                ctx.lineWidth = isOrigin ? 1.5 : 1;
                ctx.stroke();
                
                ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b';
                if (scale > 0.3) {
                     ctx.fillText(i.toString(), screenX + (CELL_SIZE*scale)/2, RULER_THICKNESS / 2);
                }
            } else {
                ctx.moveTo(screenX, RULER_THICKNESS - 4);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        // Y-Axis Ruler
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
                ctx.moveTo(RULER_THICKNESS - 8, screenY);
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
                ctx.moveTo(RULER_THICKNESS - 4, screenY);
                ctx.lineTo(RULER_THICKNESS, screenY);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Corner
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
    };

    updateRulers();
    window.addEventListener('resize', updateRulers);
    return () => window.removeEventListener('resize', updateRulers);

  }, [scale, offset, bounds, isFreeMode]);

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
     handleSave(true);
     const width = bounds.maxX - bounds.minX;
     const height = bounds.maxY - bounds.minY;
     const normalizedGrid: {[key: string]: string} = {};
     Object.entries(grid).forEach(([key, val]) => {
         const [x, y] = key.split(',').map(Number);
         normalizedGrid[`${x - bounds.minX},${y - bounds.minY}`] = val as string;
     });
     
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom speed
    const zoomIntensity = 0.001; 
    const delta = -e.deltaY;
    // Calculate new scale
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta * zoomIntensity)), 5);
    
    // Calculate new offset to zoom towards pointer
    // Formula: mouse - (mouse - oldOffset) * (newScale / oldScale)
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;
    
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
     // Multi-touch Logic
     if (e.touches.length === 2) {
         isPinching.current = true;
         isDrawing.current = false; // Cancel any drawing
         
         const t1 = e.touches[0];
         const t2 = e.touches[1];
         
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         const center = {
             x: (t1.clientX + t2.clientX) / 2,
             y: (t1.clientY + t2.clientY) / 2
         };
         
         lastPinchRef.current = { distance: dist, center };
         return;
     }
     
     // Pan Tool Logic
     if (tool === 'move') {
         isDragging.current = true;
         lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
         return;
     }

     // Drawing Logic
     if (e.touches.length === 1 && !isPinching.current) {
        const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
        handleCellAction(x, y);
     }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      // Prevent default to avoid browser zooming/scrolling
      if (e.cancelable) e.preventDefault();

      // Pinch Zoom & Pan Logic
      if (e.touches.length === 2 && lastPinchRef.current) {
          const t1 = e.touches[0];
          const t2 = e.touches[1];
          
          const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const currentCenter = {
              x: (t1.clientX + t2.clientX) / 2,
              y: (t1.clientY + t2.clientY) / 2
          };
          
          const { distance: lastDist, center: lastCenter } = lastPinchRef.current;
          
          if (lastDist > 0) {
              // Calculate standard linear zoom factor
              const rawZoomFactor = currentDist / lastDist;
              
              // Amplify changes to make it faster
              // If raw is 1.02 (zooming in), we make it 1.03 (1 + 0.02 * 1.5)
              // If raw is 0.98 (zooming out), we make it 0.97 (1 - 0.02 * 1.5)
              const sensitivity = 5; 
              const amplifiedZoomFactor = 1 + (rawZoomFactor - 1) * sensitivity;

              const newScale = Math.min(Math.max(0.1, scale * amplifiedZoomFactor), 5);
              
              // Calculate Offset correction to keep pinch center stable
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (containerRect) {
                  const oldWorldX = (lastCenter.x - containerRect.left - offset.x) / scale;
                  const oldWorldY = (lastCenter.y - containerRect.top - offset.y) / scale;
                  
                  const newOffsetX = currentCenter.x - containerRect.left - (oldWorldX * newScale);
                  const newOffsetY = currentCenter.y - containerRect.top - (oldWorldY * newScale);
                  
                  setScale(newScale);
                  setOffset({ x: newOffsetX, y: newOffsetY });
              } else {
                  // Fallback
                  const dx = currentCenter.x - lastCenter.x;
                  const dy = currentCenter.y - lastCenter.y;
                  setScale(newScale);
                  setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
              }
          }
          
          lastPinchRef.current = { distance: currentDist, center: currentCenter };
          return;
      }

      // Single Finger Pan
      if (tool === 'move' && isDragging.current && e.touches.length === 1) {
          const dx = e.touches[0].clientX - lastTouchPos.current.x;
          const dy = e.touches[0].clientY - lastTouchPos.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          return;
      }

      // Single Finger Draw
      if (tool !== 'move' && !isDragging.current && !isPinching.current && e.touches.length === 1) {
          const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
          if (isDrawing.current && (tool === 'pen' || tool === 'eraser')) {
              handleCellAction(x, y);
          }
      }
  };
  
  const handleTouchEnd = () => {
      isDragging.current = false;
      isPinching.current = false;
      lastPinchRef.current = null;
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
    <div className="flex flex-col h-[100dvh] w-full bg-slate-100 overflow-hidden select-none">
       {/* Top Bar */}
       <div className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-20 shrink-0">
           <button onClick={() => navigate('/create')} className="p-2 -ml-2 text-slate-600">
               <span className="material-symbols-outlined">arrow_back</span>
           </button>
           
           <div className="flex gap-2">
                <button onClick={() => setShowGrid(!showGrid)} className={`p-2 transition-colors ${showGrid ? 'text-primary' : 'text-slate-600'}`}>
                    <span className="material-symbols-outlined text-[20px]">grid_4x4</span>
                </button>
                <button onClick={() => setShowNumbers(!showNumbers)} className={`p-2 transition-colors ${showNumbers ? 'text-primary' : 'text-slate-600'}`}>
                    <span className="material-symbols-outlined text-[20px]">123</span>
                </button>
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
         className="flex-1 relative overflow-hidden bg-slate-200 touch-none cursor-crosshair"
         style={{ touchAction: 'none' }} 
         onWheel={handleWheel}
         onTouchStart={handleTouchStart}
         onTouchMove={handleTouchMove}
         onTouchEnd={handleTouchEnd}
       >
          <canvas ref={rulerCanvasRef} className="absolute inset-0 pointer-events-none z-10" />

          <div 
             className="absolute origin-top-left"
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
                                  style={{ color: getTextColor(color.hex), fontSize: '8px' }}
                                >
                                  {color.code}
                                </span>
                             )}
                          </div>
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