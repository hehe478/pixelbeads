import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useColorPalette } from '../context/ColorContext';
import { getTextColor } from '../utils/colors';

const ExportPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { allBeads } = useColorPalette();
  
  // Get data from location state or fallback
  const { grid = {}, width = 50, height = 50, title = '未命名作品' } = location.state || {};
  
  const [totalBeads, setTotalBeads] = useState(0);
  const [colorCounts, setColorCounts] = useState<{[key: string]: number}>({});

  const { dateStr, orderId } = useMemo(() => {
    const now = new Date();
    return {
      dateStr: `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`,
      orderId: id && id !== 'custom' ? `ID: ${id.slice(-6).toUpperCase()}` : `ID: ${now.getTime().toString().slice(-6)}`
    };
  }, [id]);

  useEffect(() => {
    if (!allBeads || allBeads.length === 0) return;

    const counts: {[key: string]: number} = {};
    let total = 0;
    Object.values(grid).forEach((colorId: any) => {
      counts[colorId] = (counts[colorId] || 0) + 1;
      total++;
    });
    
    const sortedColorKeys = Object.keys(counts).sort((a, b) => {
        const beadA = allBeads.find(x => x.id === a);
        const beadB = allBeads.find(x => x.id === b);
        if (!beadA || !beadB) return 0;
        return beadA.code.localeCompare(beadB.code);
    });

    setColorCounts(counts);
    setTotalBeads(total);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // --- CONFIGURATION ---
        const CELL_SIZE = 24;
        const RULER_SIZE = 40; // Increased for better visibility
        const GRID_MARGIN_X = 60; // Side margins for grid
        
        // Header Config
        const HEADER_HEIGHT = 140;
        
        // BOM (Bill of Materials) Config
        const BOM_COLS = 10; 
        const CHIP_GAP_X = 15; // Gap between chips
        const CHIP_GAP_Y = 15; // Gap between rows
        const CHIP_HEIGHT = 70; // Even taller chips for better visibility
        const MIN_CHIP_WIDTH = 120; // Slightly wider minimum
        const BOM_MARGIN_TOP = 50;
        const BOM_PADDING_SIDE = 40; // Left/Right padding for BOM area

        // --- DIMENSIONS CALCULATIONS ---
        const gridPixelWidth = width * CELL_SIZE + RULER_SIZE;
        const gridPixelHeight = height * CELL_SIZE + RULER_SIZE;

        // 1. Calculate Minimum Canvas Width required by the BOM (Material List)
        const minBomSectionWidth = (MIN_CHIP_WIDTH * BOM_COLS) + ((BOM_COLS - 1) * CHIP_GAP_X) + (BOM_PADDING_SIDE * 2);
        
        // 2. Calculate Final Canvas Width
        const canvasWidth = Math.max(gridPixelWidth + GRID_MARGIN_X * 2, minBomSectionWidth);
        
        // 3. Calculate DYNAMIC Chip Width to fill the row
        const availableWidthForChips = canvasWidth - (BOM_PADDING_SIDE * 2) - ((BOM_COLS - 1) * CHIP_GAP_X);
        const dynamicChipWidth = availableWidthForChips / BOM_COLS;

        // 4. Calculate Height
        const bomRows = Math.ceil(sortedColorKeys.length / BOM_COLS);
        const bomHeight = bomRows * (CHIP_HEIGHT + CHIP_GAP_Y) + BOM_PADDING_SIDE + 40; // +40 for title

        const canvasHeight = HEADER_HEIGHT + gridPixelHeight + BOM_MARGIN_TOP + bomHeight;

        // Resize Canvas
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // --- DRAWING ---

        // 1. Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Header Section
        ctx.fillStyle = '#1e293b'; // Slate-800
        ctx.fillRect(0, 0, canvas.width, 110);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, 40, 55);

        // Info Tags
        ctx.font = '500 16px sans-serif';
        ctx.fillStyle = '#cbd5e1'; // Slate-300
        const infoText = `${width} x ${height} 格  •  共 ${sortedColorKeys.length} 种颜色  •  总计 ${total} 颗豆`;
        ctx.fillText(infoText, 40, 90);

        // Date/ID (Right aligned)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(orderId, canvas.width - 40, 45);
        ctx.fillText(dateStr, canvas.width - 40, 75);

        // 3. Grid Section
        const gridStartX = (canvasWidth - gridPixelWidth) / 2;
        const gridStartY = HEADER_HEIGHT + 20;

        // Draw Rulers Background
        ctx.fillStyle = '#f8fafc'; // Slate-50
        ctx.fillRect(gridStartX, gridStartY, gridPixelWidth, RULER_SIZE); // Top ruler
        ctx.fillRect(gridStartX, gridStartY, RULER_SIZE, gridPixelHeight); // Left ruler
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#64748b';

        // Ruler Numbers
        for (let x = 0; x < width; x++) {
          if ((x + 1) % 5 === 0 || x === 0) {
             ctx.fillText((x+1).toString(), gridStartX + RULER_SIZE + x * CELL_SIZE + CELL_SIZE/2, gridStartY + RULER_SIZE/2);
          }
        }
        for (let y = 0; y < height; y++) {
          if ((y + 1) % 5 === 0 || y === 0) {
             ctx.fillText((y+1).toString(), gridStartX + RULER_SIZE/2, gridStartY + RULER_SIZE + y * CELL_SIZE + CELL_SIZE/2);
          }
        }

        // Draw Pixels and Codes
        Object.entries(grid).forEach(([key, colorId]: [string, any]) => {
          const [x, y] = key.split(',').map(Number);
          const color = allBeads.find(c => c.id === colorId);
          if (color) {
            const posX = gridStartX + RULER_SIZE + x * CELL_SIZE;
            const posY = gridStartY + RULER_SIZE + y * CELL_SIZE;
            
            // Draw Bead Color
            ctx.fillStyle = color.hex;
            ctx.fillRect(posX, posY, CELL_SIZE, CELL_SIZE);

            // Draw Bead Code text (CRITICAL REQUIREMENT)
            ctx.fillStyle = getTextColor(color.hex);
            // Use a slightly condensed font if code is long, otherwise bold sans
            ctx.font = color.code.length > 3 ? 'bold 8px sans-serif' : 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(color.code, posX + CELL_SIZE/2, posY + CELL_SIZE/2 + 1);
          }
        });

        // Grid Lines (Overlay)
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // Vertical lines
        for (let x = 0; x <= width; x++) {
            ctx.moveTo(gridStartX + RULER_SIZE + x * CELL_SIZE, gridStartY + RULER_SIZE);
            ctx.lineTo(gridStartX + RULER_SIZE + x * CELL_SIZE, gridStartY + gridPixelHeight);
        }
        // Horizontal lines
        for (let y = 0; y <= height; y++) {
            ctx.moveTo(gridStartX + RULER_SIZE, gridStartY + RULER_SIZE + y * CELL_SIZE);
            ctx.lineTo(gridStartX + gridPixelWidth, gridStartY + RULER_SIZE + y * CELL_SIZE);
        }
        ctx.stroke();

        // 10x10 Thicker Lines
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x <= width; x+=10) {
            ctx.moveTo(gridStartX + RULER_SIZE + x * CELL_SIZE, gridStartY + RULER_SIZE);
            ctx.lineTo(gridStartX + RULER_SIZE + x * CELL_SIZE, gridStartY + gridPixelHeight);
        }
        for (let y = 0; y <= height; y+=10) {
            ctx.moveTo(gridStartX + RULER_SIZE, gridStartY + RULER_SIZE + y * CELL_SIZE);
            ctx.lineTo(gridStartX + gridPixelWidth, gridStartY + RULER_SIZE + y * CELL_SIZE);
        }
        ctx.stroke();
        
        // Border around grid
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.strokeRect(gridStartX + RULER_SIZE, gridStartY + RULER_SIZE, width * CELL_SIZE, height * CELL_SIZE);


        // 4. Material List (BOM) Section
        const bomStartY = gridStartY + gridPixelHeight + BOM_MARGIN_TOP;
        
        // Divider Line
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.setLineDash([6, 6]);
        ctx.moveTo(40, bomStartY);
        ctx.lineTo(canvasWidth - 40, bomStartY);
        ctx.stroke();
        ctx.setLineDash([]);

        // "Materials" Title
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('材料清单 / Materials List', BOM_PADDING_SIDE, bomStartY + 35);

        const chipsStartY = bomStartY + 65;

        sortedColorKeys.forEach((colorId, index) => {
            const bead = allBeads.find(b => b.id === colorId);
            const count = counts[colorId];
            if (!bead) return;

            const col = index % BOM_COLS;
            const row = Math.floor(index / BOM_COLS);

            // Use dynamic width to justify the row
            const x = BOM_PADDING_SIDE + col * (dynamicChipWidth + CHIP_GAP_X);
            const y = chipsStartY + row * (CHIP_HEIGHT + CHIP_GAP_Y);

            // Draw Rounded Rect Chip
            ctx.fillStyle = bead.hex;
            
            // Manual Rounded Rect Path
            const r = 10; // radius
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + dynamicChipWidth - r, y);
            ctx.quadraticCurveTo(x + dynamicChipWidth, y, x + dynamicChipWidth, y + r);
            ctx.lineTo(x + dynamicChipWidth, y + CHIP_HEIGHT - r);
            ctx.quadraticCurveTo(x + dynamicChipWidth, y + CHIP_HEIGHT, x + dynamicChipWidth - r, y + CHIP_HEIGHT);
            ctx.lineTo(x + r, y + CHIP_HEIGHT);
            ctx.quadraticCurveTo(x, y + CHIP_HEIGHT, x, y + CHIP_HEIGHT - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
            
            ctx.fill();
            // Subtle border for light colors
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Text Contrast
            const textColor = getTextColor(bead.hex);
            ctx.fillStyle = textColor;

            // Brand (Top Left) - Larger font
            ctx.font = 'bold 12px sans-serif'; // Increased font size
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.globalAlpha = 0.85;
            ctx.fillText(bead.brand, x + 10, y + 8);

            // Code (Center) - Even larger font
            ctx.font = '800 24px sans-serif'; // Extra bold, larger
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = 1.0;
            ctx.fillText(bead.code, x + dynamicChipWidth/2, y + CHIP_HEIGHT/2 + 2);

            // Count (Bottom Right) - Larger font
            ctx.font = 'bold 16px sans-serif'; // Increased font size
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.globalAlpha = 0.95;
            ctx.fillText(`x${count}`, x + dynamicChipWidth - 10, y + CHIP_HEIGHT - 8);
        });
      }
    }
  }, [grid, width, height, allBeads, title, dateStr, orderId]);

  const handleBack = () => {
    if (window.history.state && window.history.length > 1) {
       navigate(-1);
    } else {
       navigate(`/editor/${id || 'custom'}`, {
         state: { grid, width, height, title }
       });
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `pixelbead-${title}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="bg-slate-100 dark:bg-black font-display antialiased h-screen w-full flex flex-col relative z-50">
      <div className="bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center z-[60] shadow-sm shrink-0">
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 px-3 py-1.5 rounded-lg transition-colors">
             <span className="material-symbols-outlined text-[20px]">arrow_back</span>
             <span className="text-sm font-bold">返回</span>
          </button>
          <span className="text-sm font-bold text-gray-900 dark:text-white">导出预览</span>
          <button onClick={downloadImage} className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-4 py-1.5 rounded-full shadow-lg shadow-primary/30 transition-all active:scale-95">
             <span className="material-symbols-outlined text-[18px]">download</span>
             <span className="text-sm font-bold">保存图片</span>
          </button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-8 flex items-start justify-center">
          <div className="shadow-2xl rounded-sm overflow-hidden bg-white max-w-full">
              <canvas 
                ref={canvasRef} 
                className="block max-w-full h-auto"
              />
          </div>
      </div>
    </div>
  );
};

export default ExportPreview;