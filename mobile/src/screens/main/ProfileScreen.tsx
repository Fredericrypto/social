import React, {
  useEffect, useState, useCallback, useContext, useRef,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Share, ActionSheetIOS, Platform, Alert, LayoutChangeEvent,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedScrollHandler,
  interpolate, Extrapolation, useDerivedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import { api } from "../../services/api";
import { savedService } from "../../services/saved.service";
import Avatar from "../../components/ui/Avatar";
import EarlyAdopterBadge from "../../components/ui/EarlyAdopterBadge";
import { BadgeContext } from "../../context/BadgeContext";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;
const TABS_H    = 44; // altura fixa da barra de tabs

type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";
const TABS: { key: ProfileTab; icon: string; iconFilled: string }[] = [
  { key: "posts",    icon: "grid-outline",      iconFilled: "grid"         },
  { key: "thoughts", icon: "bulb-outline",       iconFilled: "bulb"         },
  { key: "code",     icon: "code-slash-outline", iconFilled: "code-slash"   },
  { key: "projects", icon: "briefcase-outline",  iconFilled: "briefcase"    },
  { key: "saved",    icon: "bookmark-outline",   iconFilled: "bookmark"     },
];

export default function ProfileScreen({ navigation }: any) {
  const { user }   = useAuthStore();
  const { isDark, theme } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const insets = useSafeAreaInsets();

  // ── Scroll ────────────────────────────────────────────────────────────────
  const scrollY   = useSharedValue(0);
  const scrollRef = useRef<any>(null);

  // ── Altura real do header (sem as tabs) ──────────────────────────────────
  // Começa com estimativa razoável; onLayout atualiza para o valor real.
  const [headerContentH, setHeaderContentH] = useState(260);
  const headerContentHSV = useSharedValue(260);

  const onHeaderContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setHeaderContentH(h);
    headerContentHSV.value = h;
  }, []);

  // Distância total que o header colapsa = altura do conteúdo (tudo acima das tabs)
  const collapseDistance = useDerivedValue(() => headerContentHSV.value);

  // ── Animated styles ───────────────────────────────────────────────────────

  // O bloco de conteúdo do header (avatar, stats, nome, info grid) sobe e some
  const headerContentAnimStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(
        scrollY.value,
        [0, collapseDistance.value],
        [0, -collapseDistance.value],
        Extrapolation.CLAMP,
      ),
    }],
  }));

  // A barra de tabs acompanha o conteúdo até encostar no topo, depois fica fixa
  const tabsAnimStyle = useAnimatedStyle(() => {
    const topBarH = insets.top + 44; // topBar real: insets + padding interno
    return {
      transform: [{
        translateY: interpolate(
          scrollY.value,
          [0, collapseDistance.value],
          [0, -(collapseDistance.value)],
          Extrapolation.CLAMP,
        ),
      }],
      // Pequena sombra quando fixo no topo
      shadowOpacity: interpolate(
        scrollY.value,
        [collapseDistance.value - 10, collapseDistance.value],
        [0, 0.18],
        Extrapolation.CLAMP,
      ),
    };
  });

  // O conteúdo do header (nome, bio, etc.) desaparece ao rolar
  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, collapseDistance.value * 0.6],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  // Reseta scroll ao sair da tela
  useFocusEffect(useCallback(() => {
    // Reseta scroll E tab ativa ao entrar na tela
    scrollY.value = 0;
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
    setActiveTab("posts");
  }, []));

  // ── Data ──────────────────────────────────────────────────────────────────
  const [posts,        setPosts]        = useState<any[]>([]);
  const [stats,        setStats]        = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<ProfileTab>("posts");
  const [savedPosts,   setSavedPosts]   = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [hasStories,   setHasStories]   = useState(false);

  const userData = user as any;
  const glassBlur = isDark ? "dark" : "light";

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
      try {
        const sr = await api.get(`/stories/user/${user.username}`);
        setHasStories((sr.data?.stories?.length || 0) > 0);
      } catch { setHasStories(false); }
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Confira o perfil de @${user?.username} na Minha Rede!\nhttps://social-production-8e37.up.railway.app/u/${user?.username}`,
        title: `@${user?.username} — Minha Rede`,
      });
    } catch {}
  };

  const handleAvatarPress = () => {
    const options = ["Trocar/Adicionar Foto", "Postar Flash (24h)", "Cancelar"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (idx) => {
        if (idx === 0) navigation?.navigate?.("EditProfile");
        if (idx === 1) navigation?.navigate?.("FlashEditor");
      });
    } else {
      Alert.alert("Foto de Perfil", "O que deseja fazer?", [
        { text: "Trocar/Adicionar Foto", onPress: () => navigation?.navigate?.("EditProfile") },
        { text: "Postar Flash (24h)",    onPress: () => navigation?.navigate?.("FlashEditor") },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  };

  const goToFollowers = (tab: "followers" | "following") =>
    navigation?.navigate?.("FollowersList", { username: user?.username, tab });

  // ── Filtros de posts ───────────────────────────────────────────────────────
  const imagePosts   = posts.filter(p => p.postType === "image"   || (p.mediaUrls?.length > 0 && !["code","project","text"].includes(p.postType)));
  const thoughtPosts = posts.filter(p => p.postType === "text");
  const codePosts    = posts.filter(p => p.postType === "code");
  const projectPosts = posts.filter(p => p.postType === "project");

  // ── Renders ───────────────────────────────────────────────────────────────
  const renderGrid = (data: any[], tabKey: string) => (
    <FlatList
      data={data}
      keyExtractor={(item, index) => `grid-${tabKey}-${item.id}-${index}`}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item, index }) =>
        item.mediaUrls?.length > 0 ? (
          <TouchableOpacity
            style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2 }]}
            activeOpacity={0.85}
          >
            <Image source={{ uri: item.mediaUrls[0] }} style={s.gridImg} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[s.gridThumb, {
            marginRight: index % 3 === 2 ? 0 : 2,
            backgroundColor: theme.surface,
            padding: 8,
            justifyContent: "center",
          }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16 }} numberOfLines={4}>
              {item.caption}
            </Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
    />
  );

  const renderTabContent = () => {
    if (activeTab === "saved") {
      if (savedLoading) return <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>;
      if (!savedPosts.length) return (
        <View style={s.emptyTab}>
          <Ionicons name="bookmark-outline" size={32} color={theme.textTertiary} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>Nada salvo ainda</Text>
        </View>
      );
      return renderGrid(savedPosts, "saved");
    }

    if (loading) return <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>;

    const tabMap: Record<string, any[]> = {
      posts: imagePosts, thoughts: thoughtPosts,
      code: codePosts,   projects: projectPosts,
    };
    const tabPosts = tabMap[activeTab] || [];

    if (!tabPosts.length) return (
      <View style={s.emptyTab}>
        <Ionicons name="file-tray-outline" size={32} color={theme.textTertiary} />
        <Text style={[s.emptyTitle, { color: theme.text }]}>Sem conteúdo ainda</Text>
        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: theme.primary }]}
          onPress={() => navigation?.navigate?.("Tabs", { screen: "NewPost" })}
        >
          <Text style={s.createBtnText}>Criar agora</Text>
        </TouchableOpacity>
      </View>
    );

    if (activeTab === "posts") return renderGrid(imagePosts, "posts");

    if (activeTab === "thoughts") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {thoughtPosts.map(p => (
          <View key={`thought-${p.id}`} style={[s.glassItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontSize: 14, lineHeight: 22 }}>{p.caption}</Text>
            <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
              <Ionicons name="heart-outline" size={13} color={theme.textTertiary} />
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{p.likesCount}</Text>
            </View>
          </View>
        ))}
      </View>
    );

    if (activeTab === "code") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {codePosts.map(p => {
          const code    = p.caption || "";
          const content = code.replace(/```[a-z]*/g, "").replace(/```/g, "").trim();
          const lang    = code.match(/```([a-z]+)/)?.[1] || "code";
          return (
            <View key={`code-${p.id}`} style={{ backgroundColor: "#1E1E2E", borderRadius: 14, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderBottomColor: "#313244" }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map((c, i) => (
                    <View key={`dot-${p.id}-${i}`} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
                  ))}
                </View>
                <Text style={{ color: "#6C7086", fontSize: 11, fontWeight: "600" }}>{lang}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={{ fontFamily: "monospace", fontSize: 12, color: "#CDD6F4", padding: 12, lineHeight: 20 }}>
                  {content}
                </Text>
              </ScrollView>
            </View>
          );
        })}
      </View>
    );

    if (activeTab === "projects") return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 10 }}>
        {projectPosts.map(p => (
          <View key={`project-${p.id}`} style={[s.glassItem, {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            padding: 0,
            overflow: "hidden",
          }]}>
            {p.mediaUrls?.[0] && (
              <Image source={{ uri: p.mediaUrls[0] }} style={{ width: "100%", height: 160 }} resizeMode="cover" />
            )}
            <View style={{ padding: 12 }}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>
                {p.caption?.split("\n")[0] || "Projeto"}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                {p.caption?.split("\n").slice(1).join(" ")}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );

    return null;
  };

  // ── Altura total do header fixo = conteúdo + tabs ─────────────────────────
  // Usada para dar paddingTop ao ScrollView (evita conteúdo escondido atrás do header)
  const totalHeaderH = headerContentH + TABS_H;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/*
       * ESTRUTURA DO HEADER FIXO:
       *
       * [stickyWrapper] — position absolute, zIndex 10, ponteiro none no wrapper
       *   ├── [headerContent] — Animated, colapsa para cima ao rolar
       *   │     ├── topBar (logo + botões)
       *   │     └── collapsingContent (avatar, stats, nome, grid info)  ← onLayout aqui
       *   └── [tabsBar] — Animated separado, segue o headerContent mas
       *                   fica travado no topo (clamp) — é sempre tocável
       */}

      <View style={[s.stickyWrapper, { paddingTop: insets.top }]} pointerEvents="box-none">

        {/* ── Bloco que colapsa ─────────────────────────────────────────── */}
        <Animated.View style={[s.collapsingBlock, headerContentAnimStyle]} pointerEvents="box-none">

          {/* Top bar — logo + mensagens + settings */}
          <View style={s.topBar} pointerEvents="box-none">
            <Text style={[s.topLogo, { color: theme.text }]}>◈</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[s.topBtn, { backgroundColor: theme.surface }]}
                onPress={() => navigation?.navigate?.("Messages")}
                activeOpacity={0.7}
              >
                <Ionicons name="paper-plane-outline" size={17} color={theme.text} />
                {unreadMessages > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.topBtn, { backgroundColor: theme.surface }]}
                onPress={() => navigation?.navigate?.("Settings")}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={17} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Conteúdo colapsável — onLayout mede a altura real */}
          <Animated.View style={contentFadeStyle} onLayout={onHeaderContentLayout}>

            {/* Avatar + stats */}
            <View style={s.headerRow}>
              <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85}>
                <Avatar
                  uri={user?.avatarUrl}
                  name={user?.displayName || user?.username}
                  size={82}
                  ring={hasStories ? "active" : "default"}
                />
              </TouchableOpacity>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: theme.text }]}>
                    {stats.postsCount >= 1000 ? `${(stats.postsCount/1000).toFixed(1)}k` : stats.postsCount}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>posts</Text>
                </View>
                <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("followers")} activeOpacity={0.7}>
                  <Text style={[s.statValue, { color: theme.text }]}>
                    {stats.followersCount >= 1000 ? `${(stats.followersCount/1000).toFixed(1)}k` : stats.followersCount}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguidores</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("following")} activeOpacity={0.7}>
                  <Text style={[s.statValue, { color: theme.text }]}>
                    {stats.followingCount >= 1000 ? `${(stats.followingCount/1000).toFixed(1)}k` : stats.followingCount}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguindo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Nome + handle + botões */}
            <View style={[s.identityRow, { paddingHorizontal: 20 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={[s.displayName, { color: theme.text }]}>
                    {user?.displayName || user?.username}
                  </Text>
                  {(user as any)?.isVerified && (
                    <Ionicons name="checkmark-circle" size={15} color="#06B6D4" />
                  )}
                  {/* Early Adopter Badge — só aparece se o usuário optou por mostrar */}
                  {(userData?.earlyAdopterNumber && userData?.showEarlyAdopterBadge) && (
                    <EarlyAdopterBadge number={userData.earlyAdopterNumber} size="sm" />
                  )}
                </View>
                <Text style={[s.handle, { color: theme.textSecondary }]}>@{user?.username}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => navigation?.navigate?.("EditProfile")}
                  activeOpacity={0.7}
                >
                  <Text style={[s.actionBtnText, { color: theme.text }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtnSquare, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-social-outline" size={16} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Grid 2×2 — Bio, Trabalho, Website, Skills */}
            {(user?.bio || userData?.jobTitle || userData?.website || userData?.skills?.length > 0) && (
              <View style={s.infoGrid}>
                {user?.bio ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>BIO</Text>
                    <Text style={[s.infoCellValue, { color: theme.text }]} numberOfLines={3}>
                      {user.bio.slice(0, 80)}
                    </Text>
                  </View>
                ) : null}
                {(userData?.jobTitle || userData?.company) ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>TRABALHO</Text>
                    <Text style={[s.infoCellValue, { color: theme.text }]} numberOfLines={2}>
                      {[userData.jobTitle, userData.company].filter(Boolean).join(" · ").slice(0, 50)}
                    </Text>
                  </View>
                ) : null}
                {userData?.website ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>WEBSITE</Text>
                    <Text style={[s.infoCellValue, { color: theme.primaryLight }]} numberOfLines={1}>
                      {userData.website.replace(/^https?:\/\//, "")}
                    </Text>
                  </View>
                ) : null}
                {userData?.skills?.length > 0 ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>SKILLS</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {userData.skills.slice(0, 4).map((sk: string, idx: number) => (
                        <View
                          key={`skill-${idx}-${sk}`}
                          style={[s.skillChip, {
                            backgroundColor: theme.primary + "22",
                            borderColor: theme.primary + "44",
                          }]}
                        >
                          <Text style={[s.skillText, { color: theme.primaryLight }]}>{sk}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            )}

          </Animated.View>
          {/* fim contentFadeStyle */}

        </Animated.View>
        {/* fim collapsingBlock */}

        {/* ── Barra de tabs — sticky real ──────────────────────────────── */}
        <Animated.View
          style={[s.tabsBar, { borderBottomColor: theme.border, borderTopColor: theme.border }, tabsAnimStyle]}
        >
          <BlurView intensity={88} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
          {TABS.map(tab => (
            <TouchableOpacity
              key={`tab-${tab.key}`}
              style={s.tabBtn}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(activeTab === tab.key ? tab.iconFilled : tab.icon) as any}
                size={20}
                color={activeTab === tab.key ? theme.primary : theme.textTertiary}
              />
              {activeTab === tab.key && (
                <View style={[s.tabUnderline, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>
          ))}
        </Animated.View>
        {/* fim tabsBar */}

      </View>
      {/* fim stickyWrapper */}

      {/* ── ScrollView do conteúdo ────────────────────────────────────────── */}
      <Animated.ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={{
          // paddingTop dinâmico: altura real do header + tabs + pequeno espaço
          paddingTop: totalHeaderH + 8,
          paddingBottom: 100 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={1}
      >
        {renderTabContent()}
      </Animated.ScrollView>

    </View>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1 },

  // Wrapper absoluto que contém todo o header fixo
  stickyWrapper:  {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
  },

  // Bloco que colapsa (sobe) ao rolar
  collapsingBlock: {
    // Sem backgroundColor — herda do root para não criar faixas
  },

  scroll:         { flex: 1, zIndex: 2 },

  // Top bar
  topBar:         {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topLogo:        { fontSize: 20, fontWeight: "800" },
  topBtn:         { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badge:          {
    position: "absolute", top: -4, right: -4,
    minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText:      { color: "#fff", fontSize: 8, fontWeight: "700" },

  // Conteúdo do header
  headerRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, gap: 16 },
  statsRow:       { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem:       { alignItems: "center", paddingHorizontal: 4 },
  statValue:      { fontSize: 20, fontWeight: "800" },
  statLabel:      { fontSize: 11, marginTop: 1 },
  identityRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 },
  displayName:    { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  handle:         { fontSize: 13, marginTop: 1 },
  actionBtn:      { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, overflow: "hidden" },
  actionBtnText:  { fontSize: 13, fontWeight: "600" },
  actionBtnSquare:{ borderWidth: 1, borderRadius: 10, width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  // Grid 2×2
  infoGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  infoCell:       { flex: 1, minWidth: "45%", maxWidth: "49%", borderRadius: 14, padding: 12, borderWidth: 1, minHeight: 72 },
  infoCellLabel:  { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  infoCellValue:  { fontSize: 13, lineHeight: 18 },
  skillChip:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:      { fontSize: 11, fontWeight: "600" },

  // Tabs sticky — Animated.View separado, fica posicionado logo abaixo do collapsingBlock
  tabsBar:        {
    height: TABS_H,
    flexDirection: "row",
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  tabBtn:         { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 3 },
  tabUnderline:   { height: 2, width: 16, borderRadius: 1 },

  // Conteúdo das tabs
  gridThumb:      { width: GRID_SIZE, height: GRID_SIZE },
  gridImg:        { width: "100%", height: "100%" },
  emptyTab:       { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle:     { fontSize: 16, fontWeight: "700" },
  createBtn:      { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText:  { color: "#fff", fontWeight: "700", fontSize: 14 },
  glassItem:      { borderRadius: 16, borderWidth: 1, padding: 14 },
});
