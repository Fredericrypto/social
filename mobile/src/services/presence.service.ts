/**
 * presence.service.ts
 *
 * Sistema de status de presença manual e persistente.
 * O usuário escolhe seu status — ele persiste no banco até ser alterado.
 * Auto-offline após inatividade configurável.
 */

import { api } from "./api";

export type PresenceStatus = "online" | "busy" | "away" | "offline";

export interface PresenceInfo {
  userId:    string;
  status:    PresenceStatus;
  updatedAt: string;
}

// Cores dos status — independentes do tema (convenção universal)
export const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online:  "#22C55E",  // verde
  busy:    "#EF4444",  // vermelho
  away:    "#F97316",  // laranja
  offline: "#6B7280",  // cinza
};

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online:  "Online",
  busy:    "Ocupado",
  away:    "Ausente",
  offline: "Offline",
};

const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutos

class PresenceService {
  private currentStatus: PresenceStatus = "offline";
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private hasFixedStatus = false; // usuário definiu manualmente

  // ── Definir status ─────────────────────────────────────────────────────
  async setStatus(status: PresenceStatus, fixed = true): Promise<void> {
    this.currentStatus  = status;
    this.hasFixedStatus = fixed;

    try {
      await api.patch("/users/me", { presenceStatus: status });
    } catch {
      // Silencia — presença não é crítica
    }
  }

  // ── Marcar como online ao entrar no app ────────────────────────────────
  async goOnline(): Promise<void> {
    if (this.hasFixedStatus && this.currentStatus !== "offline") return;
    await this.setStatus("online", false);
    this.resetInactivityTimer();
  }

  // ── Auto-offline por inatividade ───────────────────────────────────────
  resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.hasFixedStatus && this.currentStatus !== "offline") return;

    this.inactivityTimer = setTimeout(async () => {
      if (!this.hasFixedStatus) {
        await this.setStatus("offline", false);
      }
    }, INACTIVITY_MS);
  }

  // ── Offline ao sair ────────────────────────────────────────────────────
  async goOffline(): Promise<void> {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    await this.setStatus("offline", false);
    this.hasFixedStatus = false;
  }

  getStatus(): PresenceStatus {
    return this.currentStatus;
  }

  getColor(): string {
    return PRESENCE_COLORS[this.currentStatus];
  }
}

export const presenceService = new PresenceService();

// ── Componente de dot de presença (React Native) ──────────────────────────────
// Exportado para uso inline em Avatar, PostCard, etc.
import React from "react";
import { View, StyleSheet } from "react-native";

interface PresenceDotProps {
  status:   PresenceStatus;
  size?:    number;
  absolute?: boolean; // posiciona sobre avatar
}

export function PresenceDot({ status, size = 10, absolute = false }: PresenceDotProps) {
  const color = PRESENCE_COLORS[status];
  return (
    <View style={[
      {
        width:        size,
        height:       size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth:  1.5,
        borderColor:  "#fff",
      },
      absolute && {
        position: "absolute",
        bottom:   0,
        right:    0,
      },
    ]} />
  );
}
