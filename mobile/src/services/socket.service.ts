/**
 * socket.service.ts
 *
 * Singleton Socket.io que gerencia:
 *  - Conexão autenticada (JWT no handshake)
 *  - Feed real-time: novos posts, likes, comentários
 *  - Mensagens: já usado pelo ChatScreen — mantém compatibilidade
 *  - Reconexão automática com backoff exponencial
 *  - Limpeza ao fazer logout
 */

import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/auth.store";

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || "https://social-production-8e37.up.railway.app/messages";

// ─── Tipos de eventos do feed ─────────────────────────────────────────────────
export interface FeedNewPostEvent {
  post: {
    id:         string;
    caption:    string;
    postType:   string;
    mediaUrls:  string[];
    likesCount: number;
    createdAt:  string;
    author: {
      id:          string;
      username:    string;
      displayName: string;
      avatarUrl:   string;
    };
  };
}

export interface FeedLikeEvent {
  postId:     string;
  likesCount: number;
  liked:      boolean;   // true = alguém curtiu, false = descurtiu
}

export interface FeedCommentEvent {
  postId:        string;
  commentsCount: number;
}

// ─── Singleton ────────────────────────────────────────────────────────────────
class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;

  connect(): Socket | null {
    if (this.socket?.connected) return this.socket;

    const token = useAuthStore.getState().token;
    if (!token) return null;

    this.socket = io(SOCKET_URL, {
      auth:             { token },
      transports:       ["websocket"],
      reconnection:     true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 16000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout:          10000,
    });

    this.socket.on("connect", () => {
      console.log("[Socket] Conectado:", this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[Socket] Desconectado:", reason);
    });

    this.socket.on("connect_error", (err) => {
      this.reconnectAttempts++;
      console.warn(`[Socket] Erro de conexão (${this.reconnectAttempts}/${this.maxReconnectAttempts}):`, err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // ── Helpers de subscrição tipada ──────────────────────────────────────────

  onFeedNewPost(handler: (e: FeedNewPostEvent) => void) {
    this.socket?.on("feed:new_post", handler);
    return () => this.socket?.off("feed:new_post", handler);
  }

  onFeedLike(handler: (e: FeedLikeEvent) => void) {
    this.socket?.on("feed:like", handler);
    return () => this.socket?.off("feed:like", handler);
  }

  onFeedComment(handler: (e: FeedCommentEvent) => void) {
    this.socket?.on("feed:comment", handler);
    return () => this.socket?.off("feed:comment", handler);
  }

  // Mantém compatibilidade com ChatScreen existente
  onNewMessage(handler: (msg: any) => void) {
    this.socket?.on("new_message", handler);
    return () => this.socket?.off("new_message", handler);
  }

  emitJoinRoom(conversationId: string) {
    this.socket?.emit("join_room", { conversationId });
  }

  emitLeaveRoom(conversationId: string) {
    this.socket?.emit("leave_room", { conversationId });
  }

  emitSendMessage(payload: { conversationId: string; content: string }) {
    this.socket?.emit("send_message", payload);
  }
}

export const socketService = new SocketService();
