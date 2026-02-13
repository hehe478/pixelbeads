
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor, hexToRgb, rgbToLab, deltaE, denoiseGrid } from '../utils/colors';
import PaletteModal from '../components/PaletteModal';
import { useAuth } from '../context/AuthContext';
import { StorageHelper } from '../utils/storageHelper';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move' | 'magic_wand' | 'select';

// Selection State Interface
interface SelectionState {
    isActive: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    floatingPixels: { [key: string]: string }; // relative x,y -> colorId
    offsetX: number; // visual offset X
    offsetY: number; // visual offset Y
}

// Memoized Grid View using Canvas for high performance rendering
const GridView = React.memo(({ 
  grid, 
  bounds, 
  allBeadsMap, 
  showNumbers, 
  cellSize,
  selection
}: { 
  grid: {[key: string]: string}, 
  bounds: any, 
  allBeadsMap: Record<string, BeadColor>, 
  showNumbers: boolean,
  cellSize: number,
  selection?: SelectionState
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const dashOffsetRef = useRef<number>(0);

  // Helper to draw the static grid content
  const drawGridContent = (ctx: CanvasRenderingContext2D) => {
      // 1. Draw Static Grid
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
              ctx.fillText(color.code, posX + cellSize/2, posY + cellSize/2);
          }
      });

      // 2. Draw Floating Selection Pixels (The content being moved)
      if (selection && selection.isActive) {
          const minSX = Math.min(selection.startX, selection.endX);
          const minSY = Math.min(selection.startY, selection.endY);

          Object.entries(selection.floatingPixels).forEach(([relKey, colorId]) => {
              const [rx, ry] = relKey.split(',').map(Number);
              const worldX = minSX + rx + selection.offsetX;
              const worldY = minSY + ry + selection.offsetY;

              if (worldX < bounds.minX || worldX >= bounds.maxX || worldY < bounds.minY || worldY >= bounds.maxY) return;

              const color = allBeadsMap[colorId];
              if (!color) return;

              const posX = (worldX - bounds.minX) * cellSize;
              const posY = (worldY - bounds.minY) * cellSize;

              ctx.fillStyle = color.hex;
              ctx.fillRect(posX, posY, cellSize, cellSize);
              if (showNumbers) {
                  ctx.fillStyle = getTextColor(color.hex);
                  ctx.fillText(color.code, posX + cellSize/2, posY + cellSize/2);
              }
          });
      }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set font for numbers
    if (showNumbers) {
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    }

    const renderLoop = () => {
        // Clear canvas
        const width = (bounds.maxX - bounds.minX) * cellSize;
        const height = (bounds.maxY - bounds.minY) * cellSize;
        ctx.clearRect(0, 0, width, height);

        // Draw the beads
        drawGridContent(ctx);

        // 3. Draw Animated Selection Border
        if (selection && selection.isActive) {
            const minSX = Math.min(selection.startX, selection.endX);
            const minSY = Math.min(selection.startY, selection.endY);
            const w = Math.abs(selection.endX - selection.startX) + 1;
            const h = Math.abs(selection.endY - selection.startY) + 1;

            const borderX = (minSX + selection.offsetX - bounds.minX) * cellSize;
            const borderY = (minSY + selection.offsetY - bounds.minY) * cellSize;
            const borderW = w * cellSize;
            const borderH = h * cellSize;

            // Semi-transparent blue overlay
            ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
            ctx.fillRect(borderX, borderY, borderW, borderH);

            ctx.save();
            // Black dashed line
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -dashOffsetRef.current;
            ctx.strokeRect(borderX, borderY, borderW, borderH);

            // White dashed line (offset) for high contrast on any color
            ctx.strokeStyle = '#ffffff';
            ctx.lineDashOffset = -dashOffsetRef.current + 4; 
            ctx.strokeRect(borderX, borderY, borderW, borderH);
            ctx.restore();

            // Increment offset for animation
            dashOffsetRef.current = (dashOffsetRef.current + 0.5) % 8;
            
            // Continue loop
            animationRef.current = requestAnimationFrame(renderLoop);
        }
    };

    // Start rendering
    if (selection && selection.isActive) {
        renderLoop();
    } else {
        // Static render if no selection active (save battery)
        const width = (bounds.maxX - bounds.minX) * cellSize;
        const height = (bounds.maxY - bounds.minY) * cellSize;
        ctx.clearRect(0, 0, width, height);
        drawGridContent(ctx);
    }

    return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };

  }, [grid, bounds, allBeadsMap, showNumbers, cellSize, selection]);

  return (
    <canvas 
        ref={canvasRef}
        width={(bounds.maxX - bounds.minX) * cellSize}
        height={(bounds.maxY - bounds.minY) * cellSize}
        className="absolute top-0 left-0 pointer-events-none"
    />
  );
});

const MobileEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
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
  const [isSyncing, setIsSyncing] = useState(false); // For full screen blocking sync
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
  
  // Selection Tool State
  const [selection, setSelection] = useState<SelectionState>({
      isActive: false, startX: 0, startY: 0, endX: 0, endY: 0, floatingPixels: {}, offsetX: 0, offsetY: 0
  });
  const isSelecting = useRef(false);
  const isDraggingSelection = useRef(false);

  // Magic Wand State
  const [magicWandTarget, setMagicWandTarget] = useState<{id: string, count: number} | null>(null);

  // Export Settings
  const [reduceNoise, setReduceNoise] = useState(false);
  const [detailProtection, setDetailProtection] = useState(30); 

  // Conversion States
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showConvertSuccess, setShowConvertSuccess] = useState(false);

  // Bead Mode State
  const [isBeadMode, setIsBeadMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

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

  // Initial Load... (Same as before)
  useEffect(() => {
    if (!state?.grid && id && id !== 'new' && id !== 'imported') {
       const load = async () => {
         try {
           const localDrafts = await StorageHelper.loadDrafts(); 
           const localDraft = localDrafts.find((d: Draft) => d.id === id);
           
           if (localDraft) {
               applyDraft(localDraft);
           } else if (isAuthenticated && user) {
               const cloudDrafts = await StorageHelper.loadDrafts(user.id);
               const cloudDraft = cloudDrafts.find((d: Draft) => d.id === id);
               if (cloudDraft) applyDraft(cloudDraft);
           }
         } catch (e) {
           console.error("Failed to load draft", e);
         }
       };
       load();
    }
  }, [id, isAuthenticated, user?.id]);

  const applyDraft = (draft: Draft) => {
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
  };

  // --- Auto Save Interval (LOCAL ONLY) ---
  useEffect(() => {
    const timer = setInterval(() => {
        if (!isBeadMode) performSave('local');
    }, 10000); 
    return () => clearInterval(timer);
  }, [isBeadMode]);

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
    // ... [Ruler logic identical] ...
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

  const prepareDraftObject = () => {
    // ... [Same draft object prep logic, ensure we merge floating selection if active before save]
    const currentData = autoSaveRef.current;
    let currentId = draftIdRef.current || Date.now().toString();
    draftIdRef.current = currentId;
    
    // Create Thumbnail
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

    return {
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
  };

  const performSave = async (mode: 'local' | 'cloud', feedback = false) => {
      // Force commit if selecting
      if (selection.isActive) {
          await commitSelection();
      }
      // Wait a tick for state update
      setTimeout(async () => {
          const draft = prepareDraftObject();
          if (mode === 'local') {
              StorageHelper.saveLocalCache(draft);
              if (feedback) {
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus('idle'), 1000);
              }
          } else {
              if (feedback) setSaveStatus('saving');
              await StorageHelper.saveDraft(draft, isAuthenticated && user ? user.id : undefined);
              if (feedback) {
                  setSaveStatus('saved');
                  setTimeout(() => setSaveStatus('idle'), 2000);
              }
          }
      }, 0);
  };

  const handleManualSave = () => { performSave('cloud', true); };

  const handleBack = async () => {
      if (selection.isActive) await commitSelection();
      if (isAuthenticated) {
          setIsSyncing(true);
          await performSave('cloud', false);
          setIsSyncing(false);
          navigate('/create');
      } else {
          performSave('local', false);
          navigate('/create');
      }
  };

  const handleExportClick = () => { 
      if (selection.isActive) commitSelection();
      performSave('local', false); 
      setShowExportModal(true); 
  };

  const handleDevExport = () => {
      const exportData = { width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, grid: grid };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `template_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

  // ... [Mirror, Convert, Export Logic same as before] ...
  const handleMirror = () => {
    const width = bounds.maxX - bounds.minX;
    const newGrid: {[key: string]: string} = {};
    Object.entries(grid).forEach(([key, colorId]) => {
        const [x, y] = key.split(',').map(Number);
        if (isNaN(x) || isNaN(y)) return;
        const newX = bounds.minX + (width - 1) - (x - bounds.minX);
        newGrid[`${newX},${y}`] = colorId as string;
    });
    setGrid(newGrid);
    commitHistory(newGrid);
  };

  const performConversion = () => { /* ... same ... */
      if (!currentPalette || currentPalette.length === 0) return;
      setIsConverting(true);
      setShowConvertConfirm(false);
      setTimeout(async () => {
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
                      if (dist < minDistance) { minDistance = dist; closestBead = p; }
                  }
                  newGrid[key] = closestBead.id;
              }
          });
          // ... thumbnail gen ...
          const width = bounds.maxX - bounds.minX;
          const height = bounds.maxY - bounds.minY;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width * 5); canvas.height = Math.max(1, height * 5);
          const ctx = canvas.getContext('2d');
          if(ctx) { ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); Object.entries(newGrid).forEach(([k,c])=>{const[x,y]=k.split(',').map(Number);const co=allBeadsMap[c];if(co){ctx.fillStyle=co.hex;ctx.fillRect((x-bounds.minX)*5,(y-bounds.minY)*5,5,5)}}); }

          const newDraft: Draft = {
              id: Date.now().toString(),
              title: `${title} (转换版)`,
              grid: newGrid,
              width, height,
              minX: bounds.minX, minY: bounds.minY,
              isFreeMode, lastModified: Date.now(),
              thumbnail: canvas.toDataURL('image/png', 0.5)
          };
          try {
              await StorageHelper.saveDraft(newDraft, isAuthenticated && user ? user.id : undefined);
              setShowConvertSuccess(true);
          } catch (e) { alert('保存副本失败'); } finally { setIsConverting(false); }
      }, 100);
  };

  const processExport = (shouldMapColors: boolean) => {
     setIsConverting(true);
     setTimeout(() => {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        let processedGrid = { ...grid };
        if (reduceNoise) {
            const threshold = 100 - detailProtection;
            processedGrid = denoiseGrid(processedGrid, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, allBeadsMap, threshold);
        }
        let exportGrid: {[key: string]: string} = {};
        if (shouldMapColors) {
            if (!currentPalette || currentPalette.length === 0) { alert("当前选择的套装为空"); setIsConverting(false); return; }
            const paletteCache = currentPalette.map(bead => { const rgb = hexToRgb(bead.hex); return { id: bead.id, rgb, lab: rgbToLab(rgb.r, rgb.g, rgb.b) }; });
            Object.entries(processedGrid).forEach(([key, colorId]) => {
                const [gx, gy] = key.split(',').map(Number);
                const x = gx - bounds.minX; const y = gy - bounds.minY;
                if (x >= 0 && x < width && y >= 0 && y < height) {
                    const originalBead = allBeadsMap[colorId as string];
                    if (originalBead) {
                        const rgb = hexToRgb(originalBead.hex);
                        const currentLab = rgbToLab(rgb.r, rgb.g, rgb.b);
                        let minDistance = Infinity; let closestBead = paletteCache[0];
                        for (const p of paletteCache) {
                            const dist = deltaE(currentLab, p.lab);
                            if (dist < minDistance) { minDistance = dist; closestBead = p; }
                        }
                        exportGrid[`${x},${y}`] = closestBead.id;
                    }
                }
            });
        } else {
            Object.entries(processedGrid).forEach(([key, val]) => {
                const [x, y] = key.split(',').map(Number);
                exportGrid[`${x - bounds.minX},${y - bounds.minY}`] = val as string;
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

  // --- Selection Logic ---
  const commitSelection = async () => {
      if (!selection.isActive) return;
      const minSX = Math.min(selection.startX, selection.endX);
      const minSY = Math.min(selection.startY, selection.endY);
      
      const newGrid = { ...grid };
      
      // Stamp floating pixels to new location
      Object.entries(selection.floatingPixels).forEach(([relKey, colorId]) => {
          const [rx, ry] = relKey.split(',').map(Number);
          const finalX = minSX + rx + selection.offsetX;
          const finalY = minSY + ry + selection.offsetY;
          newGrid[`${finalX},${finalY}`] = colorId;
      });

      setGrid(newGrid);
      commitHistory(newGrid);
      setSelection({ isActive: false, startX: 0, startY: 0, endX: 0, endY: 0, floatingPixels: {}, offsetX: 0, offsetY: 0 });
  };

  const handleMagicWandAction = (action: 'delete' | 'replace') => {
      if (!magicWandTarget) return;
      
      const newGrid = { ...grid };
      let changed = false;

      Object.entries(newGrid).forEach(([key, colorId]) => {
          if (colorId === magicWandTarget.id) {
              if (action === 'delete') {
                  delete newGrid[key];
                  changed = true;
              } else if (action === 'replace' && selectedBead) {
                  newGrid[key] = selectedBead.id;
                  changed = true;
              }
          }
      });

      if (changed) {
          setGrid(newGrid);
          commitHistory(newGrid);
      }
      setMagicWandTarget(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
     if (e.touches.length === 2) {
         isPinching.current = true; isDrawing.current = false;
         const t1 = e.touches[0]; const t2 = e.touches[1];
         const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
         lastPinchRef.current = { distance: dist, center: { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 } };
         return;
     }
     if (e.touches.length === 1) {
         const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);

         if (tool === 'move' || isBeadMode) {
             isDragging.current = true;
             lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
             return;
         }

         if (tool === 'select') {
             if (selection.isActive) {
                 const minSX = Math.min(selection.startX, selection.endX);
                 const maxSX = Math.max(selection.startX, selection.endX);
                 const minSY = Math.min(selection.startY, selection.endY);
                 const maxSY = Math.max(selection.startY, selection.endY);
                 
                 // If click inside selection, start dragging selection
                 const localX = x - selection.offsetX;
                 const localY = y - selection.offsetY;
                 
                 if (localX >= minSX && localX <= maxSX && localY >= minSY && localY <= maxSY) {
                     isDraggingSelection.current = true;
                     lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                     return;
                 } else {
                     // Click outside: commit and start new selection
                     commitSelection().then(() => {
                         isSelecting.current = true;
                         setSelection(prev => ({ ...prev, isActive: true, startX: x, startY: y, endX: x, endY: y, floatingPixels: {}, offsetX: 0, offsetY: 0 }));
                     });
                     return;
                 }
             } else {
                 isSelecting.current = true;
                 setSelection({ isActive: true, startX: x, startY: y, endX: x, endY: y, floatingPixels: {}, offsetX: 0, offsetY: 0 });
                 return;
             }
         }

         // Commit selection if clicking with another tool (handled by useEffect or click outside)
         if (selection.isActive) {
             commitSelection();
             return; 
         }

         if (tool === 'magic_wand') {
             const colorId = grid[`${x},${y}`];
             if (colorId) {
                 let count = 0;
                 Object.values(grid).forEach(v => { if(v === colorId) count++; });
                 setMagicWandTarget({ id: colorId, count });
             }
             return;
         }

         if (!isPinching.current) {
            handleCellAction(x, y);
         }
     }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      
      // Pinch Zoom Logic (Unchanged)
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

      // Pan Canvas
      if ((tool === 'move' || isBeadMode) && isDragging.current && e.touches.length === 1) {
          const dx = e.touches[0].clientX - lastTouchPos.current.x;
          const dy = e.touches[0].clientY - lastTouchPos.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
          lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          return;
      }

      // Selection Dragging
      if (tool === 'select' && e.touches.length === 1) {
          const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
          
          if (isSelecting.current) {
              setSelection(prev => ({ ...prev, endX: x, endY: y }));
          } else if (isDraggingSelection.current) {
              // Convert pixel delta to grid delta approximation for smoother visual, 
              // but here strictly snap to grid for simplicity logic
              // Actually for floating selection we want 1:1 movement relative to grid
              const dxPixels = e.touches[0].clientX - lastTouchPos.current.x;
              const dyPixels = e.touches[0].clientY - lastTouchPos.current.y;
              // We need to accumulate this or just use grid diff
              // Simple Grid Snap:
              const lastGrid = getGridCoord(lastTouchPos.current.x, lastTouchPos.current.y);
              const dx = x - lastGrid.x;
              const dy = y - lastGrid.y;
              
              if (dx !== 0 || dy !== 0) {
                  setSelection(prev => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
                  lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; 
              }
          }
          return;
      }

      // Drawing
      if (tool !== 'move' && tool !== 'select' && tool !== 'magic_wand' && !isDragging.current && !isPinching.current && e.touches.length === 1 && !isBeadMode) {
          const {x, y} = getGridCoord(e.touches[0].clientX, e.touches[0].clientY);
          if (isDrawing.current && (tool === 'pen' || tool === 'eraser')) handleCellAction(x, y);
      }
  };
  
  const handleTouchEnd = () => {
      isDragging.current = false; isPinching.current = false; lastPinchRef.current = null;
      
      if (isSelecting.current) {
          isSelecting.current = false;
          // Capture pixels inside selection
          const minSX = Math.min(selection.startX, selection.endX);
          const maxSX = Math.max(selection.startX, selection.endX);
          const minSY = Math.min(selection.startY, selection.endY);
          const maxSY = Math.max(selection.startY, selection.endY);

          const floating: {[key: string]: string} = {};
          const newGrid = { ...grid };
          let hasPixels = false;

          for (let y = minSY; y <= maxSY; y++) {
              for (let x = minSX; x <= maxSX; x++) {
                  const key = `${x},${y}`;
                  if (newGrid[key]) {
                      floating[`${x - minSX},${y - minSY}`] = newGrid[key];
                      delete newGrid[key];
                      hasPixels = true;
                  }
              }
          }

          if (hasPixels) {
              setGrid(newGrid);
              setSelection(prev => ({ ...prev, floatingPixels: floating }));
          } else {
              // Empty selection, cancel
              setSelection({ isActive: false, startX: 0, startY: 0, endX: 0, endY: 0, floatingPixels: {}, offsetX: 0, offsetY: 0 });
          }
      }

      isDraggingSelection.current = false;

      if (isDrawing.current && !isBeadMode) commitHistory(grid);
  };

  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move' || tool === 'select' || tool === 'magic_wand' || !selectedBead || isBeadMode) return;
    
    // ... [Free mode expansion logic same as before] ...
    if (isFreeMode) {
        let newMinX = bounds.minX;
        let newMaxX = bounds.maxX;
        let newMinY = bounds.minY;
        let newMaxY = bounds.maxY;
        let changed = false;
        let addedLeft = 0; let addedTop = 0; const EXPAND_CHUNK = 10;
        if (x < bounds.minX + 2) { newMinX = bounds.minX - EXPAND_CHUNK; addedLeft = EXPAND_CHUNK; changed = true; }
        if (x >= bounds.maxX - 2) { newMaxX = bounds.maxX + EXPAND_CHUNK; changed = true; }
        if (y < bounds.minY + 2) { newMinY = bounds.minY - EXPAND_CHUNK; addedTop = EXPAND_CHUNK; changed = true; }
        if (y >= bounds.maxY - 2) { newMaxY = bounds.maxY + EXPAND_CHUNK; changed = true; }
        if (changed) {
            setBounds({ minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY });
            if (addedLeft > 0 || addedTop > 0) { setOffset(prev => ({ x: prev.x - (addedLeft * CELL_SIZE * scale), y: prev.y - (addedTop * CELL_SIZE * scale) })); }
        }
    } else {
        if (x < bounds.minX || y < bounds.minY || x >= bounds.maxX || y >= bounds.maxY) return;
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
        if (selectedBead) newGrid[cKey] = selectedBead.id;
        safetyCount++;
        const neighbors: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        neighbors.forEach(([nx, ny]) => {
           const nKey: string = `${nx},${ny}`;
           if (!isFreeMode && (nx < bounds.minX || ny < bounds.minY || nx >= bounds.maxX || ny >= bounds.maxY)) return;
           if (!visited.has(nKey)) {
             const neighborColor: string | undefined = grid[nKey];
             if (targetColor === undefined) {
               if (neighborColor === undefined) { visited.add(nKey); queue.push([nx, ny]); }
             } else if (neighborColor === targetColor) {
               visited.add(nKey); queue.push([nx, ny]);
             }
           }
        });
      }
      setGrid(newGrid); commitHistory(newGrid);
    }
  };

  // Helper to commit selection when switching tools
  const setToolAndCommit = async (newTool: Tool) => {
      if (selection.isActive) await commitSelection();
      setTool(newTool);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-100 overflow-hidden select-none relative">
       {/* Sync Blocking... */}
       {isSyncing && (
           <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
               <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
               <div className="font-bold text-lg">正在同步云端</div>
               <div className="text-sm text-white/60 mt-1">请勿关闭页面...</div>
           </div>
       )}

       {/* Top Bar - Normal Mode */}
       {!isBeadMode && (
         <div className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-20 shrink-0">
             <button onClick={handleBack} className="p-2 -ml-2 text-slate-600"><span className="material-symbols-outlined">arrow_back</span></button>
             <div className="flex gap-2">
                  <button onClick={() => setShowGrid(!showGrid)} className={`p-2 transition-colors ${showGrid ? 'text-primary' : 'text-slate-600'}`}><span className="material-symbols-outlined text-[20px]">grid_4x4</span></button>
                  <button onClick={() => setShowNumbers(!showNumbers)} className={`p-2 transition-colors ${showNumbers ? 'text-primary' : 'text-slate-600'}`}><span className="material-symbols-outlined text-[20px]">123</span></button>
                  <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 text-slate-600 disabled:opacity-30"><span className="material-symbols-outlined">undo</span></button>
                  <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 text-slate-600 disabled:opacity-30"><span className="material-symbols-outlined">redo</span></button>
                  
                  {/* Select Tool & Magic Wand added to top bar as actions or quick toggles */}
                  <button onClick={() => setToolAndCommit('select')} className={`p-2 rounded-full transition-colors ${tool === 'select' ? 'text-white bg-primary' : 'text-slate-600 hover:text-primary'}`} title="框选移动"><span className="material-symbols-outlined text-[20px]">select_all</span></button>
                  <button onClick={() => setToolAndCommit('magic_wand')} className={`p-2 rounded-full transition-colors ${tool === 'magic_wand' ? 'text-white bg-primary' : 'text-slate-600 hover:text-primary'}`} title="魔棒工具"><span className="material-symbols-outlined text-[20px]">auto_awesome</span></button>

                  <button onClick={handleMirror} className="p-2 text-slate-600 hover:text-primary hover:bg-slate-50 rounded-full" title="水平镜像"><span className="material-symbols-outlined text-[20px]">flip</span></button>
                  <button onClick={() => setShowConvertConfirm(true)} className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-full" title="转换色彩"><span className="material-symbols-outlined text-[20px]">auto_fix_high</span></button>
                  <button onClick={handleManualSave} className={`p-2 transition-colors ${saveStatus === 'saved' ? 'text-green-500' : 'text-primary'}`}><span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check_circle' : 'save'}</span></button>
                  <button onClick={() => { setIsBeadMode(true); setTimerSeconds(0); }} className="p-2 text-primary hover:bg-blue-50 rounded-full" title="拼豆模式"><span className="material-symbols-outlined text-[20px]">spa</span></button>
                  <button onClick={handleExportClick} className="p-2 text-slate-600"><span className="material-symbols-outlined">ios_share</span></button>
             </div>
         </div>
       )}

       {/* Bead Mode Top Bar ... */}
       {isBeadMode && (
         <div className="h-16 bg-white/90 backdrop-blur shadow-sm flex items-center justify-between px-6 z-20 shrink-0 border-b border-primary/20">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                     <span className="material-symbols-outlined animate-pulse">spa</span>
                 </div>
                 <div>
                     <div className="text-[10px] uppercase font-bold text-primary tracking-wider">拼豆计时</div>
                     <div className="font-mono text-2xl font-bold text-gray-800 leading-none">{formatTime(timerSeconds)}</div>
                 </div>
             </div>
             <button 
                onClick={() => setIsBeadMode(false)} 
                className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-1"
             >
                <span className="material-symbols-outlined text-lg">stop</span>
                结束
             </button>
         </div>
       )}

       <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-200 touch-none cursor-crosshair" style={{ touchAction: 'none' }} onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <canvas ref={rulerCanvasRef} className="absolute inset-0 pointer-events-none z-10" />
          <div className="absolute origin-top-left" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`, willChange: 'transform' }}>
              <div 
                className="shadow-xl relative" 
                style={{ 
                    width: (bounds.maxX - bounds.minX) * CELL_SIZE, 
                    height: (bounds.maxY - bounds.minY) * CELL_SIZE,
                    backgroundColor: '#ffffff',
                    backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)`,
                    backgroundPosition: '0 0, 8px 8px',
                    backgroundSize: '16px 16px'
                }}
              >
                  {showGrid && <div className="absolute inset-0 pointer-events-none z-20 opacity-25" style={{ backgroundImage: `linear-gradient(to right, #000000 1px, transparent 1px), linear-gradient(to bottom, #000000 1px, transparent 1px)`, backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px` }} />}
                  <GridView grid={grid} bounds={bounds} allBeadsMap={allBeadsMap} showNumbers={showNumbers} cellSize={CELL_SIZE} selection={selection} />
              </div>
          </div>
       </div>

       {/* Bottom Toolbar - Only visible in Normal Mode */}
       {!isBeadMode && (
           <div className="bg-white border-t border-slate-200 shrink-0 h-20 pb-safe flex items-center justify-between px-6 z-30">
               <div className="flex flex-col items-center gap-1">
                   <button onClick={() => setIsPaletteOpen(true)} className="w-10 h-10 rounded-full shadow-md border-2 border-white ring-2 ring-gray-200 relative overflow-hidden" style={{ backgroundColor: selectedBead?.hex || '#ccc' }}><div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none"></div></button>
                   <span className="text-[10px] font-bold text-gray-500 max-w-[4rem] truncate">{selectedBead?.code || '选择'}</span>
               </div>
               <div className="w-[1px] h-8 bg-gray-200 mx-2"></div>
               <div className="flex flex-1 justify-between text-slate-500 max-w-xs">
                   <button onClick={() => setToolAndCommit('move')} className={`flex flex-col items-center transition-colors ${tool === 'move' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'move' ? 'filled' : ''}`}>pan_tool_alt</span></button>
                   <button onClick={() => setToolAndCommit('pen')} className={`flex flex-col items-center transition-colors ${tool === 'pen' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'pen' ? 'filled' : ''}`}>edit</span></button>
                   <button onClick={() => setToolAndCommit('eraser')} className={`flex flex-col items-center transition-colors ${tool === 'eraser' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'eraser' ? 'filled' : ''}`}>ink_eraser</span></button>
                   <button onClick={() => setToolAndCommit('fill')} className={`flex flex-col items-center transition-colors ${tool === 'fill' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'fill' ? 'filled' : ''}`}>format_color_fill</span></button>
                   <button onClick={() => setToolAndCommit('picker')} className={`flex flex-col items-center transition-colors ${tool === 'picker' ? 'text-primary' : 'hover:text-gray-700'}`}><span className={`material-symbols-outlined text-2xl ${tool === 'picker' ? 'filled' : ''}`}>colorize</span></button>
               </div>
           </div>
       )}

       <PaletteModal isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onSelect={(c) => { setSelectedBead(c); addToRecent(c); setTool('pen'); setIsPaletteOpen(false); }} />
       
       {/* Magic Wand Modal */}
       {magicWandTarget && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl p-6">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">批量操作</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
                        选中了 <span className="font-bold">{magicWandTarget.count}</span> 个 {allBeadsMap[magicWandTarget.id]?.code} 颜色的像素。
                    </p>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={() => handleMagicWandAction('replace')} 
                        disabled={!selectedBead || selectedBead.id === magicWandTarget.id}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                            (!selectedBead || selectedBead.id === magicWandTarget.id)
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-primary text-white shadow-lg shadow-primary/30 active:scale-95'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">format_paint</span>
                        {(!selectedBead || selectedBead.id === magicWandTarget.id) 
                            ? '当前已是该颜色' 
                            : `全部替换为 ${selectedBead?.code}`
                        }
                    </button>
                    
                    <button 
                        onClick={() => handleMagicWandAction('delete')} 
                        className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 font-bold border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        全部删除
                    </button>
                    <button onClick={() => setMagicWandTarget(null)} className="w-full py-2 text-gray-400 text-sm font-bold hover:text-gray-600 dark:hover:text-gray-300">取消</button>
                </div>
            </div>
         </div>
       )}

       {/* Existing Convert/Export Modals... */}
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
         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 animate-fade-in">
            <div className="bg-white dark:bg-surface-dark w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-6">
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
                        <button onClick={handleDevExport} className="w-full flex items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1e1e30] hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all group">
                            <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">code</span></div>
                            <div className="ml-4 flex-1 text-left"><h4 className="font-bold text-gray-900 dark:text-white">【开发者】导出 JSON</h4><p className="text-xs text-gray-500 mt-1">导出 Grid Data 上传到 OSS</p></div>
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
