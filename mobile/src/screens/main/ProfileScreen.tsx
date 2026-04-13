import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import { api } from "../../services/api";
import { savedService } from "../../services/saved.service";
import Avatar from "../../components/ui/Avatar";
import { BadgeContext } from "../../context/BadgeContext";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;
const BANNER_HEIGHT = 260;

type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";
const TABS: { key: ProfileTab; icon: string }[] = [
  { key: "posts",    icon: "images-outline"      },
  { key: "thoughts", icon: "chatbubble-outline"   },
  { key: "code",     icon: "code-slash-outline"   },
  { key: "projects", icon: "briefcase-outline"    },
  { key: "saved",    icon: "bookmark-outline"     },
];

const BANNER_GRADIENTS: Record<string, [string, string, string]> = {
  purple:  ['#1a0533', '#3b0764', '#0f1a3a'],
  ocean:   ['#0c1445', '#1e3a8a', '#0891b2'],
  sunset:  ['#1a0a00', '#7c2d12', '#dc2626'],
  forest:  ['#052e16', '#14532d', '#065f46'],
  night:   ['#000000', '#111827', '#1f2937'],
  rose:    ['#1a0010', '#881337', '#be185d'],
  gold:    ['#1c0a00', '#78350f', '#d97706'],
  cosmic:  ['#0d0221', '#1e1b4b', '#4c1d95'],
};

function ThoughtCard({ post, theme }: any) {
  return (
    <View style={[tStyles.card, { borderColor: theme.border }]}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
      <Text style={[tStyles.text, { color: theme.text }]}>{post.caption}</Text>
      <View style={tStyles.footer}>
        <Ionicons name="heart-outline" size={14} color={theme.textSecondary} />
        <Text style={[tStyles.likes, { color: theme.textSecondary }]}>{post.likesCount}</Text>
      </View>
    </View>
  );
}
const tStyles = StyleSheet.create({
  card: { margin: 8, borderRadius: 16, borderWidth: 1, padding: 14, overflow: 'hidden' },
  text: { fontSize: 14, lineHeight: 22 },
  footer: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  likes: { fontSize: 12 },
});

function CodeCard({ post, theme }: any) {
  const code = post.caption || "";
  const isCode = code.includes("```");
  const codeContent = isCode ? code.replace(/```[a-z]*/g, "").replace(/```/g, "").trim() : code;
  const lang = isCode ? (code.match(/```([a-z]+)/)?.[1] || "js") : "js";
  return (
    <View style={[cStyles.card, { borderColor: "#313244" }]}>
      <View style={cStyles.topBar}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {["#FF5F57","#FFBD2E","#28C840"].map(c => (
            <View key={c} style={[cStyles.dot, { backgroundColor: c }]} />
          ))}
        </View>
        <Text style={cStyles.lang}>{lang}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={cStyles.code}>{codeContent}</Text>
      </ScrollView>
    </View>
  );
}
const cStyles = StyleSheet.create({
  card: { margin: 8, borderRadius: 12, borderWidth: 1, overflow: "hidden", backgroundColor: "#1E1E2E" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  lang: { color: "#6C7086", fontSize: 11, fontWeight: "600" },
  code: { fontFamily: "monospace", fontSize: 12, color: "#CDD6F4", padding: 12, lineHeight: 20 },
});

function ProjectCard({ post, theme }: any) {
  return (
    <TouchableOpacity style={[pStyles.card, { borderColor: theme.border }]} activeOpacity={0.8}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
      {post.mediaUrls?.[0] && (
        <Image source={{ uri: post.mediaUrls[0] }} style={pStyles.cover} resizeMode="cover" />
      )}
      <View style={pStyles.content}>
        <Text style={[pStyles.title, { color: theme.text }]} numberOfLines={1}>
          {post.caption?.split("\n")[0] || "Projeto"}
        </Text>
        <Text style={[pStyles.desc, { color: theme.textSecondary }]} numberOfLines={2}>
          {post.caption?.split("\n").slice(1).join(" ") || ""}
        </Text>
        <View style={pStyles.footer}>
          <Ionicons name="heart-outline" size={13} color={theme.textSecondary} />
          <Text style={[pStyles.stat, { color: theme.textSecondary }]}>{post.likesCount}</Text>
          <Ionicons name="chatbubble-outline" size={13} color={theme.textSecondary} />
          <Text style={[pStyles.stat, { color: theme.textSecondary }]}>{post.commentsCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
const pStyles = StyleSheet.create({
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
  const { theme, isDark } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const userData = user as any;
  const bannerColors = BANNER_GRADIENTS[userData?.bannerGradient || 'purple'];

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

  const loadSaved = async () => {
    if (savedPosts.length > 0) return;
    setSavedLoading(true);
    try {
      const data = await savedService.getMySaved();
      setSavedPosts(data.posts || []);
    } catch {}
    finally { setSavedLoading(false); }
  };

  useEffect(() => {
    if (activeTab === "saved") loadSaved();
  }, [activeTab]);

  const imagePosts    = posts.filter(p => p.postType === 'image' || (p.mediaUrls?.length > 0 && p.postType !== 'code' && p.postType !== 'project'));
  const thoughtPosts  = posts.filter(p => p.postType === 'text'  || (!p.mediaUrls?.length && p.caption && !p.caption.includes("```") && p.postType !== 'code'));
  const codePosts     = posts.filter(p => p.postType === 'code'  || p.caption?.includes("```"));
  const projectPosts  = posts.filter(p => p.postType === 'project');

  const getTabPosts = () => {
    switch (activeTab) {
      case "posts":    return imagePosts;
      case "thoughts": return thoughtPosts;
      case "code":     return codePosts;
      case "projects": return projectPosts;
      default:         return [];
    }
  };

  const renderTabContent = () => {
    if (activeTab === "saved") {
      if (savedLoading) return <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>;
      if (savedPosts.length === 0) return (
        <View style={s.emptyTab}>
          <View style={[s.emptyIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name="bookmark-outline" size={28} color={theme.primaryLight} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.text }]}>Nada salvo ainda</Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>Só você vê seus itens salvos</Text>
        </View>
      );
      return (
        <FlatList
          data={savedPosts}
          keyExtractor={i => i.id}
          numColumns={3}
          scrollEnabled={false}
          renderItem={({ item, index }) => (
            item.mediaUrls?.length > 0 ? (
              <TouchableOpacity style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2 }]} activeOpacity={0.85}>
                <Image source={{ uri: item.mediaUrls[0] }} style={s.gridImg} resizeMode="cover" />
              </TouchableOpacity>
            ) : (
              <View style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", padding: 8 }]}>
                <Text style={{ color: theme.text, fontSize: 11, lineHeight: 16 }} numberOfLines={4}>{item.caption}</Text>
              </View>
            )
          )}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      );
    }

    if (loading) return <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>;

    const tabPosts = getTabPosts();
    if (tabPosts.length === 0) {
      return (
        <View style={s.emptyTab}>
          <View style={[s.emptyIconWrap, { backgroundColor: theme.surface }]}>
            <Ionicons name={TABS.find(t => t.key === activeTab)?.icon as any || "apps"} size={28} color={theme.primaryLight} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.text }]}>Sem conteúdo ainda</Text>
          <TouchableOpacity
            style={[s.createBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}
          >
            <Text style={s.createBtnText}>Criar agora</Text>
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
            <TouchableOpacity style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2 }]} activeOpacity={0.85}>
              <Image source={{ uri: item.mediaUrls[0] }} style={s.gridImg} resizeMode="cover" />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        />
      );
    }
    if (activeTab === "thoughts") return <View>{thoughtPosts.map(p => <ThoughtCard key={p.id} post={p} theme={theme} />)}</View>;
    if (activeTab === "code")     return <View>{codePosts.map(p => <CodeCard key={p.id} post={p} theme={theme} />)}</View>;
    if (activeTab === "projects") return <View>{projectPosts.map(p => <ProjectCard key={p.id} post={p} theme={theme} />)}</View>;
    return null;
  };

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* Banner — cor fixa, não afetada pelo tema */}
        <View style={{ height: BANNER_HEIGHT }}>
          <LinearGradient
            colors={bannerColors}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {/* Fade suave banner → conteúdo */}
          <LinearGradient
            colors={['transparent', theme.background]}
            style={[StyleSheet.absoluteFillObject, { top: BANNER_HEIGHT * 0.45 }]}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          />

          {/* Top bar */}
          <View style={s.topBar}>
            <Text style={s.topLogo}>◈</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={s.topBtn} onPress={() => navigation?.navigate?.("Messages")} activeOpacity={0.7}>
                <Ionicons name="paper-plane-outline" size={17} color="#fff" />
                {unreadMessages > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.topBtn} onPress={() => navigation?.navigate?.("Settings")} activeOpacity={0.7}>
                <Ionicons name="settings-outline" size={17} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Avatar centralizado sobre o banner */}
          <View style={s.avatarSection}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={90} showRing />
          </View>
        </View>

        {/* Card de identidade com glassmorphism */}
        <View style={[s.glassCard, { borderColor: theme.borderLight }]}>
          <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          <View style={s.identity}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
              <Text style={[s.displayName, { color: theme.text }]}>
                {user?.displayName || user?.username}
              </Text>
              {user?.isVerified && <Ionicons name="checkmark-circle" size={16} color={theme.verified} />}
            </View>
            <Text style={[s.handle, { color: theme.textSecondary }]}>@{user?.username}</Text>

            {(userData?.jobTitle || userData?.company) && (
              <View style={s.jobRow}>
                <Ionicons name="briefcase-outline" size={12} color={theme.textSecondary} />
                <Text style={[s.jobText, { color: theme.textSecondary }]}>
                  {[userData.jobTitle, userData.company].filter(Boolean).join(" · ")}
                </Text>
              </View>
            )}

            {user?.bio && (
              <Text style={[s.bio, { color: theme.textSecondary }]}>{user.bio}</Text>
            )}

            {userData?.skills?.length > 0 && (
              <View style={s.skills}>
                {userData.skills.slice(0, 5).map((sk: string) => (
                  <View key={sk} style={[s.skillChip, { backgroundColor: theme.primary + "22", borderColor: theme.primary + "44" }]}>
                    <Text style={[s.skillText, { color: theme.primaryLight }]}>{sk}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={[s.statsRow, { borderColor: theme.border }]}>
          <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
          {[
            { label: "posts",     value: stats.postsCount     },
            { label: "seguidores", value: stats.followersCount },
            { label: "seguindo",  value: stats.followingCount  },
          ].map((st, i, arr) => (
            <React.Fragment key={st.label}>
              {i > 0 && <View style={[s.statDivider, { backgroundColor: theme.border }]} />}
              <TouchableOpacity style={s.statItem} activeOpacity={0.7}>
                <Text style={[s.statValue, { color: theme.text }]}>
                  {st.value >= 1000 ? `${(st.value / 1000).toFixed(1)}k` : st.value}
                </Text>
                <Text style={[s.statLabel, { color: theme.textSecondary }]}>{st.label}</Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Botões de ação */}
        <View style={s.actionRow}>
          <TouchableOpacity
            style={[s.editBtn, { borderColor: theme.border }]}
            onPress={() => navigation?.navigate?.("EditProfile")}
            activeOpacity={0.7}
          >
            <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
            <Text style={[s.editBtnText, { color: theme.text }]}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.shareBtn, { borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <BlurView intensity={25} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="share-social-outline" size={17} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Tabs — só ícones */}
        <View style={[s.tabsRow, { borderBottomColor: theme.border, borderTopColor: theme.border }]}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, activeTab === tab.key && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.key ? theme.primary : theme.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Conteúdo das tabs */}
        <View style={{ minHeight: 300, backgroundColor: theme.background }}>
          {renderTabContent()}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  topLogo: { fontSize: 20, fontWeight: "800", color: "#fff" },
  topBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  avatarSection: { alignItems: "center", position: "absolute", bottom: -10, left: 0, right: 0 },
  glassCard: { marginHorizontal: 16, marginTop: 24, borderRadius: 20, borderWidth: 1, overflow: "hidden", paddingVertical: 16 },
  identity: { alignItems: "center", gap: 4, paddingHorizontal: 20 },
  displayName: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
  handle: { fontSize: 13 },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  jobText: { fontSize: 12 },
  bio: { fontSize: 13, textAlign: "center", lineHeight: 18, marginTop: 4 },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 },
  skillChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  skillText: { fontSize: 11, fontWeight: "600" },
  statsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, marginVertical: 12 },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  editBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", overflow: "hidden" },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  shareBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tabsRow: { flexDirection: "row", marginTop: 16, borderBottomWidth: 1, borderTopWidth: 1 },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 12 },
  gridThumb: { width: GRID_SIZE, height: GRID_SIZE },
  gridImg: { width: "100%", height: "100%" },
  emptyTab: { padding: 60, alignItems: "center", gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center" },
  createBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
