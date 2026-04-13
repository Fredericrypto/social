import React, { useEffect, useState, useCallback, useContext, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Animated, Share, Modal,
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

const { width, height } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;
const HEADER_HEIGHT = 280;

type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";
const TABS: { key: ProfileTab; label: string }[] = [
  { key: "posts",    label: "Posts"    },
  { key: "thoughts", label: "Ideias"   },
  { key: "code",     label: "Código"   },
  { key: "projects", label: "Projetos" },
  { key: "saved",    label: "Salvos"   },
];

const BG_DARK: Record<string, [string,string,string]> = {
  purple:  ['#0d0221','#1a0533','#0f0020'],
  ocean:   ['#000d1a','#001a3a','#000a12'],
  sunset:  ['#1a0500','#2d0a00','#0d0200'],
  forest:  ['#001a0a','#052e16','#011a10'],
  night:   ['#000000','#0d0d0d','#050505'],
  rose:    ['#1a0010','#2d0018','#0d0008'],
  gold:    ['#1a0f00','#2d1a00','#0d0800'],
  cosmic:  ['#050012','#0d0221','#030010'],
  pastel1: ['#2d2040','#1e1530','#150e22'],
  pastel2: ['#0d1a12','#152b1e','#0a1410'],
  pastel3: ['#1a0d12','#2b1520','#14080d'],
  pastel4: ['#1a1a00','#2b2b00','#141400'],
};
const BG_LIGHT: Record<string, [string,string,string]> = {
  purple:  ['#f3e8ff','#e9d5ff','#ddd6fe'],
  ocean:   ['#dbeafe','#bfdbfe','#93c5fd'],
  sunset:  ['#fef2e2','#fde8cc','#fcd9a8'],
  forest:  ['#d1fae5','#a7f3d0','#6ee7b7'],
  night:   ['#f1f5f9','#e2e8f0','#cbd5e1'],
  rose:    ['#fce7f3','#fbcfe8','#f9a8d4'],
  gold:    ['#fef9c3','#fef08a','#fde047'],
  cosmic:  ['#ede9fe','#ddd6fe','#c4b5fd'],
  pastel1: ['#f0e6ff','#e4d4fd','#d8c2fb'],
  pastel2: ['#e0fdf4','#ccfbf1','#b2f5e9'],
  pastel3: ['#fdf2f8','#fce7f3','#fad1e8'],
  pastel4: ['#fffde7','#fff9c4','#fff59d'],
};

const isLightBg = (key: string, isDark: boolean) =>
  !isDark && ['pastel1','pastel2','pastel3','pastel4','night','forest','ocean'].includes(key);

export default function ProfileScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const { isDark } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [posts, setPosts] = useState<any[]>([]);
  const [stats, setStats] = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const userData = user as any;
  const bgKey = userData?.bannerGradient || 'purple';
  const bgColors = isDark ? (BG_DARK[bgKey] || BG_DARK.purple) : (BG_LIGHT[bgKey] || BG_LIGHT.purple);
  const isLight = isLightBg(bgKey, isDark);
  const textPrimary   = isLight ? "#111118" : "#ffffff";
  const textSecondary = isLight ? "#6B7280" : "rgba(255,255,255,0.55)";
  const textTertiary  = isLight ? "#9CA3AF" : "rgba(255,255,255,0.35)";
  const glassBlur     = isLight ? "light" : "dark";
  const statusBarStyle = isLight ? "dark-content" : "light-content";

  // Sticky tabs: header sobe até encaixar no topo
  const tabsTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT - insets.top - 44],
    outputRange: [0, -(HEADER_HEIGHT - insets.top - 44)],
    extrapolate: "clamp",
  });

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

  useEffect(() => {
    if (activeTab === "saved" && savedPosts.length === 0) {
      setSavedLoading(true);
      savedService.getMySaved()
        .then(d => setSavedPosts(d.posts || []))
        .catch(() => {})
        .finally(() => setSavedLoading(false));
    }
  }, [activeTab]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Confira o perfil de @${user?.username} na Minha Rede!\nhttps://social-production-8e37.up.railway.app/u/${user?.username}`,
        title: `@${user?.username} — Minha Rede`,
      });
    } catch {}
  };

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
          <View style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2, backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", padding: 8, justifyContent: "center" }]}>
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
        </View>
      );
      return renderGrid(savedPosts);
    }
    if (loading) return <View style={s.emptyTab}><ActivityIndicator color="#7C3AED" /></View>;
    const tabMap: Record<string, any[]> = { posts: imagePosts, thoughts: thoughtPosts, code: codePosts, projects: projectPosts };
    const tabPosts = tabMap[activeTab] || [];
    if (tabPosts.length === 0) return (
      <View style={s.emptyTab}>
        <Text style={[s.emptyTitle, { color: textPrimary }]}>Sem conteúdo ainda</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}>
          <Text style={s.createBtnText}>Criar agora</Text>
        </TouchableOpacity>
      </View>
    );
    if (activeTab === "posts") return renderGrid(imagePosts);
    if (activeTab === "thoughts") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {thoughtPosts.map(p => (
          <View key={p.id} style={[s.glassItem, { borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)" }]}>
            <BlurView intensity={20} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
            <Text style={{ color: textPrimary, fontSize: 14, lineHeight: 22 }}>{p.caption}</Text>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
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
          <View key={p.id} style={[s.glassItem, { borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)", padding: 0, overflow: "hidden" }]}>
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
      <StatusBar barStyle={statusBarStyle} translucent backgroundColor="transparent" />

      {/* Fundo estático */}
      <LinearGradient colors={bgColors} style={s.staticBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <View style={[s.bgOverlay, { backgroundColor: isLight ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.25)" }]} />

      {/* Gradiente blend bottom */}
      <LinearGradient
        colors={["transparent", bgColors[2]]}
        style={s.bottomFade}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
      />

      <Animated.ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={[s.topLogo, { color: textPrimary }]}>◈</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.topBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)" }]} onPress={() => navigation?.navigate?.("Messages")} activeOpacity={0.7}>
              <Ionicons name="paper-plane-outline" size={17} color={textPrimary} />
              {unreadMessages > 0 && <View style={s.badge}><Text style={s.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[s.topBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.1)" }]} onPress={() => navigation?.navigate?.("Settings")} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={17} color={textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Header: avatar + stats lado a lado (estilo Instagram) */}
        <View style={s.headerRow}>
          <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={82} showRing />
          <View style={s.statsRow}>
            {[
              { label: "posts",      value: stats.postsCount      },
              { label: "seguidores", value: stats.followersCount   },
              { label: "seguindo",   value: stats.followingCount   },
            ].map((st, i) => (
              <View key={st.label} style={s.statItem}>
                <Text style={[s.statValue, { color: textPrimary }]}>
                  {st.value >= 1000 ? `${(st.value/1000).toFixed(1)}k` : st.value}
                </Text>
                <Text style={[s.statLabel, { color: textSecondary }]}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Nome + handle + botões */}
        <View style={[s.identityRow, { paddingHorizontal: 20 }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.displayName, { color: textPrimary }]}>{user?.displayName || user?.username}</Text>
              {user?.isVerified && <Ionicons name="checkmark-circle" size={15} color="#06B6D4" />}
            </View>
            <Text style={[s.handle, { color: textSecondary }]}>@{user?.username}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.actionBtn, { borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)" }]} onPress={() => navigation?.navigate?.("EditProfile")} activeOpacity={0.7}>
              <BlurView intensity={25} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
              <Text style={[s.actionBtnText, { color: textPrimary }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.actionBtnSquare, { borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)" }]} onPress={handleShare} activeOpacity={0.7}>
              <BlurView intensity={25} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
              <Ionicons name="share-social-outline" size={16} color={textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info grid 2x2 */}
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
                    <View key={sk} style={[s.skillChip, { backgroundColor: "rgba(124,58,237,0.15)", borderColor: "rgba(124,58,237,0.3)" }]}>
                      <Text style={[s.skillText, { color: "#A78BFA" }]}>{sk}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Tabs sticky */}
        <Animated.View style={[s.tabsRow, { transform: [{ translateY: tabsTranslateY }] }]}>
          {TABS.map(tab => (
            <TouchableOpacity key={tab.key} style={s.tabBtn} onPress={() => setActiveTab(tab.key)} activeOpacity={0.7}>
              <Text style={[s.tabLabel, { color: activeTab === tab.key ? textPrimary : textTertiary }, activeTab === tab.key && { fontWeight: "700" }]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Conteúdo */}
        <View style={{ minHeight: 300, marginTop: 8 }}>
          {renderTabContent()}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#000" },
  staticBg:    { ...StyleSheet.absoluteFillObject },
  bgOverlay:   { ...StyleSheet.absoluteFillObject },
  bottomFade:  { position: "absolute", bottom: 0, left: 0, right: 0, height: 100, zIndex: 1 },
  scroll:      { flex: 1, zIndex: 2 },
  scrollContent: {},
  topBar:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  topLogo:     { fontSize: 20, fontWeight: "800" },
  topBtn:      { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badge:       { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText:   { color: "#fff", fontSize: 8, fontWeight: "700" },
  headerRow:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, gap: 16 },
  statsRow:    { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem:    { alignItems: "center" },
  statValue:   { fontSize: 20, fontWeight: "800" },
  statLabel:   { fontSize: 11, marginTop: 1 },
  identityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 },
  displayName: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  handle:      { fontSize: 13, marginTop: 1 },
  actionBtn:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, overflow: "hidden" },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  actionBtnSquare: { borderWidth: 1, borderRadius: 10, width: 36, height: 36, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  infoGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  infoCell:    { flex: 1, minWidth: "45%", borderRadius: 14, padding: 12, overflow: "hidden" },
  infoCellLabel: { fontSize: 10, fontWeight: "600", letterSpacing: 0.6, marginBottom: 3 },
  infoCellValue: { fontSize: 13, lineHeight: 18 },
  skillChip:   { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:   { fontSize: 11, fontWeight: "600" },
  tabsRow:     { flexDirection: "row", paddingHorizontal: 16, marginBottom: 4, gap: 4 },
  tabBtn:      { flex: 1, alignItems: "center", paddingVertical: 8, gap: 3 },
  tabLabel:    { fontSize: 12, fontWeight: "500" },
  tabUnderline: { width: 16, height: 2, borderRadius: 1, backgroundColor: "#7C3AED" },
  gridThumb:   { width: GRID_SIZE, height: GRID_SIZE },
  gridImg:     { width: "100%", height: "100%" },
  emptyTab:    { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle:  { fontSize: 16, fontWeight: "700" },
  createBtn:   { backgroundColor: "#7C3AED", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  glassItem:   { borderRadius: 16, borderWidth: 1, padding: 14, overflow: "hidden" },
});
