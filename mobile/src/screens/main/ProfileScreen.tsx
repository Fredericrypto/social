import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
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

const { width, height } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;

type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";
const TABS: { key: ProfileTab; icon: string }[] = [
  { key: "posts",    icon: "images-outline"    },
  { key: "thoughts", icon: "chatbubble-outline" },
  { key: "code",     icon: "code-slash-outline" },
  { key: "projects", icon: "briefcase-outline"  },
  { key: "saved",    icon: "bookmark-outline"   },
];

// 10 fundos premium — não afetados pelo tema
const BACKGROUNDS: Record<string, [string, string, string, string]> = {
  // Smoke
  neon_smoke:    ['#0d0221', '#1a0533', '#2d1b69', '#06061a'],
  deep_purple:   ['#0a0015', '#1e0635', '#3b0764', '#0f0020'],
  forest_mist:   ['#001a0a', '#052e16', '#064e3b', '#011a10'],
  // Abstract / Geometric feel via gradient
  bauhaus_fire:  ['#1a0a00', '#3d0e00', '#7c2d12', '#1a0500'],
  bauhaus_ice:   ['#000d1a', '#0c1445', '#1e3a5f', '#000a12'],
  bauhaus_earth: ['#0f0a00', '#1c1400', '#3d2f00', '#0a0700'],
  // Modern Gradients
  deep_ocean:    ['#000428', '#001a3a', '#004e92', '#000a1a'],
  sunset_ember:  ['#0d0000', '#3d0000', '#7f1d1d', '#450a0a'],
  silver_silk:   ['#0a0a0f', '#111827', '#1f2937', '#030712'],
  midnight_aurora: ['#000510', '#0d1b2a', '#1b2838', '#051020'],
};

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

  // Fundo baseado no bannerGradient do usuário — mapeado para BACKGROUNDS
  const bgMap: Record<string, keyof typeof BACKGROUNDS> = {
    purple:  'deep_purple',
    ocean:   'deep_ocean',
    sunset:  'sunset_ember',
    forest:  'forest_mist',
    night:   'silver_silk',
    rose:    'neon_smoke',
    gold:    'bauhaus_fire',
    cosmic:  'midnight_aurora',
  };
  const bgKey = bgMap[userData?.bannerGradient || 'purple'] || 'deep_purple';
  const bgColors = BACKGROUNDS[bgKey];

  const loadData = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [postsRes, profileRes] = await Promise.all([
        api.get(`/posts/user/${user.username}?limit=30`),
        api.get(`/users/${user.username}`),
      ]);
      setPosts(postsRes.data.posts || []);
      setStats({
        postsCount:    profileRes.data.postsCount    || 0,
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

  const imagePosts   = posts.filter(p => p.postType === 'image'   || (p.mediaUrls?.length > 0 && !['code','project'].includes(p.postType)));
  const thoughtPosts = posts.filter(p => p.postType === 'text'    || (!p.mediaUrls?.length && p.caption && !p.caption.includes("```") && p.postType !== 'code'));
  const codePosts    = posts.filter(p => p.postType === 'code'    || p.caption?.includes("```"));
  const projectPosts = posts.filter(p => p.postType === 'project');

  const renderTabContent = () => {
    if (activeTab === "saved") {
      if (savedLoading) return <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>;
      if (savedPosts.length === 0) return (
        <View style={s.emptyTab}>
          <Ionicons name="bookmark-outline" size={32} color={theme.primaryLight} />
          <Text style={[s.emptyTitle, { color: "#fff" }]}>Nada salvo ainda</Text>
          <Text style={[s.emptySub, { color: "rgba(255,255,255,0.5)" }]}>Só você vê seus itens salvos</Text>
        </View>
      );
      return renderGrid(savedPosts);
    }

    if (loading) return <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>;

    const tabMap: Record<string, any[]> = {
      posts: imagePosts, thoughts: thoughtPosts, code: codePosts, projects: projectPosts,
    };
    const tabPosts = tabMap[activeTab] || [];

    if (tabPosts.length === 0) return (
      <View style={s.emptyTab}>
        <Ionicons name={TABS.find(t => t.key === activeTab)?.icon as any} size={32} color={theme.primaryLight} />
        <Text style={[s.emptyTitle, { color: "#fff" }]}>Sem conteúdo ainda</Text>
        <TouchableOpacity style={[s.createBtn, { backgroundColor: theme.primary }]}
          onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}>
          <Text style={s.createBtnText}>Criar agora</Text>
        </TouchableOpacity>
      </View>
    );

    if (activeTab === "posts") return renderGrid(imagePosts);

    if (activeTab === "thoughts") return (
      <View style={{ padding: 8 }}>
        {thoughtPosts.map(p => (
          <View key={p.id} style={s.thoughtCard}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={{ color: "#fff", fontSize: 14, lineHeight: 22 }}>{p.caption}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 }}>
              <Ionicons name="heart-outline" size={13} color="rgba(255,255,255,0.5)" />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{p.likesCount}</Text>
            </View>
          </View>
        ))}
      </View>
    );

    if (activeTab === "code") return (
      <View style={{ padding: 8 }}>
        {codePosts.map(p => {
          const code = p.caption || "";
          const content = code.replace(/```[a-z]*/g, "").replace(/```/g, "").trim();
          const lang = code.match(/```([a-z]+)/)?.[1] || "code";
          return (
            <View key={p.id} style={s.codeCard}>
              <View style={s.codeTopBar}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map(c => <View key={c} style={[s.codeDot, { backgroundColor: c }]} />)}
                </View>
                <Text style={s.codeLang}>{lang}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={s.codeText}>{content}</Text>
              </ScrollView>
            </View>
          );
        })}
      </View>
    );

    if (activeTab === "projects") return (
      <View style={{ padding: 8 }}>
        {projectPosts.map(p => (
          <View key={p.id} style={s.projectCard}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
            {p.mediaUrls?.[0] && <Image source={{ uri: p.mediaUrls[0] }} style={s.projectCover} resizeMode="cover" />}
            <View style={{ padding: 12 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                {p.caption?.split("\n")[0] || "Projeto"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                {p.caption?.split("\n").slice(1).join(" ")}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );

    return null;
  };

  const renderGrid = (data: any[]) => (
    <FlatList
      data={data}
      keyExtractor={i => i.id}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item, index }) => (
        item.mediaUrls?.length > 0 ? (
          <TouchableOpacity style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2 }]} activeOpacity={0.85}>
            <Image source={{ uri: item.mediaUrls[0] }} style={s.gridImg} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", padding: 8 }]}>
            <Text style={{ color: "#fff", fontSize: 11, lineHeight: 16 }} numberOfLines={4}>{item.caption}</Text>
          </View>
        )
      )}
      ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
    />
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Fundo estático — ocupa 100% da tela, não rola */}
      <LinearGradient
        colors={bgColors}
        style={s.staticBg}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      />

      {/* Overlay escuro para legibilidade */}
      <View style={s.bgOverlay} />

      {/* Conteúdo rolável com fundo transparente */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces
      >
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

        {/* Avatar */}
        <View style={s.avatarSection}>
          <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={90} showRing />
        </View>

        {/* Identidade — glass */}
        <View style={s.glassCard}>
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={s.glassInner}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.displayName}>{user?.displayName || user?.username}</Text>
              {user?.isVerified && <Ionicons name="checkmark-circle" size={16} color="#06B6D4" />}
            </View>
            <Text style={s.handle}>@{user?.username}</Text>

            {(userData?.jobTitle || userData?.company) && (
              <View style={s.jobRow}>
                <Ionicons name="briefcase-outline" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={s.jobText}>{[userData.jobTitle, userData.company].filter(Boolean).join(" · ")}</Text>
              </View>
            )}

            {user?.bio && <Text style={s.bio}>{user.bio}</Text>}

            {userData?.skills?.length > 0 && (
              <View style={s.skills}>
                {userData.skills.slice(0, 5).map((sk: string) => (
                  <View key={sk} style={s.skillChip}>
                    <Text style={s.skillText}>{sk}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Stats — glass */}
        <View style={s.statsRow}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          {[
            { label: "posts",      value: stats.postsCount      },
            { label: "seguidores", value: stats.followersCount   },
            { label: "seguindo",   value: stats.followingCount   },
          ].map((st, i) => (
            <React.Fragment key={st.label}>
              {i > 0 && <View style={s.statDivider} />}
              <View style={s.statItem}>
                <Text style={s.statValue}>{st.value >= 1000 ? `${(st.value/1000).toFixed(1)}k` : st.value}</Text>
                <Text style={s.statLabel}>{st.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Ações */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => navigation?.navigate?.("EditProfile")} activeOpacity={0.7}>
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Text style={s.editBtnText}>Editar perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} activeOpacity={0.7}>
            <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="share-social-outline" size={17} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Tabs — minimalistas */}
        <View style={s.tabsRow}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.key ? "#fff" : "rgba(255,255,255,0.35)"}
              />
              {activeTab === tab.key && <View style={s.tabDot} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Conteúdo */}
        <View style={{ minHeight: 300 }}>
          {renderTabContent()}
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  staticBg: { ...StyleSheet.absoluteFillObject },
  bgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  topLogo: { fontSize: 20, fontWeight: "800", color: "#fff" },
  topBtn: { width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 2 },
  badgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  avatarSection: { alignItems: "center", marginTop: 24, marginBottom: 16 },
  glassCard: { marginHorizontal: 16, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  glassInner: { alignItems: "center", padding: 16, gap: 4 },
  displayName: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.4 },
  handle: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  jobRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  jobText: { fontSize: 12, color: "rgba(255,255,255,0.5)" },
  bio: { fontSize: 13, textAlign: "center", lineHeight: 18, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 8 },
  skillChip: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(124,58,237,0.5)", backgroundColor: "rgba(124,58,237,0.15)", paddingHorizontal: 10, paddingVertical: 3 },
  skillText: { fontSize: 11, fontWeight: "600", color: "#A78BFA" },
  statsRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 10, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statItem: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 11, marginTop: 1, color: "rgba(255,255,255,0.5)" },
  statDivider: { width: 1, marginVertical: 12, backgroundColor: "rgba(255,255,255,0.1)" },
  actionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
  editBtn: { flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingVertical: 10, alignItems: "center", overflow: "hidden" },
  editBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  shareBtn: { borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  tabsRow: { flexDirection: "row", marginTop: 16, marginHorizontal: 16, borderRadius: 14, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.05)" },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 12, gap: 4 },
  tabItemActive: { backgroundColor: "rgba(124,58,237,0.25)" },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#7C3AED" },
  gridThumb: { width: GRID_SIZE, height: GRID_SIZE },
  gridImg: { width: "100%", height: "100%" },
  emptyTab: { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center" },
  createBtn: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  thoughtCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 14, marginBottom: 8, overflow: "hidden" },
  codeCard: { borderRadius: 12, overflow: "hidden", marginBottom: 8, backgroundColor: "#1E1E2E" },
  codeTopBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#313244" },
  codeDot: { width: 10, height: 10, borderRadius: 5 },
  codeLang: { color: "#6C7086", fontSize: 11, fontWeight: "600" },
  codeText: { fontFamily: "monospace", fontSize: 12, color: "#CDD6F4", padding: 12, lineHeight: 20 },
  projectCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 8 },
  projectCover: { width: "100%", height: 160 },
});
