import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor, hexToRgb, rgbToLab, deltaE, denoiseGrid } from '../utils/colors';
import PaletteModal from '../components/PaletteModal';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move';

// Memoized Grid View using Canvas for high performance rendering
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    const width = (bounds.maxX - bounds.minX) * cellSize;
    const height = (bounds.maxY - bounds.minY) * cellSize;
    ctx.clearRect(0, 0, width, height);

    // Set font for numbers once
    if (showNumbers) {
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    }

    Object.entries(grid).forEach(([key, colorId]) => {
        const [x, y] = key.split(',').map(Number);
        
        // Skip rendering if out of current bounds
        if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return;
        
        const color = allBeadsMap[colorId];
        if (!color) return;

        const posX = (x - bounds.minX) * cellSize;
        const posY = (y - bounds.minY) * cellSize;

        // Draw pixel
        ctx.fillStyle = color.hex;
        ctx.fillRect(posX, posY, cellSize, cellSize);

        // Draw number code if enabled
        if (showNumbers) {
            ctx.fillStyle = getTextColor(color.hex);
            // Center text in cell
            ctx.fillText(color.code, posX + cellSize/2, posY + cellSize/2);
        }
    });

  }, [grid, bounds, allBeadsMap, showNumbers, cellSize]);

  return (
    <canvas 
        ref={canvasRef}
        width={(bounds.maxX - bounds.minX) * cellSize}
        height={(bounds.maxY - bounds.minY) * cellSize}
        className="absolute top-0 left-0 pointer-events-none"
    />
  );
});

const DesktopEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const state = location.state as { grid?: {[key: string]: string}, width?: number, height?: number, title?: string, minX?: number, minY?: number, isFreeMode?: boolean };

  const { allBeads, recentColors, addToRecent, currentPalette, paletteConfig } = useColorPalette();

  const allBeadsMap = useMemo(() => {
    const map: Record<string, BeadColor> = {};
    allBeads.forEach(b => { map[b.id] = b; });
    return map;
  }, [allBeads]);

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  
  // Export Settings
  const [reduceNoise, setReduceNoise] = useState(false);
  const [detailProtection, setDetailProtection] = useState(30); // Default to 30

  // Conversion States
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showConvertSuccess, setShowConvertSuccess] = useState(false);

  // Bead Mode State
  const [isBeadMode, setIsBeadMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<{[key: string]: string}[]>([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isDragging = useRef(false);
  const isDrawing = useRef(false);
  const startStrokeGrid = useRef<{[key: string]: string} | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const autoSaveRef = useRef({ grid, title, bounds, isFreeMode, offset, scale });

  useEffect(() => {
    if (!selectedBead) {
      const defaultBead = allBeads.find(b => b.code === 'B09' || b.hex === '#000000') || allBeads[0];
      if (defaultBead) setSelectedBead(defaultBead);
    }
  }, [allBeads]);

  useEffect(() => { if (state?.grid && history.length === 1 && Object.keys(history[0]).length === 0) { setHistory([state.grid]); setHistoryIndex(0); } }, []);
  useEffect(() => { autoSaveRef.current = { grid, title, bounds, isFreeMode, offset, scale }; }, [grid, title, bounds, isFreeMode, offset, scale]);

  useEffect(() => {
    if (!state?.grid && id && id !== 'new' && id !== 'imported') {
       try {
         const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
         const draft = drafts.find((d: any) => d.id === id);
         if (draft) {
           setGrid(draft.grid); setTitle(draft.title); setHistory([draft.grid]); setHistoryIndex(0);
           setIsFreeMode(draft.isFreeMode ?? (draft.width === 100));
           setBounds({ minX: draft.minX ?? 0, minY: draft.minY ?? 0, maxX: draft.minX !== undefined ? (draft.minX + draft.width) : draft.width, maxY: draft.minY !== undefined ? (draft.minY + draft.height) : draft.height });
           if (draft.offsetX !== undefined && draft.offsetY !== undefined) {
             setOffset({ x: draft.offsetX, y: draft.offsetY });
             if (draft.zoom) setScale(draft.zoom);
           }
         }
       } catch (e) {}
    }
  }, [id]);

  useEffect(() => { const timer = setInterval(() => { if (!isBeadMode) handleSave(true); }, 10000); return () => clearInterval(timer); }, [isBeadMode]);
  useEffect(() => { if (isRenaming && titleInputRef.current) titleInputRef.current.focus(); }, [isRenaming]);

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (isBeadMode) {
        interval = setInterval(() => {
            setTimerSeconds(prev => prev + 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBeadMode]);

  const formatTime = (totalSeconds: number) => {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const canvas = rulerCanvasRef.current; const container = mainContainerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const updateRulers = () => {
        canvas.width = container.clientWidth; canvas.height = container.clientHeight;
        const RULER_THICKNESS = 24;
        ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
        ctx.fillRect(0, 0, canvas.width, RULER_THICKNESS); ctx.fillRect(0, 0, RULER_THICKNESS, canvas.height);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(0, RULER_THICKNESS); ctx.lineTo(canvas.width, RULER_THICKNESS); ctx.moveTo(RULER_THICKNESS, 0); ctx.lineTo(RULER_THICKNESS, canvas.height);
        ctx.stroke();
        ctx.fillStyle = '#64748b'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const startVal = Math.floor((RULER_THICKNESS - offset.x) / (CELL_SIZE * scale));
        const endVal = Math.ceil((canvas.width - offset.x) / (CELL_SIZE * scale));
        for (let i = startVal - 2; i <= endVal + 2; i++) {
            const screenX = offset.x + i * CELL_SIZE * scale;
            if (screenX < RULER_THICKNESS) continue;
            const isMajor = Math.abs(i) % 5 === 0; const isOrigin = i === 0;
            if (scale < 0.4 && !isMajor && !isOrigin) continue;
            ctx.beginPath();
            if (isMajor || isOrigin) {
                ctx.moveTo(screenX, RULER_THICKNESS - 12); ctx.lineTo(screenX, RULER_THICKNESS);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8'; ctx.lineWidth = isOrigin ? 1.5 : 1; ctx.stroke();
                ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b';
                if (scale > 0.3) ctx.fillText(i.toString(), screenX + (CELL_SIZE*scale)/2, RULER_THICKNESS / 2);
            } else { ctx.moveTo(screenX, RULER_THICKNESS - 6); ctx.lineTo(screenX, RULER_THICKNESS); ctx.strokeStyle = '#cbd5e1'; ctx.stroke(); }
        }
        const startRow = Math.floor((RULER_THICKNESS - offset.y) / (CELL_SIZE * scale));
        const endRow = Math.ceil((canvas.height - offset.y) / (CELL_SIZE * scale));
        for (let i = startRow - 2; i <= endRow + 2; i++) {
            const screenY = offset.y + i * CELL_SIZE * scale;
            if (screenY < RULER_THICKNESS) continue;
            const isMajor = Math.abs(i) % 5 === 0; const isOrigin = i === 0;
            if (scale < 0.4 && !isMajor && !isOrigin) continue;
            ctx.beginPath();
            if (isMajor || isOrigin) {
                ctx.moveTo(RULER_THICKNESS - 12, screenY); ctx.lineTo(RULER_THICKNESS, screenY);
                ctx.strokeStyle = isOrigin ? '#6366f1' : '#94a3b8'; ctx.lineWidth = isOrigin ? 1.5 : 1; ctx.stroke();
                 ctx.save(); ctx.translate(RULER_THICKNESS / 2, screenY + (CELL_SIZE*scale)/2); ctx.rotate(-Math.PI / 2);
                 ctx.fillStyle = isOrigin ? '#6366f1' : '#64748b'; if (scale > 0.3) ctx.fillText(i.toString(), 0, 0); ctx.restore();
            } else { ctx.moveTo(RULER_THICKNESS - 6, screenY); ctx.lineTo(RULER_THICKNESS, screenY); ctx.strokeStyle = '#cbd5e1'; ctx.stroke(); }
        }
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0, RULER_THICKNESS, RULER_THICKNESS); ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(0,0, RULER_THICKNESS, RULER_THICKNESS);
    };
    updateRulers(); window.addEventListener('resize', updateRulers); return () => window.removeEventListener('resize', updateRulers);
  }, [scale, offset, bounds]);

  const handleSave = (silent = false) => {
    setSaveStatus('saving');
    const currentData = autoSaveRef.current;
    let currentId = draftIdRef.current || Date.now().toString(); draftIdRef.current = currentId;
    const width = currentData.bounds.maxX - currentData.bounds.minX;
    const height = currentData.bounds.maxY - currentData.bounds.minY;
    const canvas = document.createElement('canvas'); const thumbSize = 5;
    canvas.width = Math.max(1, width * thumbSize); canvas.height = Math.max(1, height * thumbSize);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      Object.entries(currentData.grid).forEach(([key, colorId]) => {
        const [x, y] = key.split(',').map(Number);
        const color = allBeadsMap[colorId];
        if (color) { ctx.fillStyle = color.hex; ctx.fillRect((x - currentData.bounds.minX) * thumbSize, (y - currentData.bounds.minY) * thumbSize, thumbSize, thumbSize); }
      });
    }
    const draft: Draft = { id: currentId, title: currentData.title, grid: currentData.grid, width, height, minX: currentData.bounds.minX, minY: currentData.bounds.minY, isFreeMode: currentData.isFreeMode, offsetX: currentData.offset.x, offsetY: currentData.offset.y, zoom: currentData.scale, lastModified: Date.now(), thumbnail: canvas.toDataURL('image/png', 0.5) };
    try {
      const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
      const idx = drafts.findIndex((d: Draft) => d.id === draft.id);
      if (idx >= 0) drafts[idx] = draft; else drafts.unshift(draft);
      localStorage.setItem('pixelbead_drafts', JSON.stringify(drafts));
      setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) { setSaveStatus('idle'); }
  };

  const handleExportClick = () => { handleSave(true); setShowExportModal(true); };

  const performConversion = () => {
      if (!currentPalette || currentPalette.length === 0) return;
      setIsConverting(true);
      setShowConvertConfirm(false);

      setTimeout(() => {
          const paletteCache = currentPalette.map(bead => {
              const rgb = hexToRgb(bead.hex);
              return { id: bead.id, rgb, lab: rgbToLab(rgb.r, rgb.g, rgb.b) };
          });

          const newGrid: {[key: string]: string} = {};
          Object.entries(grid).forEach(([key, colorId]) => {
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
                  newGrid[key] = closestBead.id;
              }
          });

          // Generate Draft Copy
          const width = bounds.maxX - bounds.minX;
          const height = bounds.maxY - bounds.minY;
          const canvas = document.createElement('canvas');
          const thumbSize = 5;
          canvas.width = Math.max(1, width * thumbSize);
          canvas.height = Math.max(1, height * thumbSize);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            Object.entries(newGrid).forEach(([key, colorId]) => {
              const [x, y] = key.split(',').map(Number);
              const drawX = x - bounds.minX;
              const drawY = y - bounds.minY;
              const color = allBeadsMap[colorId];
              if (color) {
                ctx.fillStyle = color.hex;
                ctx.fillRect(drawX * thumbSize, drawY * thumbSize, thumbSize, thumbSize);
              }
            });
          }

          const newDraft: Draft = {
              id: Date.now().toString(),
              title: `${title} (转换版)`,
              grid: newGrid,
              width, height,
              minX: bounds.minX,
              minY: bounds.minY,
              isFreeMode,
              lastModified: Date.now(),
              thumbnail: canvas.toDataURL('image/png', 0.5)
          };

          try {
              const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
              drafts.unshift(newDraft);
              localStorage.setItem('pixelbead_drafts', JSON.stringify(drafts));
              setShowConvertSuccess(true);
          } catch (e) {
              alert('保存副本失败，请检查存储空间');
          } finally {
              setIsConverting(false);
          }
      }, 100);
  };

  const processExport = (shouldMapColors: boolean) => {
     setIsConverting(true);
     setTimeout(() => {
        const width = bounds.maxX - bounds.minX; const height = bounds.maxY - bounds.minY;
        
        // 1. Prepare base grid (optionally denoised)
        let processedGrid = { ...grid };
        if (reduceNoise) {
            // Updated to use the adjustable threshold
            // protection 100 => threshold 0 (Keep all)
            // protection 0 => threshold 100 (Keep only huge contrasts)
            const threshold = 100 - detailProtection;
            processedGrid = denoiseGrid(processedGrid, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, allBeadsMap, threshold);
        }

        let exportGrid: {[key: string]: string} = {};
        if (shouldMapColors) {
            if (!currentPalette || currentPalette.length === 0) { alert("当前选择的套装为空"); setIsConverting(false); return; }
            const paletteCache = currentPalette.map(bead => { const rgb = hexToRgb(bead.hex); return { id: bead.id, rgb, lab: rgbToLab(rgb.r, rgb.g, rgb.b) }; });
            
            // Iterate directly over grid items for O(N) performance instead of O(W*H)
            Object.entries(processedGrid).forEach(([key, colorId]: [string, string]) => {
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
        } else { Object.entries(processedGrid).forEach(([key, val]: [string, string]) => { const [x, y] = key.split(',').map(Number); exportGrid[`${x - bounds.minX},${y - bounds.minY}`] = val; }); }
        setIsConverting(false); setShowExportModal(false);
        navigate(`/preview/${draftIdRef.current || 'custom'}`, { state: { grid: exportGrid, width, height, title: shouldMapColors ? `${title} (套装转换)` : title } });
     }, 100);
  };

  const commitHistory = (finalGrid: {[key: string]: string}) => { if (JSON.stringify(finalGrid) !== JSON.stringify(history[historyIndex])) { const newHistory = history.slice(0, historyIndex + 1); newHistory.push(finalGrid); setHistory(newHistory); setHistoryIndex(newHistory.length - 1); } isDrawing.current = false; };
  const handleUndo = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setGrid(history[historyIndex - 1]); } };
  const handleRedo = () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setGrid(history[historyIndex + 1]); } };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); if (!mainContainerRef.current) return;
    const rect = mainContainerRef.current.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    const newScale = Math.min(Math.max(0.1, scale * (1 + -e.deltaY * 0.001)), 5);
    const worldX = (mouseX - offset.x) / scale; const worldY = (mouseY - offset.y) / scale;
    setOffset({ x: mouseX - worldX * newScale, y: mouseY - worldY * newScale }); setScale(newScale);
  };

  const getGridCoord = (clientX: number, clientY: number) => {
    if (!mainContainerRef.current) return { x: 0, y: 0 };
    const rect = mainContainerRef.current.getBoundingClientRect();
    const gridX: number = (clientX - rect.left - offset.x) / scale; 
    const gridY: number = (clientY - rect.top - offset.y) / scale;
    return { x: Math.floor(gridX / CELL_SIZE) + bounds.minX, y: Math.floor(gridY / CELL_SIZE) + bounds.minY };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      // In Bead Mode, force drag/pan behavior regardless of button or tool
      if (e.button === 1 || tool === 'move' || isBeadMode) { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; return; }
      const {x, y} = getGridCoord(e.clientX, e.clientY); handleCellAction(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const {x, y} = getGridCoord(e.clientX, e.clientY); setCursorPos({x, y});
      if (isDragging.current) {
          const dx = e.clientX - lastPos.current.x; const dy = e.clientY - lastPos.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy })); lastPos.current = { x: e.clientX, y: e.clientY }; return;
      }
      if (isDrawing.current && (tool === 'pen' || tool === 'eraser') && !isBeadMode) handleCellAction(x, y);
  };

  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move' || !selectedBead || isBeadMode) return;
    
    // Auto-expand logic for Free Mode
    if (isFreeMode) {
        let newMinX = bounds.minX;
        let newMaxX = bounds.maxX;
        let newMinY = bounds.minY;
        let newMaxY = bounds.maxY;
        let changed = false;
        let addedLeft = 0;
        let addedTop = 0;
        const EXPAND_CHUNK = 10;

        // Expand Left (Negative X)
        if (x < bounds.minX + 2) { 
            newMinX = bounds.minX - EXPAND_CHUNK; 
            addedLeft = EXPAND_CHUNK; 
            changed = true; 
        }
        // Expand Right (Positive X)
        if (x >= bounds.maxX - 2) { 
            newMaxX = bounds.maxX + EXPAND_CHUNK; 
            changed = true; 
        }
        // Expand Top (Negative Y)
        if (y < bounds.minY + 2) { 
            newMinY = bounds.minY - EXPAND_CHUNK; 
            addedTop = EXPAND_CHUNK; 
            changed = true; 
        }
        // Expand Bottom (Positive Y)
        if (y >= bounds.maxY - 2) { 
            newMaxY = bounds.maxY + EXPAND_CHUNK; 
            changed = true; 
        }

        if (changed) {
            setBounds({ minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY });
            // Seamless expansion: Adjust offset to counteract the bounds change
            if (addedLeft > 0 || addedTop > 0) {
                setOffset(prev => ({ 
                    x: prev.x - (addedLeft * CELL_SIZE * scale), 
                    y: prev.y - (addedTop * CELL_SIZE * scale) 
                }));
            }
        }
    } else {
        // Fixed Mode: Boundary Check
        if (x < bounds.minX || y < bounds.minY || x >= bounds.maxX || y >= bounds.maxY) return;
    }

    if (!isDrawing.current) { isDrawing.current = true; startStrokeGrid.current = { ...grid }; }
    const key = `${x},${y}`; 
    const newGrid: { [key: string]: string } = { ...grid };
    if (tool === 'pen') { newGrid[key] = selectedBead.id; setGrid(newGrid); }
    else if (tool === 'eraser') { delete newGrid[key]; setGrid(newGrid); }
    else if (tool === 'picker') { const colorId = grid[key]; if (colorId) { const found = allBeadsMap[colorId]; if (found) { setSelectedBead(found); addToRecent(found); setTool('pen'); } } isDrawing.current = false; }
    else if (tool === 'fill') {
      const targetColor = grid[key]; if (targetColor === selectedBead.id) return;
      
      const queue: [number, number][] = [[x, y]];
      const visited: Set<string> = new Set<string>([key]);
      let safety: number = 0;
      
      while (queue.length > 0 && safety < 2000) {
        const next: [number, number] | undefined = queue.shift();
        if (!next) break;
        const [cx, cy] = next;
        if (selectedBead) {
          newGrid[`${cx},${cy}`] = selectedBead.id;
        }
        safety++;
        
        const neighbors: [number, number][] = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
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
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden select-none">
       {/* Sidebar - Hidden in Bead Mode */}
       {!isBeadMode && (
           <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-sm transition-all duration-300">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                 <button onClick={() => navigate('/create')} className="hover:bg-slate-100 p-1 rounded-full text-slate-500"><span className="material-symbols-outlined">arrow_back</span></button>
                 {isRenaming ? (
                   <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { setIsRenaming(false); handleSave(true); }} onKeyDown={(e) => e.key === 'Enter' && setIsRenaming(false)} className="font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded w-full outline-none" autoFocus />
                 ) : (
                   <h1 onClick={() => setIsRenaming(true)} className="font-bold text-gray-900 truncate cursor-text hover:bg-slate-50 px-2 py-0.5 rounded">{title}</h1>
                 )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                 <div className="p-6 flex flex-col items-center border-b border-slate-100 bg-slate-50/50">
                     <div className="w-24 h-24 rounded-full shadow-md border-4 border-white mb-3 relative overflow-hidden" style={{ backgroundColor: selectedBead?.hex }}><div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none"></div></div>
                     <h2 className="text-2xl font-black text-slate-800">{selectedBead?.code}</h2>
                     <p className="text-xs text-slate-500 font-medium mt-1">{selectedBead?.brand} • {selectedBead?.hex}</p>
                 </div>
                 <div className="p-4"><button onClick={() => setIsPaletteOpen(true)} className="w-full py-3 px-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm text-slate-700 font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2"><span className="material-symbols-outlined">palette</span>打开调色板</button></div>
                 <div className="px-4 pb-4">
                     <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">最近使用</h3>
                     <div className="grid grid-cols-5 gap-2">
                         {recentColors.slice(0, 20).map(color => (
                             <button key={color.id} onClick={() => { setSelectedBead(color); setTool('pen'); }} className={`aspect-square rounded-lg border border-slate-200 relative group transition-transform hover:scale-105 ${selectedBead?.id === color.id ? 'ring-2 ring-primary ring-offset-2 z-10' : ''}`} style={{ backgroundColor: color.hex }} title={`${color.code}`} />
                         ))}
                     </div>
                 </div>
              </div>
              <div className="p-2 border-t border-slate-100 text-center text-[10px] text-slate-400">
                 <span>{bounds.maxX - bounds.minX}x{bounds.maxY - bounds.minY}</span>
                 <span className={`ml-2 ${saveStatus === 'saved' ? 'text-green-500' : ''}`}>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}</span>
              </div>
           </div>
       )}

       <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Top Bar - Normal Mode */}
          {!isBeadMode && (
              <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10 shadow-sm">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      <button onClick={() => setTool('move')} className={`p-2 rounded-md transition-colors ${tool === 'move' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">pan_tool_alt</span></button>
                      <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                      <button onClick={() => setTool('pen')} className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">edit</span></button>
                      <button onClick={() => setTool('eraser')} className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">ink_eraser</span></button>
                      <button onClick={() => setTool('fill')} className={`p-2 rounded-md transition-colors ${tool === 'fill' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">format_color_fill</span></button>
                      <button onClick={() => setTool('picker')} className={`p-2 rounded-md transition-colors ${tool === 'picker' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">colorize</span></button>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-2">
                          <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-md transition-colors ${showGrid ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">grid_4x4</span></button>
                          <button onClick={() => setShowNumbers(!showNumbers)} className={`p-2 rounded-md transition-colors ${showNumbers ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">123</span></button>
                      </div>
                      <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors text-slate-600"><span className="material-symbols-outlined">undo</span></button>
                      <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors text-slate-600"><span className="material-symbols-outlined">redo</span></button>
                      <button onClick={() => setShowConvertConfirm(true)} className="p-2 rounded-full text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="转换色彩"><span className="material-symbols-outlined text-[20px]">auto_fix_high</span></button>
                      <button onClick={() => handleSave(false)} className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${saveStatus === 'saved' ? 'text-green-500' : 'text-primary'}`}><span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check_circle' : 'save'}</span></button>
                      <button onClick={() => { setIsBeadMode(true); setTimerSeconds(0); }} className="p-2 rounded-full text-primary hover:bg-blue-50 transition-colors" title="拼豆模式"><span className="material-symbols-outlined text-[20px]">spa</span></button>
                      <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                      <button onClick={handleExportClick} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm shadow-blue-500/30"><span className="material-symbols-outlined text-[20px]">ios_share</span><span className="text-sm font-bold">导出</span></button>
                  </div>
              </div>
          )}

          {/* Bead Mode Overlay */}
          {isBeadMode && (
              <div className="absolute top-4 right-4 z-50 flex items-center gap-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-primary/20 animate-fade-in">
                  <div className="flex items-center gap-3 pl-2">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg">
                          <span className="material-symbols-outlined animate-pulse">spa</span>
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">拼豆计时</span>
                          <span className="font-mono text-2xl font-bold text-gray-800 leading-none">{formatTime(timerSeconds)}</span>
                      </div>
                  </div>
                  <div className="w-[1px] h-8 bg-gray-200"></div>
                  <button 
                    onClick={() => setIsBeadMode(false)} 
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">stop_circle</span>
                    结束
                  </button>
              </div>
          )}

          <div ref={mainContainerRef} className="flex-1 relative bg-slate-50 overflow-hidden cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => { isDragging.current = false; if (isDrawing.current && !isBeadMode) commitHistory(grid); }} onMouseLeave={() => { isDragging.current = false; if (isDrawing.current && !isBeadMode) commitHistory(grid); }} onWheel={handleWheel}>
             <canvas ref={rulerCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
             <div className="absolute origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, willChange: 'transform' }}>
                 <div 
                    className="shadow-2xl relative" 
                    style={{ 
                        width: (bounds.maxX - bounds.minX) * CELL_SIZE, 
                        height: (bounds.maxY - bounds.minY) * CELL_SIZE,
                        backgroundColor: '#ffffff',
                        backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)`,
                        backgroundPosition: '0 0, 8px 8px',
                        backgroundSize: '16px 16px'
                    }}
                 >
                     {showGrid && <div className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: `linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)`, backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px` }} />}
                     <GridView grid={grid} bounds={bounds} allBeadsMap={allBeadsMap} showNumbers={showNumbers} cellSize={CELL_SIZE} />
                 </div>
             </div>
             <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm text-xs font-mono text-slate-600 pointer-events-none z-20 flex gap-4">
                 <span>X: {cursorPos?.x ?? 0}</span><span>Y: {cursorPos?.y ?? 0}</span><span>Zoom: {Math.round(scale * 100)}%</span>
             </div>
          </div>
       </div>
       <PaletteModal isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onSelect={(c) => { setSelectedBead(c); addToRecent(c); setIsPaletteOpen(false); setTool('pen'); }} />
       
       {/* Color Conversion Confirmation Modal */}
       {showConvertConfirm && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl p-6">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl">auto_fix_high</span>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">转换色彩</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                        是否将当前画作转换为 <span className="font-bold text-gray-800 dark:text-gray-200">{paletteConfig.brand} {paletteConfig.set === 'all' ? '全套' : paletteConfig.set === 'custom' ? '自定义' : `${paletteConfig.set}色`}</span> 套装的近似色？
                    </p>
                    <p className="text-xs text-gray-400 mt-2 bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-lg">
                        将自动生成一个新副本，原图不会被修改。
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowConvertConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-600 hover:bg-gray-50 transition-colors">取消</button>
                    <button onClick={performConversion} disabled={isConverting} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 shadow-lg shadow-purple-500/30 transition-colors flex items-center justify-center gap-2">
                        {isConverting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : '确认转换'}
                    </button>
                </div>
            </div>
         </div>
       )}

       {/* Success Modal */}
       {showConvertSuccess && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl p-6 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-500 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-3xl">check_circle</span>
                </div>
                <h3 className="font-bold text-xl text-gray-900 dark:text-white">转换完毕！</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 mb-6">
                    已生成副本，请到草稿箱查看。
                </p>
                <button onClick={() => setShowConvertSuccess(false)} className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:opacity-90 transition-opacity">
                    知道了
                </button>
            </div>
         </div>
       )}

       {showExportModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-surface-dark w-full max-w-md rounded-2xl shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">导出选项</h3>
                    <button onClick={() => setShowExportModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"><span className="material-symbols-outlined text-gray-500">close</span></button>
                </div>
                {isConverting ? (
                    <div className="flex flex-col items-center justify-center py-8"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div><p className="text-sm text-gray-500">正在生成预览...</p></div>
                ) : (
                    <div className="space-y-4">
                        {/* Noise Reduction Toggle & Slider */}
                        <div className="flex flex-col p-4 bg-slate-50 dark:bg-[#1e1e30] rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900 dark:text-white text-sm">优化杂色</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">自动去除孤立的单个像素</span>
                                </div>
                                <div 
                                    onClick={() => setReduceNoise(!reduceNoise)}
                                    className={`w-12 h-6 rounded-full flex items-center transition-colors duration-300 cursor-pointer px-1 ${reduceNoise ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${reduceNoise ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </div>
                            </div>
                            
                            {/* Detail Protection Slider */}
                            {reduceNoise && (
                                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 animate-fade-in">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">细节保护</span>
                                        <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{detailProtection}%</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        value={detailProtection} 
                                        onChange={(e) => setDetailProtection(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] text-gray-400">更少细节 (强力去噪)</span>
                                        <span className="text-[10px] text-gray-400">更多细节 (轻微去噪)</span>
                                    </div>
                                </div>
                            )}
                        </div>

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

export default DesktopEditor;