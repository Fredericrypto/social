import AsyncStorage from "@react-native-async-storage/async-storage";
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

const STORAGE_KEY     = "@venus:presence_status";
const INACTIVITY_MS   = 5 * 60 * 1000; // 5 min sem interação → away

/**
 * Comportamento MSN 2009:
 *
 * - Abre o app           → online (a menos que status salvo seja busy/away)
 * - Minimiza (background)→ away  (não offline — usuário pode voltar)
 * - Fecha o app          → offline (tratado pelo logout ou próxima abertura)
 * - 5 min sem interação  → away
 * - Logout               → offline, limpa status salvo
 * - Status manual        → persiste no AsyncStorage entre sessões
 *   - busy/away manual   → não é sobrescrito pelo foreground/background
 *   - offline manual     → permanece offline mesmo ao voltar ao foreground
 */
class PresenceService {
  private currentStatus: PresenceStatus = "offline";
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;

  // true = usuário escolheu manualmente (busy, away, offline)
  // false = status automático (online, away por inatividade)
  private isManual = false;

  // ── Persistência ──────────────────────────────────────────────────────

  private async loadSavedStatus(): Promise<PresenceStatus | null> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      return (saved as PresenceStatus) || null;
    } catch {
      return null;
    }
  }

  private async saveStatus(status: PresenceStatus): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, status);
    } catch {}
  }

  private async clearSavedStatus(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  // ── Patch no backend ──────────────────────────────────────────────────

  private async patch(status: PresenceStatus): Promise<void> {
    try {
      await api.patch("/users/me", { presenceStatus: status });
    } catch {}
  }

  // ── API pública ───────────────────────────────────────────────────────

  /**
   * Chamado ao autenticar / voltar ao foreground.
   * Respeita status manual salvo.
   */
  async goOnline(): Promise<void> {
    const saved = await this.loadSavedStatus();

    if (saved && saved !== "online") {
      // Usuário tinha definido busy/away/offline manualmente — respeita
      this.currentStatus = saved;
      this.isManual      = true;
      await this.patch(saved);
      return;
    }

    // Sem status salvo ou era online → vai online normalmente
    this.currentStatus = "online";
    this.isManual      = false;
    await this.patch("online");
    await this.saveStatus("online");
    this.resetInactivityTimer();
  }

  /**
   * Chamado quando o app vai para background (AppState = background/inactive).
   * Status manual (busy/away/offline) não é sobrescrito.
   */
  async goAway(): Promise<void> {
    // Não sobrescreve status manual
    if (this.isManual) return;

    this.clearInactivityTimer();
    this.currentStatus = "away";
    await this.patch("away");
    // Não salva "away" automático no AsyncStorage — ao voltar vai online
  }

  /**
   * Chamado no logout.
   * Limpa tudo — próxima sessão começa do zero.
   */
  async goOffline(): Promise<void> {
    this.clearInactivityTimer();
    this.currentStatus = "offline";
    this.isManual      = false;
    await this.patch("offline");
    await this.clearSavedStatus();
  }

  /**
   * Seleção manual pelo usuário (SettingsScreen).
   * Persiste no AsyncStorage — sobrevive a fechar/abrir o app.
   */
  async setStatus(status: PresenceStatus): Promise<void> {
    this.clearInactivityTimer();
    this.currentStatus = status;
    this.isManual      = status !== "online"; // online manual não é "fixo"
    await this.patch(status);

    if (status === "online") {
      await this.saveStatus("online");
      this.resetInactivityTimer();
    } else {
      await this.saveStatus(status);
    }
  }

  // ── Timer de inatividade ──────────────────────────────────────────────

  resetInactivityTimer(): void {
    this.clearInactivityTimer();
    if (this.isManual) return;

    this.inactivityTimer = setTimeout(async () => {
      if (!this.isManual && this.currentStatus === "online") {
        this.currentStatus = "away";
        await this.patch("away");
      }
    }, INACTIVITY_MS);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  // ── Getters ───────────────────────────────────────────────────────────

  getStatus(): PresenceStatus { return this.currentStatus; }
  getColor():  string         { return PRESENCE_COLORS[this.currentStatus]; }
}

export const presenceService = new PresenceService();
