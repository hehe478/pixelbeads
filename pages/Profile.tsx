
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MockAPI, DraftAPI } from '../utils/mockBackend';
import { StorageHelper } from '../utils/storageHelper';

interface AuthFormData {
  username: string;
  password: string;
  confirmPassword?: string;
  activationCode?: string;
}

const Profile: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync Modal State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null); // User object waiting for sync decision
  const [isSyncing, setIsSyncing] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<AuthFormData>({
    username: '',
    password: '',
    confirmPassword: '',
    activationCode: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg(''); 
  };

  const executeLogin = (userData: any) => {
      // Check for local data
      if (StorageHelper.hasLocalData()) {
          setPendingUser(userData);
          setShowSyncModal(true);
      } else {
          login(userData);
      }
  };

  const handleSyncConfirm = async () => {
      if (!pendingUser) return;
      setIsSyncing(true);
      try {
          const { drafts, palettes } = StorageHelper.getLocalData();
          await DraftAPI.mergeLocalData(pendingUser.id, drafts, palettes);
          // Optional: Clear local data to avoid confusion, OR keep it as backup.
          // Usually better to clear or ignore it once logged in.
          StorageHelper.clearLocalData(); 
          
          login(pendingUser);
          setShowSyncModal(false);
      } catch (e) {
          setErrorMsg('同步失败，请稍后重试');
      } finally {
          setIsSyncing(false);
      }
  };

  const handleSyncSkip = () => {
      if (pendingUser) login(pendingUser);
      setShowSyncModal(false);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (authMode === 'login') {
        const loggedInUser = await MockAPI.login(formData.username, formData.password);
        executeLogin(loggedInUser);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('两次输入的密码不一致');
        }
        if (!formData.activationCode) {
           throw new Error('请输入激活码');
        }
        
        const registeredUser = await MockAPI.register(formData.username, formData.password, formData.activationCode);
        setSuccessMsg('注册成功！正在自动登录...');
        
        setTimeout(() => {
          executeLogin(registeredUser);
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '操作失败');
      setIsLoading(false); 
    }
  };

  const toggleMode = () => {
    setAuthMode(prev => prev === 'login' ? 'register' : 'login');
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(false);
    setFormData({ username: '', password: '', confirmPassword: '', activationCode: '' });
  };

  const getAvatarInitial = () => {
    if (!user || !user.username) return '?';
    return user.username[0].toUpperCase();
  };

  // --- Render: Not Logged In ---
  if (!isAuthenticated) {
    return (
      <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-background-light dark:bg-background-dark shadow-2xl pb-24">
        <div className="flex-1 flex flex-col justify-center px-8 animate-fade-in">
          <div className="mb-8 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-400 text-white shadow-lg shadow-blue-500/30 mb-4">
              <span className="material-symbols-outlined text-[36px]">grid_view</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">PixelBead</h1>
            <p className="text-sm text-gray-500 mt-2">专业的像素画创作社区</p>
          </div>

          <div className="bg-slate-50 dark:bg-surface-dark rounded-2xl p-1 shadow-inner border border-slate-100 dark:border-slate-800 flex mb-6">
            <button 
              onClick={() => setAuthMode('login')} 
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              登录账号
            </button>
            <button 
              onClick={() => setAuthMode('register')} 
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${authMode === 'register' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              注册新用户
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">账号</label>
              <input 
                name="username"
                type="text" 
                value={formData.username}
                onChange={handleInputChange}
                placeholder={authMode === 'register' ? "8-16位数字或字母" : "输入账号"}
                className="w-full h-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all font-medium text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 ml-1">密码</label>
              <input 
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange} 
                placeholder={authMode === 'register' ? "8-16位，含数字和字母" : "输入密码"}
                className="w-full h-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all font-medium text-gray-900 dark:text-white"
                required
              />
            </div>

            {authMode === 'register' && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 ml-1">确认密码</label>
                  <input 
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange} 
                    placeholder="再次输入密码"
                    className="w-full h-12 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all font-medium text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 ml-1">邀请激活码</label>
                  <input 
                    name="activationCode"
                    type="text" 
                    value={formData.activationCode}
                    onChange={handleInputChange}
                    placeholder="请输入获得的激活码"
                    className="w-full h-12 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/30 rounded-xl px-4 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none transition-all font-medium text-gray-900 dark:text-white placeholder-purple-300"
                    required
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 text-red-500 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <span className="material-symbols-outlined text-sm">error</span>
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="p-3 rounded-lg bg-green-50 text-green-600 text-xs font-bold flex items-center gap-2 animate-fade-in">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {successMsg}
              </div>
            )}

            <button 
              disabled={isLoading}
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary-dark active:scale-[0.98] text-white rounded-xl font-bold shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (authMode === 'login' ? '立即登录' : '验证并注册')}
            </button>
          </form>
          
          <div className="mt-6 text-center">
             <button onClick={toggleMode} className="text-xs text-gray-400 hover:text-primary transition-colors">
               {authMode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'}
             </button>
          </div>
        </div>

        {/* Sync Modal */}
        {showSyncModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-3xl">cloud_upload</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">同步本地数据</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                        检测到您本地有未登录时创建的草稿或配色方案。<br/>是否将它们合并到云端账号？
                    </p>
                    <div className="space-y-3">
                        <button 
                            onClick={handleSyncConfirm} 
                            disabled={isSyncing}
                            className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isSyncing ? <span className="material-symbols-outlined animate-spin text-lg">sync</span> : <span className="material-symbols-outlined text-lg">cloud_upload</span>}
                            {isSyncing ? '同步中...' : '同步并登录'}
                        </button>
                        <button 
                            onClick={handleSyncSkip}
                            disabled={isSyncing}
                            className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                        >
                            跳过 (丢弃本地数据)
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- Render: Logged In ---
  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-hidden mx-auto max-w-md bg-background-light dark:bg-background-dark shadow-2xl pb-24">
      <div className="flex-1 overflow-y-auto hide-scrollbar animate-fade-in">
        <div className="flex items-center justify-between p-6 pt-12 pb-2">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex-1 text-center pl-12">个人中心</h2>
          <button className="flex w-12 items-center justify-end text-primary dark:text-primary hover:text-primary-dark transition-colors">
            <span className="text-base font-bold">设置</span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-6 pt-6 pb-8">
          <div className="relative group cursor-pointer">
            <div 
              className="h-28 w-28 rounded-full border-4 border-white dark:border-surface-dark shadow-xl overflow-hidden bg-cover bg-center bg-gray-100 dark:bg-slate-800" 
              style={{ backgroundImage: user?.avatar ? `url('${user.avatar}')` : undefined }}
            >
               {!user?.avatar && <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300 font-bold">{getAvatarInitial()}</div>}
            </div>
            {user?.isVip && (
              <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-yellow-300 to-yellow-500 shadow-md border-2 border-white dark:border-slate-700">
                <span className="material-symbols-outlined filled text-white text-[18px]">crown</span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-center text-center">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{user?.username || '用户'}</h3>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              {user?.isVip ? <span className="text-yellow-600 dark:text-yellow-400">高级会员</span> : '普通用户'}
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span>ID: {user?.id ? user.id.slice(-6) : '---'}</span>
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-center gap-8 mb-8 px-6">
            <div className="text-center">
                <div className="text-xl font-black text-gray-900 dark:text-white">12</div>
                <div className="text-xs text-gray-400 font-medium">草稿</div>
            </div>
            <div className="text-center">
                <div className="text-xl font-black text-gray-900 dark:text-white">5</div>
                <div className="text-xs text-gray-400 font-medium">收藏</div>
            </div>
            <div className="text-center">
                <div className="text-xl font-black text-gray-900 dark:text-white">2.4k</div>
                <div className="text-xs text-gray-400 font-medium">获赞</div>
            </div>
        </div>

        <div className="flex flex-col px-6 space-y-4 w-full max-w-md mx-auto">
          {/* VIP Card (Only if VIP) */}
          {user?.isVip && (
             <div className="rounded-2xl p-5 bg-gradient-to-r from-gray-900 to-gray-800 text-white shadow-lg relative overflow-hidden mb-2">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <span className="material-symbols-outlined text-[100px]">diamond</span>
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-yellow-400">workspace_premium</span>
                        <span className="font-bold text-yellow-400 text-sm tracking-wider">PRO MEMBER</span>
                    </div>
                    <h4 className="text-lg font-bold">已解锁全部高级功能</h4>
                    <p className="text-gray-400 text-xs mt-1">有效期至: 永久有效</p>
                </div>
             </div>
          )}

          <button className="group flex items-center justify-between rounded-2xl bg-white dark:bg-surface-dark p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <span className="material-symbols-outlined">folder_open</span>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white">我的作品集</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">chevron_right</span>
          </button>
          
          <button className="group flex items-center justify-between rounded-2xl bg-white dark:bg-surface-dark p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <span className="material-symbols-outlined">palette</span>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white">配色方案管理</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">chevron_right</span>
          </button>

          <button className="group flex items-center justify-between rounded-2xl bg-white dark:bg-surface-dark p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 active:bg-slate-50 dark:active:bg-slate-800 transition-colors">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                <span className="material-symbols-outlined">help</span>
              </div>
              <span className="text-base font-semibold text-gray-900 dark:text-white">帮助与反馈</span>
            </div>
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">chevron_right</span>
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 pb-8">
          <button 
            onClick={logout}
            className="text-sm font-bold text-red-500 hover:text-red-600 dark:text-red-400 transition-colors px-6 py-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 w-[80%] max-w-[200px]"
          >
            退出当前账号
          </button>
          <p className="text-xs text-slate-400 dark:text-slate-600 font-mono mt-2">
            Ver 2.5.0 (Build 105)
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
