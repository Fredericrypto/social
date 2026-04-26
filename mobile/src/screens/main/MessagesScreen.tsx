import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl, Animated, Pressable,
  PanResponder, Dimensions, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../services/api";
import { socketService } from "../../services/socket.service";
import { PresenceStatus } from "../../services/presence.service";
import Avatar from "../../components/ui/Avatar";

const { width: SW } = Dimensions.get("window");
const DELETE_THRESHOLD = -75;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMsgTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, "HH:mm");
  if (isYesterday(d)) return "Ontem";
  return format(d, "dd/MM/yy");
}

function getPreview(conv: any, myId: string): string {
  const msg = conv.lastMessage;
  if (!msg) return "Toque para ver a conversa";
  const isMine = msg.senderId === myId;
  const prefix = isMine ? "Você: " : "";
  if (msg.imageUrl && !msg.content) return `${prefix}📷 Foto`;
  if (msg.imageUrl && msg.content)  return `${prefix}📷 ${msg.content}`;
  return `${prefix}${msg.content}`;
}

// ─── Glow Slate Button (padrão do app) ───────────────────────────────────────
const GlowBtn = ({ onPress, icon, isDark }: { onPress: () => void; icon: string; isDark: boolean }) => (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      onPress();
    }}
    style={s.glowWrap}
  >
    <LinearGradient
      colors={["#475569", "#94A3B8", "#64748B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={[s.glowInner, { backgroundColor: isDark ? "#0D1018" : "#F9F8F6" }]}>
      <Ionicons name={icon as any} size={20} color={isDark ? "#F8FAFC" : "#0F172A"} />
    </View>
  </TouchableOpacity>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ color }: { color: string }) => {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ opacity: pulse, flexDirection: "row", gap: 14, alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 10 }}>
        <View style={{ width: "40%", height: 12, borderRadius: 6, backgroundColor: color }} />
        <View style={{ width: "75%", height: 11, borderRadius: 6, backgroundColor: color }} />
      </View>
    </Animated.View>
  );
};

// ─── SwipeableConvRow ─────────────────────────────────────────────────────────
function SwipeableConvRow({ item, other, myId, theme, isDark, onPress, onDelete, presenceMap }: any) {
  const translateX  = useRef(new Animated.Value(0)).current;
  const swiped      = useRef(false);
  const hasUnread   = (item.unreadCount ?? 0) > 0;
  const preview     = getPreview(item, myId);
  const timeStr     = item.lastMessageAt ? formatMsgTime(item.lastMessageAt) : "";
  const presence: PresenceStatus | null = other?.id ? (presenceMap[other.id] ?? null) : null;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 10 && Math.abs(g.dy) < 15 && g.dx < 0,
    onPanResponderGrant: () => { swiped.current = false; },
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) {
        translateX.setValue(Math.max(g.dx, -90));
        if (g.dx < DELETE_THRESHOLD) swiped.current = true;
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < DELETE_THRESHOLD) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
        swiped.current = false;
      }
    },
  })).current;

  const closeSwipe = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
    swiped.current = false;
  };

  const handlePress = () => {
    // Se está swipado, fechar em vez de abrir o chat
    if (swiped.current) { closeSwipe(); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress(item, other);
  };

  return (
    <View style={{ overflow: "hidden" }}>
      {/* Ação de deletar — atrás */}
      <View style={cr.deleteSlot}>
        <TouchableOpacity
          style={cr.deleteBtn}
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
            closeSwipe();
            onDelete(item);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={cr.deleteTxt}>Apagar</Text>
        </TouchableOpacity>
      </View>

      {/* Row deslizável */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          style={[cr.row, { backgroundColor: theme.background, borderBottomColor: theme.border }]}
          onPress={handlePress}
          android_ripple={{ color: theme.surfaceHigh }}
        >
          <Avatar
            uri={other?.avatarUrl}
            name={other?.displayName || other?.username}
            size={54}
            presenceStatus={presence}
          />

          <View style={cr.info}>
            <View style={cr.top}>
              <Text style={[cr.name, { color: theme.text }]} numberOfLines={1}>
                {other?.displayName || other?.username || "Usuário"}
              </Text>
              <Text style={[cr.time, { color: hasUnread ? theme.primary : theme.textSecondary }]}>
                {timeStr}
              </Text>
            </View>
            <View style={cr.bottom}>
              <Text
                style={[
                  cr.preview,
                  {
                    color:      hasUnread ? theme.text : theme.textSecondary,
                    fontWeight: hasUnread ? "600"   : "400",
                  },
                ]}
                numberOfLines={1}
              >
                {preview}
              </Text>
              {hasUnread && (
                <View style={[cr.badge, { backgroundColor: theme.primary }]}>
                  <Text style={cr.badgeTxt}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const cr = StyleSheet.create({
  deleteSlot: { position: "absolute", right: 0, top: 0, bottom: 0, width: 80, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  deleteBtn:  { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", gap: 4 },
  deleteTxt:  { color: "#fff", fontSize: 11, fontWeight: "700" },
  row:        { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 13, gap: 13, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  info:       { flex: 1, minWidth: 0 },
  top:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  name:       { fontSize: 16, fontWeight: "700", flex: 1, letterSpacing: -0.3 },
  time:       { fontSize: 12, marginLeft: 8, flexShrink: 0 },
  bottom:     { flexDirection: "row", alignItems: "center", gap: 8 },
  preview:    { flex: 1, fontSize: 14, lineHeight: 20 },
  badge:      { minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeTxt:   { color: "#fff", fontSize: 11, fontWeight: "800" },
});

// ─── Modal de Confirmação de Delete ──────────────────────────────────────────
function DeleteModal({ visible, conv, other, onConfirm, onCancel, theme }: any) {
  if (!visible) return null;
  return (
    <View style={dm.overlay}>
      <View style={[dm.box, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[dm.iconWrap, { backgroundColor: "#EF444420" }]}>
          <Ionicons name="trash-outline" size={24} color="#EF4444" />
        </View>
        <Text style={[dm.title, { color: theme.text }]}>Apagar conversa</Text>
        <Text style={[dm.sub, { color: theme.textSecondary }]}>
          Esta ação remove a conversa com{" "}
          <Text style={{ fontWeight: "700", color: theme.text }}>
            {other?.displayName || other?.username}
          </Text>{" "}
          apenas para você. As mensagens não poderão ser recuperadas.
        </Text>
        <View style={dm.actions}>
          <TouchableOpacity
            style={[dm.btn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={[dm.btnTxt, { color: theme.textSecondary }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dm.btn, { backgroundColor: "#EF4444", borderColor: "#EF4444" }]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <Text style={[dm.btnTxt, { color: "#fff" }]}>Apagar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const dm = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", zIndex: 999, paddingHorizontal: 24 },
  box:     { width: "100%", borderRadius: 20, borderWidth: 1, padding: 24, gap: 12 },
  iconWrap:{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title:   { fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  sub:     { fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  btn:     { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  btnTxt:  { fontSize: 15, fontWeight: "700" },
});

// ─── MessagesScreen ───────────────────────────────────────────────────────────
export default function MessagesScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const { user }          = useAuthStore();
  const insets            = useSafeAreaInsets();

  const [conversations, setConversations] = useState<any[]>([]);
  const [filtered,      setFiltered]      = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [presenceMap,   setPresenceMap]   = useState<Record<string, PresenceStatus>>({});
  const [search,        setSearch]        = useState("");
  const [searching,     setSearching]     = useState(false);

  // Modal delete
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // ── Carregar conversas ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/messages/conversations");
      const convs: any[] = Array.isArray(data) ? data : [];
      setConversations(convs);
      setFiltered(convs);

      const otherIds = convs
        .map((c: any) => c.participantAId === user?.id ? c.participantB?.id : c.participantA?.id)
        .filter(Boolean);

      if (otherIds.length > 0) {
        try {
          const { data: presences } = await api.get("/users/presence", {
            params: { ids: otherIds.join(",") },
          });
          if (Array.isArray(presences)) {
            const map: Record<string, PresenceStatus> = {};
            presences.forEach((p: any) => { if (p.userId) map[p.userId] = p.status; });
            setPresenceMap(map);
          }
        } catch {}
      }
    } catch {
      setConversations([]);
      setFiltered([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Socket — tempo real ────────────────────────────────────────────────
  useEffect(() => {
    const socket = socketService.connect();
    if (!socket) return;

    // Presença
    const onPresence = ({ userId, status }: { userId: string; status: PresenceStatus }) => {
      setPresenceMap(prev => ({ ...prev, [userId]: status }));
    };
    socket.on("presence:update", onPresence);

    // Nova mensagem → subir conversa para o topo e atualizar preview
    const onNewMsg = (msg: any) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === msg.conversationId);
        if (idx < 0) { load(); return prev; }
        const conv = { ...prev[idx], lastMessage: msg, lastMessageAt: msg.createdAt };
        // Incrementar unread se a mensagem não é minha
        if (msg.senderId !== user?.id) {
          conv.unreadCount = (conv.unreadCount ?? 0) + 1;
        }
        const next = [conv, ...prev.filter((_, i) => i !== idx)];
        return next;
      });
    };
    socketService.onNewMessage(onNewMsg);

    // Mensagens lidas → zerar badge
    const onRead = ({ conversationId }: { conversationId: string }) => {
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c)
      );
    };
    socket.on("messages_read", onRead);

    return () => {
      socket.off("presence:update", onPresence);
      socket.off("messages_read", onRead);
      // onNewMessage cleanup não tem off direto no service — recarregar ao focus resolve
    };
  }, [load, user?.id]);

  // ── Sincronizar filtered com conversations ─────────────────────────────
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(conversations);
    } else {
      const q = search.toLowerCase();
      setFiltered(conversations.filter(c => {
        const other = c.participantAId === user?.id ? c.participantB : c.participantA;
        return (
          other?.displayName?.toLowerCase().includes(q) ||
          other?.username?.toLowerCase().includes(q)
        );
      }));
    }
  }, [search, conversations, user?.id]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const getOther = (conv: any) =>
    conv.participantAId === user?.id ? conv.participantB : conv.participantA;

  const handleOpen = (conv: any, other: any) => {
    navigation.navigate("Chat", { conversation: conv, other });
  };

  const handleDeleteRequest = (conv: any) => {
    setDeleteTarget(conv);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const conv = deleteTarget;
    setDeleteTarget(null);
    // Otimista
    setConversations(prev => prev.filter(c => c.id !== conv.id));
    try {
      await api.delete(`/messages/conversations/${conv.id}/clear`);
    } catch {
      load(); // reverter se falhar
    }
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.("Tabs", { screen: "Profile" });
  };

  const toggleSearch = () => {
    setSearching(s => !s);
    setSearch("");
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <GlowBtn icon="chevron-back" isDark={isDark} onPress={handleBack} />
        <Text style={[s.title, { color: theme.text }]}>Mensagens</Text>
        <GlowBtn icon={searching ? "close" : "search"} isDark={isDark} onPress={toggleSearch} />
      </View>

      {/* Barra de busca */}
      {searching && (
        <View style={[s.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: theme.text }]}
            placeholder="Buscar conversa..."
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ paddingTop: 8 }}>
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} color={theme.surfaceHigh} />)}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={theme.primary}
            />
          }
          renderItem={({ item }) => {
            const other = getOther(item);
            return (
              <SwipeableConvRow
                item={item}
                other={other}
                myId={user?.id}
                theme={theme}
                isDark={isDark}
                onPress={handleOpen}
                onDelete={handleDeleteRequest}
                presenceMap={presenceMap}
              />
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name="paper-plane-outline" size={32} color={theme.primaryLight} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>
                {search ? "Nenhum resultado" : "Sem mensagens"}
              </Text>
              <Text style={[s.emptySub, { color: theme.textSecondary }]}>
                {search ? `Nada encontrado para "${search}"` : "Inicie uma conversa pelo perfil de alguém"}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: insets.bottom + 80 }}
        />
      )}

      {/* Modal de confirmação de delete */}
      <DeleteModal
        visible={!!deleteTarget}
        conv={deleteTarget}
        other={deleteTarget ? getOther(deleteTarget) : null}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        theme={theme}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:       { fontSize: 19, fontWeight: "800", letterSpacing: -0.4 },
  glowWrap:    { width: 36, height: 36, borderRadius: 10, overflow: "hidden" },
  glowInner:   { margin: 1.5, borderRadius: 8.5, flex: 1, alignItems: "center", justifyContent: "center" },
  searchBar:   { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 14, height: 42, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingBottom: 80 },
  emptyIcon:   { width: 76, height: 76, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  emptyTitle:  { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  emptySub:    { fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 32, opacity: 0.7 },
});
