import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
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
  const intervalRef = useRef<any>(null);
  const lastFetch = useRef<number>(0);

  const refreshBadges = useCallback(async () => {
    if (!isAuthenticated) return;
    // Throttle: no mínimo 15s entre chamadas
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

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch inicial
    lastFetch.current = 0;
    refreshBadges();

    // Poll a cada 60s (não 30s)
    intervalRef.current = setInterval(() => {
      lastFetch.current = 0; // resetar throttle para o poll
      refreshBadges();
    }, 60000);

    // Pausar quando app vai para background
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        lastFetch.current = 0;
        refreshBadges();
      }
    });

    return () => {
      clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [isAuthenticated]);

  return (
    <BadgeContext.Provider value={{ unreadMessages, unreadNotifications, refreshBadges }}>
      {children}
    </BadgeContext.Provider>
  );
}
