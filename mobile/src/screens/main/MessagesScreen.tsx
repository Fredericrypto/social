import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl, Animated, Alert,
  PanResponder, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../services/api";
import Avatar from "../../components/ui/Avatar";

const { width: SW } = Dimensions.get("window");
const DELETE_THRESHOLD = -80;

// ─── SwipeableConvRow ─────────────────────────────────────────────────────────
function SwipeableConvRow({
  item, other, theme, onPress, onDelete,
}: any) {
  const translateX = useRef(new Animated.Value(0)).current;
  const lastMsg    = item.lastMessage;
  const timeAgo    = item.lastMessageAt
    ? formatDistanceToNow(new Date(item.lastMessageAt), { locale: ptBR, addSuffix: false })
    : null;
  const hasUnread  = (item.unreadCount ?? 0) > 0;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 20,
    onPanResponderMove: (_, g) => {
      if (g.dx < 0) translateX.setValue(Math.max(g.dx, -100));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < DELETE_THRESHOLD) {
        // Reveal delete
        Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      }
    },
  })).current;

  const closeSwipe = () =>
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();

  return (
    <View style={cr.wrapper}>
      {/* Delete action behind */}
      <View style={cr.deleteAction}>
        <TouchableOpacity
          style={cr.deleteBtn}
          onPress={() => { closeSwipe(); onDelete(item); }}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={cr.deleteTxt}>Apagar</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[cr.row, { backgroundColor: theme.background, borderBottomColor: theme.border }]}
          onPress={() => { closeSwipe(); onPress(item, other); }}
          activeOpacity={0.8}
        >
          <View style={{ position: "relative" }}>
            <Avatar uri={other?.avatarUrl} name={other?.displayName || other?.username} size={52} />
          </View>

          <View style={cr.info}>
            <View style={cr.top}>
              <Text style={[cr.name, { color: theme.text }]} numberOfLines={1}>
                {other?.displayName || other?.username || "Usuário"}
              </Text>
              {timeAgo && (
                <Text style={[cr.time, { color: theme.textSecondary }]}>{timeAgo}</Text>
              )}
            </View>
            <View style={cr.bottom}>
              <Text
                style={[cr.preview, { color: hasUnread ? theme.text : theme.textSecondary, fontWeight: hasUnread ? "600" : "400" }]}
                numberOfLines={1}
              >
                {lastMsg?.content || "Toque para ver a conversa"}
              </Text>
              {hasUnread && (
                <View style={[cr.badge, { backgroundColor: theme.primary }]}>
                  <Text style={cr.badgeTxt}>{item.unreadCount > 9 ? "9+" : item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const cr = StyleSheet.create({
  wrapper:     { overflow: "hidden" },
  deleteAction:{ position: "absolute", right: 0, top: 0, bottom: 0, width: 80, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  deleteBtn:   { alignItems: "center", gap: 4 },
  deleteTxt:   { color: "#fff", fontSize: 11, fontWeight: "600" },
  row:         { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 12, alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  info:        { flex: 1, minWidth: 0 },
  top:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  name:        { fontSize: 15, fontWeight: "600", flex: 1 },
  time:        { fontSize: 11, marginLeft: 8 },
  bottom:      { flexDirection: "row", alignItems: "center", gap: 8 },
  preview:     { flex: 1, fontSize: 13, lineHeight: 18 },
  badge:       { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeTxt:    { color: "#fff", fontSize: 10, fontWeight: "700" },
});

// ─── MessagesScreen ───────────────────────────────────────────────────────────
export default function MessagesScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const { user }          = useAuthStore();
  const insets            = useSafeAreaInsets();

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/messages/conversations");
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recarrega sempre que a tela ganha foco (volta do chat)
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const getOther = (conv: any) =>
    conv.participantAId === user?.id ? conv.participantB : conv.participantA;

  const handleOpen = (conv: any, other: any) => {
    navigation.navigate("Chat", { conversation: conv, other });
  };

  const handleDelete = (conv: any) => {
    Alert.alert(
      "Apagar conversa",
      "Esta ação remove a conversa apenas para você.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            setConversations(prev => prev.filter(c => c.id !== conv.id));
            try {
              await api.delete(`/messages/conversations/${conv.id}`);
            } catch {
              // Reverter se falhar
              load();
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.("Tabs", { screen: "Profile" });
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[s.header, {
        paddingTop:      insets.top + 10,
        borderBottomColor: theme.border,
        backgroundColor:   theme.background,
      }]}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Mensagens</Text>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: theme.surface }]}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={18} color={theme.primaryLight} />
        </TouchableOpacity>
      </View>

      {loading ? (
        // Skeleton
        <View style={{ padding: 16, gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View style={[s.skeletonCircle, { backgroundColor: theme.surfaceHigh }]} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[s.skeletonLine, { width: "50%", backgroundColor: theme.surfaceHigh }]} />
                <View style={[s.skeletonLine, { width: "75%", backgroundColor: theme.surfaceHigh }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={conversations}
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
                theme={theme}
                onPress={handleOpen}
                onDelete={handleDelete}
              />
            );
          }}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                <Ionicons name="paper-plane-outline" size={32} color={theme.primaryLight} />
              </View>
              <Text style={[s.emptyTitle, { color: theme.text }]}>Sem mensagens</Text>
              <Text style={[s.emptySub, { color: theme.textSecondary }]}>
                Inicie uma conversa pelo perfil de alguém
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:       { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle:   { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  iconBtn:       { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  skeletonCircle:{ width: 52, height: 52, borderRadius: 26 },
  skeletonLine:  { height: 12, borderRadius: 6 },
  empty:         { alignItems: "center", padding: 60, gap: 12 },
  emptyIcon:     { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle:    { fontSize: 18, fontWeight: "700" },
  emptySub:      { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
