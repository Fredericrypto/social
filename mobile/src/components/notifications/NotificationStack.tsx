/**
 * NotificationStack v2
 *
 * Correções:
 * - Clique no CARD INTEIRO expande (sem seta separada)
 * - Ícone de tipo proporcional (preenchendo o espaço)
 * - Botão "Seguir de volta" APENAS na expansão individual ou grupos single-follow
 * - Suporte a uniqueActors e uniquePosts do helper v2
 */

import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
  Image, PanResponder, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../services/api";
import Avatar from "../../components/ui/Avatar";
import {
  NotificationGroup, RawNotification, NOTIF_CONFIG,
} from "../../utils/notificationHelpers";

interface Props {
  group:      NotificationGroup;
  onDelete:   (key: string) => void;
  onNavigate: (target: "profile" | "post", id: string) => void;
}

const SWIPE_THRESHOLD = -80;

export default function NotificationStack({ group, onDelete, onNavigate }: Props) {
  const { theme }  = useThemeStore();
  const { user }   = useAuthStore();

  const [expanded,       setExpanded]       = useState(false);
  const [followingIds,   setFollowingIds]   = useState<Set<string>>(new Set());
  const [loadingIds,     setLoadingIds]     = useState<Set<string>>(new Set());

  const translateX = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const cfg      = NOTIF_CONFIG[group.type] || NOTIF_CONFIG.like;
  const isFollow = group.type === "follow";
  const hasMany  = group.notifications.length > 1 || (group.uniqueActors?.length || 0) > 1;

  // ── Expand card inteiro ────────────────────────────────────────────────
  const toggleExpand = useCallback(() => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(expandAnim, {
      toValue, useNativeDriver: false, friction: 8, tension: 100,
    }).start();
    setExpanded(v => !v);
  }, [expanded, expandAnim]);

  // ── Swipe to delete ───────────────────────────────────────────────────
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -100));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < SWIPE_THRESHOLD) {
        Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      }
    },
  })).current;

  const closeSwipe = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();

  const confirmDelete = () => {
    closeSwipe();
    Alert.alert("Remover notificação?", undefined, [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => onDelete(group.key) },
    ]);
  };

  // ── Follow / Unfollow individual ──────────────────────────────────────
  const handleFollow = async (actorId: string) => {
    if (!actorId || loadingIds.has(actorId)) return;
    setLoadingIds(prev => new Set([...prev, actorId]));
    const isFollowing = followingIds.has(actorId);
    try {
      if (isFollowing) {
        await api.delete(`/follows/${actorId}`);
        setFollowingIds(prev => { const s = new Set(prev); s.delete(actorId); return s; });
      } else {
        await api.post(`/follows/${actorId}`);
        setFollowingIds(prev => new Set([...prev, actorId]));
      }
    } catch {}
    finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(actorId); return s; });
    }
  };

  // ── Altura animada da expansão ────────────────────────────────────────
  const itemH = 60;
  const contentH = (group.uniqueActors?.length || group.notifications.length) * itemH;
  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, contentH],
  });

  const timeAgo = formatDistanceToNow(new Date(group.latestAt), {
    addSuffix: true, locale: ptBR,
  });

  // ── Item individual expandido ─────────────────────────────────────────
  const renderActorRow = (actor: RawNotification["actor"], index: number) => {
    if (!actor) return null;
    const name      = actor.displayName || actor.username || "Alguém";
    const isMe      = actor.id === user?.id;
    const following = followingIds.has(actor.id || "");
    const loading   = loadingIds.has(actor.id || "");

    return (
      <View
        key={actor.id || index}
        style={[n.actorRow, { borderTopColor: theme.border }]}
      >
        <TouchableOpacity
          style={n.actorLeft}
          onPress={() => actor.username && onNavigate("profile", actor.username)}
          activeOpacity={0.8}
        >
          <Avatar uri={actor.avatarUrl} name={name} size={34} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[n.actorName, { color: theme.text }]} numberOfLines={1}>
              @{actor.username}
            </Text>
            {actor.displayName && (
              <Text style={[n.actorDisplayName, { color: theme.textSecondary }]} numberOfLines={1}>
                {actor.displayName}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Follow back — SÓ na expansão, SÓ se for follow */}
        {isFollow && !isMe && (
          <TouchableOpacity
            style={[
              n.followBtn,
              following
                ? { borderWidth: 1, borderColor: theme.border }
                : { backgroundColor: theme.primary },
            ]}
            onPress={() => actor.id && handleFollow(actor.id)}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator size="small" color={following ? theme.textSecondary : "#fff"} />
              : <Text style={[n.followBtnText, { color: following ? theme.textSecondary : "#fff" }]}>
                  {following ? "Seguindo" : "Seguir"}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render posts únicos (quando mesmo usuário curtiu vários) ──────────
  const renderPostRow = (post: RawNotification["post"], index: number) => {
    if (!post) return null;
    return (
      <TouchableOpacity
        key={post.id || index}
        style={[n.postRow, { borderTopColor: theme.border }]}
        onPress={() => post.id && onNavigate("post", post.id)}
        activeOpacity={0.8}
      >
        {post.mediaUrls?.[0] ? (
          <Image source={{ uri: post.mediaUrls[0] }} style={n.postThumb} />
        ) : (
          <View style={[n.postThumb, { backgroundColor: theme.surfaceHigh, alignItems: "center", justifyContent: "center" }]}>
            <Ionicons name="document-text-outline" size={16} color={theme.textTertiary} />
          </View>
        )}
        <Text style={[n.postCaption, { color: theme.textSecondary }]} numberOfLines={2}>
          {post.caption?.replace(/```[^`]*```/g, "[código]") || "Post sem legenda"}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
      </TouchableOpacity>
    );
  };

  // Decide o que mostrar na expansão
  const isSameActor  = (group.uniqueActors?.length || 0) === 1;
  const expandContent = isSameActor && !isFollow
    ? (group.uniquePosts || []).map(renderPostRow)
    : (group.uniqueActors || []).map(renderActorRow);

  return (
    <View style={n.wrapper}>
      {/* Botão delete atrás */}
      <View style={n.deleteBack}>
        <TouchableOpacity style={n.deleteBtn} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={n.deleteTxt}>Remover</Text>
        </TouchableOpacity>
      </View>

      {/* Card deslizável — clique no card inteiro expande */}
      <Animated.View
        style={[n.card, {
          backgroundColor: group.hasUnread ? theme.surface : theme.background,
          transform: [{ translateX }],
        }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={n.mainRow}
          onPress={hasMany ? toggleExpand : undefined}
          activeOpacity={hasMany ? 0.75 : 1}
          disabled={!hasMany}
        >
          {/* Avatar empilhado */}
          <TouchableOpacity
            style={n.avatarStack}
            onPress={() => {
              if (group.leadActor?.username) onNavigate("profile", group.leadActor.username);
            }}
            activeOpacity={0.8}
          >
            <Avatar
              uri={group.leadActor?.avatarUrl}
              name={group.leadActor?.displayName || group.leadActor?.username}
              size={46}
            />
            {/* Segundo avatar empilhado */}
            {(group.uniqueActors?.length || 0) > 1 && group.uniqueActors![1] && (
              <View style={n.secondAvatar}>
                <Avatar
                  uri={group.uniqueActors![1].avatarUrl}
                  name={group.uniqueActors![1].displayName}
                  size={24}
                />
              </View>
            )}
            {/* Ícone de tipo — proporcional */}
            <View style={[n.typeIcon, { backgroundColor: cfg.color }]}>
              <Ionicons name={cfg.icon as any} size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Texto */}
          <View style={n.content}>
            <Text style={[n.summary, { color: theme.text }]} numberOfLines={2}>
              {group.summary}
            </Text>
            <Text style={[n.time, { color: theme.textSecondary }]}>{timeAgo}</Text>
          </View>

          {/* Thumbnail do post (só navega se não for expandível) */}
          {group.post?.mediaUrls?.[0] && (
            <TouchableOpacity
              onPress={() => group.post?.id && onNavigate("post", group.post.id)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: group.post.mediaUrls[0] }} style={n.thumbnail} />
            </TouchableOpacity>
          )}

          {/* Dot não lido */}
          {group.hasUnread && (
            <View style={[n.unreadDot, { backgroundColor: theme.primary }]} />
          )}

          {/* Indicador expand (sutil — só chevron, sem botão separado) */}
          {hasMany && (
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={13}
              color={theme.textTertiary}
              style={{ marginLeft: 2 }}
            />
          )}
        </TouchableOpacity>

        {/* Conteúdo expandido */}
        {hasMany && (
          <Animated.View style={[n.expandedList, { maxHeight: expandedHeight, overflow: "hidden" }]}>
            {expandContent}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const n = StyleSheet.create({
  wrapper:    { overflow: "hidden" },
  deleteBack: { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  deleteBtn:  { alignItems: "center", gap: 4 },
  deleteTxt:  { color: "#fff", fontSize: 10, fontWeight: "600" },

  card:       { paddingHorizontal: 16, paddingVertical: 13 },
  mainRow:    { flexDirection: "row", alignItems: "center", gap: 12 },

  avatarStack:  { position: "relative", width: 50, height: 50 },
  secondAvatar: { position: "absolute", bottom: -6, right: -8, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  // Ícone proporcional — 20×20 com ícone 12px preenche bem
  typeIcon:   { position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  content:    { flex: 1, minWidth: 0 },
  summary:    { fontSize: 13, lineHeight: 19 },
  time:       { fontSize: 11, marginTop: 2 },

  thumbnail:  { width: 44, height: 44, borderRadius: 8 },
  unreadDot:  { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },

  expandedList: {},

  // Rows na expansão
  actorRow:        { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth },
  actorLeft:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  actorName:       { fontSize: 13, fontWeight: "600" },
  actorDisplayName:{ fontSize: 11, marginTop: 1 },

  followBtn:     { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, minWidth: 80, alignItems: "center" },
  followBtnText: { fontSize: 12, fontWeight: "700" },

  postRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth },
  postThumb:  { width: 42, height: 42, borderRadius: 8 },
  postCaption:{ flex: 1, fontSize: 12, lineHeight: 17 },
});
