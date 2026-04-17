import { api } from "./api";

export type PresenceStatus = "online" | "busy" | "away" | "offline";

export const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online:  "#22C55E",
  busy:    "#EF4444",
  away:    "#F97316",
  offline: "#6B7280",
};

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online:  "Online",
  busy:    "Ocupado",
  away:    "Ausente",
  offline: "Offline",
};

const INACTIVITY_MS = 10 * 60 * 1000;

class PresenceService {
  private currentStatus: PresenceStatus = "offline";
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private hasFixedStatus = false;

  async setStatus(status: PresenceStatus, fixed = true): Promise<void> {
    this.currentStatus = status;
    this.hasFixedStatus = fixed;
    try { await api.patch("/users/me", { presenceStatus: status }); } catch {}
  }

  async goOnline(): Promise<void> {
    if (this.hasFixedStatus && this.currentStatus !== "offline") return;
    await this.setStatus("online", false);
    this.resetInactivityTimer();
  }

  resetInactivityTimer(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.hasFixedStatus && this.currentStatus !== "offline") return;
    this.inactivityTimer = setTimeout(async () => {
      if (!this.hasFixedStatus) await this.setStatus("offline", false);
    }, INACTIVITY_MS);
  }

  async goOffline(): Promise<void> {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    await this.setStatus("offline", false);
    this.hasFixedStatus = false;
  }

  getStatus(): PresenceStatus { return this.currentStatus; }
  getColor():  string { return PRESENCE_COLORS[this.currentStatus]; }
}

export const presenceService = new PresenceService();
