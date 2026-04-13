import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import { api } from "../../services/api";
import Avatar from "../../components/ui/Avatar";
import { BadgeContext } from "../../context/BadgeContext";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;

// Tipos de tab do perfil
type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";

const TABS: { key: ProfileTab; icon: string; label: string }[] = [
  { key: "posts",     icon: "images-outline",       label: "Fotos"      },
  { key: "thoughts",  icon: "chatbubble-outline",    label: "Pensamentos"},
  { key: "code",      icon: "code-slash-outline",    label: "Código"     },
  { key: "projects",  icon: "briefcase-outline",     label: "Projetos"   },
  { key: "saved",     icon: "bookmark-outline",      label: "Salvos"     },
];

// Card de post de texto (pensamento)
function ThoughtCard({ post, theme }: any) {
  return (
    <View style={[thoughtStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[thoughtStyles.text, { color: theme.text }]}>{post.caption}</Text>
      <View style={thoughtStyles.footer}>
        <Ionicons name="heart-outline" size={14} color={theme.textSecondary} />
        <Text style={[thoughtStyles.likes, { color: theme.textSecondary }]}>{post.likesCount}</Text>
      </View>
    </View>
  );
}

const thoughtStyles = StyleSheet.create({
  card: { margin: 8, borderRadius: 14, borderWidth: 1, padding: 14 },
  text: { fontSize: 14, lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  likes: { fontSize: 12 },
});

// Card de código
function CodeCard({ post, theme }: any) {
  const code = post.caption || "";
  const isCode = code.includes("```");
  const codeContent = isCode
    ? code.replace(/```[a-z]*/g, "").replace(/```/g, "").trim()
    : code;
  const lang = isCode ? (code.match(/```([a-z]+)/)?.[1] || "js") : "js";

  return (
    <View style={[codeStyles.card, { backgroundColor: "#1E1E2E", borderColor: "#313244" }]}>
      <View style={codeStyles.topBar}>
        <View style={codeStyles.dots}>
          {["#FF5F57", "#FFBD2E", "#28C840"].map(c => (
            <View key={c} style={[codeStyles.dot, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={codeStyles.lang}>{lang}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={codeStyles.code}>{codeContent}</Text>
      </ScrollView>
    </View>
  );
}

const codeStyles = StyleSheet.create({
  card: { margin: 8, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  lang: { color: "#6C7086", fontSize: 11, fontWeight: "600" },
  code: { fontFamily: "monospace", fontSize: 12, color: "#CDD6F4", padding: 12, lineHeight: 20 },
});

// Card de projeto
function ProjectCard({ post, theme }: any) {
  return (
    <TouchableOpacity style={[projStyles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} activeOpacity={0.8}>
      {post.mediaUrls?.[0] && (
        <Image source={{ uri: post.mediaUrls[0] }} style={projStyles.cover} resizeMode="cover" />
      )}
      <View style={projStyles.content}>
        <Text style={[projStyles.title, { color: theme.text }]} numberOfLines={1}>
          {post.caption?.split("\n")[0] || "Projeto"}
        </Text>
        <Text style={[projStyles.desc, { color: theme.textSecondary }]} numberOfLines={2}>
          {post.caption?.split("\n").slice(1).join(" ") || ""}
        </Text>
        <View style={projStyles.footer}>
          <Ionicons name="heart-outline" size={13} color={theme.textSecondary} />
          <Text style={[projStyles.stat, { color: theme.textSecondary }]}>{post.likesCount}</Text>
          <Ionicons name="chatbubble-outline" size={13} color={theme.textSecondary} />
          <Text style={[projStyles.stat, { color: theme.textSecondary }]}>{post.commentsCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const projStyles = StyleSheet.create({
  card: { margin: 8, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cover: { width: "100%", height: 160 },
  content: { padding: 12 },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  desc: { fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  stat: { fontSize: 12 },
});

export default function ProfileScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const scrollX = React.useRef(new Animated.Value(0)).current;

  const loadData = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [postsRes, profileRes] = await Promise.all([
        api.get(`/posts/user/${user.username}?limit=30`),
        api.get(`/users/${user.username}`),
      ]);
      setPosts(postsRes.data.posts || []);
      setStats({
        postsCount: profileRes.data.postsCount || 0,
        followersCount: profileRes.data.followersCount || 0,
        followingCount: profileRes.data.followingCount || 0,
      });
    } catch {}
    finally { setLoading(false); }
  }, [user?.username]);

  useEffect(() => { loadData(); refreshBadges(); }, [loadData]);

  // Filtrar posts por tipo
  const imagePosts = posts.filter(p => p.postType === 'image' || (p.mediaUrls?.length > 0 && p.postType !== 'code' && p.postType !== 'project'));
  const thoughtPosts = posts.filter(p => p.postType === 'text' || (!p.mediaUrls?.length && p.caption && !p.caption.includes("```") && p.postType !== 'code'));
  const codePosts = posts.filter(p => p.postType === 'code' || p.caption?.includes("```"));
  const projectPosts = posts.filter(p => p.postType === 'project');

  const getTabPosts = () => {
    switch (activeTab) {
      case "posts":     return imagePosts;
      case "thoughts":  return thoughtPosts;
      case "code":      return codePosts;
      case "projects":  return projectPosts;
      case "saved":     return []; // privado — só dono vê
      default:          return [];
    }
  };

  const userData = user as any;

  const renderTabContent = () => {
    const tabPosts = getTabPosts();

    if (activeTab === "saved") {
      return (
        <View style={styles.emptyTab}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name="lock-closed-outline" size={28} color={theme.primaryLight} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Salvos — privado</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Só você pode ver seus itens salvos</Text>
        </View>
      );
    }

    if (loading) return <View style={styles.emptyTab}><ActivityIndicator color={theme.primary} /></View>;

    if (tabPosts.length === 0) {
      return (
        <View style={styles.emptyTab}>
          <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name={TABS.find(t => t.key === activeTab)?.icon as any || "apps"} size={28} color={theme.primaryLight} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem conteúdo ainda</Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}
          >
            <Text style={styles.createBtnText}>Criar agora</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (activeTab === "posts") {
      return (
        <FlatList
          data={imagePosts}
          keyExtractor={i => i.id}
          numColumns={3}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2 }]}
              activeOpacity={0.85}
            >
              <Image source={{ uri: item.mediaUrls[0] }} style={styles.gridImg} resizeMode="cover" />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      );
    }

    if (activeTab === "thoughts") {
      return (
        <View>
          {thoughtPosts.map(p => <ThoughtCard key={p.id} post={p} theme={theme} />)}
        </View>
      );
    }

    if (activeTab === "code") {
      return (
        <View>
          {codePosts.map(p => <CodeCard key={p.id} post={p} theme={theme} />)}
        </View>
      );
    }

    if (activeTab === "projects") {
      return (
        <View>
          {projectPosts.map(p => <ProjectCard key={p.id} post={p} theme={theme} />)}
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* Cover + header */}
        <View style={styles.coverArea}>
          <LinearGradient
            colors={["#1a0533", "#0f1a3a", theme.background]}
            style={styles.cover}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          <View style={styles.topBar}>
            <Text style={[styles.topLogo, { color: theme.primaryLight }]}>◈</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={styles.topBtn} onPress={() => navigation?.navigate?.("Messages")} activeOpacity={0.7}>
                <Ionicons name="paper-plane-outline" size={17} color="#fff" />
                {unreadMessages > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.topBtn} onPress={() => navigation?.navigate?.("Settings")} activeOpacity={0.7}>
                <Ionicons name="settings-outline" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar centralizado */}
          <View style={styles.avatarSection}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={90} showRing />
            <View style={styles.identity}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
                <Text style={[styles.displayName, { color: theme.text }]}>
                  {user?.displayName || user?.username}
                </Text>
                {user?.isVerified && <Ionicons name="checkmark-circle" size={16} color={theme.verified} />}
              </View>
              <Text style={[styles.handle, { color: theme.textSecondary }]}>@{user?.username}</Text>

              {(userData?.jobTitle || userData?.company) && (
                <View style={styles.jobRow}>
                  <Ionicons name="briefcase-outline" size={12} color={theme.textSecondary} />
                  <Text style={[styles.jobText, { color: theme.textSecondary }]}>
                    {[userData.jobTitle, userData.company].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              )}

              {user?.bio && (
                <Text style={[styles.bio, { color: theme.textSecondary }]}>{user.bio}</Text>
              )}

              {userData?.skills?.length > 0 && (
                <View style={styles.skills}>
                  {userData.skills.slice(0, 5).map((s: string) => (
                    <View key={s} style={[styles.skillChip, { backgroundColor: theme.primary + "22", borderColor: theme.primary + "44" }]}>
                      <Text style={[styles.skillText, { color: theme.primaryLight }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats row */}
        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {[
            { label: "posts", value: stats.postsCount },
            { label: "seguidores", value: stats.followersCount },
            { label: "seguindo", value: stats.followingCount },
          ].map((s, i, arr) => (
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

        {/* Edit button */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => navigation?.navigate?.("EditProfile")}
            activeOpacity={0.7}
          >
            <Text style={[styles.editBtnText, { color: theme.text }]}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="share-social-outline" size={17} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs — scroll horizontal */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsScroll, { borderBottomColor: theme.border }]}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabItem, activeTab === tab.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={18}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
              <Text style={[styles.tabLabel, { color: activeTab === tab.key ? theme.primary : theme.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Tab content */}
        <View style={{ minHeight: 300 }}>
          {renderTabContent()}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  coverArea: { paddingBottom: 20 },
  cover: { position: "absolute", top: 0, left: 0, right: 0, height: 220 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  topLogo: { fontSize: 20, fontWeight: "800" },
  topBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  avatarSection: { alignItems: "center", paddingTop: 12, gap: 12 },
  identity: { alignItems: "center", gap: 4, paddingHorizontal: 24 },
  displayName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  handle: { fontSize: 13 },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  jobText: { fontSize: 12 },
  bio: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 4 },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 },
  skillChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  skillText: { fontSize: 11, fontWeight: "600" },
  statsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, marginVertical: 12 },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  editBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  shareBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  tabsScroll: { marginTop: 16, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: 8 },
  tabItem: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 12, marginHorizontal: 2 },
  tabLabel: { fontSize: 12, fontWeight: "600" },
  gridThumb: { width: GRID_SIZE, height: GRID_SIZE },
  gridImg: { width: "100%", height: "100%" },
  emptyTab: { padding: 60, alignItems: "center", gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center", color: "gray" },
  createBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
