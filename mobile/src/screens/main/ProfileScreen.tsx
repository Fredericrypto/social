import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import { api } from "../../services/api";
import Avatar from "../../components/ui/Avatar";
import { BadgeContext } from "../../context/BadgeContext";

const { width } = Dimensions.get("window");
const POST_SIZE = (width - 3) / 3;

export default function ProfileScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");

  const loadData = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [postsRes, profileRes] = await Promise.all([
        api.get(`/posts/user/${user.username}?limit=18`),
        api.get(`/users/${user.username}`),
      ]);
      setPosts(postsRes.data.posts || []);
      setStats({
        postsCount: profileRes.data.postsCount || 0,
        followersCount: profileRes.data.followersCount || 0,
        followingCount: profileRes.data.followingCount || 0,
      });
    } catch (e) {
      console.log("profile load error:", e);
    } finally {
      setLoadingPosts(false);
    }
  }, [user?.username]);

  useEffect(() => { loadData(); refreshBadges(); }, [loadData]);

  const goTo = (screen: string, params?: any) => navigation?.navigate?.(screen, params);

  const userData = user as any;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Cover area */}
        <View style={styles.coverArea}>
          <LinearGradient
            colors={["#1a0533", "#0f1a3a", theme.background]}
            style={styles.cover}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {/* Top bar — apenas DM + Settings */}
          <View style={styles.topBar}>
            <Text style={styles.topTitle}>◈</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={styles.topBtn}
                onPress={() => goTo("Messages")}
                activeOpacity={0.7}
              >
                <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                {unreadMessages > 0 && (
                  <View style={styles.dmBadge}>
                    <Text style={styles.dmBadgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.topBtn}
                onPress={() => goTo("Settings")}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar + identity */}
          <View style={styles.profileRow}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={84} showRing />
            <View style={styles.nameBlock}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.displayName, { color: theme.text }]}>
                  {user?.displayName || user?.username}
                </Text>
                {user?.isVerified && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.verified} />
                )}
              </View>
              <Text style={[styles.username, { color: theme.textSecondary }]}>@{user?.username}</Text>

              {/* Campos profissionais */}
              {(userData?.jobTitle || userData?.company) && (
                <View style={styles.jobRow}>
                  <Ionicons name="briefcase-outline" size={12} color={theme.textSecondary} />
                  <Text style={[styles.jobText, { color: theme.textSecondary }]}>
                    {[userData.jobTitle, userData.company].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              )}
              {userData?.website && (
                <View style={styles.jobRow}>
                  <Ionicons name="link-outline" size={12} color={theme.primaryLight} />
                  <Text style={[styles.websiteText, { color: theme.primaryLight }]}>{userData.website}</Text>
                </View>
              )}
              {user?.bio && (
                <Text style={[styles.bio, { color: theme.text }]}>{user.bio}</Text>
              )}

              {/* Skills chips */}
              {userData?.skills?.length > 0 && (
                <View style={styles.skillsRow}>
                  {userData.skills.slice(0, 4).map((s: string) => (
                    <View key={s} style={[styles.skillChip, { backgroundColor: theme.surfaceHigh, borderColor: theme.border }]}>
                      <Text style={[styles.skillText, { color: theme.primaryLight }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {[
            { label: "posts", value: stats.postsCount },
            { label: "seguidores", value: stats.followersCount },
            { label: "seguindo", value: stats.followingCount },
          ].map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && <View style={[styles.statDivider, { backgroundColor: theme.border }]} />}
              <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.editBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() => goTo("EditProfile")}
            activeOpacity={0.7}
          >
            <Text style={[styles.editBtnText, { color: theme.text }]}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconActionBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert("Link copiado!", `rede.app/${user?.username}`)}
          >
            <Ionicons name="share-social-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          {[
            { key: "posts", icon: "grid-outline" },
            { key: "saved", icon: "bookmark-outline" },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(t.key as any)}
            >
              <Ionicons name={t.icon as any} size={22} color={activeTab === t.key ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Post grid */}
        {activeTab === "posts" ? (
          loadingPosts ? (
            <View style={styles.emptyPosts}><ActivityIndicator color={theme.primary} /></View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="camera-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum post ainda</Text>
              <TouchableOpacity
                style={[styles.firstPostBtn, { backgroundColor: theme.primary }]}
                onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Criar primeiro post</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={i => i.id}
              numColumns={3}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.postThumb} activeOpacity={0.85}>
                  {item.mediaUrls?.length > 0 ? (
                    <Image source={{ uri: item.mediaUrls[0] }} style={styles.postThumbImg} />
                  ) : (
                    <View style={[styles.postThumbText, { backgroundColor: theme.surfaceHigh }]}>
                      <Text style={[styles.postCaption, { color: theme.text }]} numberOfLines={4}>
                        {item.caption}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1.5 }} />}
            />
          )
        ) : (
          <View style={styles.emptyPosts}>
            <Ionicons name="bookmark-outline" size={48} color={theme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nada salvo ainda</Text>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  coverArea: { paddingBottom: 16 },
  cover: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  topTitle: { fontSize: 22, fontWeight: "800", color: "#A78BFA" },
  topBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", position: "relative" },
  dmBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  dmBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  profileRow: { flexDirection: "row", paddingHorizontal: 16, gap: 14, alignItems: "flex-start", paddingTop: 4 },
  nameBlock: { flex: 1, paddingTop: 4 },
  displayName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  username: { fontSize: 13, marginTop: 2 },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  jobText: { fontSize: 12 },
  websiteText: { fontSize: 12 },
  bio: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  skillChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  skillText: { fontSize: 11, fontWeight: "600" },
  statsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 12 },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  editBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  iconActionBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginTop: 16, borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  emptyPosts: { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  firstPostBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  postThumb: { width: POST_SIZE, height: POST_SIZE, marginRight: 1.5 },
  postThumbImg: { width: "100%", height: "100%" },
  postThumbText: { width: "100%", height: "100%", padding: 8, justifyContent: "center" },
  postCaption: { fontSize: 11, lineHeight: 16 },
});
