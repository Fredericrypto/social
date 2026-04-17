/**
 * useFeedSocket.ts
 *
 * Hook que conecta o FeedScreen ao Socket.io para atualizações real-time.
 *
 * USO no FeedScreen:
 *
 *   const { isConnected } = useFeedSocket({
 *     onNewPost:  (post) => setPosts(prev => [post, ...prev]),
 *     onLike:     ({ postId, likesCount }) =>
 *                   setPosts(prev => prev.map(p =>
 *                     p.id === postId ? { ...p, likesCount } : p)),
 *     onComment:  ({ postId, commentsCount }) =>
 *                   setPosts(prev => prev.map(p =>
 *                     p.id === postId ? { ...p, commentsCount } : p)),
 *   });
 *
 * O hook:
 *  - Conecta o socket na montagem, desconecta na desmontagem
 *  - Só se subscreve nos eventos enquanto o componente está montado
 *  - Expõe `isConnected` para exibir indicador visual opcional
 */

import { useEffect, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { socketService, FeedNewPostEvent, FeedLikeEvent, FeedCommentEvent } from "../services/socket.service";

interface UseFeedSocketOptions {
  onNewPost?:  (post: FeedNewPostEvent["post"]) => void;
  onLike?:     (e: FeedLikeEvent) => void;
  onComment?:  (e: FeedCommentEvent) => void;
  enabled?:    boolean; // padrão true — permite desativar em telas de teste
}

export function useFeedSocket({
  onNewPost,
  onLike,
  onComment,
  enabled = true,
}: UseFeedSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (!enabled) return;
    const socket = socketService.connect();
    if (!socket) return;

    setIsConnected(socket.connected);

    // Listeners de estado
    const onConnect    = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on("connect",    onConnect);
    socket.on("disconnect", onDisconnect);

    // Listeners de feed
    const unsubPost    = onNewPost
      ? socketService.onFeedNewPost(e => onNewPost(e.post))
      : null;
    const unsubLike    = onLike    ? socketService.onFeedLike(onLike)       : null;
    const unsubComment = onComment ? socketService.onFeedComment(onComment) : null;

    return () => {
      socket.off("connect",    onConnect);
      socket.off("disconnect", onDisconnect);
      unsubPost?.();
      unsubLike?.();
      unsubComment?.();
    };
  }, [enabled, onNewPost, onLike, onComment]);

  // Conecta/desconecta com o ciclo de vida do componente
  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      // Não desconecta o socket global aqui — outros hooks podem usar
      // O socket só é desconectado no logout (auth.store)
    };
  }, [connect]);

  // Reconecta quando app volta ao foreground
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active" && !socketService.isConnected()) {
        connect();
      }
    });
    return () => sub.remove();
  }, [enabled, connect]);

  return { isConnected };
}
