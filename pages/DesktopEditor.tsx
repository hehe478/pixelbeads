
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams, useParams } from 'react-router-dom';
import { Draft, BeadColor } from '../types';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor, hexToRgb, rgbToLab, deltaE, denoiseGrid } from '../utils/colors';
import PaletteModal from '../components/PaletteModal';
import { useAuth } from '../context/AuthContext';
import { StorageHelper } from '../utils/storageHelper';

type Tool = 'pen' | 'eraser' | 'fill' | 'picker' | 'move' | 'magic_wand' | 'select';

// Selection State Interface (Same as Mobile)
interface SelectionState {
    isActive: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    floatingPixels: { [key: string]: string };
    offsetX: number;
    offsetY: number;
}

// Memoized Grid View (Same as Mobile)
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

  const drawGridContent = (ctx: CanvasRenderingContext2D) => {
    Object.entries(grid).forEach(([key, colorId]) => {
        const [x, y] = key.split(',').map(Number);
        if (x < bounds.minX || x >= bounds.maxX || y < bounds.minY || y >= bounds.maxY) return;
        
        const color = allBeadsMap[colorId];
        if (!color) return;

        const posX = (x - bounds.minX) * cellSize;
        const posY = (y - bounds.minY) * cellSize;

        ctx.fillStyle = color.hex;
        ctx.fillRect(posX, posY, cellSize, cellSize);

        if (showNumbers) {
            ctx.fillStyle = getTextColor(color.hex);
            ctx.fillText(color.code, posX + cellSize/2, posY + cellSize/2);
        }
    });

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

    if (showNumbers) {
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    }

    const renderLoop = () => {
        const width = (bounds.maxX - bounds.minX) * cellSize;
        const height = (bounds.maxY - bounds.minY) * cellSize;
        ctx.clearRect(0, 0, width, height);

        drawGridContent(ctx);

        if (selection && selection.isActive) {
            const minSX = Math.min(selection.startX, selection.endX);
            const minSY = Math.min(selection.startY, selection.endY);
            const w = Math.abs(selection.endX - selection.startX) + 1;
            const h = Math.abs(selection.endY - selection.startY) + 1;

            const borderX = (minSX + selection.offsetX - bounds.minX) * cellSize;
            const borderY = (minSY + selection.offsetY - bounds.minY) * cellSize;
            const borderW = w * cellSize;
            const borderH = h * cellSize;

            // Overlay
            ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
            ctx.fillRect(borderX, borderY, borderW, borderH);

            // Animated Dashed Line
            ctx.save();
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            
            ctx.strokeStyle = '#000000';
            ctx.lineDashOffset = -dashOffsetRef.current;
            ctx.strokeRect(borderX, borderY, borderW, borderH);

            ctx.strokeStyle = '#ffffff';
            ctx.lineDashOffset = -dashOffsetRef.current + 4;
            ctx.strokeRect(borderX, borderY, borderW, borderH);
            ctx.restore();

            dashOffsetRef.current = (dashOffsetRef.current + 0.5) % 8;
            animationRef.current = requestAnimationFrame(renderLoop);
        }
    };

    if (selection && selection.isActive) {
        renderLoop();
    } else {
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

const DesktopEditor: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
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
  const [isSyncing, setIsSyncing] = useState(false);
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
  
  // Selection Tool State
  const [selection, setSelection] = useState<SelectionState>({
      isActive: false, startX: 0, startY: 0, endX: 0, endY: 0, floatingPixels: {}, offsetX: 0, offsetY: 0
  });
  const isSelecting = useRef(false);
  const isDraggingSelection = useRef(false);

  // Magic Wand
  const [magicWandTarget, setMagicWandTarget] = useState<{id: string, count: number} | null>(null);

  const [reduceNoise, setReduceNoise] = useState(false);
  const [detailProtection, setDetailProtection] = useState(30); 

  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showConvertSuccess, setShowConvertSuccess] = useState(false);

  const [isBeadMode, setIsBeadMode] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<{[key: string]: string}[]>([{}]);
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (history.length > 1) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [history]); 
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

  // Initial Load Strategy: Local > Cloud (Same as Mobile)
  useEffect(() => {
    if (!state?.grid && id && id !== 'new' && id !== 'imported') {
       const load = async () => {
         try {
           const localDrafts = await StorageHelper.loadDrafts();
           const localDraft = localDrafts.find((d: any) => d.id === id);
           
           if (localDraft) {
               applyDraft(localDraft);
           } else if (isAuthenticated && user) {
               const cloudDrafts = await StorageHelper.loadDrafts(user.id);
               const cloudDraft = cloudDrafts.find((d: any) => d.id === id);
               if (cloudDraft) applyDraft(cloudDraft);
           }
         } catch (e) {}
       };
       load();
    }
  }, [id, isAuthenticated, user?.id]);

  const applyDraft = (draft: any) => {
     setGrid(draft.grid); setTitle(draft.title); setHistory([draft.grid]); setHistoryIndex(0);
     setIsFreeMode(draft.isFreeMode ?? (draft.width === 100));
     setBounds({ minX: draft.minX ?? 0, minY: draft.minY ?? 0, maxX: draft.minX !== undefined ? (draft.minX + draft.width) : draft.width, maxY: draft.minY !== undefined ? (draft.minY + draft.height) : draft.height });
     if (draft.offsetX !== undefined && draft.offsetY !== undefined) {
       setOffset({ x: draft.offsetX, y: draft.offsetY });
       if (draft.zoom) setScale(draft.zoom);
     }
  };

  // Auto-Save: LOCAL ONLY
  useEffect(() => { 
      const timer = setInterval(() => { 
          if (!isBeadMode) performSave('local',true); 
      }, 10000); 
      return () => clearInterval(timer); 
  }, [isBeadMode]);

  useEffect(() => { if (isRenaming && titleInputRef.current) titleInputRef.current.focus(); }, [isRenaming]);

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

  // Ruler Logic (Omitted details for brevity, identical to prev)
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

  const prepareDraftObject = () => {
    // ... same draft logic ...
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
    return { id: currentId, title: currentData.title, grid: currentData.grid, width, height, minX: currentData.bounds.minX, minY: currentData.bounds.minY, isFreeMode: currentData.isFreeMode, offsetX: currentData.offset.x, offsetY: currentData.offset.y, zoom: currentData.scale, lastModified: Date.now(), thumbnail: canvas.toDataURL('image/png', 0.5) };
  };

  const performSave = async (mode: 'local' | 'cloud', feedback = false) => {
      if (selection.isActive) await commitSelection();
        const draft = prepareDraftObject();
        if (mode === 'local') {
            StorageHelper.saveLocalCache(draft);
            if (feedback) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1000); }
        } else {
            if (feedback) setSaveStatus('saving');
            await StorageHelper.saveDraft(draft, isAuthenticated && user ? user.id : undefined);
            if (feedback) { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }
        }
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

  const handleDevExport = () => { /* ... same ... */
      const exportData = { width: bounds.maxX - bounds.minX, height: bounds.maxY - bounds.minY, grid: grid };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `template_${Date.now()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  };

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
          const paletteCache = currentPalette.map(bead => { const rgb = hexToRgb(bead.hex); return { id: bead.id, rgb, lab: rgbToLab(rgb.r, rgb.g, rgb.b) }; });
          const newGrid: {[key: string]: string} = {};
          Object.entries(grid).forEach(([key, colorId]) => {
              const originalBead = allBeadsMap[colorId];
              if (originalBead) {
                  const rgb = hexToRgb(originalBead.hex);
                  const currentLab = rgbToLab(rgb.r, rgb.g, rgb.b);
                  let minDistance = Infinity; let closestBead = paletteCache[0];
                  for (const p of paletteCache) { const dist = deltaE(currentLab, p.lab); if (dist < minDistance) { minDistance = dist; closestBead = p; } }
                  newGrid[key] = closestBead.id;
              }
          });
          const width = bounds.maxX - bounds.minX; const height = bounds.maxY - bounds.minY;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width * 5); canvas.height = Math.max(1, height * 5);
          const ctx = canvas.getContext('2d');
          if (ctx) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); Object.entries(newGrid).forEach(([key, colorId]) => { const [x, y] = key.split(',').map(Number); const c = allBeadsMap[colorId]; if (c) { ctx.fillStyle = c.hex; ctx.fillRect((x - bounds.minX) * 5, (y - bounds.minY) * 5, 5, 5); } }); }
          const newDraft: Draft = { id: Date.now().toString(), title: `${title} (转换版)`, grid: newGrid, width, height, minX: bounds.minX, minY: bounds.minY, isFreeMode, lastModified: Date.now(), thumbnail: canvas.toDataURL('image/png', 0.5) };
          try { await StorageHelper.saveDraft(newDraft, isAuthenticated && user ? user.id : undefined); setShowConvertSuccess(true); } catch (e) { alert('保存副本失败'); } finally { setIsConverting(false); }
      }, 100);
  };

  const processExport = (shouldMapColors: boolean) => {
     setIsConverting(true);
     setTimeout(() => {
        const width = bounds.maxX - bounds.minX; const height = bounds.maxY - bounds.minY;
        let processedGrid = { ...grid };
        if (reduceNoise) { const threshold = 100 - detailProtection; processedGrid = denoiseGrid(processedGrid, bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, allBeadsMap, threshold); }
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
                        for (const p of paletteCache) { const dist = deltaE(currentLab, p.lab); if (dist < minDistance) { minDistance = dist; closestBead = p; } }
                        exportGrid[`${x},${y}`] = closestBead.id;
                    }
                }
            });
        } else { Object.entries(processedGrid).forEach(([key, val]) => { const [x, y] = key.split(',').map(Number); exportGrid[`${x - bounds.minX},${y - bounds.minY}`] = val as string; }); }
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

  // --- Selection Logic Desktop ---
  const commitSelection = async () => {
      if (!selection.isActive) return;
      const minSX = Math.min(selection.startX, selection.endX);
      const minSY = Math.min(selection.startY, selection.endY);
      
      const newGrid = { ...grid };
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
              if (action === 'delete') { delete newGrid[key]; changed = true; }
              else if (action === 'replace' && selectedBead) { newGrid[key] = selectedBead.id; changed = true; }
          }
      });
      if (changed) { setGrid(newGrid); commitHistory(newGrid); }
      setMagicWandTarget(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      if (e.button === 1 || tool === 'move' || isBeadMode) { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; return; }
      
      const {x, y} = getGridCoord(e.clientX, e.clientY); 

      if (tool === 'select') {
          if (selection.isActive) {
              const minSX = Math.min(selection.startX, selection.endX);
              const maxSX = Math.max(selection.startX, selection.endX);
              const minSY = Math.min(selection.startY, selection.endY);
              const maxSY = Math.max(selection.startY, selection.endY);
              const localX = x - selection.offsetX;
              const localY = y - selection.offsetY;
              
              if (localX >= minSX && localX <= maxSX && localY >= minSY && localY <= maxSY) {
                  isDraggingSelection.current = true;
                  lastPos.current = { x: e.clientX, y: e.clientY };
                  return;
              } else {
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

      if (selection.isActive) { commitSelection(); return; }

      if (tool === 'magic_wand') {
          const colorId = grid[`${x},${y}`];
          if (colorId) {
              let count = 0; Object.values(grid).forEach(v => { if(v === colorId) count++; });
              setMagicWandTarget({ id: colorId, count });
          }
          return;
      }

      handleCellAction(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const {x, y} = getGridCoord(e.clientX, e.clientY); setCursorPos({x, y});
      
      if ((tool === 'move' || isBeadMode) && isDragging.current) {
          const dx = e.clientX - lastPos.current.x; const dy = e.clientY - lastPos.current.y;
          setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy })); lastPos.current = { x: e.clientX, y: e.clientY }; return;
      }

      if (tool === 'select') {
          if (isSelecting.current) {
              setSelection(prev => ({ ...prev, endX: x, endY: y }));
          } else if (isDraggingSelection.current) {
              const lastGrid = getGridCoord(lastPos.current.x, lastPos.current.y);
              const dx = x - lastGrid.x;
              const dy = y - lastGrid.y;
              if (dx !== 0 || dy !== 0) {
                  setSelection(prev => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
                  lastPos.current = { x: e.clientX, y: e.clientY };
              }
          }
          return;
      }

      if (isDrawing.current && (tool === 'pen' || tool === 'eraser') && !isBeadMode) handleCellAction(x, y);
  };

  const handleMouseUp = () => {
      isDragging.current = false; 
      
      if (isSelecting.current) {
          isSelecting.current = false;
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
              setSelection({ isActive: false, startX: 0, startY: 0, endX: 0, endY: 0, floatingPixels: {}, offsetX: 0, offsetY: 0 });
          }
      }
      isDraggingSelection.current = false;

      if (isDrawing.current && !isBeadMode) commitHistory(grid);
  };

  const handleCellAction = (x: number, y: number) => {
    if (tool === 'move' || tool === 'select' || tool === 'magic_wand' || !selectedBead || isBeadMode) return;
    
    // ... [Free mode logic] ...
    if (isFreeMode) {
        let newMinX = bounds.minX; let newMaxX = bounds.maxX; let newMinY = bounds.minY; let newMaxY = bounds.maxY;
        let changed = false; let addedLeft = 0; let addedTop = 0; const EXPAND_CHUNK = 10;
        if (x < bounds.minX + 2) { newMinX = bounds.minX - EXPAND_CHUNK; addedLeft = EXPAND_CHUNK; changed = true; }
        if (x >= bounds.maxX - 2) { newMaxX = bounds.maxX + EXPAND_CHUNK; changed = true; }
        if (y < bounds.minY + 2) { newMinY = bounds.minY - EXPAND_CHUNK; addedTop = EXPAND_CHUNK; changed = true; }
        if (y >= bounds.maxY - 2) { newMaxY = bounds.maxY + EXPAND_CHUNK; changed = true; }
        if (changed) {
            setBounds({ minX: newMinX, maxX: newMaxX, minY: newMinY, maxY: newMaxY });
            if (addedLeft > 0 || addedTop > 0) { setOffset(prev => ({ x: prev.x - (addedLeft * CELL_SIZE * scale), y: prev.y - (addedTop * CELL_SIZE * scale) })); }
        }
    } else { if (x < bounds.minX || y < bounds.minY || x >= bounds.maxX || y >= bounds.maxY) return; }

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
        if (selectedBead) { newGrid[`${cx},${cy}`] = selectedBead.id; }
        safety++;
        const neighbors: [number, number][] = [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
        neighbors.forEach(([nx, ny]) => {
           const nKey: string = `${nx},${ny}`;
           if (!isFreeMode && (nx < bounds.minX || ny < bounds.minY || nx >= bounds.maxX || ny >= bounds.maxY)) return;
           if (!visited.has(nKey)) {
             const neighborColor: string | undefined = grid[nKey];
             if (targetColor === undefined) { if (neighborColor === undefined) { visited.add(nKey); queue.push([nx, ny]); } } 
             else if (neighborColor === targetColor) { visited.add(nKey); queue.push([nx, ny]); }
           }
        });
      }
      setGrid(newGrid); commitHistory(newGrid);
    }
  };

  const setToolAndCommit = async (newTool: Tool) => {
      if (selection.isActive) await commitSelection();
      setTool(newTool);
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden select-none relative">
       {/* Sync Overlay */}
       {isSyncing && (
           <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
               <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
               <div className="font-bold text-lg">正在同步云端</div>
               <div className="text-sm text-white/60 mt-1">请勿关闭页面...</div>
           </div>
       )}

       {/* Sidebar - Hidden in Bead Mode */}
       {!isBeadMode && (
           <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-sm transition-all duration-300">
              {/* ... [Sidebar content] ... */}
              <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                 <button onClick={handleBack} className="hover:bg-slate-100 p-1 rounded-full text-slate-500"><span className="material-symbols-outlined">arrow_back</span></button>
                 {isRenaming ? (
                   <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { setIsRenaming(false); performSave('local'); }} onKeyDown={(e) => e.key === 'Enter' && setIsRenaming(false)} className="font-bold text-gray-900 bg-slate-100 px-2 py-0.5 rounded w-full outline-none" autoFocus />
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
                      <button onClick={() => setToolAndCommit('move')} className={`p-2 rounded-md transition-colors ${tool === 'move' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">pan_tool_alt</span></button>
                      <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                      <button onClick={() => setToolAndCommit('pen')} className={`p-2 rounded-md transition-colors ${tool === 'pen' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">edit</span></button>
                      <button onClick={() => setToolAndCommit('eraser')} className={`p-2 rounded-md transition-colors ${tool === 'eraser' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">ink_eraser</span></button>
                      <button onClick={() => setToolAndCommit('fill')} className={`p-2 rounded-md transition-colors ${tool === 'fill' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">format_color_fill</span></button>
                      <button onClick={() => setToolAndCommit('picker')} className={`p-2 rounded-md transition-colors ${tool === 'picker' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">colorize</span></button>
                      <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>
                      <button onClick={() => setToolAndCommit('select')} className={`p-2 rounded-md transition-colors ${tool === 'select' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="框选移动"><span className="material-symbols-outlined text-[20px]">select_all</span></button>
                      <button onClick={() => setToolAndCommit('magic_wand')} className={`p-2 rounded-md transition-colors ${tool === 'magic_wand' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`} title="魔棒工具"><span className="material-symbols-outlined text-[20px]">auto_awesome</span></button>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg mr-2">
                          <button onClick={() => setShowGrid(!showGrid)} className={`p-2 rounded-md transition-colors ${showGrid ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">grid_4x4</span></button>
                          <button onClick={() => setShowNumbers(!showNumbers)} className={`p-2 rounded-md transition-colors ${showNumbers ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}><span className="material-symbols-outlined text-[20px]">123</span></button>
                      </div>
                      <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors text-slate-600"><span className="material-symbols-outlined">undo</span></button>
                      <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors text-slate-600"><span className="material-symbols-outlined">redo</span></button>
                      <button onClick={handleMirror} className="p-2 rounded-full text-slate-600 hover:text-primary hover:bg-slate-50 transition-colors" title="水平镜像"><span className="material-symbols-outlined text-[20px]">flip</span></button>
                      <button onClick={() => setShowConvertConfirm(true)} className="p-2 rounded-full text-slate-600 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="转换色彩"><span className="material-symbols-outlined text-[20px]">auto_fix_high</span></button>
                      <button onClick={handleManualSave} className={`p-2 rounded-full hover:bg-slate-100 transition-colors ${saveStatus === 'saved' ? 'text-green-500' : 'text-primary'}`}><span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check_circle' : 'save'}</span></button>
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

          <div ref={mainContainerRef} className="flex-1 relative bg-slate-50 overflow-hidden cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
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
                     <GridView grid={grid} bounds={bounds} allBeadsMap={allBeadsMap} showNumbers={showNumbers} cellSize={CELL_SIZE} selection={selection} />
                 </div>
             </div>
             <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm text-xs font-mono text-slate-600 pointer-events-none z-20 flex gap-4">
                 <span>X: {cursorPos?.x ?? 0}</span><span>Y: {cursorPos?.y ?? 0}</span><span>Zoom: {Math.round(scale * 100)}%</span>
             </div>
          </div>
       </div>
       <PaletteModal isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onSelect={(c) => { setSelectedBead(c); addToRecent(c); setIsPaletteOpen(false); setTool('pen'); }} />
       
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

       {showConvertConfirm && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            {/* Same convert modal content */}
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

export default DesktopEditor;
