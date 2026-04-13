import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import { api } from "../../services/api";
import { savedService } from "../../services/saved.service";
import Avatar from "../../components/ui/Avatar";
import { BadgeContext } from "../../context/BadgeContext";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;

type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";
const TABS: { key: ProfileTab; icon: string; label: string }[] = [
  { key: "posts",    icon: "images-outline",     label: "Posts"     },
  { key: "thoughts", icon: "chatbubble-outline",  label: "Ideias"    },
  { key: "code",     icon: "code-slash-outline",  label: "Código"    },
  { key: "projects", icon: "briefcase-outline",   label: "Projetos"  },
  { key: "saved",    icon: "bookmark-outline",    label: "Salvos"    },
];

// Paleta: dark profundo + pastel claro por chave
const BG_DARK: Record<string, [string,string,string]> = {
  purple:  ['#0d0221', '#1a0533', '#0f0020'],
  ocean:   ['#000d1a', '#001a3a', '#000a12'],
  sunset:  ['#1a0500', '#2d0a00', '#0d0200'],
  forest:  ['#001a0a', '#052e16', '#011a10'],
  night:   ['#000000', '#0d0d0d', '#050505'],
  rose:    ['#1a0010', '#2d0018', '#0d0008'],
  gold:    ['#1a0f00', '#2d1a00', '#0d0800'],
  cosmic:  ['#050012', '#0d0221', '#030010'],
  pastel1: ['#2d2040', '#1e1530', '#150e22'],
  pastel2: ['#0d1a12', '#152b1e', '#0a1410'],
  pastel3: ['#1a0d12', '#2b1520', '#14080d'],
  pastel4: ['#1a1a00', '#2b2b00', '#141400'],
};

const BG_LIGHT: Record<string, [string,string,string]> = {
  purple:  ['#f3e8ff', '#e9d5ff', '#ddd6fe'],
  ocean:   ['#dbeafe', '#bfdbfe', '#93c5fd'],
  sunset:  ['#fef2e2', '#fde8cc', '#fcd9a8'],
  forest:  ['#d1fae5', '#a7f3d0', '#6ee7b7'],
  night:   ['#f1f5f9', '#e2e8f0', '#cbd5e1'],
  rose:    ['#fce7f3', '#fbcfe8', '#f9a8d4'],
  gold:    ['#fef9c3', '#fef08a', '#fde047'],
  cosmic:  ['#ede9fe', '#ddd6fe', '#c4b5fd'],
  pastel1: ['#f0e6ff', '#e4d4fd', '#d8c2fb'],
  pastel2: ['#e0fdf4', '#ccfbf1', '#b2f5e9'],
  pastel3: ['#fdf2f8', '#fce7f3', '#fad1e8'],
  pastel4: ['#fffde7', '#fff9c4', '#fff59d'],
};

// Texto adaptativo: escuro em fundos claros, branco em fundos escuros
const isLightBg = (key: string, isDark: boolean) => !isDark && ['pastel1','pastel2','pastel3','pastel4','night','forest','ocean'].includes(key);

export default function ProfileScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { isDark } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const userData = user as any;
  const bgKey = userData?.bannerGradient || 'purple';
  const bgColors = isDark ? BG_DARK[bgKey] || BG_DARK.purple : BG_LIGHT[bgKey] || BG_LIGHT.purple;
  const isLight = isLightBg(bgKey, isDark);

  // Cores adaptativas baseadas no fundo
  const textPrimary   = isLight ? "#111118" : "#ffffff";
  const textSecondary = isLight ? "#6B7280" : "rgba(255,255,255,0.55)";
  const textTertiary  = isLight ? "#9CA3AF" : "rgba(255,255,255,0.35)";
  const glassBlur     = isLight ? "light"   : "dark";
  const statusBar     = isLight ? "dark-content" : "light-content";

  const loadData = useCallback(async () => {
    if (!user?.username) return;
    try {
      const [postsRes, profileRes] = await Promise.all([
        api.get(`/posts/user/${user.username}?limit=30`),
        api.get(`/users/${user.username}`),
      ]);
      setPosts(postsRes.data.posts || []);
      setStats({
        postsCount:     profileRes.data.postsCount     || 0,
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
          <View style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2, backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", padding: 8, alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: textSecondary, fontSize: 11, lineHeight: 16 }} numberOfLines={4}>{item.caption}</Text>
          </View>
        )
      )}
      ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
    />
  );

  const renderTabContent = () => {
    if (activeTab === "saved") {
      if (savedLoading) return <View style={s.emptyTab}><ActivityIndicator color="#7C3AED" /></View>;
      if (savedPosts.length === 0) return (
        <View style={s.emptyTab}>
          <Ionicons name="bookmark-outline" size={32} color={textTertiary} />
          <Text style={[s.emptyTitle, { color: textPrimary }]}>Nada salvo ainda</Text>
          <Text style={[s.emptySub, { color: textSecondary }]}>Só você vê seus itens salvos</Text>
        </View>
      );
      return renderGrid(savedPosts);
    }
    if (loading) return <View style={s.emptyTab}><ActivityIndicator color="#7C3AED" /></View>;

    const tabMap: Record<string, any[]> = { posts: imagePosts, thoughts: thoughtPosts, code: codePosts, projects: projectPosts };
    const tabPosts = tabMap[activeTab] || [];

    if (tabPosts.length === 0) return (
      <View style={s.emptyTab}>
        <Ionicons name={TABS.find(t => t.key === activeTab)?.icon as any} size={32} color={textTertiary} />
        <Text style={[s.emptyTitle, { color: textPrimary }]}>Sem conteúdo ainda</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}>
          <Text style={s.createBtnText}>Criar agora</Text>
        </TouchableOpacity>
      </View>
    );

    if (activeTab === "posts")    return renderGrid(imagePosts);
    if (activeTab === "thoughts") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {thoughtPosts.map(p => (
          <View key={p.id} style={[s.thoughtCard, { borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)" }]}>
            <BlurView intensity={20} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
            <Text style={{ color: textPrimary, fontSize: 14, lineHeight: 22 }}>{p.caption}</Text>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 8, alignItems: "center" }}>
              <Ionicons name="heart-outline" size={13} color={textTertiary} />
              <Text style={{ color: textTertiary, fontSize: 12 }}>{p.likesCount}</Text>
            </View>
          </View>
        ))}
      </View>
    );
    if (activeTab === "code") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {codePosts.map(p => {
          const code = p.caption || "";
          const content = code.replace(/```[a-z]*/g, "").replace(/```/g, "").trim();
          const lang = code.match(/```([a-z]+)/)?.[1] || "code";
          return (
            <View key={p.id} style={{ backgroundColor: "#1E1E2E", borderRadius: 14, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderBottomColor: "#313244" }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map(c => <View key={c} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />)}
                </View>
                <Text style={{ color: "#6C7086", fontSize: 11, fontWeight: "600" }}>{lang}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={{ fontFamily: "monospace", fontSize: 12, color: "#CDD6F4", padding: 12, lineHeight: 20 }}>{content}</Text>
              </ScrollView>
            </View>
          );
        })}
      </View>
    );
    if (activeTab === "projects") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {projectPosts.map(p => (
          <View key={p.id} style={[s.projectCard, { borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)" }]}>
            <BlurView intensity={20} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
            {p.mediaUrls?.[0] && <Image source={{ uri: p.mediaUrls[0] }} style={{ width: "100%", height: 160 }} resizeMode="cover" />}
            <View style={{ padding: 12 }}>
              <Text style={{ color: textPrimary, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{p.caption?.split("\n")[0] || "Projeto"}</Text>
              <Text style={{ color: textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{p.caption?.split("\n").slice(1).join(" ")}</Text>
            </View>
          </View>
        ))}
      </View>
    );
    return null;
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle={statusBar} translucent backgroundColor="transparent" />

      {/* Fundo estático imersivo */}
      <LinearGradient colors={bgColors} style={s.staticBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[s.bgOverlay, { backgroundColor: isLight ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.3)" }]} />

      {/* Gradiente inferior para blend com tab bar */}
      <LinearGradient
        colors={["transparent", bgColors[2]]}
        style={s.bottomFade}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={[s.topLogo, { color: textPrimary }]}>◈</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.topBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)" }]} onPress={() => navigation?.navigate?.("Messages")} activeOpacity={0.7}>
              <Ionicons name="paper-plane-outline" size={17} color={textPrimary} />
              {unreadMessages > 0 && (
                <View style={s.badge}><Text style={s.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[s.topBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)" }]} onPress={() => navigation?.navigate?.("Settings")} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={17} color={textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Avatar + nome + handle */}
        <View style={s.heroSection}>
          <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={88} showRing />
          <View style={s.heroText}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[s.displayName, { color: textPrimary }]}>{user?.displayName || user?.username}</Text>
              {user?.isVerified && <Ionicons name="checkmark-circle" size={16} color="#06B6D4" />}
              <TouchableOpacity onPress={() => navigation?.navigate?.("EditProfile")} activeOpacity={0.7}>
                <View style={[s.editIcon, { backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)" }]}>
                  <Ionicons name="pencil-outline" size={13} color={textSecondary} />
                </View>
              </TouchableOpacity>
            </View>
            <Text style={[s.handle, { color: textSecondary }]}>@{user?.username}</Text>
          </View>
        </View>

        {/* Bio e infos em grid 2x2 */}
        {(user?.bio || userData?.jobTitle || userData?.website || userData?.skills?.length > 0) && (
          <View style={s.infoGrid}>
            {user?.bio ? (
              <View style={[s.infoCell, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)" }]}>
                <BlurView intensity={15} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
                <Text style={[s.infoCellLabel, { color: textTertiary }]}>bio</Text>
                <Text style={[s.infoCellValue, { color: textPrimary }]}>{user.bio}</Text>
              </View>
            ) : null}
            {(userData?.jobTitle || userData?.company) ? (
              <View style={[s.infoCell, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)" }]}>
                <BlurView intensity={15} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
                <Text style={[s.infoCellLabel, { color: textTertiary }]}>trabalho</Text>
                <Text style={[s.infoCellValue, { color: textPrimary }]}>{[userData.jobTitle, userData.company].filter(Boolean).join(" · ")}</Text>
              </View>
            ) : null}
            {userData?.website ? (
              <View style={[s.infoCell, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)" }]}>
                <BlurView intensity={15} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
                <Text style={[s.infoCellLabel, { color: textTertiary }]}>website</Text>
                <Text style={[s.infoCellValue, { color: "#A78BFA" }]}>{userData.website}</Text>
              </View>
            ) : null}
            {userData?.skills?.length > 0 ? (
              <View style={[s.infoCell, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)" }]}>
                <BlurView intensity={15} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
                <Text style={[s.infoCellLabel, { color: textTertiary }]}>skills</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                  {userData.skills.slice(0, 4).map((sk: string) => (
                    <View key={sk} style={[s.skillChip, { backgroundColor: isLight ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.2)", borderColor: "rgba(124,58,237,0.3)" }]}>
                      <Text style={[s.skillText, { color: "#A78BFA" }]}>{sk}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: "posts",      value: stats.postsCount      },
            { label: "seguidores", value: stats.followersCount   },
            { label: "seguindo",   value: stats.followingCount   },
          ].map((st, i) => (
            <React.Fragment key={st.label}>
              {i > 0 && <View style={[s.statDivider, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />}
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: textPrimary }]}>
                  {st.value >= 1000 ? `${(st.value/1000).toFixed(1)}k` : st.value}
                </Text>
                <Text style={[s.statLabel, { color: textSecondary }]}>{st.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Tabs — apenas texto, estilo minimalista */}
        <View style={s.tabsRow}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={s.tabBtn}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                s.tabLabel,
                { color: activeTab === tab.key ? textPrimary : textTertiary },
                activeTab === tab.key && s.tabLabelActive,
              ]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Conteúdo das tabs */}
        <View style={{ minHeight: 300 }}>
          {renderTabContent()}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#000" },
  staticBg:    { ...StyleSheet.absoluteFillObject },
  bgOverlay:   { ...StyleSheet.absoluteFillObject },
  bottomFade:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 120, zIndex: 1 },
  scroll:      { flex: 1, zIndex: 2 },
  scrollContent: { paddingBottom: 100 },
  topBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  topLogo:     { fontSize: 20, fontWeight: "800" },
  topBtn:      { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badge:       { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:   { color: "#fff", fontSize: 8, fontWeight: "700" },
  heroSection: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 12 },
  heroText:    { gap: 3 },
  displayName: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  handle:      { fontSize: 13 },
  editIcon:    { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  infoGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  infoCell:    { flex: 1, minWidth: "45%", borderRadius: 14, padding: 12, overflow: "hidden" },
  infoCellLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, marginBottom: 3 },
  infoCellValue: { fontSize: 13, lineHeight: 18 },
  skillChip:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:   { fontSize: 11, fontWeight: "600" },
  statsRow:    { flexDirection: "row", paddingHorizontal: 20, marginBottom: 20 },
  statItem:    { flex: 1, alignItems: "center" },
  statValue:   { fontSize: 20, fontWeight: "800" },
  statLabel:   { fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, marginVertical: 8 },
  tabsRow:     { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 4 },
  tabBtn:      { flex: 1, alignItems: "center", paddingVertical: 8, gap: 4 },
  tabLabel:    { fontSize: 12, fontWeight: "500" },
  tabLabelActive: { fontWeight: "700" },
  tabUnderline: { width: 16, height: 2, borderRadius: 1, backgroundColor: "#7C3AED" },
  gridThumb:   { width: GRID_SIZE, height: GRID_SIZE },
  gridImg:     { width: "100%", height: "100%" },
  emptyTab:    { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle:  { fontSize: 16, fontWeight: "700" },
  emptySub:    { fontSize: 13, textAlign: "center" },
  createBtn:   { backgroundColor: "#7C3AED", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  thoughtCard: { borderRadius: 16, borderWidth: 1, padding: 14, overflow: "hidden" },
  projectCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
});
