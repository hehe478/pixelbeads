import React from 'react';

const Profile: React.FC = () => {
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-background-light dark:bg-background-dark shadow-2xl pb-24">
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="flex items-center justify-between p-6 pt-12 pb-2">
          <h2 className="text-2xl font-bold tracking-tight text-text-main dark:text-white flex-1 text-center pl-12">我的资料</h2>
          <button className="flex w-12 items-center justify-end text-primary dark:text-primary hover:text-primary-dark transition-colors">
            <span className="text-base font-bold">编辑</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-8">
          <div className="relative group cursor-pointer">
            <div className="h-32 w-32 rounded-full border-4 border-white dark:border-surface-dark shadow-soft overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAqSWT_3m7J3NOs9SVoa4lzRDhkaWSif1VbsyT8vWAhdoSoMcVnWu94JjqbTueGY1UBy8Xq7JLwKIDpg1tq8VeZwHtKNXzkcGNQf_InZJ4GBQM6vrWjXNLoXMgfn9LKmKWeyR1K-ilE0zchvRzrbiBUmKirAJ1AlD-YdnVNaLsM6UrEoxdYtcRZOQyURMpTQMAtwTTy8O6JKl6CQb94RbZOzRgCRrXrSNWwvEJvKw2Hh7oPXUB9VPZBw9BiLCrNOKkYYjY4QlYaeI3f')" }}>
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark shadow-md border border-slate-100 dark:border-slate-700">
              <span className="material-symbols-outlined filled text-[#F59E0B] text-[20px]">crown</span>
            </div>
          </div>
          <div className="flex flex-col items-center text-center">
            <h3 className="text-xl font-bold text-text-main dark:text-white">PixelArtist_99</h3>
            <p className="text-sm font-medium text-text-secondary dark:text-slate-400 mt-1">免费会员</p>
          </div>
        </div>

        <div className="px-6 mb-8 w-full max-w-md mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl"></div>
            <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl"></div>
            <div className="relative flex flex-col items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <span className="material-symbols-outlined filled text-[32px]">lock_open</span>
              </div>
              <div className="text-center space-y-2">
                <h4 className="text-xl font-black tracking-tight text-text-main dark:text-white">
                  解锁专业版功能
                </h4>
                <p className="text-sm text-text-secondary dark:text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                  输入您的激活码以访问无限图纸和高级导出工具。
                </p>
              </div>
              <div className="w-full space-y-3">
                <div className="relative">
                  <input className="w-full h-14 rounded-xl border-none bg-background-light dark:bg-slate-800 px-4 text-center text-base font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-primary/50 text-text-main dark:text-white transition-all outline-none" placeholder="输入激活码" type="text" />
                </div>
                <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white font-bold transition-all shadow-[0_0_15px_rgba(43,43,238,0.2)] active:scale-[0.98]">
                  <span>立即激活</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col px-6 space-y-4 w-full max-w-md mx-auto">
          <button className="group flex items-center justify-between rounded-2xl bg-surface-light dark:bg-surface-dark p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <span className="material-symbols-outlined">grid_view</span>
              </div>
              <span className="text-base font-semibold text-text-main dark:text-white">我的图纸</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">chevron_right</span>
          </button>
          <button className="group flex items-center justify-between rounded-2xl bg-surface-light dark:bg-surface-dark p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined">help</span>
              </div>
              <span className="text-base font-semibold text-text-main dark:text-white">帮助与支持</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">chevron_right</span>
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 pb-8">
          <button className="text-sm font-semibold text-red-500 hover:text-red-600 dark:text-red-400 transition-colors px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
            退出登录
          </button>
          <p className="text-xs text-slate-400 dark:text-slate-600">
            版本 2.4.0 (Build 102)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;