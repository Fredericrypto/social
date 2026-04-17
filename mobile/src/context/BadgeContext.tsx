import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth.store";

interface BadgeState {
  unreadMessages:      number;
  unreadNotifications: number;
  refreshBadges:       () => void;
  clearNotificationBadge: () => void;  // zera badge imediatamente (ao abrir tela)
}

export const BadgeContext = createContext<BadgeState>({
  unreadMessages:         0,
  unreadNotifications:    0,
  refreshBadges:          () => {},
  clearNotificationBadge: () => {},
});

export function useBadges() {
  return useContext(BadgeContext);
}

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [unreadMessages,      setUnreadMessages]      = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { isAuthenticated } = useAuthStore();
  const intervalRef = useRef<any>(null);
  const lastFetch   = useRef<number>(0);

  const refreshBadges = useCallback(async () => {
    if (!isAuthenticated) return;
    const now = Date.now();
    if (now - lastFetch.current < 15000) return;
    lastFetch.current = now;
    try {
      const [msgRes, notifRes] = await Promise.all([
        api.get("/messages/unread-count").catch(() => ({ data: 0 })),
        api.get("/notifications/unread-count").catch(() => ({ data: 0 })),
      ]);
      setUnreadMessages(typeof msgRes.data === "number" ? msgRes.data : 0);
      setUnreadNotifications(typeof notifRes.data === "number" ? notifRes.data : 0);
    } catch {}
  }, [isAuthenticated]);

  // Zera o badge de notificações imediatamente (chamado ao abrir a tela)
  const clearNotificationBadge = useCallback(() => {
    setUnreadNotifications(0);
    lastFetch.current = 0; // força refresh na próxima chamada
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }
    lastFetch.current = 0;
    refreshBadges();
    intervalRef.current = setInterval(() => {
      lastFetch.current = 0;
      refreshBadges();
    }, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") { lastFetch.current = 0; refreshBadges(); }
    });
    return () => { clearInterval(intervalRef.current); sub.remove(); };
  }, [isAuthenticated, refreshBadges]);

  return (
    <BadgeContext.Provider value={{
      unreadMessages,
      unreadNotifications,
      refreshBadges,
      clearNotificationBadge,
    }}>
      {children}
    </BadgeContext.Provider>
  );
}
