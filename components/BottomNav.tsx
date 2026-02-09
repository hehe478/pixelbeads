import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white/95 dark:bg-surface-dark/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 pb-6 pt-3 z-40 fixed bottom-0 w-full left-0">
      <div className="flex justify-between items-end px-12 relative max-w-md mx-auto">
        <button 
          onClick={() => navigate('/')}
          className={`flex flex-col items-center gap-1 group w-12 transition-colors ${isActive('/') ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
        >
          <span className={`material-symbols-outlined text-[28px] ${isActive('/') ? 'filled' : 'font-light'}`}>home</span>
          <span className="text-[10px] font-medium">灵感</span>
        </button>
        
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 flex flex-col items-center gap-1 z-50">
          <button 
            onClick={() => navigate('/create')}
            className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-white shadow-lg shadow-blue-500/40 ring-4 ring-slate-50 dark:ring-background-dark transition-transform active:scale-95 hover:bg-blue-600"
          >
            <span className="material-symbols-outlined text-[36px] font-medium">add</span>
          </button>
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-1">创建</span>
        </div>

        <button 
          onClick={() => navigate('/profile')}
          className={`flex flex-col items-center gap-1 group w-12 transition-colors ${isActive('/profile') ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
        >
          <span className={`material-symbols-outlined text-[28px] ${isActive('/profile') ? 'filled' : 'font-light'}`}>person</span>
          <span className="text-[10px] font-medium">我的</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;