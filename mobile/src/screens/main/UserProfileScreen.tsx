import React, {
  useEffect, useState, useCallback, useRef,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Share, Alert, LayoutChangeEvent, ScrollView,
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
import Avatar from "../../components/ui/Avatar";
import EarlyAdopterBadge from "../../components/ui/EarlyAdopterBadge";

const { width } = Dimensions.get("window");
const GRID_SIZE = (width - 4) / 3;
const TABS_H    = 44;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UserData {
  id:             string;
  username:       string;
  displayName?:   string;
  bio?:           string;
  avatarUrl?:     string;
  jobTitle?:      string;
  company?:       string;
  website?:       string;
  skills?:        string[];
  isPrivate?:     boolean;
  isVerified?:    boolean;
  postsCount?:    number;
  followersCount?:number;
  followingCount?:number;
  isFollowing?:   boolean;
  isFollowedBy?:  boolean;
  isBlocked?:     boolean;
}

type ProfileTab = "posts" | "thoughts" | "code" | "projects";
const TABS: { key: ProfileTab; icon: string; iconFilled: string }[] = [
  { key: "posts",    icon: "grid-outline",      iconFilled: "grid"       },
  { key: "thoughts", icon: "bulb-outline",       iconFilled: "bulb"       },
  { key: "code",     icon: "code-slash-outline", iconFilled: "code-slash" },
  { key: "projects", icon: "briefcase-outline",  iconFilled: "briefcase"  },
];

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UserProfileScreen({ route, navigation }: any) {
  const { username } = route.params as { username: string };

  const { user: me }        = useAuthStore();
  const { isDark, theme }   = useThemeStore();
  const insets              = useSafeAreaInsets();
  const glassBlur           = isDark ? "dark" : "light";

  // ── Scroll ─────────────────────────────────────────────────────────────
  const scrollY   = useSharedValue(0);
  const scrollRef = useRef<any>(null);

  const [headerContentH, setHeaderContentH]   = useState(260);
  const headerContentHSV                       = useSharedValue(260);

  const onHeaderContentLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setHeaderContentH(h);
    headerContentHSV.value = h;
  }, []);

  const collapseDistance = useDerivedValue(() => headerContentHSV.value);

  // ── Animated styles ────────────────────────────────────────────────────
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

  const tabsAnimStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(
        scrollY.value,
        [0, collapseDistance.value],
        [0, -collapseDistance.value],
        Extrapolation.CLAMP,
      ),
    }],
    shadowOpacity: interpolate(
      scrollY.value,
      [collapseDistance.value - 10, collapseDistance.value],
      [0, 0.18],
      Extrapolation.CLAMP,
    ),
  }));

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

  // Reseta scroll e tab ao sair da tela (voltar = estado limpo)
  useFocusEffect(useCallback(() => {
    return () => {
      scrollY.value = 0;
      scrollRef.current?.scrollTo?.({ y: 0, animated: false });
      setActiveTab("posts");
    };
  }, []));

  // ── Data ───────────────────────────────────────────────────────────────
  const [userData,  setUserData]  = useState<UserData | null>(null);
  const [posts,     setPosts]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [hasStories, setHasStories] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const [profileRes, postsRes] = await Promise.all([
        api.get(`/users/${username}`),
        api.get(`/posts/user/${username}?limit=30`),
      ]);
      setUserData(profileRes.data);
      setPosts(postsRes.data.posts || []);
      try {
        const sr = await api.get(`/stories/user/${username}`);
        setHasStories((sr.data?.stories?.length || 0) > 0);
      } catch { setHasStories(false); }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        Alert.alert("Perfil não encontrado", "Este usuário não existe.", [
          { text: "Voltar", onPress: () => navigation.goBack() },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Follow / Unfollow ──────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!userData?.id || followLoading) return;
    const wasFollowing = userData.isFollowing;
    // Optimistic
    setUserData(prev => prev ? {
      ...prev,
      isFollowing:    !wasFollowing,
      followersCount: (prev.followersCount || 0) + (wasFollowing ? -1 : 1),
    } : prev);
    setFollowLoading(true);
    try {
      if (wasFollowing) {
        await api.delete(`/follows/${userData.id}`);
      } else {
        await api.post(`/follows/${userData.id}`);
      }
    } catch {
      // Reverter
      setUserData(prev => prev ? {
        ...prev,
        isFollowing:    wasFollowing,
        followersCount: (prev.followersCount || 0) + (wasFollowing ? 1 : -1),
      } : prev);
    } finally {
      setFollowLoading(false);
    }
  };

  // ── Share ──────────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Confira o perfil de @${username} na Minha Rede!\nhttps://social-production-8e37.up.railway.app/u/${username}`,
        title: `@${username} — Minha Rede`,
      });
    } catch {}
  };

  const goToFollowers = (tab: "followers" | "following") =>
    navigation?.navigate?.("FollowersList", {
      username,
      tab,
      userId: userData?.id,
    });

  // ── Filtros ────────────────────────────────────────────────────────────
  const imagePosts   = posts.filter(p => p.postType === "image"   || (p.mediaUrls?.length > 0 && !["code","project","text"].includes(p.postType)));
  const thoughtPosts = posts.filter(p => p.postType === "text");
  const codePosts    = posts.filter(p => p.postType === "code");
  const projectPosts = posts.filter(p => p.postType === "project");

  // ── Helpers de render ──────────────────────────────────────────────────
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
    // Perfil privado e não seguindo
    if (userData?.isPrivate && !userData?.isFollowing && userData?.id !== me?.id) {
      return (
        <View style={s.emptyTab}>
          <Ionicons name="lock-closed-outline" size={36} color={theme.textTertiary} />
          <Text style={[s.emptyTitle, { color: theme.text }]}>Perfil privado</Text>
          <Text style={[s.emptySub, { color: theme.textSecondary }]}>
            Siga para ver os posts de @{username}
          </Text>
        </View>
      );
    }

    if (loading) return (
      <View style={s.emptyTab}><ActivityIndicator color={theme.primary} /></View>
    );

    const tabMap: Record<string, any[]> = {
      posts: imagePosts, thoughts: thoughtPosts,
      code:  codePosts,  projects: projectPosts,
    };
    const tabPosts = tabMap[activeTab] || [];

    if (!tabPosts.length) return (
      <View style={s.emptyTab}>
        <Ionicons name="file-tray-outline" size={32} color={theme.textTertiary} />
        <Text style={[s.emptyTitle, { color: theme.text }]}>Sem conteúdo ainda</Text>
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

  // ── Follow button ──────────────────────────────────────────────────────
  const isMe = userData?.id === me?.id;

  const FollowButton = () => {
    if (isMe) return null;
    const following  = userData?.isFollowing;
    const followedBy = userData?.isFollowedBy;
    const label = following
      ? "Seguindo"
      : followedBy
        ? "Seguir de volta"
        : "Seguir";
    return (
      <TouchableOpacity
        style={[
          s.followBtn,
          following
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border }
            : { backgroundColor: theme.primary, borderWidth: 0 },
        ]}
        onPress={handleFollow}
        disabled={followLoading}
        activeOpacity={0.8}
      >
        {followLoading
          ? <ActivityIndicator size="small" color={following ? theme.textSecondary : "#fff"} />
          : <Text style={[s.followBtnText, { color: following ? theme.textSecondary : "#fff" }]}>
              {label}
            </Text>
        }
      </TouchableOpacity>
    );
  };

  // ── Loading inicial ────────────────────────────────────────────────────
  if (loading && !userData) {
    return (
      <View style={[s.root, { backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  const totalHeaderH = headerContentH + TABS_H;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* ── Header fixo ─────────────────────────────────────────────────── */}
      <View style={[s.stickyWrapper, { paddingTop: insets.top }]} pointerEvents="box-none">

        {/* Bloco colapsável */}
        <Animated.View style={headerContentAnimStyle} pointerEvents="box-none">

          {/* Top bar com botão voltar */}
          <View style={s.topBar} pointerEvents="box-none">
            <TouchableOpacity
              style={[s.topBtn, { backgroundColor: theme.surface }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={19} color={theme.text} />
            </TouchableOpacity>

            <Text style={[s.topUsername, { color: theme.text }]} numberOfLines={1}>
              @{username}
            </Text>

            <TouchableOpacity
              style={[s.topBtn, { backgroundColor: theme.surface }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Ionicons name="share-social-outline" size={17} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Conteúdo que some no colapso */}
          <Animated.View style={contentFadeStyle} onLayout={onHeaderContentLayout}>

            {/* Avatar + stats */}
            <View style={s.headerRow}>
              <Avatar
                uri={userData?.avatarUrl}
                name={userData?.displayName || userData?.username}
                size={82}
                ring={hasStories ? "active" : "default"}
              />
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: theme.text }]}>
                    {(userData?.postsCount || 0) >= 1000
                      ? `${((userData?.postsCount || 0)/1000).toFixed(1)}k`
                      : (userData?.postsCount || 0)}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>posts</Text>
                </View>
                <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("followers")} activeOpacity={0.7}>
                  <Text style={[s.statValue, { color: theme.text }]}>
                    {(userData?.followersCount || 0) >= 1000
                      ? `${((userData?.followersCount || 0)/1000).toFixed(1)}k`
                      : (userData?.followersCount || 0)}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguidores</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("following")} activeOpacity={0.7}>
                  <Text style={[s.statValue, { color: theme.text }]}>
                    {(userData?.followingCount || 0) >= 1000
                      ? `${((userData?.followingCount || 0)/1000).toFixed(1)}k`
                      : (userData?.followingCount || 0)}
                  </Text>
                  <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguindo</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Nome + handle + botão follow */}
            <View style={[s.identityRow, { paddingHorizontal: 20 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={[s.displayName, { color: theme.text }]} numberOfLines={1}>
                    {userData?.displayName || userData?.username}
                  </Text>
                  {userData?.isVerified && (
                    <Ionicons name="checkmark-circle" size={15} color="#06B6D4" />
                  )}
                  {userData?.isPrivate && (
                    <Ionicons name="lock-closed" size={13} color={theme.textTertiary} />
                  )}
                  {(userData?.earlyAdopterNumber && userData?.showEarlyAdopterBadge) && (
                    <EarlyAdopterBadge number={userData.earlyAdopterNumber} size="sm" />
                  )}
                </View>
                <Text style={[s.handle, { color: theme.textSecondary }]}>@{userData?.username}</Text>
                {/* Segue você de volta */}
                {userData?.isFollowedBy && !isMe && (
                  <Text style={[s.followsYou, { color: theme.textTertiary, backgroundColor: theme.surfaceHigh }]}>
                    Segue você
                  </Text>
                )}
              </View>
              <FollowButton />
            </View>

            {/* Grid 2×2 — Bio, Trabalho, Website, Skills */}
            {(userData?.bio || userData?.jobTitle || userData?.website || (userData?.skills?.length || 0) > 0) && (
              <View style={s.infoGrid}>
                {userData?.bio ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>BIO</Text>
                    <Text style={[s.infoCellValue, { color: theme.text }]} numberOfLines={3}>
                      {userData.bio.slice(0, 80)}
                    </Text>
                  </View>
                ) : null}
                {(userData?.jobTitle || userData?.company) ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>TRABALHO</Text>
                    <Text style={[s.infoCellValue, { color: theme.text }]} numberOfLines={2}>
                      {[userData?.jobTitle, userData?.company].filter(Boolean).join(" · ").slice(0, 50)}
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
                {(userData?.skills?.length || 0) > 0 ? (
                  <View style={[s.infoCell, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[s.infoCellLabel, { color: theme.textTertiary }]}>SKILLS</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                      {userData!.skills!.slice(0, 4).map((sk: string, idx: number) => (
                        <View key={`skill-${idx}-${sk}`} style={[s.skillChip, {
                          backgroundColor: theme.primary + "22",
                          borderColor:     theme.primary + "44",
                        }]}>
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

        {/* ── Tabs sticky ────────────────────────────────────────────────── */}
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

      </View>
      {/* fim stickyWrapper */}

      {/* ── Scroll do conteúdo ───────────────────────────────────────────── */}
      <Animated.ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={{
          paddingTop:    totalHeaderH + 8,
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:            { flex: 1 },
  stickyWrapper:   { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  scroll:          { flex: 1, zIndex: 2 },

  // Top bar
  topBar:          {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
  },
  topBtn:          { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  topUsername:     { flex: 1, fontSize: 16, fontWeight: "700", textAlign: "center" },

  // Header content
  headerRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 14, gap: 16 },
  statsRow:        { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem:        { alignItems: "center", paddingHorizontal: 4 },
  statValue:       { fontSize: 20, fontWeight: "800" },
  statLabel:       { fontSize: 11, marginTop: 1 },
  identityRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingHorizontal: 20, gap: 12 },
  displayName:     { fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  handle:          { fontSize: 13, marginTop: 1 },
  followsYou:      { fontSize: 10, fontWeight: "600", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4, alignSelf: "flex-start" },

  // Follow button
  followBtn:       { paddingHorizontal: 22, paddingVertical: 9, borderRadius: 12, minWidth: 100, alignItems: "center", justifyContent: "center" },
  followBtnText:   { fontSize: 14, fontWeight: "700" },

  // Grid 2×2
  infoGrid:        { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  infoCell:        { flex: 1, minWidth: "45%", maxWidth: "49%", borderRadius: 14, padding: 12, borderWidth: 1, minHeight: 72 },
  infoCellLabel:   { fontSize: 9, fontWeight: "700", letterSpacing: 0.8, marginBottom: 4 },
  infoCellValue:   { fontSize: 13, lineHeight: 18 },
  skillChip:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  skillText:       { fontSize: 11, fontWeight: "600" },

  // Tabs
  tabsBar:         {
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
  tabBtn:          { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 3 },
  tabUnderline:    { height: 2, width: 16, borderRadius: 1 },

  // Content
  gridThumb:       { width: GRID_SIZE, height: GRID_SIZE },
  gridImg:         { width: "100%", height: "100%" },
  emptyTab:        { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle:      { fontSize: 16, fontWeight: "700" },
  emptySub:        { fontSize: 13, textAlign: "center", lineHeight: 20 },
  glassItem:       { borderRadius: 16, borderWidth: 1, padding: 14 },
});
