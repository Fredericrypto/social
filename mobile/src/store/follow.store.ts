/**
 * follow.store.ts — Store global de estado de follow
 * Compartilhado entre ExploreScreen, UserProfileScreen, NotificationsScreen etc.
 * Fonte da verdade para isFollowing de qualquer userId.
 */
import { create } from 'zustand';
import { api } from '../services/api';

interface FollowStore {
  // Map userId → isFollowing
  states: Record<string, boolean>;
  // Seta o estado de um usuário (sem chamar API — só atualiza o store)
  set: (userId: string, isFollowing: boolean) => void;
  // Faz follow/unfollow + atualiza o store
  toggle: (userId: string) => Promise<void>;
  // Inicializa múltiplos estados de uma vez (vindo da API)
  hydrate: (entries: { userId: string; isFollowing: boolean }[]) => void;
}

export const useFollowStore = create<FollowStore>((set, get) => ({
  states: {},

  set: (userId, isFollowing) =>
    set(s => ({ states: { ...s.states, [userId]: isFollowing } })),

  hydrate: (entries) => {
    const patch: Record<string, boolean> = {};
    entries.forEach(e => { patch[e.userId] = e.isFollowing; });
    set(s => ({ states: { ...s.states, ...patch } }));
  },

  toggle: async (userId) => {
    const current = get().states[userId] ?? false;
    const next    = !current;

    // Optimistic
    set(s => ({ states: { ...s.states, [userId]: next } }));

    try {
      if (current) await api.delete(`/follows/${userId}`);
      else         await api.post(`/follows/${userId}`);
    } catch (e: any) {
      const status = e?.response?.status;
      // 409 = já seguindo → força true
      if (status === 409) {
        set(s => ({ states: { ...s.states, [userId]: true } }));
        return;
      }
      // 404 = não estava seguindo → força false
      if (status === 404) {
        set(s => ({ states: { ...s.states, [userId]: false } }));
        return;
      }
      // Outros erros → reverte
      set(s => ({ states: { ...s.states, [userId]: current } }));
    }
  },
}));
