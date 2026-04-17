import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../services/api";
import Avatar from "../../components/ui/Avatar";

interface UserItem {
  id:            string;
  username:      string;
  displayName?:  string;
  avatarUrl?:    string;
  isFollowing?:  boolean;
  isFollowedBy?: boolean;
}

export default function FollowersListScreen({ route, navigation }: any) {
  const { username, tab: initialTab, userId: passedUserId } = route.params || {};

  const [tab,    setTab]    = useState<"followers" | "following">(initialTab || "followers");
  const [data,   setData]   = useState<UserItem[]>([]);
  const [loading,setLoading]= useState(true);
  const [userId, setUserId] = useState<string | null>(passedUserId || null);

  const { theme, isDark } = useThemeStore();
  const { user: me }      = useAuthStore();
  const insets            = useSafeAreaInsets();

  const resolveUserId = useCallback(async (): Promise<string | null> => {
    if (userId) return userId;
    try {
      const res = await api.get(`/users/${username}`);
      const id  = res.data?.id;
      if (id) setUserId(id);
      return id ?? null;
    } catch { return null; }
  }, [username, userId]);

  const load = useCallback(async () => {
    setLoading(true);
    setData([]);
    try {
      const id = await resolveUserId();
      if (!id) return;
      const endpoint = tab === "followers"
        ? `/follows/${id}/followers`
        : `/follows/${id}/following`;
      const res  = await api.get(endpoint);
      // Backend retorna { users: [...], total } — cada user é flat com isFollowing
      const raw: any[] = res.data?.users ?? res.data ?? [];
      setData(
        raw
          .filter(u => u && u.id && u.username)
          .map(u => ({
            id:           u.id,
            username:     u.username,
            displayName:  u.displayName  ?? null,
            avatarUrl:    u.avatarUrl    ?? null,
            isFollowing:  u.isFollowing  ?? false,
            isFollowedBy: u.isFollowedBy ?? false,
          }))
      );
    } catch { setData([]); }
    finally  { setLoading(false); }
  }, [tab, resolveUserId]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async (item: UserItem) => {
    if (!item.id || item.id === me?.id) return;
    const wasFollowing = !!item.isFollowing;
    setData(prev => prev.map(u => u.id === item.id ? { ...u, isFollowing: !wasFollowing } : u));
    try {
      if (wasFollowing) await api.delete(`/follows/${item.id}`);
      else              await api.post(`/follows/${item.id}`);
    } catch {
      setData(prev => prev.map(u => u.id === item.id ? { ...u, isFollowing: wasFollowing } : u));
    }
  };

  const getFollowLabel = (item: UserItem): string => {
    if (item.isFollowing)  return "Parar de seguir";
    if (item.isFollowedBy) return "Seguir de volta";
    return "Seguir";
  };

  const renderItem = ({ item }: { item: UserItem }) => {
    const isMe = item.id === me?.id;
    return (
      <View style={[s.row, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={s.rowLeft}
          activeOpacity={0.75}
          onPress={() =>
            isMe
              ? navigation.navigate("Tabs", { screen: "Profile" })
              : navigation.navigate("UserProfile", { username: item.username })
          }
        >
          <Avatar uri={item.avatarUrl} name={item.displayName || item.username} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            <Text style={[s.handle, { color: theme.textSecondary }]}>@{item.username}</Text>
          </View>
        </TouchableOpacity>

        {!isMe && (
          <TouchableOpacity
            style={[
              s.followBtn,
              item.isFollowing
                ? { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border }
                : { backgroundColor: theme.primary, borderWidth: 0 },
            ]}
            onPress={() => toggleFollow(item)}
            activeOpacity={0.75}
          >
            <Text style={[s.followBtnText, { color: item.isFollowing ? theme.textSecondary : "#fff" }]}>
              {getFollowLabel(item)}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>@{username}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={[s.tabs, { borderBottomColor: theme.border }]}>
        {(["followers", "following"] as const).map(t => (
          <TouchableOpacity key={t} style={s.tabBtn} onPress={() => setTab(t)} activeOpacity={0.7}>
            <Text style={[s.tabLabel, { color: tab === t ? theme.primary : theme.textSecondary }, tab === t && { fontWeight: "700" }]}>
              {t === "followers" ? "Seguidores" : "Seguindo"}
            </Text>
            {tab === t && <View style={[s.tabDot, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.primary} /></View>
      ) : data.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="people-outline" size={40} color={theme.textTertiary} />
          <Text style={[s.empty, { color: theme.textSecondary }]}>
            {tab === "followers" ? "Nenhum seguidor ainda" : "Não segue ninguém ainda"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => `${tab}-${item.id}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:   { fontSize: 16, fontWeight: "700" },
  backBtn:       { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  tabs:          { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn:        { flex: 1, alignItems: "center", paddingVertical: 12, gap: 4 },
  tabLabel:      { fontSize: 14, fontWeight: "500" },
  tabDot:        { width: 4, height: 4, borderRadius: 2 },
  row:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft:       { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  name:          { fontSize: 14, fontWeight: "600" },
  handle:        { fontSize: 12, marginTop: 2 },
  followBtn:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginLeft: 8, minWidth: 90, alignItems: "center" },
  followBtnText: { fontSize: 12, fontWeight: "700" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  empty:         { fontSize: 14 },
});
