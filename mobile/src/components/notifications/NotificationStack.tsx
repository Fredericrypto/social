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
import Avatar from "../../components/ui/Avatar";
import FollowButton from "../../components/ui/FollowButton";
import { useFollowStore } from "../../store/follow.store";
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
  const { theme }   = useThemeStore();
  const { user }    = useAuthStore();
  const followStore = useFollowStore();

  const [expanded, setExpanded] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const cfg      = NOTIF_CONFIG[group.type] || NOTIF_CONFIG.like;
  const isFollow = group.type === "follow";
  const hasMany  = group.notifications.length > 1 || (group.uniqueActors?.length || 0) > 1;

  // Para notificação de follow single — inicializa o estado no store
  const singleActor = !hasMany ? (group.uniqueActors?.[0] || group.leadActor) : null;

  // ── Expand ────────────────────────────────────────────────────────────
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

  // ── Altura animada da expansão (estilo Instagram) ─────────────────────
  const actors    = group.uniqueActors || [];
  const posts     = group.uniquePosts  || [];
  const isSameActor = actors.length === 1 && !isFollow;
  const expandItems = isSameActor ? posts : actors;
  const itemH     = 64;
  const contentH  = Math.max(expandItems.length, 1) * itemH + 8;

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1], outputRange: [0, contentH],
  });

  const timeAgo = formatDistanceToNow(new Date(group.latestAt), {
    addSuffix: true, locale: ptBR,
  });

  // ── Row de ator na expansão — estilo Instagram ────────────────────────
  const renderActorRow = (actor: RawNotification["actor"], index: number) => {
    if (!actor) return null;
    const isMe = actor.id === user?.id;
    const isFollowing = followStore.states[actor.id ?? ""] ?? false;

    return (
      <View key={actor.id || index} style={[n.actorRow, { borderTopColor: theme.border }]}>
        <TouchableOpacity
          style={n.actorLeft}
          onPress={() => actor.username && onNavigate("profile", actor.username)}
          activeOpacity={0.8}
        >
          <Avatar
            uri={actor.avatarUrl}
            name={actor.displayName || actor.username}
            size={40}
            presenceStatus={(actor as any)?.presenceStatus ?? null}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[n.actorName, { color: theme.text }]} numberOfLines={1}>
              {actor.displayName || actor.username}
            </Text>
            <Text style={[n.actorHandle, { color: theme.textSecondary }]} numberOfLines={1}>
              @{actor.username}
            </Text>
          </View>
        </TouchableOpacity>

        {isFollow && !isMe && actor.id && (
          <FollowButton
            isFollowing={isFollowing}
            onPress={() => followStore.toggle(actor.id!)}
            size="sm"
          />
        )}
      </View>
    );
  };

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

  const expandContent = isSameActor
    ? posts.map(renderPostRow)
    : actors.map(renderActorRow);

  // Follow single — mostra botão diretamente no card principal
  const showInlineFollow = isFollow && !hasMany && singleActor && singleActor.id !== user?.id;
  const inlineIsFollowing = followStore.states[singleActor?.id ?? ""] ?? false;

  return (
    <View style={n.wrapper}>
      {/* Delete atrás */}
      <View style={n.deleteBack}>
        <TouchableOpacity style={n.deleteBtn} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={n.deleteTxt}>Remover</Text>
        </TouchableOpacity>
      </View>

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
          {/* Avatar stack */}
          <TouchableOpacity
            style={n.avatarStack}
            onPress={() => group.leadActor?.username && onNavigate("profile", group.leadActor.username)}
            activeOpacity={0.8}
          >
            <Avatar
              uri={group.leadActor?.avatarUrl}
              name={group.leadActor?.displayName || group.leadActor?.username}
              size={46}
            />
            {(group.uniqueActors?.length || 0) > 1 && group.uniqueActors![1] && (
              <View style={n.secondAvatar}>
                <Avatar
                  uri={group.uniqueActors![1].avatarUrl}
                  name={group.uniqueActors![1].displayName}
                  size={24}
                />
              </View>
            )}
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

          {/* Post thumbnail */}
          {group.post?.mediaUrls?.[0] && !showInlineFollow && (
            <TouchableOpacity
              onPress={() => group.post?.id && onNavigate("post", group.post.id)}
              activeOpacity={0.8}
            >
              <Image source={{ uri: group.post.mediaUrls[0] }} style={n.thumbnail} />
            </TouchableOpacity>
          )}

          {/* Dot não lido */}
          {group.hasUnread && !showInlineFollow && (
            <View style={[n.unreadDot, { backgroundColor: theme.primary }]} />
          )}

          {/* Botão seguir inline — follow single */}
          {showInlineFollow && (
            <FollowButton
              isFollowing={inlineIsFollowing}
              onPress={() => followStore.toggle(singleActor!.id!)}
              size="sm"
            />
          )}

          {/* Chevron expand */}
          {hasMany && (
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={13}
              color={theme.textTertiary}
              style={{ marginLeft: 2 }}
            />
          )}
        </TouchableOpacity>

        {/* Cascata expandida — estilo Instagram */}
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

  card:     { paddingHorizontal: 16, paddingVertical: 13 },
  mainRow:  { flexDirection: "row", alignItems: "center", gap: 12 },

  avatarStack:  { position: "relative", width: 50, height: 50 },
  secondAvatar: { position: "absolute", bottom: -6, right: -8, borderRadius: 12, borderWidth: 2, borderColor: "transparent" },
  typeIcon:     { position: "absolute", bottom: -1, right: -1, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  content:  { flex: 1, minWidth: 0 },
  summary:  { fontSize: 13, lineHeight: 19 },
  time:     { fontSize: 11, marginTop: 2 },

  thumbnail:  { width: 44, height: 44, borderRadius: 8 },
  unreadDot:  { width: 7, height: 7, borderRadius: 4, marginLeft: 2 },

  expandedList: {},

  // Rows na cascata
  actorRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actorLeft:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  actorName:   { fontSize: 13, fontWeight: "600" },
  actorHandle: { fontSize: 11, marginTop: 1 },

  postRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 6, borderTopWidth: StyleSheet.hairlineWidth },
  postThumb:  { width: 42, height: 42, borderRadius: 8 },
  postCaption:{ flex: 1, fontSize: 12, lineHeight: 17 },
});
