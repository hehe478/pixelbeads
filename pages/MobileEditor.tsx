import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor, hexToRgb, rgbToLab, deltaE } from '../utils/colors';
import PaletteModal from '../components/PaletteModal';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move';

// Memoized Grid View to prevent expensive re-renders during zoom/pan
const GridView = React.memo(({ 
  grid, 
  bounds, 
  allBeadsMap, 
  showNumbers, 
  cellSize 
}: { 
  grid: {[key: string]: string}, 
  bounds: any, 
  allBeadsMap: Record<string, BeadColor>, 
  showNumbers: boolean,
  cellSize: number
}) => {
  return (
    <>
      {Object.entries(grid).map(([key, colorId]) => {
          const [x, y] = key.split(',').map(Number);
          if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return null;
          
          const color = allBeadsMap[colorId];
          if (!color) return null;

          return (
              <div 
                key={key}
                className="absolute flex items-center justify-center"
                style={{
                    left: (x - bounds.minX) * cellSize,
                    top: (y - bounds.minY) * cellSize,
                    width: cellSize,
                    height: cellSize,
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
    </>
  );
});

const MobileEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const state = location.state as { grid?: {[key: string]: string}, width?: number, height?: number, title?: string, minX?: number, minY?: number, isFreeMode?: boolean };

  const { allBeads, addToRecent, currentPalette, paletteConfig } = useColorPalette();

  // Optimized color lookup map
  const allBeadsMap = useMemo(() => {
    const map: Record<string, BeadColor> = {};
    allBeads.forEach(b => { map[b.id] = b; });
    return map;
  }, [allBeads]);

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
  
  const [offset, setOffset] = useState(() => {
     const contentWidth = (state?.width || initialSize) * CELL_SIZE;
     const contentHeight = (state?.height || initialSize) * CELL_SIZE;
     const initialScale = 0.8;
     const x = (window.innerWidth - contentWidth * initialScale) / 2;
     const y = (window.innerHeight - 136 - contentHeight * initialScale) / 2;
     return { x, y };
  });

  const [tool, setTool] = useState<Tool>('pen');
  const [selectedBead, setSelectedBead] = useState<BeadColor | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

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

  useEffect(() => {
    const timer = setInterval(() => handleSave(true), 10000); 
    return () => clearInterval(timer);
  }, []);

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
        ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
        ctx.fillRect(0, 0, width, RULER_THICKNESS);
        ctx.fillRect(0, 0, RULER_THICKNESS, height);
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
        const startVal = Math.floor((RULER_THICKNESS - originX) / (CELL_SIZE * scale));
        const endVal = Math.ceil((width - originX) / (CELL_SIZE * scale));
        for (let i = startVal - 2; i <= endVal + 2; i++) {
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
                if (scale > 0.3) ctx.fillText(i.toString(), screenX + (CELL_SIZE*scale)/2, RULER_THICKNESS / 2);
            } else {
                ctx.moveTo(screenX, RULER_THICKNESS - 4);
                ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = '#cbd5e1';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        const startRow = Math.floor((RULER_THICKNESS - originY) / (CELL_SIZE * scale));
        const endRow = Math.ceil((height - originY) / (CELL_SIZE * scale));
        for (let i = startRow - 2; i <= endRow + 2; i++) {
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
                 if (scale > 0.3) ctx.fillText(i.toString(), 0, 0);
                 ctx.restore();
            } else {
                ctx.moveTo(RULER_THICKNESS - 4, screenY);
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
    };
    updateRulers();
    window.addEventListener('resize', updateRulers);
    return () => window.removeEventListener('resize', updateRulers);
  }, [scale, offset, bounds]);

  const handleSave = (silent = false) => {
    setSaveStatus('saving');
    const currentData = autoSaveRef.current;
    let currentId = draftIdRef.current || Date.now().toString();
    draftIdRef.current = currentId;
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
        const color = allBeadsMap[colorId];
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
      width, height,
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
      setSaveStatus('idle');
    }
  };

  const handleExportClick = () => { handleSave(true); setShowExportModal(true); };

  const processExport = (shouldMapColors: boolean) => {
     setIsConverting(true);
     setTimeout(() => {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        let exportGrid: {[key: string]: string} = {};
        if (shouldMapColors) {
            if (!currentPalette || currentPalette.length === 0) {
                alert("当前选择的套装为空，请先在灵感页设置套装。");
                setIsConverting(false);
                return;
            }
            const paletteCache = currentPalette.map(bead => {
                const rgb = hexToRgb(bead.hex);
                return { id: bead.id, rgb, lab: rgbToLab(rgb.r, rgb.g, rgb.b) };
            });
            
            // Iterate directly over grid items for O(N) performance instead of O(W*H)
            Object.entries(grid).forEach(([key, colorId]: [string, string]) => {
                const [gx, gy] = key.split(',').map(Number);
                const x = gx - bounds.minX;
                const y = gy - bounds.minY;
                
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const originalBead = allBeadsMap[colorId];
                    if (originalBead) {
                        const rgb = hexToRgb(originalBead.hex);
                        const currentLab = rgbToLab(rgb.r, rgb.g, rgb.b);
                        
                        let minDistance = Infinity;
                        let closestBead = paletteCache[0];
                        
                        for (const p of paletteCache) {
                            const dist = deltaE(currentLab, p.lab);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestBead = p;
                            }
                        }
                        
                        exportGrid[`${x},${y}`] = closestBead.id;
                    }
                }
            });
        } else {
            Object.entries(grid).forEach(([key, val]: [string, string]) => {
                const [x, y] = key.split(',').map(Number);
                exportGrid[`${x - bounds.minX},${y - bounds.minY}`] = val;
            });
        }
        setIsConverting(false); setShowExportModal(false);
        navigate(`/preview/${draftIdRef.current || 'custom'}`, { state: { grid: exportGrid, width, height, title: shouldMapColors ? `${title} (套装转换)` : title } });
     }, 100);
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

  const handleUndo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setGrid(history[historyIndex - 1]); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setGrid(history[historyIndex + 1]); } };

  const getGridCoord = (clientX: number, clientY: number) => {
     if (!containerRef.current) return { x: 0, y: 0 };
     const rect = containerRef.current.getBoundingClientRect();
     const gridPixelX: number = (clientX - rect.left - offset.x) / scale;
     const gridPixelY: number = (clientY - rect.top - offset.y) / scale;
     return { x: Math.floor(gridPixelX / CELL_SIZE) + bounds.minX, y: Math.floor(gridPixelY / CELL_SIZE) + bounds.minY };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const delta = -e.deltaY;
    const newScale = Math.min(Math.max(0.1, scale * (1 + delta * 0.001)), 5);
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;
    setOffset({ x: mouseX - worldX * newScale, y: mouseY - worldY * newScale });
    setScale(newScale);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
     if (e.touches.length === 2) {
         isPinching.current = true; isDrawing.current = false;
         const t1 = e.touches[0]; const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         lastPinchRef.current = { distance: dist, center: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 } };
         return;
     }
     if (tool === 'move') {
         isDragging.current = true;
         lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
         return;
     }
     if (e.touches.length === 1 && !isPinching.current) {
        const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
        handleCellAction(x, y);
     }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 2 && lastPinchRef.current) {
          const t1 = e.touches[0]; const t2 = e.touches[1];
          const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const currentCenter = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
          const { distance: lastDist, center: lastCenter } = lastPinchRef.current;
          if (lastDist > 0) {
              const amplifiedZoomFactor = 1 + (currentDist / lastDist - 1) * 1.5;
              const newScale = Math.min(Math.max(0.1, scale * amplifiedZoomFactor), 5);
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (containerRect) {
                  const worldX = (lastCenter.x - containerRect.left - offset.x) / scale;
                  const worldY = (lastCenter.y - containerRect.top - offset.y) / scale;
                  setOffset({ x: currentCenter.x - containerRect.left - (worldX * newScale), y: currentCenter.y - containerRect.top - (worldY * newScale) });
                  setScale(newScale);
              }
          }
          lastPinchRef.current = { distance: currentDist, center: currentCenter };
          return;
      }
      if (tool === 'move' && isDragging.current && e.touches.length === 1) {
          const dx = e.touches[0].clientX - lastTouchPos.current.x;
          const dy = e.touches[0].clientY - lastTouchPos.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          return;
      }
      if (tool !== 'move' && !isDragging.current && !isPinching.current && e.touches.length === 1) {
          const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
          if (isDrawing.current && (tool === 'pen' || tool === 'eraser')) handleCellAction(x, y);
      }
  };
  
  const handleTouchEnd = () => {
      isDragging.current = false; isPinching.current = false; lastPinchRef.current = null;
      if (isDrawing.current) commitHistory(grid);
  };

  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move' || !selectedBead) return;
    if (!isFreeMode) { if (x < bounds.minX || y < bounds.minY || x >= bounds.maxX || y >= bounds.maxY) return; }
    else {
        let newMinX = bounds.minX; let newMaxX = bounds.maxX;
        let newMinY = bounds.minY; let newMaxY = bounds.maxY;
        let changed = false; let addedLeft = 0; let addedTop = 0;
        const EXPAND_CHUNK = 20;
        if (x < bounds.minX + 5) { newMinX = bounds.minX - EXPAND_CHUNK; addedLeft = EXPAND_CHUNK; changed = true; }
        if (x >= bounds.maxX - 5) { newMaxX = bounds.maxX + EXPAND_CHUNK; changed = true; }
        if (y < bounds.minY + 5) { newMinY = bounds.minY - EXPAND_CHUNK; addedTop = EXPAND_CHUNK; changed = true; }
        if (y >= bounds.maxY - 5) { newMaxY = bounds.maxY + EXPAND_CHUNK; changed = true; }
        if (changed) {
            setBounds({ minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY });
            if (addedLeft > 0 || addedTop > 0) {
                setOffset(prev => ({ x: prev.x - (addedLeft * CELL_SIZE * scale), y: prev.y - (addedTop * CELL_SIZE * scale) }));
            }
        }
    }
    if (!isDrawing.current) { isDrawing.current = true; startStrokeGrid.current = { ...grid }; }
    const key = `${x},${y}`; 
    const newGrid: { [key: string]: string } = { ...grid };
    if (tool === 'pen') { newGrid[key] = selectedBead.id; setGrid(newGrid); }
    else if (tool === 'eraser') { delete newGrid[key]; setGrid(newGrid); }
    else if (tool === 'picker') {
      const colorId = grid[key];
      if (colorId) { const found = allBeadsMap[colorId]; if (found) { setSelectedBead(found); addToRecent(found); setTool('pen'); } }
      isDrawing.current = false;
    } else if (tool === 'fill') {
      const targetColor = grid[key];
      if (targetColor === selectedBead.id) return;
      
      const queue: [number, number][] = [[x, y]];
      const visited: Set<string> = new Set<string>([key]);
      let safetyCount = 0;
      
      while (queue.length > 0 && safetyCount < 1000) {
        const next: [number, number] | undefined = queue.shift();
        if (!next) break;
        const [cx, cy] = next;
        const cKey: string = `${cx},${cy}`;
        if (selectedBead) {
          newGrid[cKey] = selectedBead.id;
        }
        safetyCount++;
        
        const neighbors: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        neighbors.forEach(([nx, ny]) => {
           const nKey: string = `${nx},${ny}`;
           if (!isFreeMode && (nx < bounds.minX || ny < bounds.minY || nx >= bounds.maxX || ny >= bounds.maxY)) return;
           
           if (!visited.has(nKey)) {
             const neighborColor: string | undefined = grid[nKey];
             if (targetColor === undefined) {
               if (neighborColor === undefined) {
                 visited.add(nKey);
                 queue.push([nx, ny]);
               }
             } else if (neighborColor === targetColor) {
               visited.add(nKey);
               queue.push([nx, ny]);
             }
           }
        });
      }
      setGrid(newGrid); commitHistory(newGrid);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden select-none">
       <div className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-20 shrink-0">
           <button onClick={() => navigate('/create')} className="p-2 -ml-2 text-slate-600"><span className="material-symbols-outlined">arrow_back</span></button>
           <div className="flex gap-2">
                <button onClick={() => setShowGrid(!showGrid)} className={`p-2 transition-colors ${showGrid ? 'text-primary' : 'text-slate-600'}`}><span className="material-symbols-outlined text-[20px]">grid_4x4</span></button>
                <button onClick={() => setShowNumbers(!showNumbers)} className={`p-2 transition-colors ${showNumbers ? 'text-primary' : 'text-slate-600'}`}><span className="material-symbols-outlined text-[20px]">123</span></button>
                <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 text-slate-600 disabled:opacity-30"><span className="material-symbols-outlined">undo</span></button>
                <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 text-slate-600 disabled:opacity-30"><span className="material-symbols-outlined">redo</span></button>
                <button onClick={() => handleSave(false)} className={`p-2 transition-colors ${saveStatus === 'saved' ? 'text-green-500' : 'text-primary'}`}><span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check_circle' : 'save'}</span></button>
                <button onClick={handleExportClick} className="p-2 text-slate-600"><span className="material-symbols-outlined">ios_share</span></button>
           </div>
       </div>

       <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-200 touch-none cursor-crosshair" style={{ touchAction: 'none' }} onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <canvas ref={rulerCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
          <div className="absolute origin-top-left" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, willChange: 'transform' }}>
              <div className="bg-white shadow-xl relative" style={{ width: (bounds.maxX - bounds.minX) * CELL_SIZE, height: (bounds.maxY - bounds.minY) * CELL_SIZE }}>
                  {showGrid && <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: `linear-gradient(to right, #ccc 1px, transparent 1px), linear-gradient(to bottom, #ccc 1px, transparent 1px)`, backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px` }} />}
                  <GridView grid={grid} bounds={bounds} allBeadsMap={allBeadsMap} showNumbers={showNumbers} cellSize={CELL_SIZE} />
              </div>
          </div>
       </div>

       <div className="bg-white border-t border-slate-200 shrink-0 h-20 pb-safe flex items-center justify-between px-6 z-30">
           <div className="flex flex-col items-center gap-1">
               <button onClick={() => setIsPaletteOpen(true)} className="w-10 h-10 rounded-full shadow-md border-2 border-white ring-2 ring-gray-200 relative overflow-hidden" style={{ backgroundColor: selectedBead?.hex || '#ccc' }}><div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none"></div></button>
               <span className="text-[10px] font-bold text-gray-500 max-w-[4rem] truncate">{selectedBead?.code || '选择'}</span>
           </div>
           <div className="w-[1px] h-8 bg-gray-200 mx-2"></div>
           <div className="flex flex-1 justify-between text-slate-500 max-w-xs">
               <button onClick={() => setTool('move')} className={`flex flex-col items-center transition-colors ${tool === 'move' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'move' ? 'filled' : ''}`}>pan_tool_alt</span></button>
               <button onClick={() => setTool('pen')} className={`flex flex-col items-center transition-colors ${tool === 'pen' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'pen' ? 'filled' : ''}`}>edit</span></button>
               <button onClick={() => setTool('eraser')} className={`flex flex-col items-center transition-colors ${tool === 'eraser' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'eraser' ? 'filled' : ''}`}>ink_eraser</span></button>
               <button onClick={() => setTool('fill')} className={`flex flex-col items-center transition-colors ${tool === 'fill' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'fill' ? 'filled' : ''}`}>format_color_fill</span></button>
               <button onClick={() => setTool('picker')} className={`flex flex-col items-center transition-colors ${tool === 'picker' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'picker' ? 'filled' : ''}`}>colorize</span></button>
           </div>
       </div>

       <PaletteModal isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onSelect={(c) => { setSelectedBead(c); addToRecent(c); setTool('pen'); setIsPaletteOpen(false); }} />
       {showExportModal && (
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
            <div className="bg-white dark:bg-surface-dark w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">导出选项</h3>
                    <button onClick={() => setShowExportModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><span className="material-symbols-outlined text-gray-500">close</span></button>
                </div>
                {isConverting ? (
                    <div className="flex flex-col items-center justify-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div><p className="text-sm text-gray-500">正在应用套装色彩 (CIELAB)...</p></div>
                ) : (
                    <div className="space-y-4">
                        <button onClick={() => processExport(false)} className="w-full flex items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1e1e30] hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all group">
                            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">palette</span></div>
                            <div className="ml-4 flex-1 text-left"><h4 className="font-bold text-gray-900 dark:text-white">原始色彩导出</h4><p className="text-xs text-gray-500 mt-1">保留绘制时使用的所有原始颜色</p></div>
                            <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                        </button>
                        <button onClick={() => processExport(true)} className="w-full flex items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1e1e30] hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all group">
                            <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">auto_fix</span></div>
                            <div className="ml-4 flex-1 text-left"><h4 className="font-bold text-gray-900 dark:text-white">转换为套装色</h4><p className="text-xs text-gray-500 mt-1">自动替换为 {paletteConfig.brand} 套装内的近似色</p></div>
                            <span className="material-symbols-outlined text-gray-400">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>
         </div>
       )}
    </div>
  );
};

export default MobileEditor;