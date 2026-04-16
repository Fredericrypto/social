/**
 * ProfileScreen — Reengenharia completa
 *
 * Arquitetura: FlatList única com ListHeaderComponent
 * - Zero position:absolute no header
 * - Parallax real via Animated.event no scroll
 * - Blur progressivo no top bar conforme scroll
 * - Bio livre, sem rótulo, alinhada à esquerda
 * - Trabalho/Website/Skills à direita dos botões
 * - Tabs minimalistas: só ícone + dot ativo (sem underline reto)
 * - Ícone de posts = imagens, thoughts = balão de chat
 * - Botões DM/Settings com borda colorida do tema
 */

import React, {
  useEffect, useState, useCallback, useContext, useRef,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Share, ActionSheetIOS, Platform, Alert, Animated,
} from "react-native";
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
const GRID_SIZE  = (width - 4) / 3;
const TOPBAR_H   = 56; // altura do top bar (logo + btns)
const TABS_H     = 46;
const PARALLAX_H = 0;  // sem imagem de capa — parallax no blur apenas

// ─── Tabs — ícones atualizados ────────────────────────────────────────────────
type ProfileTab = "posts" | "thoughts" | "code" | "projects" | "saved";
const TABS: { key: ProfileTab; icon: string; iconFilled: string }[] = [
  { key: "posts",    icon: "images-outline",        iconFilled: "images"           }, // fotos
  { key: "thoughts", icon: "chatbubble-outline",    iconFilled: "chatbubble"       }, // balão
  { key: "code",     icon: "code-slash-outline",    iconFilled: "code-slash"       },
  { key: "projects", icon: "briefcase-outline",     iconFilled: "briefcase"        },
  { key: "saved",    icon: "bookmark-outline",      iconFilled: "bookmark"         },
];

export default function ProfileScreen({ navigation }: any) {
  const { user }   = useAuthStore();
  const { isDark, theme } = useThemeStore();
  const { unreadMessages, refreshBadges } = useContext(BadgeContext);
  const insets = useSafeAreaInsets();

  // ── Scroll para parallax / blur ───────────────────────────────────────────
  const scrollY    = useRef(new Animated.Value(0)).current;
  const listRef    = useRef<FlatList>(null);

  // Blur do topBar: aparece progressivamente ao rolar
  const topBarBlurOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Fade do avatar/stats conforme scroll (parallax suave)
  const headerParallax = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -30],
    extrapolate: "clamp",
  });

  const headerFade = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.3],
    extrapolate: "clamp",
  });

  // ── Reset ao entrar na tela ────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    scrollY.setValue(0);
    listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
    setActiveTab("posts");
  }, []));

  // ── Data ───────────────────────────────────────────────────────────────────
  const [posts,        setPosts]        = useState<any[]>([]);
  const [stats,        setStats]        = useState({ postsCount: 0, followersCount: 0, followingCount: 0 });
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<ProfileTab>("posts");
  const [savedPosts,   setSavedPosts]   = useState<any[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [hasStories,   setHasStories]   = useState(false);
  // Tab bar sticky — posição Y medida via onLayout
  const [tabsOffsetY,  setTabsOffsetY]  = useState(0);

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

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Confira @${user?.username} na Minha Rede!\nhttps://social-production-8e37.up.railway.app/u/${user?.username}`,
        title: `@${user?.username}`,
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

  // ── Filtros ────────────────────────────────────────────────────────────────
  const imagePosts   = posts.filter(p => p.postType === "image" || (p.mediaUrls?.length > 0 && !["code","project","text"].includes(p.postType)));
  const thoughtPosts = posts.filter(p => p.postType === "text");
  const codePosts    = posts.filter(p => p.postType === "code");
  const projectPosts = posts.filter(p => p.postType === "project");

  // ── Grid de imagens ────────────────────────────────────────────────────────
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

  // ── Conteúdo da tab ativa ──────────────────────────────────────────────────
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
        <Text style={[s.emptyTitle, { color: theme.text }]}>Sem conteúdo aqui ainda</Text>
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
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 10 }}>
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
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 10 }}>
        {codePosts.map(p => {
          const code    = p.caption || "";
          const content = code.replace(/```[a-z]*/g, "").replace(/```/g, "").trim();
          const lang    = code.match(/```([a-z]+)/)?.[1] || "code";
          return (
            <View key={`code-${p.id}`} style={{ backgroundColor: "#1E1E2E", borderRadius: 14, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderBottomColor: "#313244" }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map((c, i) => (
                    <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />
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
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 10 }}>
        {projectPosts.map(p => (
          <View key={`project-${p.id}`} style={[s.glassItem, {
            backgroundColor: theme.surface, borderColor: theme.border,
            padding: 0, overflow: "hidden",
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

  // ── ListHeaderComponent — tudo que vem antes dos posts ────────────────────
  const ListHeader = (
    <View>
      {/* Espaço para o topBar fixo não cobrir o conteúdo */}
      <View style={{ height: insets.top + TOPBAR_H }} />

      {/* Avatar + stats — com parallax */}
      <Animated.View style={[s.headerRow, {
        transform: [{ translateY: headerParallax }],
        opacity: headerFade,
      }]}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.85}>
          <Avatar
            uri={user?.avatarUrl}
            name={user?.displayName || user?.username}
            size={86}
            ring={hasStories ? "active" : "default"}
          />
        </TouchableOpacity>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: theme.text }]}>
              {stats.postsCount >= 1000 ? `${(stats.postsCount / 1000).toFixed(1)}k` : stats.postsCount}
            </Text>
            <Text style={[s.statLabel, { color: theme.textSecondary }]}>posts</Text>
          </View>
          <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("followers")} activeOpacity={0.7}>
            <Text style={[s.statValue, { color: theme.text }]}>
              {stats.followersCount >= 1000 ? `${(stats.followersCount / 1000).toFixed(1)}k` : stats.followersCount}
            </Text>
            <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguidores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("following")} activeOpacity={0.7}>
            <Text style={[s.statValue, { color: theme.text }]}>
              {stats.followingCount >= 1000 ? `${(stats.followingCount / 1000).toFixed(1)}k` : stats.followingCount}
            </Text>
            <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguindo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Nome + badge + handle */}
      <View style={s.identityBlock}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={[s.displayName, { color: theme.text }]}>
            {user?.displayName || user?.username}
          </Text>
          {(user as any)?.isVerified && (
            <Ionicons name="checkmark-circle" size={15} color="#06B6D4" />
          )}
          {(userData?.earlyAdopterNumber && userData?.showEarlyAdopterBadge) && (
            <EarlyAdopterBadge number={userData.earlyAdopterNumber} size="sm" />
          )}
        </View>
        <Text style={[s.handle, { color: theme.textSecondary }]}>@{user?.username}</Text>
      </View>

      {/* Bio — texto livre, esquerda, sem rótulo */}
      {user?.bio ? (
        <Text style={[s.bioText, { color: theme.text }]}>{user.bio}</Text>
      ) : null}

      {/* Botões de ação */}
      <View style={s.actionsRow}>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
          onPress={() => navigation?.navigate?.("EditProfile")}
          activeOpacity={0.7}
        >
          <Text style={[s.actionBtnText, { color: theme.text }]}>Editar perfil</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.actionBtnSq, { backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={16} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.actionBtnSq, { backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
          onPress={() => navigation?.navigate?.("Messages")}
          activeOpacity={0.7}
        >
          <Ionicons name="paper-plane-outline" size={16} color={theme.text} />
          {unreadMessages > 0 && (
            <View style={s.dmBadge}><Text style={s.dmBadgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text></View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.actionBtnSq, { backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
          onPress={() => navigation?.navigate?.("Settings")}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Trabalho / Website / Skills — abaixo dos botões, à esquerda */}
      {(userData?.jobTitle || userData?.company || userData?.website || userData?.skills?.length > 0) && (
        <View style={s.metaBlock}>
          {(userData?.jobTitle || userData?.company) && (
            <View style={s.metaRow}>
              <Ionicons name="briefcase-outline" size={13} color={theme.textSecondary} />
              <Text style={[s.metaText, { color: theme.textSecondary }]}>
                {[userData.jobTitle, userData.company].filter(Boolean).join(" · ")}
              </Text>
            </View>
          )}
          {userData?.website && (
            <View style={s.metaRow}>
              <Ionicons name="link-outline" size={13} color={theme.primaryLight} />
              <Text style={[s.metaText, { color: theme.primaryLight }]} numberOfLines={1}>
                {userData.website.replace(/^https?:\/\//, "")}
              </Text>
            </View>
          )}
          {userData?.skills?.length > 0 && (
            <View style={[s.metaRow, { flexWrap: "wrap", gap: 4 }]}>
              {userData.skills.slice(0, 6).map((sk: string, idx: number) => (
                <View key={`sk-${idx}`} style={[s.skillChip, {
                  backgroundColor: theme.primary + "18",
                  borderColor:     theme.primary + "40",
                }]}>
                  <Text style={[s.skillText, { color: theme.primaryLight }]}>{sk}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Tab bar — sticky implementado via stickyHeaderIndices ── */}
      <View
        style={[s.tabsBar, { borderBottomColor: theme.border }]}
        onLayout={e => setTabsOffsetY(e.nativeEvent.layout.y)}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tabBtn}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(isActive ? tab.iconFilled : tab.icon) as any}
                size={21}
                color={isActive ? theme.primary : theme.textTertiary}
              />
              {/* Dot minimalista — sem underline reto */}
              {isActive && (
                <View style={[s.tabDot, { backgroundColor: theme.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── FlatList principal — header + conteúdo da tab ─────────────────────────
  // Usar uma FlatList de "seções" simples:
  // item 0 = header (ListHeaderComponent)
  // items 1..N = conteúdo da tab atual (como View única)
  const tabContent = renderTabContent();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* ── Top bar flutuante com blur progressivo ──────────────────────── */}
      <View style={[s.topBarWrapper, { paddingTop: insets.top, height: insets.top + TOPBAR_H }]}>
        {/* Blur layer — opacidade animada pelo scroll */}
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: topBarBlurOpacity }]}>
          <BlurView
            intensity={90}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Conteúdo do top bar */}
        <View style={s.topBar}>
          <Text style={[s.topLogo, { color: theme.text }]}>◈</Text>
          {/* Botões agora ficam na área de ações abaixo — top bar só tem o logo */}
        </View>
      </View>

      {/* ── FlatList única — tudo rola junto ───────────────────────────── */}
      <Animated.FlatList
        ref={listRef}
        data={[{ key: "content" }]}
        keyExtractor={item => item.key}
        renderItem={() => (
          <View style={{ paddingBottom: 100 + insets.bottom }}>
            {tabContent}
          </View>
        )}
        ListHeaderComponent={ListHeader}
        // stickyHeaderIndices não funciona bem com header dinâmico —
        // usamos a abordagem de topBar absoluto com blur
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // Top bar flutuante
  topBarWrapper: {
    position:   "absolute",
    top: 0, left: 0, right: 0,
    zIndex:     10,
    justifyContent: "flex-end",
  },
  topBar: {
    height:          TOPBAR_H,
    paddingHorizontal: 20,
    justifyContent:  "center",
  },
  topLogo: { fontSize: 22, fontWeight: "800" },

  // Header — avatar + stats
  headerRow: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingHorizontal: 16,
    paddingTop:     14,
    paddingBottom:  16,
    gap:            16,
  },
  statsRow:  { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem:  { alignItems: "center", gap: 1 },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11 },

  // Identidade
  identityBlock: { paddingHorizontal: 16, marginBottom: 6 },
  displayName:   { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  handle:        { fontSize: 13, marginTop: 2 },

  // Bio — livre, sem rótulo, esquerda
  bioText: {
    paddingHorizontal: 16,
    fontSize:          14,
    lineHeight:        21,
    marginBottom:      12,
  },

  // Botões de ação
  actionsRow: {
    flexDirection:  "row",
    paddingHorizontal: 16,
    gap:            8,
    marginBottom:   14,
    alignItems:     "center",
  },
  actionBtn: {
    flex:           1,
    height:         36,
    borderRadius:   10,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  actionBtnSq: {
    width:          36,
    height:         36,
    borderRadius:   10,
    borderWidth:    1,
    alignItems:     "center",
    justifyContent: "center",
  },
  dmBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 14, height: 14, borderRadius: 7,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 2,
  },
  dmBadgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },

  // Meta (trabalho / site / skills)
  metaBlock: {
    paddingHorizontal: 16,
    marginBottom:      16,
    gap:               6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flexWrap:      "wrap",
  },
  metaText:  { fontSize: 13 },
  skillChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  skillText: { fontSize: 11, fontWeight: "600" },

  // Tab bar — minimalista, sem divisórias sólidas
  tabsBar: {
    flexDirection:    "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    height:            TABS_H,
    backgroundColor:  "transparent",
    marginBottom:      2,
  },
  tabBtn: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    gap:            3,
  },
  // Dot minimalista (sem underline reto)
  tabDot: {
    width:        4,
    height:       4,
    borderRadius: 2,
  },

  // Grid de fotos
  gridThumb: { width: GRID_SIZE, height: GRID_SIZE },
  gridImg:   { width: "100%", height: "100%" },

  // Estados vazios
  emptyTab:      { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle:    { fontSize: 15, fontWeight: "700" },
  createBtn:     { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  glassItem:     { borderRadius: 16, borderWidth: 1, padding: 14 },
});
