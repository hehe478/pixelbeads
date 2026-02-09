import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Draft } from '../types';
import { useColorPalette } from '../context/ColorContext';

const Create: React.FC = () => {
  const navigate = useNavigate();
  const { allBeads } = useColorPalette();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  
  // Import Dialog State
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [targetWidth, setTargetWidth] = useState(50);

  // Delete Dialog State
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState<string | null>(null);

  // Load drafts on mount
  useEffect(() => {
    try {
      const savedDrafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
      setDrafts(savedDrafts);
    } catch (e) {
      console.error('Failed to load drafts', e);
    }
  }, []);

  // Clean up object URL on unmount or new selection
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Hex to RGB helper
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Find closest color
  const findClosestColor = (r: number, g: number, b: number) => {
    if (!allBeads || allBeads.length === 0) return '000000';

    let minDistance = Infinity;
    let closestColor = allBeads[0].id;

    allBeads.forEach(color => {
      const cRgb = hexToRgb(color.hex);
      // Simple Euclidean distance
      const distance = Math.sqrt(
        Math.pow(r - cRgb.r, 2) +
        Math.pow(g - cRgb.g, 2) +
        Math.pow(b - cRgb.b, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = color.id;
      }
    });

    return closestColor;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      
      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.width, height: img.height });
        // Default to 50 or image width if smaller
        setTargetWidth(Math.min(50, img.width));
        setPreviewUrl(url);
        setSelectedFile(file);
        setShowImportDialog(true);
      };
      img.src = url;
    }
  };

  const processImage = () => {
    if (!selectedFile || !previewUrl) return;
    if (!allBeads || allBeads.length === 0) {
        alert("颜色库加载中，请稍后再试");
        return;
    }
    
    setIsProcessing(true);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const width = targetWidth;
        // Calculate height based on aspect ratio
        const height = Math.round(originalDimensions.height * (targetWidth / originalDimensions.width));

        canvas.width = width;
        canvas.height = height;

        if (ctx) {
          // Disable smoothing for pixel art look if desired, but for photo import usually we want smooth downsampling first
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          const initialGrid: {[key: string]: string} = {};

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const index = (y * width + x) * 4;
              const r = data[index];
              const g = data[index + 1];
              const b = data[index + 2];
              const a = data[index + 3];

              if (a > 128) { // If not transparent
                const colorId = findClosestColor(r, g, b);
                initialGrid[`${x},${y}`] = colorId;
              }
            }
          }
          
          navigate('/editor/imported', { 
            state: { 
              grid: initialGrid, 
              width, 
              height,
              title: '导入的照片'
            } 
          });
        }
      } catch (err) {
        console.error("Processing failed", err);
        alert("图片处理出错");
      } finally {
        setIsProcessing(false);
        setShowImportDialog(false);
      }
    };
    img.onerror = () => {
        setIsProcessing(false);
        alert("图片加载失败");
    };
    img.src = previewUrl;
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraftToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (draftToDelete) {
      // Cast both to string to ensure matching even if one is number
      const updatedDrafts = drafts.filter(d => String(d.id) !== String(draftToDelete));
      setDrafts(updatedDrafts);
      localStorage.setItem('pixelbead_drafts', JSON.stringify(updatedDrafts));
    }
    setShowDeleteDialog(false);
    setDraftToDelete(null);
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  const displayedDrafts = showAllDrafts ? drafts : drafts.slice(0, 2);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-white dark:bg-background-dark shadow-2xl pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md pb-2">
        <div className="h-11 w-full"></div> 
        <div className="px-6 pb-2 pt-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">创建新图纸</h1>
            <button 
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">选择画布尺寸或导入图片开始创作</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-24 hide-scrollbar">
        
        {/* Import Section (Moved to Top) */}
        <section className="mt-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">更多方式</h2>
          <div className="w-full">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileChange} 
            />
            <button 
              onClick={() => {
                // Reset file input
                if (fileInputRef.current) fileInputRef.current.value = '';
                fileInputRef.current?.click();
              }}
              disabled={isProcessing}
              className="flex w-full flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-blue-500 to-primary text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-95 transition-transform"
            >
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-3"></div>
                  <span className="font-bold text-lg">处理中...</span>
                </div>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center mb-3 backdrop-blur-sm">
                    <span className="material-symbols-outlined text-2xl">image</span>
                  </div>
                  <span className="font-bold text-lg">导入照片</span>
                  <span className="text-xs text-white/80 mt-1">本地处理，智能转换像素画</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Presets Section */}
        <section className="mt-8">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">选择画布预设</h2>
          <div className="grid grid-cols-1 gap-4">
             {/* Free Mode (New) */}
            <button onClick={() => navigate('/editor/new?size=100')} className="relative group flex items-center p-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
              <div className="h-16 w-16 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center shrink-0 text-emerald-500 shadow-sm">
                <span className="material-symbols-outlined text-3xl">gesture</span>
              </div>
              <div className="ml-4 flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">自由模式</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">无限画布，自由绘制 (100x100)</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>

            <button onClick={() => navigate('/editor/new?size=32')} className="relative group flex items-center p-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-[#1e1e30] hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <div className="h-16 w-16 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 text-primary">
                <span className="material-symbols-outlined text-3xl">grid_3x3</span>
              </div>
              <div className="ml-4 flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">32 x 32</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">适合初学者，简单图标与角色</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-transparent group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>
            <button onClick={() => navigate('/editor/new?size=50')} className="relative group flex items-center p-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-[#1e1e30] hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <div className="h-16 w-16 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                <span className="material-symbols-outlined text-3xl">grid_4x4</span>
              </div>
              <div className="ml-4 flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">50 x 50</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">标准尺寸，适合大多数场景</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-transparent group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>
            <button onClick={() => navigate('/editor/new?size=80')} className="relative group flex items-center p-4 rounded-2xl border border-slate-100 dark:border-gray-800 bg-white dark:bg-[#1e1e30] hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
              <div className="h-16 w-16 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                <span className="material-symbols-outlined text-3xl">apps</span>
              </div>
              <div className="ml-4 flex-1 text-left">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">80 x 80</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">高细节创作，适合复杂风景</p>
              </div>
              <div className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-transparent group-hover:bg-primary group-hover:border-primary group-hover:text-white transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </div>
            </button>
          </div>
        </section>

        {/* Drafts Section */}
        <section className="mt-8 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">最近草稿 ({drafts.length})</h2>
            {drafts.length > 2 && (
              <button 
                onClick={() => setShowAllDrafts(!showAllDrafts)}
                className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-0.5"
              >
                {showAllDrafts ? '收起' : '查看全部'}
                <span className="material-symbols-outlined text-[16px]">{showAllDrafts ? 'expand_less' : 'expand_more'}</span>
              </button>
            )}
          </div>
          
          {displayedDrafts.length > 0 ? (
             <div className="space-y-3">
               {displayedDrafts.map(draft => (
                 <div 
                   key={draft.id}
                   onClick={() => navigate(`/editor/${draft.id}`)}
                   className="relative rounded-2xl bg-slate-50 dark:bg-[#1e1e30] border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-[#25253a] transition-colors group animate-fade-in"
                 >
                    <div className="h-14 w-14 rounded-lg bg-white dark:bg-black/20 overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                      {draft.thumbnail ? (
                        <img alt={draft.title} className="w-full h-full object-contain pixelated-image" src={draft.thumbnail} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                           <span className="material-symbols-outlined text-2xl">grid_on</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{draft.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{draft.width}x{draft.height} • {getTimeAgo(draft.lastModified)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <button className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" onClick={(e) => { e.stopPropagation(); navigate(`/editor/${draft.id}`); }}>
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button 
                        onClick={(e) => handleDeleteClick(e, draft.id)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 text-red-500 shadow-sm border border-slate-100 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                 </div>
               ))}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-8 text-slate-400 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
               <span className="material-symbols-outlined text-3xl mb-2 opacity-50">draft</span>
               <p className="text-sm">暂无草稿</p>
             </div>
          )}
        </section>
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 dark:text-white">设置导入参数</h3>
              <button 
                onClick={() => setShowImportDialog(false)}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="material-symbols-outlined text-gray-500">close</span>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              {/* Preview */}
              <div className="relative aspect-square w-full bg-gray-100 dark:bg-black/20 rounded-lg overflow-hidden mb-4 border border-gray-200 dark:border-gray-700">
                {previewUrl && (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                )}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-md">
                   原始: {originalDimensions.width} x {originalDimensions.height}
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">目标宽度 (像素)</label>
                    <span className="text-primary font-bold">{targetWidth} px</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max={originalDimensions.width} 
                    value={targetWidth}
                    onChange={(e) => setTargetWidth(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>1px</span>
                    <span>{originalDimensions.width}px</span>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-[18px]">info</span>
                    <div className="text-xs text-blue-700 dark:text-blue-300">
                      <p className="font-bold mb-0.5">推荐宽度: 30-60</p>
                      <p className="opacity-80">此范围内的像素画效果最佳，既保留细节又适合拼豆制作。</p>
                      <p className="mt-1 opacity-80">预计高度: {Math.round(originalDimensions.height * (targetWidth / originalDimensions.width))} px</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-black/10 flex gap-3">
              <button 
                onClick={() => setShowImportDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={processImage}
                disabled={isProcessing}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? '生成中...' : '确认生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 flex flex-col items-center pt-8 pb-6">
               <div className="h-14 w-14 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl">delete</span>
               </div>
               <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">删除草稿</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                 确定要永久删除这个作品吗？<br/>此操作无法撤销。
               </p>
            </div>
            
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-black/10 flex gap-3">
              <button 
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Create;