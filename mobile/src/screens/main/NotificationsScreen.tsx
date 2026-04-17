import React, {
  useEffect, useState, useCallback, useContext, useRef,
} from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl, Animated, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useThemeStore } from "../../store/theme.store";
import { api } from "../../services/api";
import { BadgeContext } from "../../context/BadgeContext";
import {
  groupNotifications, filterOld,
  NotificationGroup, RawNotification,
} from "../../utils/notificationHelpers";
import NotificationStack from "../../components/notifications/NotificationStack";

export default function NotificationsScreen({ navigation }: any) {
  const { theme, isDark }     = useThemeStore();
  const { refreshBadges, clearNotificationBadge } = useContext(BadgeContext);
  const insets                = useSafeAreaInsets();

  const [groups,     setGroups]     = useState<NotificationGroup[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode,   setEditMode]   = useState(false);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());

  // ── Carregar + agrupar ──────────────────────────────────────────────────
  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const { data } = await api.get("/notifications?limit=100");
      const raw: RawNotification[] = data.notifications || data || [];
      // Aplica filtro de 7 dias e agrupa
      const grouped = groupNotifications(filterOld(raw));
      setGroups(grouped);
      // Marca todas como lidas
      await api.patch("/notifications/read-all").catch(() => {});
      refreshBadges();
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshBadges]);

  // Recarrega ao focar a tela
  useFocusEffect(useCallback(() => { clearNotificationBadge(); load(); }, [load, clearNotificationBadge]));

  // ── Deletar grupo ───────────────────────────────────────────────────────
  const deleteGroup = useCallback((key: string) => {
    setGroups(prev => prev.filter(g => g.key !== key));
    setSelected(prev => { const s = new Set(prev); s.delete(key); return s; });
  }, []);

  // ── Deletar selecionados ────────────────────────────────────────────────
  const deleteSelected = () => {
    if (selected.size === 0) return;
    Alert.alert(
      `Remover ${selected.size} grupo${selected.size > 1 ? "s" : ""}?`,
      "As notificações serão removidas permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            setGroups(prev => prev.filter(g => !selected.has(g.key)));
            setSelected(new Set());
            setEditMode(false);
          },
        },
      ]
    );
  };

  const selectAll = () => {
    if (selected.size === groups.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(groups.map(g => g.key)));
    }
  };

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  // ── Navegação inteligente ───────────────────────────────────────────────
  const handleNavigate = useCallback((target: "profile" | "post", id: string) => {
    if (target === "profile") {
      navigation?.navigate?.("UserProfile", { username: id });
    } else {
      // Post individual — futuro
      navigation?.navigate?.("Tabs", { screen: "Feed" });
    }
  }, [navigation]);

  // ── Skeleton ────────────────────────────────────────────────────────────
  const Skeleton = () => (
    <View style={{ padding: 16, gap: 16 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={[sk.circle, { backgroundColor: theme.surfaceHigh }]} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[sk.line, { width: "70%", backgroundColor: theme.surfaceHigh }]} />
            <View style={[sk.line, { width: "30%", backgroundColor: theme.surfaceHigh }]} />
          </View>
        </View>
      ))}
    </View>
  );

  const allSelected = selected.size === groups.length && groups.length > 0;
  const unreadCount = groups.filter(g => g.hasUnread).length;

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        translucent backgroundColor="transparent"
      />

      {/* Header */}
      <View style={[s.header, {
        paddingTop:        insets.top + 10,
        borderBottomColor: theme.border,
        backgroundColor:   theme.background,
      }]}>
        <View style={s.headerLeft}>
          <Text style={[s.headerTitle, { color: theme.text }]}>Notificações</Text>
          {unreadCount > 0 && (
            <View style={[s.unreadBadge, { backgroundColor: theme.primary }]}>
              <Text style={s.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        <View style={s.headerRight}>
          {editMode ? (
            <>
              <TouchableOpacity onPress={selectAll} style={s.headerBtn}>
                <Text style={[s.headerBtnText, { color: theme.primary }]}>
                  {allSelected ? "Limpar" : "Selecionar tudo"}
                </Text>
              </TouchableOpacity>
              {selected.size > 0 && (
                <TouchableOpacity onPress={deleteSelected} style={s.headerBtn}>
                  <Text style={[s.headerBtnText, { color: theme.error }]}>
                    Remover ({selected.size})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => { setEditMode(false); setSelected(new Set()); }}
                style={s.headerBtn}
              >
                <Text style={[s.headerBtnText, { color: theme.textSecondary }]}>Feito</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {groups.length > 0 && (
                <TouchableOpacity
                  onPress={() => setEditMode(true)}
                  style={[s.iconBtn, { backgroundColor: theme.surface }]}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {loading ? (
        <Skeleton />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => g.key}
          renderItem={({ item: group }) => (
            <View style={s.groupWrapper}>
              {/* Checkbox em modo de edição */}
              {editMode && (
                <TouchableOpacity
                  style={s.checkboxArea}
                  onPress={() => toggleSelect(group.key)}
                >
                  <View style={[
                    s.checkbox,
                    { borderColor: theme.border },
                    selected.has(group.key) && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}>
                    {selected.has(group.key) && (
                      <Ionicons name="checkmark" size={11} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }}>
                <NotificationStack
                  group={group}
                  onDelete={deleteGroup}
                  onNavigate={handleNavigate}
                />
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => (
            <View style={[s.separator, { backgroundColor: theme.border }]} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyEmoji}>🔔</Text>
              <Text style={[s.emptyTitle, { color: theme.text }]}>Sem notificações</Text>
              <Text style={[s.emptySub, { color: theme.textSecondary }]}>
                Quando alguém interagir com você, aparecerá aqui
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const sk = StyleSheet.create({
  circle: { width: 46, height: 46, borderRadius: 23 },
  line:   { height: 12, borderRadius: 6 },
});

const s = StyleSheet.create({
  root:           { flex: 1 },
  header:         {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft:     { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle:    { fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
  unreadBadge:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  unreadBadgeText:{ color: "#fff", fontSize: 11, fontWeight: "700" },
  headerRight:    { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn:      { paddingHorizontal: 4, paddingVertical: 2 },
  headerBtnText:  { fontSize: 13, fontWeight: "600" },
  iconBtn:        { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  groupWrapper:   { flexDirection: "row", alignItems: "center" },
  checkboxArea:   { paddingLeft: 16, paddingRight: 4, justifyContent: "center" },
  checkbox:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  separator:      { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  empty:          { alignItems: "center", paddingTop: 80, gap: 8 },
  emptyEmoji:     { fontSize: 40, marginBottom: 4 },
  emptyTitle:     { fontSize: 18, fontWeight: "700" },
  emptySub:       { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
