/**
 * notifications.service.ts
 *
 * Push Notifications via Expo Notifications:
 *  - Solicita permissão ao usuário
 *  - Obtém o Expo Push Token
 *  - Registra o token no backend (PATCH /users/me { expoPushToken })
 *  - Handler para notificações recebidas com app em foreground
 *  - Handler para tap na notificação (navegação)
 *  - Limpeza ao logout
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// Detecta se está rodando no Expo Go (sem suporte a push remoto no SDK 53+)
const IS_EXPO_GO = Constants.appOwnership === "expo";

// ─── Configuração global de como exibir notificações em foreground ────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface PushNotificationData {
  type:       "like" | "comment" | "follow" | "message" | "new_post";
  postId?:    string;
  userId?:    string;
  username?:  string;
  screen?:    string;
  params?:    Record<string, any>;
}

// ─── Serviço ──────────────────────────────────────────────────────────────────
class NotificationsService {
  private foregroundSubscription: Notifications.Subscription | null = null;
  private responseSubscription:   Notifications.Subscription | null = null;
  private navigationRef: any = null;

  // Injeta a ref de navegação (chamado no AppContent após mount)
  setNavigationRef(ref: any) {
    this.navigationRef = ref;
  }

  async registerForPushNotifications(): Promise<string | null> {
    // Push remoto não funciona no Expo Go a partir do SDK 53
    if (IS_EXPO_GO) {
      console.log("[Push] Expo Go detectado — push remoto indisponível. Use um development build.");
      return null;
    }

    // Só funciona em dispositivo físico
    if (!Device.isDevice) {
      console.log("[Push] Emulador detectado — push não disponível.");
      return null;
    }

    // Permissão
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("[Push] Permissão negada pelo usuário.");
      return null;
    }

    // Canal Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name:             "Notificações",
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       "#7C3AED",
        sound:            "default",
      });
    }

    // Obter token
    try {
      // projectId vem do app.json (EAS) ou do .env como fallback
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        process.env.EXPO_PUBLIC_PROJECT_ID;

      if (!projectId) {
        console.warn("[Push] EXPO_PUBLIC_PROJECT_ID não definido. Configure no .env ou app.json.");
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;
      console.log("[Push] Token obtido:", token);

      // Registrar no backend
      await this.saveTokenToBackend(token);
      return token;
    } catch (e) {
      console.warn("[Push] Falha ao obter token:", e);
      return null;
    }
  }

  private async saveTokenToBackend(token: string) {
    try {
      await api.patch("/users/me", { expoPushToken: token });
      console.log("[Push] Token registrado no backend.");
    } catch (e) {
      // Silencioso — o campo pode ainda não existir no backend
      console.warn("[Push] Falha ao registrar token no backend:", e);
    }
  }

  async clearTokenFromBackend() {
    try {
      await api.patch("/users/me", { expoPushToken: null });
    } catch {}
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  startListening() {
    // Notificação recebida com app em foreground
    this.foregroundSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[Push] Recebida em foreground:", notification.request.content);
      }
    );

    // Tap na notificação — navega para a tela correta
    this.responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as PushNotificationData;
        this.handleNotificationTap(data);
      }
    );
  }

  stopListening() {
    this.foregroundSubscription?.remove();
    this.responseSubscription?.remove();
    this.foregroundSubscription = null;
    this.responseSubscription   = null;
  }

  private handleNotificationTap(data: PushNotificationData) {
    if (!this.navigationRef?.current) return;
    const nav = this.navigationRef.current;

    switch (data.type) {
      case "like":
      case "comment":
        // Vai para o feed (a tela de post individual será Sprint 5+)
        nav.navigate?.("Main", { screen: "Tabs", params: { screen: "Feed" } });
        break;
      case "follow":
        if (data.username) {
          nav.navigate?.("Main", { screen: "UserProfile", params: { username: data.username } });
        }
        break;
      case "message":
        nav.navigate?.("Main", { screen: "Messages" });
        break;
      case "new_post":
        nav.navigate?.("Main", { screen: "Tabs", params: { screen: "Feed" } });
        break;
      default:
        nav.navigate?.("Main", { screen: "Tabs", params: { screen: "Notifications" } });
    }
  }

  // Limpar badge de notificações
  async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }
}

export const notificationsService = new NotificationsService();
