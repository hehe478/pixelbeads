import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ARTKAL_COLORS } from '../types';

const ExportPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Get data from location state or fallback
  const { grid = {}, width = 50, height = 50, title = '未命名作品' } = location.state || {};
  
  const [totalBeads, setTotalBeads] = useState(0);
  const [colorCounts, setColorCounts] = useState<{[key: string]: number}>({});

  useEffect(() => {
    // Calculate stats
    const counts: {[key: string]: number} = {};
    let total = 0;
    Object.values(grid).forEach((colorId: any) => {
      counts[colorId] = (counts[colorId] || 0) + 1;
      total++;
    });
    setColorCounts(counts);
    setTotalBeads(total);

    // Render Canvas Preview - BLUEPRINT STYLE
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const CELL_SIZE = 30; // Larger cell for text
        const PADDING_LEFT = 40;
        const PADDING_TOP = 40;
        
        // Set canvas resolution high enough for text
        canvas.width = width * CELL_SIZE + PADDING_LEFT;
        canvas.height = height * CELL_SIZE + PADDING_TOP;
        
        // Background
        ctx.fillStyle = '#f0f4f8'; // Slight blueish tint for blueprint feel
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Rulers Background
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(0, 0, canvas.width, PADDING_TOP); // Top ruler
        ctx.fillRect(0, 0, PADDING_LEFT, canvas.height); // Left ruler
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(0, 0, PADDING_LEFT, PADDING_TOP); // Corner

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = '#64748b';

        // Draw Top Ruler Numbers
        for (let x = 0; x < width; x++) {
          const num = x + 1;
          if (num === 1 || num % 5 === 0) {
            ctx.fillText(num.toString(), PADDING_LEFT + x * CELL_SIZE + CELL_SIZE / 2, PADDING_TOP / 2);
          }
          // Tick marks
          ctx.beginPath();
          ctx.moveTo(PADDING_LEFT + x * CELL_SIZE + CELL_SIZE, PADDING_TOP - 5);
          ctx.lineTo(PADDING_LEFT + x * CELL_SIZE + CELL_SIZE, PADDING_TOP);
          ctx.strokeStyle = '#94a3b8';
          ctx.stroke();
        }

        // Draw Left Ruler Numbers
        for (let y = 0; y < height; y++) {
           const num = y + 1;
           if (num === 1 || num % 5 === 0) {
             ctx.fillText(num.toString(), PADDING_LEFT / 2, PADDING_TOP + y * CELL_SIZE + CELL_SIZE / 2);
           }
           // Tick marks
           ctx.beginPath();
           ctx.moveTo(PADDING_LEFT - 5, PADDING_TOP + y * CELL_SIZE + CELL_SIZE);
           ctx.lineTo(PADDING_LEFT, PADDING_TOP + y * CELL_SIZE + CELL_SIZE);
           ctx.strokeStyle = '#94a3b8';
           ctx.stroke();
        }

        // Main Grid Area Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(PADDING_LEFT, PADDING_TOP, width * CELL_SIZE, height * CELL_SIZE);

        // Draw Grid Lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= width; x++) {
          ctx.moveTo(PADDING_LEFT + x * CELL_SIZE, PADDING_TOP);
          ctx.lineTo(PADDING_LEFT + x * CELL_SIZE, PADDING_TOP + height * CELL_SIZE);
        }
        for (let y = 0; y <= height; y++) {
          ctx.moveTo(PADDING_LEFT, PADDING_TOP + y * CELL_SIZE);
          ctx.lineTo(PADDING_LEFT + width * CELL_SIZE, PADDING_TOP + y * CELL_SIZE);
        }
        ctx.stroke();

        // Draw Beads and Codes
        Object.entries(grid).forEach(([key, colorId]: [string, any]) => {
          const [x, y] = key.split(',').map(Number);
          const color = ARTKAL_COLORS.find(c => c.id === colorId);
          if (color) {
            const posX = PADDING_LEFT + x * CELL_SIZE;
            const posY = PADDING_TOP + y * CELL_SIZE;
            
            // Draw Bead Background
            ctx.fillStyle = color.hex;
            ctx.fillRect(posX, posY, CELL_SIZE, CELL_SIZE);

            // Determine text color (simple contrast)
            const r = parseInt(color.hex.slice(1, 3), 16);
            const g = parseInt(color.hex.slice(3, 5), 16);
            const b = parseInt(color.hex.slice(5, 7), 16);
            const isLight = (r * 0.299 + g * 0.587 + b * 0.114) > 128;
            
            // Draw Code
            ctx.fillStyle = isLight ? '#000000' : '#ffffff';
            ctx.font = 'bold 9px sans-serif'; // Slightly smaller for code
            if (color.code) {
               ctx.fillText(color.code, posX + CELL_SIZE / 2, posY + CELL_SIZE / 2);
            }
          }
        });

        // Draw Thicker borders for 10x10 grids
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 10) {
           ctx.moveTo(PADDING_LEFT + x * CELL_SIZE, PADDING_TOP);
           ctx.lineTo(PADDING_LEFT + x * CELL_SIZE, PADDING_TOP + height * CELL_SIZE);
        }
        for (let y = 0; y <= height; y += 10) {
           ctx.moveTo(PADDING_LEFT, PADDING_TOP + y * CELL_SIZE);
           ctx.lineTo(PADDING_LEFT + width * CELL_SIZE, PADDING_TOP + y * CELL_SIZE);
        }
        ctx.stroke();
      }
    }
  }, [grid, width, height]);

  // Format date
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const orderId = `#PB-${now.getTime().toString().slice(-5)}`;

  const handleBack = () => {
    // Navigate back to custom editor specifically, passing state to prevent clearing
    navigate('/editor/custom', {
      state: {
        grid,
        width,
        height,
        title
      }
    });
  };

  return (
    <div className="bg-black/80 font-display antialiased h-full w-full overflow-y-auto flex flex-col items-center relative z-50">
      <div className="sticky top-0 w-full p-4 flex justify-between items-center z-50 text-white bg-black/40 backdrop-blur-md shrink-0">
          <button onClick={handleBack} className="flex items-center justify-center p-2 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition">
          <span className="material-symbols-outlined text-white font-light">close</span>
          </button>
          <span className="text-sm font-medium opacity-80">导出预览</span>
          <button className="flex items-center justify-center p-2 rounded-full bg-white/10 backdrop-blur hover:bg-white/20 transition">
          <span className="material-symbols-outlined text-white font-light">ios_share</span>
          </button>
      </div>

      <div className="w-full max-w-2xl flex flex-col relative z-10 px-4 pt-4 pb-24 shrink-0">
          <div className="bg-white dark:bg-[#1e1e2f] rounded-lg shadow-2xl overflow-hidden flex flex-col relative">
          <div className="flex-1">
              <div className="p-6 border-b border-dashed border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-primary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px] font-light">grid_view</span>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">PixelBead</h1>
                  </div>
                  <div className="text-right">
                  <p className="text-[10px] uppercase font-mono text-gray-400 dark:text-gray-500 tracking-wider">单据编号</p>
                  <p className="text-xs font-mono font-bold text-gray-900 dark:text-white">{orderId}</p>
                  </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-mono mt-4">
                  <span>{dateStr}</span>
                  <span>{timeStr}</span>
              </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-black/20 overflow-x-auto">
              {/* Canvas Container with horizontal scroll if needed */}
              <div className="min-w-full flex items-center justify-center">
                  <canvas 
                  ref={canvasRef} 
                  className="shadow-lg rounded-sm"
                  style={{ 
                      maxWidth: '100%',
                      height: 'auto'
                  }}
                  />
              </div>
              <div className="mt-4 text-center">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{width}x{height} 网格 • {Object.keys(colorCounts).length} 色 • {totalBeads} 豆</p>
              </div>
              </div>

              <div className="relative h-4 w-full">
              <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full border-t border-dashed border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="absolute inset-0 flex justify-center">
                  <span className="bg-white dark:bg-[#1e1e2f] px-2 text-[10px] font-mono uppercase tracking-widest text-gray-400">材料清单</span>
              </div>
              </div>

              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(colorCounts).map(([colorId, count]) => {
                  const color = ARTKAL_COLORS.find(c => c.id === colorId);
                  if (!color) return null;
                  return (
                  <div key={colorId} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                      <div className="w-8 h-8 rounded-full shadow-inner border border-black/5 shrink-0" style={{ backgroundColor: color.hex }}></div>
                      <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-gray-900 dark:text-white">{color.code}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate block">{color.name}</span>
                      </div>
                      <div className="text-right shrink-0 bg-white dark:bg-black/20 px-1.5 py-0.5 rounded text-center min-w-[32px]">
                      <span className="text-xs font-mono font-bold text-primary dark:text-primary-light">{count}</span>
                      </div>
                  </div>
                  );
              })}
              </div>

              <div className="mt-2 bg-gray-50 dark:bg-gray-800/50 p-6 flex flex-col items-center justify-center text-center gap-1 border-t border-dashed border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-2">
                  <span className="material-symbols-outlined">public</span>
              </div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">在线创作与分享</p>
              <p className="text-primary font-bold text-base tracking-tight font-mono mt-1">www.pixel-beads.com</p>
              </div>
              
              <div className="receipt-edge h-4 w-full -mb-4" style={{
              background: 'linear-gradient(-45deg, transparent 8px, white 0) 0 100%, linear-gradient(45deg, transparent 8px, white 0) 0 100%',
              backgroundRepeat: 'repeat-x',
              backgroundPosition: 'left bottom',
              backgroundSize: '16px 16px'
              }}></div>
          </div>
          </div>
      </div>
      
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 z-30 w-full max-w-sm">
          <button className="w-full bg-primary hover:bg-blue-600 active:scale-[0.98] transition-all text-white font-bold py-4 px-6 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center gap-2 text-lg">
          <span className="material-symbols-outlined font-light">download</span>
          保存图片回执
          </button>
      </div>
    </div>
  );
};

export default ExportPreview;