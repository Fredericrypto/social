import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/auth.store";

interface BadgeState {
  unreadMessages: number;
  unreadNotifications: number;
  refreshBadges: () => void;
}

export const BadgeContext = createContext<BadgeState>({
  unreadMessages: 0,
  unreadNotifications: 0,
  refreshBadges: () => {},
});

export function useBadges() {
  return useContext(BadgeContext);
}

export function BadgeProvider({ children }: { children: React.ReactNode }) {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const { isAuthenticated } = useAuthStore();

  const refreshBadges = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [msgRes, notifRes] = await Promise.all([
        api.get("/messages/unread-count").catch(() => ({ data: 0 })),
        api.get("/notifications/unread-count").catch(() => ({ data: 0 })),
      ]);
      setUnreadMessages(typeof msgRes.data === "number" ? msgRes.data : 0);
      setUnreadNotifications(typeof notifRes.data === "number" ? notifRes.data : 0);
    } catch {}
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshBadges();
      const interval = setInterval(refreshBadges, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, refreshBadges]);

  return (
    <BadgeContext.Provider value={{ unreadMessages, unreadNotifications, refreshBadges }}>
      {children}
    </BadgeContext.Provider>
  );
}
