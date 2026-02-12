
import { Draft } from '../types';
import { DraftAPI } from './mockBackend';

// Helper to get user ID from AuthContext
export const StorageHelper = {
  
  // 1. 加载逻辑：优先读取云端（如果是登录状态），但为了防止覆盖未保存的本地进度，这里可以扩展
  // 简单起见，我们假设进入编辑器时，由组件层决定是否使用传入的 state (可能是本地最新的)
  loadDrafts: async (userId?: string): Promise<Draft[]> => {
    if (userId) {
      try {
        return await DraftAPI.getUserDrafts(userId);
      } catch (e) {
        console.error("Cloud load failed, falling back to empty", e);
        return [];
      }
    } else {
      try {
        const saved = localStorage.getItem('pixelbead_drafts');
        return saved ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
  },

  // 2. 权威保存 (Cloud Sync)：用于手动保存或退出时
  // 这是一个耗时操作
  saveDraft: async (draft: Draft, userId?: string): Promise<void> => {
    // 无论是否登录，总是先更新本地的主存储，保证本地数据最新
    const localDrafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
    const existingIndex = localDrafts.findIndex((d: Draft) => d.id === draft.id);
    if (existingIndex >= 0) localDrafts[existingIndex] = draft;
    else localDrafts.unshift(draft);
    localStorage.setItem('pixelbead_drafts', JSON.stringify(localDrafts));

    // 如果登录了，推送到云端
    if (userId) {
      const currentList = await DraftAPI.getUserDrafts(userId);
      const cloudIndex = currentList.findIndex(d => d.id === draft.id);
      
      let newList;
      if (cloudIndex >= 0) {
        newList = [...currentList];
        newList[cloudIndex] = draft;
      } else {
        newList = [draft, ...currentList];
      }
      
      await DraftAPI.saveUserDrafts(userId, newList);
    }
  },

  // 3. 快速缓存 (Fast Save)：用于画布内的自动保存
  // 仅写入 LocalStorage，不走网络，杜绝卡顿
  saveLocalCache: (draft: Draft) => {
      // 我们直接更新 'pixelbead_drafts'，因为这是本地单一数据源
      // 注意：这在并发极高时可能有性能损耗，但在 10s 间隔下是安全的
      // 为了极致性能，也可以存到一个临时的 key，但为了代码简单，直接存主库
      try {
        const localDrafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
        const existingIndex = localDrafts.findIndex((d: Draft) => d.id === draft.id);
        
        if (existingIndex >= 0) {
            // 只更新变动字段以减少开销? 还是整体替换
            localDrafts[existingIndex] = draft;
        } else {
            localDrafts.unshift(draft);
        }
        localStorage.setItem('pixelbead_drafts', JSON.stringify(localDrafts));
      } catch (e) {
          console.error("Local cache failed", e); // Quota exceeded?
      }
  },

  // Delete Draft
  deleteDraft: async (draftId: string, userId?: string): Promise<void> => {
    // 删本地
    const currentList = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
    const newList = currentList.filter((d: Draft) => String(d.id) !== String(draftId));
    localStorage.setItem('pixelbead_drafts', JSON.stringify(newList));

    // 删云端
    if (userId) {
        const cloudList = await DraftAPI.getUserDrafts(userId);
        const newCloudList = cloudList.filter(d => d.id !== draftId);
        await DraftAPI.saveUserDrafts(userId, newCloudList);
    }
  },

  hasLocalData: (): boolean => {
      const drafts = JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]');
      const palettes = JSON.parse(localStorage.getItem('pixelbead_custom_palettes') || '[]');
      return drafts.length > 0 || palettes.length > 0;
  },

  getLocalData: () => {
      return {
          drafts: JSON.parse(localStorage.getItem('pixelbead_drafts') || '[]'),
          palettes: JSON.parse(localStorage.getItem('pixelbead_custom_palettes') || '[]')
      };
  },

  clearLocalData: () => {
      localStorage.removeItem('pixelbead_drafts');
      localStorage.removeItem('pixelbead_custom_palettes');
  }
};
