import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { api } from "../../services/api";

interface UserItem {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  isFollowing?: boolean;
}

export default function FollowersListScreen({ route, navigation }: any) {
  const { username, tab: initialTab, userId: passedUserId } = route.params || {};
  const [tab,     setTab]     = useState<"followers" | "following">(initialTab || "followers");
  const [data,    setData]    = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(passedUserId || null);

  const { theme, isDark } = useThemeStore();
  const { user: me } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Resolve userId a partir do username se não foi passado
  const resolveUserId = useCallback(async () => {
    if (userId) return userId;
    try {
      const res = await api.get(`/users/${username}`);
      const id = res.data?.id;
      setUserId(id);
      return id;
    } catch {
      return null;
    }
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
      const res = await api.get(endpoint);
      // Normaliza resposta — backend pode retornar array direto ou { users, items, data }
      const raw: any[] = res.data?.users || res.data?.items || res.data?.data || res.data || [];
      setData(raw.map((u: any) => ({
        id:          u.id || u.followerId || u.followingId,
        username:    u.username || u.follower?.username || u.following?.username,
        displayName: u.displayName || u.follower?.displayName || u.following?.displayName,
        avatarUrl:   u.avatarUrl || u.follower?.avatarUrl || u.following?.avatarUrl,
        isFollowing: u.isFollowing ?? false,
      })).filter(u => u.username));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tab, resolveUserId]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async (item: UserItem) => {
    if (!item.id || item.id === me?.id) return;
    const wasFollowing = item.isFollowing;
    // Optimistic update
    setData(prev => prev.map(u => u.id === item.id ? { ...u, isFollowing: !wasFollowing } : u));
    try {
      if (wasFollowing) {
        await api.delete(`/follows/${item.id}`);
      } else {
        await api.post(`/follows/${item.id}`);
      }
    } catch {
      // Reverter se falhou
      setData(prev => prev.map(u => u.id === item.id ? { ...u, isFollowing: wasFollowing } : u));
    }
  };

  const renderItem = ({ item }: { item: UserItem }) => {
    const isMe = item.id === me?.id;
    return (
      <View style={[s.row, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={s.rowLeft}
          activeOpacity={0.7}
          onPress={() => {
            navigation.navigate("UserProfile", { username: item.username });
          }}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: theme.surfaceHigh, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ color: theme.primaryLight, fontWeight: "700", fontSize: 16 }}>
                {(item.displayName || item.username || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
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
            activeOpacity={0.7}
          >
            <Text style={[
              s.followBtnText,
              { color: item.isFollowing ? theme.textSecondary : "#fff" },
            ]}>
              {item.isFollowing ? "Seguindo" : "Seguir"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>@{username}</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={[s.tabs, { borderBottomColor: theme.border }]}>
        {(["followers", "following"] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={s.tabBtn}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[
              s.tabLabel,
              { color: tab === t ? theme.primary : theme.textSecondary },
              tab === t && { fontWeight: "700" },
            ]}>
              {t === "followers" ? "Seguidores" : "Seguindo"}
            </Text>
            {tab === t && <View style={[s.tabLine, { backgroundColor: theme.primary }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
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
          keyExtractor={(item, i) => `${tab}-${item.id || item.username}-${i}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  backBtn:     { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  tabs:        { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn:      { flex: 1, alignItems: "center", paddingVertical: 12, gap: 2 },
  tabLabel:    { fontSize: 14, fontWeight: "500" },
  tabLine:     { height: 2, width: 40, borderRadius: 1 },
  row:         { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft:     { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:      { width: 44, height: 44, borderRadius: 22 },
  name:        { fontSize: 14, fontWeight: "600" },
  handle:      { fontSize: 12, marginTop: 2 },
  followBtn:   { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginLeft: 8 },
  followBtnText: { fontSize: 13, fontWeight: "600" },
  center:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  empty:       { fontSize: 14 },
});
