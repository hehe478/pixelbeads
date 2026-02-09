import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ARTS, CATEGORIES } from '../types';
import { useColorPalette } from '../context/ColorContext';
import PaletteModal from '../components/PaletteModal';

const Inspiration: React.FC = () => {
  const navigate = useNavigate();
  const { availableBrands, availableSets, paletteConfig, setBrand, setSet } = useColorPalette();
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-background-light dark:bg-background-dark shadow-2xl pb-24">
      {/* Header with Palette Selector */}
      <div className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="h-11 w-full"></div>
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">发现灵感</h1>
            <button className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary/10 hover:text-primary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
          </div>
          
          {/* Color Palette Selector */}
          <div className="bg-white dark:bg-[#1a1a2e] rounded-2xl p-1.5 shadow-sm border border-gray-100 dark:border-gray-700 flex gap-2">
             <div className="flex-1 min-w-0">
               <label className="text-[10px] text-gray-400 pl-2 block mb-0.5 font-medium">品牌</label>
               <select 
                 value={paletteConfig.brand}
                 onChange={(e) => setBrand(e.target.value)}
                 className="w-full bg-transparent border-none text-sm font-bold text-gray-800 dark:text-white p-0 pl-2 focus:ring-0 cursor-pointer"
               >
                 {availableBrands.map(b => (
                   <option key={b} value={b}>{b}</option>
                 ))}
               </select>
             </div>
             
             <div className="w-[1px] bg-gray-200 dark:bg-gray-700 my-1"></div>

             <div className="flex-1 min-w-0">
               <label className="text-[10px] text-gray-400 pl-2 block mb-0.5 font-medium">套装</label>
               <select 
                 value={paletteConfig.set}
                 onChange={(e) => setSet(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
                 className="w-full bg-transparent border-none text-sm font-bold text-gray-800 dark:text-white p-0 pl-2 focus:ring-0 cursor-pointer"
               >
                 {availableSets.map(s => (
                   <option key={s} value={s}>{s}色套装</option>
                 ))}
                 <option value="custom">我的专用</option>
               </select>
             </div>

             <button 
               onClick={() => setIsPaletteModalOpen(true)}
               className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
             >
               <span className="material-symbols-outlined text-[20px]">palette</span>
             </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
        {/* Banner */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative w-full h-48 rounded-xl overflow-hidden group shadow-lg cursor-pointer" onClick={() => navigate('/editor/featured')}>
            <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuB12KjebCZNIJBgJUMOmRKSTWMKIWIf0bzc9Ic_X5lz_wPJAiHGkcgdu9mBMna0zg-hpsBoRlVEGu_GvW5OFrZQ2nXNF95ADEJYL3xgK6kk4YBKP6fXmCpQJBPWw1hV74hfCLB5P7uYUz88BhhoIE__G8gJrMDjdRs2Xa82n6Azr7A6GZ-izbZJO02p7sALeirYhfXa-hJSD90LgfO3HdJzQexxxaKoc9JC3mXRSd7CkxQj5o-DJIdB2cmRul_6cx0KbiYeDcZmaLi8')" }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-5 w-full">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold uppercase tracking-wider">热门推荐</span>
                <span className="text-white/80 text-xs font-medium">每周更新</span>
              </div>
              <h2 className="text-white text-xl font-bold leading-tight">像素完美：十大复古设计</h2>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-3 px-4 py-3 overflow-x-auto hide-scrollbar sticky top-0 z-10 bg-background-light dark:bg-background-dark">
          <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-primary pl-5 pr-5 shadow-md shadow-primary/30 transition-all active:scale-95">
            <span className="text-white text-sm font-semibold leading-normal">卡通</span>
          </button>
          {CATEGORIES.slice(1, 5).map(cat => (
            <button key={cat} className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-[#1a1a2e] border border-gray-100 dark:border-gray-800 pl-5 pr-5 transition-all hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95">
              <span className="text-gray-700 dark:text-gray-300 text-sm font-medium leading-normal">{cat}</span>
            </button>
          ))}
        </div>

        {/* Masonry Grid */}
        <div className="px-4 pb-4 mt-2">
          <div className="columns-2 gap-4 space-y-4">
            {DEMO_ARTS.map((art) => (
              <div 
                key={art.id} 
                onClick={() => navigate(`/editor/${art.id}`)}
                className="break-inside-avoid relative rounded-xl bg-white dark:bg-[#1e1e30] p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className={`relative w-full rounded-lg bg-gray-50 dark:bg-gray-800 overflow-hidden mb-3 aspect-[${Math.random() > 0.5 ? '4/5' : '1/1'}]`}>
                  <img alt={art.title} className="h-full w-full object-cover object-center pixelated-image" src={art.imageUrl} />
                  <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-0.5">
                    <span className="text-[10px] font-bold text-white">
                      {art.difficulty === 'Simple' ? '简单' : art.difficulty === 'Medium' ? '中等' : '困难'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-gray-900 dark:text-white font-semibold text-sm line-clamp-1">{art.title}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">@{art.author}</span>
                    <div className="flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors cursor-pointer group/heart">
                      <span className="material-symbols-outlined text-[16px] font-light group-hover/heart:fill-current">favorite</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{art.likes}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>

      <PaletteModal isOpen={isPaletteModalOpen} onClose={() => setIsPaletteModalOpen(false)} />
    </div>
  );
};

export default Inspiration;