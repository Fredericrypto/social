/**
 * NotificationStack.tsx
 *
 * Card de grupo de notificações com:
 * - Expand/collapse suave dos itens individuais
 * - Swipe to delete (PanResponder)
 * - Botão "Seguir de volta" inline para grupos de follow
 * - Navegação inteligente: avatar → perfil, thumbnail → post
 * - Badge de não lido na cor do tema
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
  group:     NotificationGroup;
  onDelete:  (key: string) => void;
  onNavigate:(target: "profile" | "post", id: string) => void;
}

const SWIPE_DELETE_THRESHOLD = -80;

export default function NotificationStack({ group, onDelete, onNavigate }: Props) {
  const { theme }  = useThemeStore();
  const { user }   = useAuthStore();

  const [expanded,      setExpanded]      = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing,   setIsFollowing]   = useState(false);

  // Swipe
  const translateX = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const cfg = NOTIF_CONFIG[group.type] || NOTIF_CONFIG.like;
  const isFollow  = group.type === "follow";
  const hasMany   = group.notifications.length > 1;

  // ── Expand / Collapse ─────────────────────────────────────────────────
  const toggleExpand = useCallback(() => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(expandAnim, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 100,
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
      if (g.dx < SWIPE_DELETE_THRESHOLD) {
        Animated.spring(translateX, {
          toValue: -80, useNativeDriver: true,
        }).start();
      } else {
        Animated.spring(translateX, {
          toValue: 0, useNativeDriver: true, friction: 6,
        }).start();
      }
    },
  })).current;

  const closeSwipe = () =>
    Animated.spring(translateX, {
      toValue: 0, useNativeDriver: true, friction: 6,
    }).start();

  const confirmDelete = () => {
    closeSwipe();
    Alert.alert("Remover notificação", "Deseja remover este grupo de notificações?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => onDelete(group.key) },
    ]);
  };

  // ── Follow back ────────────────────────────────────────────────────────
  const handleFollowBack = async () => {
    if (!group.leadActor?.id || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.delete(`/follows/${group.leadActor.id}`);
        setIsFollowing(false);
      } else {
        await api.post(`/follows/${group.leadActor.id}`);
        setIsFollowing(true);
      }
    } catch {}
    finally { setFollowLoading(false); }
  };

  // ── Altura animada dos itens expandidos ───────────────────────────────
  const itemHeight = 56; // altura estimada por item
  const expandedHeight = expandAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, group.notifications.length * itemHeight],
  });

  const timeAgo = formatDistanceToNow(new Date(group.latestAt), {
    addSuffix: true, locale: ptBR,
  });

  // ── Render item individual (quando expandido) ─────────────────────────
  const renderIndividual = (item: RawNotification) => {
    const name = item.actor?.displayName || item.actor?.username || "Alguém";
    return (
      <View key={item.id} style={[n.individualRow, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => item.actor?.id && onNavigate("profile", item.actor.username || "")}
          activeOpacity={0.8}
        >
          <Avatar
            uri={item.actor?.avatarUrl}
            name={name}
            size={32}
          />
        </TouchableOpacity>
        <Text style={[n.individualText, { color: theme.textSecondary }]} numberOfLines={1}>
          <Text style={{ fontWeight: "600", color: theme.text }}>@{item.actor?.username}</Text>
          {" · "}
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
        </Text>
        {!item.isRead && (
          <View style={[n.dot, { backgroundColor: theme.primary }]} />
        )}
      </View>
    );
  };

  return (
    <View style={n.wrapper}>
      {/* Botão de delete atrás do card */}
      <View style={n.deleteBack}>
        <TouchableOpacity style={n.deleteBtn} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={n.deleteTxt}>Remover</Text>
        </TouchableOpacity>
      </View>

      {/* Card deslizável */}
      <Animated.View
        style={[n.card, {
          backgroundColor: group.hasUnread ? theme.surface : theme.background,
          transform: [{ translateX }],
        }]}
        {...panResponder.panHandlers}
      >
        {/* Linha principal */}
        <View style={n.mainRow}>

          {/* Avatar empilhado (mostra até 2 avatares) */}
          <TouchableOpacity
            style={n.avatarStack}
            onPress={() => group.leadActor && onNavigate("profile", group.leadActor.username || "")}
            activeOpacity={0.8}
          >
            <Avatar
              uri={group.leadActor?.avatarUrl}
              name={group.leadActor?.displayName || group.leadActor?.username}
              size={46}
            />
            {group.notifications.length > 1 && group.notifications[1]?.actor && (
              <View style={n.secondAvatar}>
                <Avatar
                  uri={group.notifications[1].actor?.avatarUrl}
                  name={group.notifications[1].actor?.displayName}
                  size={26}
                />
              </View>
            )}
            {/* Badge de tipo */}
            <View style={[n.typeIcon, { backgroundColor: cfg.color }]}>
              <Ionicons name={cfg.icon as any} size={9} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Texto */}
          <View style={n.content}>
            <Text style={[n.summary, { color: theme.text }]} numberOfLines={2}>
              {group.summary}
            </Text>
            <Text style={[n.time, { color: theme.textSecondary }]}>{timeAgo}</Text>
          </View>

          {/* Thumbnail do post */}
          {group.post?.mediaUrls?.[0] && (
            <TouchableOpacity
              onPress={() => group.post?.id && onNavigate("post", group.post.id)}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: group.post.mediaUrls[0] }}
                style={n.thumbnail}
              />
            </TouchableOpacity>
          )}

          {/* Botão seguir de volta (só em grupos de follow) */}
          {isFollow && !isFollowing && group.leadActor?.id !== user?.id && (
            <TouchableOpacity
              style={[n.followBackBtn, { backgroundColor: theme.primary }]}
              onPress={handleFollowBack}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={n.followBackText}>Seguir</Text>
              }
            </TouchableOpacity>
          )}

          {isFollow && isFollowing && (
            <TouchableOpacity
              style={[n.followBackBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border }]}
              onPress={handleFollowBack}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              <Text style={[n.followBackText, { color: theme.textSecondary }]}>Seguindo</Text>
            </TouchableOpacity>
          )}

          {/* Indicador de não lido */}
          {group.hasUnread && (
            <View style={[n.unreadDot, { backgroundColor: theme.primary }]} />
          )}

          {/* Seta de expandir (grupos com mais de 1 item) */}
          {hasMany && (
            <TouchableOpacity onPress={toggleExpand} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={14}
                color={theme.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Items expandidos */}
        {hasMany && (
          <Animated.View style={[n.expandedList, { maxHeight: expandedHeight, overflow: "hidden" }]}>
            {group.notifications.map(renderIndividual)}
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const n = StyleSheet.create({
  wrapper:      { overflow: "hidden" },
  deleteBack:   { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  deleteBtn:    { alignItems: "center", gap: 4 },
  deleteTxt:    { color: "#fff", fontSize: 10, fontWeight: "600" },

  card:         { paddingHorizontal: 16, paddingVertical: 12 },
  mainRow:      { flexDirection: "row", alignItems: "center", gap: 12 },

  avatarStack:  { position: "relative", width: 48, height: 48 },
  secondAvatar: { position: "absolute", bottom: -4, right: -8, borderRadius: 13, borderWidth: 2, borderColor: "transparent" },
  typeIcon:     { position: "absolute", bottom: -2, right: -2, width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center" },

  content:      { flex: 1, minWidth: 0 },
  summary:      { fontSize: 13, lineHeight: 19 },
  time:         { fontSize: 11, marginTop: 2 },

  thumbnail:    { width: 44, height: 44, borderRadius: 8 },

  followBackBtn:{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, minWidth: 72, alignItems: "center" },
  followBackText:{ fontSize: 12, fontWeight: "700", color: "#fff" },

  unreadDot:    { width: 7, height: 7, borderRadius: 4, marginLeft: 4 },
  dot:          { width: 6, height: 6, borderRadius: 3 },

  expandedList: {},
  individualRow:{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: StyleSheet.hairlineWidth },
  individualText:{ flex: 1, fontSize: 12 },
});
