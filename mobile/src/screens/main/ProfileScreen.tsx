import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Switch, StatusBar, FlatList, Image, ActivityIndicator,
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
  const { user, logout } = useAuthStore();
  const { isDark, toggle, theme } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");

  const loadData = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [postsRes, profileRes] = await Promise.all([
        api.get(`/posts/user/${user.username}?limit=12`),
        api.get(`/users/${user.username}`),
      ]);
      setPosts(postsRes.data.posts || []);
      setStats({
        postsCount: profileRes.data.postsCount || postsRes.data.total || 0,
        followersCount: profileRes.data.followersCount || 0,
        followingCount: profileRes.data.followingCount || 0,
      });
    } catch {}
    finally { setLoadingPosts(false); }
  }, [user?.username]);

  useEffect(() => {
    loadData();
    refreshBadges();
  }, [loadData]);

  const goToMessages = () => navigation?.navigate?.("Messages");
  const goToEdit = () => navigation?.navigate?.("EditProfile");

  const StatItem = ({ label, value }: { label: string; value: number }) => (
    <TouchableOpacity style={styles.statItem} activeOpacity={0.7}>
      <Text style={[styles.statValue, { color: theme.text }]}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.coverArea}>
          <LinearGradient
            colors={["#1a0533", "#0f1a3a", theme.background]}
            style={styles.cover}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />
          <View style={styles.topBar}>
            <Text style={styles.topTitle}>Perfil</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.topBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
                onPress={goToMessages}
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
                style={[styles.topBtn, { backgroundColor: "rgba(255,255,255,0.12)" }]}
                onPress={goToEdit}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.profileRow}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={80} showRing />
            <View style={styles.nameBlock}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[styles.displayName, { color: theme.text }]}>
                  {user?.displayName || user?.username || "Usuário"}
                </Text>
                {user?.isVerified && <Ionicons name="checkmark-circle" size={16} color={theme.verified} />}
              </View>
              <Text style={[styles.username, { color: theme.textSecondary }]}>@{user?.username}</Text>
              {user?.bio
                ? <Text style={[styles.bio, { color: theme.text }]}>{user.bio}</Text>
                : <TouchableOpacity onPress={goToEdit}><Text style={[styles.addBio, { color: theme.primaryLight }]}>+ Adicionar bio</Text></TouchableOpacity>
              }
            </View>
          </View>
        </View>

        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatItem label="posts" value={stats.postsCount} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem label="seguidores" value={stats.followersCount} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem label="seguindo" value={stats.followingCount} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.editBtn, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={goToEdit} activeOpacity={0.7}>
            <Text style={[styles.editBtnText, { color: theme.text }]}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.shareBtn, { borderColor: theme.border, backgroundColor: theme.surface }]} activeOpacity={0.7}>
            <Ionicons name="share-social-outline" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
          <TouchableOpacity style={[styles.tab, activeTab === "posts" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab("posts")}>
            <Ionicons name="grid-outline" size={22} color={activeTab === "posts" ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === "saved" && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]} onPress={() => setActiveTab("saved")}>
            <Ionicons name="bookmark-outline" size={22} color={activeTab === "saved" ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {activeTab === "posts" ? (
          loadingPosts ? (
            <View style={styles.emptyPosts}><ActivityIndicator color={theme.primary} /></View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Ionicons name="camera-outline" size={48} color={theme.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum post ainda</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Compartilhe seu primeiro momento</Text>
            </View>
          ) : (
            <FlatList
              data={posts} keyExtractor={(i) => i.id} numColumns={3} scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.postThumb} activeOpacity={0.85}>
                  {item.mediaUrls?.length > 0
                    ? <Image source={{ uri: item.mediaUrls[0] }} style={styles.postThumbImg} />
                    : <View style={[styles.postThumbText, { backgroundColor: theme.surfaceHigh }]}>
                        <Text style={[styles.postCaption, { color: theme.text }]} numberOfLines={4}>{item.caption}</Text>
                      </View>
                  }
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

        <View style={[styles.section, { borderTopColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREFERÊNCIAS</Text>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: theme.surfaceHigh }]}>
                <Ionicons name={isDark ? "moon" : "sunny"} size={15} color={theme.primaryLight} />
              </View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Tema escuro</Text>
            </View>
            <Switch value={isDark} onValueChange={toggle} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
          </View>
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: theme.surfaceHigh }]}>
                <Ionicons name="lock-closed-outline" size={15} color={theme.primaryLight} />
              </View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Perfil privado</Text>
            </View>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>{user?.isPrivate ? "Ativo" : "Desativado"}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 52 }}>
          <TouchableOpacity style={[styles.logoutBtn, { borderColor: theme.error + "33" }]} onPress={logout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color={theme.error} />
            <Text style={[styles.logoutText, { color: theme.error }]}>Sair da conta</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  coverArea: { paddingBottom: 16 },
  cover: { position: "absolute", top: 0, left: 0, right: 0, height: 200 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  topTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  topBtn: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", position: "relative" },
  dmBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  dmBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  profileRow: { flexDirection: "row", paddingHorizontal: 16, gap: 14, alignItems: "flex-start", paddingTop: 4 },
  nameBlock: { flex: 1, paddingTop: 4 },
  displayName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  username: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  addBio: { fontSize: 13, marginTop: 6 },
  statsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 12 },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  editBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  shareBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", marginTop: 16, borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  emptyPosts: { padding: 60, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center" },
  postThumb: { width: POST_SIZE, height: POST_SIZE, marginRight: 1.5 },
  postThumbImg: { width: "100%", height: "100%" },
  postThumbText: { width: "100%", height: "100%", padding: 8, justifyContent: "center" },
  postCaption: { fontSize: 11, lineHeight: 16 },
  section: { borderTopWidth: 1, marginTop: 16, paddingTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 12 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1 },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontSize: 15 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 14 },
  logoutText: { fontSize: 15, fontWeight: "600" },
});
