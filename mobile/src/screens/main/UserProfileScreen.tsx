/**
 * UserProfileScreen — Perfil de terceiros
 *
 * Layout 100% idêntico ao ProfileScreen próprio:
 * - FlatList única com ListHeaderComponent
 * - Bio livre sem rótulo, esquerda
 * - Trabalho/Website/Skills inline com ícones
 * - Botões com borda colorida do tema
 * - Botão DM ao lado do Follow (só para terceiros)
 * - Tabs minimalistas: dot 4px, ícones images/chatbubble
 * - Parallax + blur progressivo no top bar
 */

import React, {
  useEffect, useState, useCallback, useRef,
} from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, StatusBar, FlatList, Image, ActivityIndicator,
  Share, Animated,
} from "react-native";
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
const TOPBAR_H  = 56;
const TABS_H    = 46;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface UserData {
  id:              string;
  username:        string;
  displayName?:    string;
  bio?:            string;
  avatarUrl?:      string;
  jobTitle?:       string;
  company?:        string;
  website?:        string;
  skills?:         string[];
  isPrivate?:      boolean;
  isVerified?:     boolean;
  postsCount?:     number;
  followersCount?: number;
  followingCount?: number;
  isFollowing?:    boolean;
  isFollowedBy?:   boolean;
  earlyAdopterNumber?:     number | null;
  showEarlyAdopterBadge?:  boolean;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type ProfileTab = "posts" | "thoughts" | "code" | "projects";
const TABS: { key: ProfileTab; icon: string; iconFilled: string }[] = [
  { key: "posts",    icon: "images-outline",     iconFilled: "images"     },
  { key: "thoughts", icon: "chatbubble-outline",  iconFilled: "chatbubble" },
  { key: "code",     icon: "code-slash-outline",  iconFilled: "code-slash" },
  { key: "projects", icon: "briefcase-outline",   iconFilled: "briefcase"  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function UserProfileScreen({ route, navigation }: any) {
  const { username } = route.params as { username: string };

  const { user: me }      = useAuthStore();
  const { isDark, theme } = useThemeStore();
  const insets            = useSafeAreaInsets();
  const glassBlur         = isDark ? "dark" : "light";

  // ── Scroll / parallax / blur ──────────────────────────────────────────────
  const scrollY  = useRef(new Animated.Value(0)).current;
  const listRef  = useRef<FlatList>(null);

  const topBarBlurOpacity = scrollY.interpolate({
    inputRange: [0, 80], outputRange: [0, 1], extrapolate: "clamp",
  });
  const headerParallax = scrollY.interpolate({
    inputRange: [0, 120], outputRange: [0, -30], extrapolate: "clamp",
  });
  const headerFade = scrollY.interpolate({
    inputRange: [0, 100], outputRange: [1, 0.3], extrapolate: "clamp",
  });

  // ── Reset ao sair da tela ────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    return () => {
      scrollY.setValue(0);
      listRef.current?.scrollToOffset?.({ offset: 0, animated: false });
      setActiveTab("posts");
    };
  }, []));

  // ── Data ──────────────────────────────────────────────────────────────────
  const [userData,      setUserData]      = useState<UserData | null>(null);
  const [posts,         setPosts]         = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab,     setActiveTab]     = useState<ProfileTab>("posts");
  const [hasStories,    setHasStories]    = useState(false);

  const isMe = userData?.id === me?.id;

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
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Follow / Unfollow optimistic ─────────────────────────────────────────
  const handleFollow = async () => {
    if (!userData?.id || followLoading) return;
    const wasFollowing = userData.isFollowing;
    setUserData(prev => prev ? {
      ...prev,
      isFollowing:    !wasFollowing,
      followersCount: (prev.followersCount || 0) + (wasFollowing ? -1 : 1),
    } : prev);
    setFollowLoading(true);
    try {
      if (wasFollowing) await api.delete(`/follows/${userData.id}`);
      else              await api.post(`/follows/${userData.id}`);
    } catch {
      setUserData(prev => prev ? {
        ...prev,
        isFollowing:    wasFollowing,
        followersCount: (prev.followersCount || 0) + (wasFollowing ? 1 : -1),
      } : prev);
    } finally {
      setFollowLoading(false);
    }
  };

  // ── DM ────────────────────────────────────────────────────────────────────
  const handleDM = async () => {
    if (!userData?.id) return;
    try {
      // Backend retorna a conversa completa com participantA/B
      const res = await api.post("/messages/conversations", { userId: userData.id });
      const conversation = res.data;
      // Constrói o objeto "other" que o ChatScreen espera
      const other = {
        id:          userData.id,
        username:    userData.username,
        displayName: userData.displayName,
        avatarUrl:   userData.avatarUrl,
      };
      navigation.navigate("Chat", { conversation, other });
    } catch (e: any) {
      // Se a conversa já existe, o backend pode retorná-la no erro 409
      if (e?.response?.data?.conversation) {
        const conversation = e.response.data.conversation;
        const other = {
          id:          userData.id,
          username:    userData.username,
          displayName: userData.displayName,
          avatarUrl:   userData.avatarUrl,
        };
        navigation.navigate("Chat", { conversation, other });
      } else {
        navigation.navigate("Messages");
      }
    }
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Confira @${username} na Rede!\nhttps://social-production-8e37.up.railway.app/u/${username}`,
      });
    } catch {}
  };

  const goToFollowers = (tab: "followers" | "following") =>
    navigation?.navigate?.("FollowersList", { username, userId: userData?.id, tab });

  // ── Filtros de posts ───────────────────────────────────────────────────────
  const imagePosts   = posts.filter(p => p.postType === "image" || (p.mediaUrls?.length > 0 && !["code","project","text"].includes(p.postType)));
  const thoughtPosts = posts.filter(p => p.postType === "text");
  const codePosts    = posts.filter(p => p.postType === "code");
  const projectPosts = posts.filter(p => p.postType === "project");

  // ── Grid ──────────────────────────────────────────────────────────────────
  const renderGrid = (data: any[], tabKey: string) => (
    <FlatList
      data={data}
      keyExtractor={(item, index) => `grid-${tabKey}-${item.id}-${index}`}
      numColumns={3}
      scrollEnabled={false}
      renderItem={({ item, index }) =>
        item.mediaUrls?.length > 0 ? (
          <TouchableOpacity style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2 }]} activeOpacity={0.85}>
            <Image source={{ uri: item.mediaUrls[0] }} style={s.gridImg} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[s.gridThumb, { marginRight: index % 3 === 2 ? 0 : 2, backgroundColor: theme.surface, padding: 8, justifyContent: "center" }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16 }} numberOfLines={4}>{item.caption}</Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
    />
  );

  // ── Conteúdo da tab ────────────────────────────────────────────────────────
  const renderTabContent = () => {
    // Perfil privado
    if (userData?.isPrivate && !userData?.isFollowing && !isMe) {
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
      </View>
    );

    if (activeTab === "posts") return renderGrid(imagePosts, "posts");

    if (activeTab === "thoughts") return (
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 10 }}>
        {thoughtPosts.map(p => (
          <View key={p.id} style={[s.glassItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
            <View key={p.id} style={{ backgroundColor: "#1E1E2E", borderRadius: 14, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 10, borderBottomWidth: 1, borderBottomColor: "#313244" }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {["#FF5F57","#FFBD2E","#28C840"].map((c, i) => <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c }} />)}
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
      <View style={{ paddingHorizontal: 14, paddingTop: 10, gap: 10 }}>
        {projectPosts.map(p => (
          <View key={p.id} style={[s.glassItem, { backgroundColor: theme.surface, borderColor: theme.border, padding: 0, overflow: "hidden" }]}>
            {p.mediaUrls?.[0] && <Image source={{ uri: p.mediaUrls[0] }} style={{ width: "100%", height: 160 }} resizeMode="cover" />}
            <View style={{ padding: 12 }}>
              <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }} numberOfLines={1}>{p.caption?.split("\n")[0] || "Projeto"}</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{p.caption?.split("\n").slice(1).join(" ")}</Text>
            </View>
          </View>
        ))}
      </View>
    );

    return null;
  };

  // ── ListHeaderComponent — idêntico ao ProfileScreen ───────────────────────
  const ListHeader = (
    <View>
      <View style={{ height: insets.top + TOPBAR_H }} />

      {/* Avatar + stats */}
      <Animated.View style={[s.headerRow, { transform: [{ translateY: headerParallax }], opacity: headerFade }]}>
        <Avatar
          uri={userData?.avatarUrl}
          name={userData?.displayName || userData?.username}
          size={86}
          ring={hasStories ? "active" : "default"}
        />
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={[s.statValue, { color: theme.text }]}>
              {(userData?.postsCount || 0) >= 1000 ? `${((userData?.postsCount||0)/1000).toFixed(1)}k` : (userData?.postsCount || 0)}
            </Text>
            <Text style={[s.statLabel, { color: theme.textSecondary }]}>posts</Text>
          </View>
          <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("followers")} activeOpacity={0.7}>
            <Text style={[s.statValue, { color: theme.text }]}>
              {(userData?.followersCount || 0) >= 1000 ? `${((userData?.followersCount||0)/1000).toFixed(1)}k` : (userData?.followersCount || 0)}
            </Text>
            <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguidores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statItem} onPress={() => goToFollowers("following")} activeOpacity={0.7}>
            <Text style={[s.statValue, { color: theme.text }]}>
              {(userData?.followingCount || 0) >= 1000 ? `${((userData?.followingCount||0)/1000).toFixed(1)}k` : (userData?.followingCount || 0)}
            </Text>
            <Text style={[s.statLabel, { color: theme.textSecondary }]}>seguindo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Nome + badges + handle */}
      <View style={s.identityBlock}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={[s.displayName, { color: theme.text }]} numberOfLines={1}>
            {userData?.displayName || userData?.username}
          </Text>
          {userData?.isVerified && <Ionicons name="checkmark-circle" size={15} color="#06B6D4" />}
          {userData?.isPrivate   && <Ionicons name="lock-closed"     size={13} color={theme.textTertiary} />}
          {(userData?.earlyAdopterNumber && userData?.showEarlyAdopterBadge) && (
            <EarlyAdopterBadge number={userData.earlyAdopterNumber!} size="sm" />
          )}
        </View>
        <Text style={[s.handle, { color: theme.textSecondary }]}>@{userData?.username}</Text>
        {userData?.isFollowedBy && !isMe && (
          <View style={[s.followsYouBadge, { backgroundColor: theme.surfaceHigh }]}>
            <Text style={[s.followsYouText, { color: theme.textTertiary }]}>Segue você</Text>
          </View>
        )}
      </View>

      {/* Bio — livre, sem rótulo */}
      {userData?.bio ? (
        <Text style={[s.bioText, { color: theme.text }]}>{userData.bio}</Text>
      ) : null}

      {/* Botões de ação */}
      <View style={s.actionsRow}>
        {isMe ? (
          // Perfil próprio — Editar
          <TouchableOpacity
            style={[s.actionBtn, { flex: 1, backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.7}
          >
            <Text style={[s.actionBtnText, { color: theme.text }]}>Editar perfil</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Follow / Seguindo */}
            <TouchableOpacity
              style={[
                s.actionBtn,
                { flex: 1 },
                userData?.isFollowing
                  ? { backgroundColor: "transparent", borderColor: theme.border, borderWidth: 1 }
                  : { backgroundColor: theme.primary, borderColor: "transparent", borderWidth: 0 },
              ]}
              onPress={handleFollow}
              disabled={followLoading}
              activeOpacity={0.8}
            >
              {followLoading
                ? <ActivityIndicator size="small" color={userData?.isFollowing ? theme.textSecondary : "#fff"} />
                : <Text style={[s.actionBtnText, { color: userData?.isFollowing ? theme.textSecondary : "#fff" }]}>
                    {userData?.isFollowing ? "Seguindo" : userData?.isFollowedBy ? "Seguir de volta" : "Seguir"}
                  </Text>
              }
            </TouchableOpacity>

            {/* DM — só para terceiros */}
            <TouchableOpacity
              style={[s.actionBtnSq, { backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
              onPress={handleDM}
              activeOpacity={0.7}
            >
              <Ionicons name="paper-plane-outline" size={16} color={theme.text} />
            </TouchableOpacity>
          </>
        )}

        {/* Compartilhar */}
        <TouchableOpacity
          style={[s.actionBtnSq, { backgroundColor: theme.surface, borderColor: theme.primary + "55" }]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={16} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Meta — Trabalho / Website / Skills */}
      {(userData?.jobTitle || userData?.company || userData?.website || (userData?.skills?.length || 0) > 0) && (
        <View style={s.metaBlock}>
          {(userData?.jobTitle || userData?.company) && (
            <View style={s.metaRow}>
              <Ionicons name="briefcase-outline" size={13} color={theme.textSecondary} />
              <Text style={[s.metaText, { color: theme.textSecondary }]}>
                {[userData?.jobTitle, userData?.company].filter(Boolean).join(" · ")}
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
          {(userData?.skills?.length || 0) > 0 && (
            <View style={[s.metaRow, { flexWrap: "wrap", gap: 4 }]}>
              {userData!.skills!.slice(0, 6).map((sk, idx) => (
                <View key={idx} style={[s.skillChip, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "40" }]}>
                  <Text style={[s.skillText, { color: theme.primaryLight }]}>{sk}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Tabs */}
      <View style={[s.tabsBar, { borderBottomColor: theme.border }]}>
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
              {isActive && <View style={[s.tabDot, { backgroundColor: theme.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // ── Loading inicial ────────────────────────────────────────────────────────
  if (loading && !userData) {
    return (
      <View style={[s.root, { backgroundColor: theme.background, alignItems: "center", justifyContent: "center" }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Top bar flutuante com blur */}
      <View style={[s.topBarWrapper, { paddingTop: insets.top, height: insets.top + TOPBAR_H }]}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: topBarBlurOpacity }]}>
          <BlurView intensity={90} tint={glassBlur} style={StyleSheet.absoluteFillObject} />
        </Animated.View>
        <View style={s.topBar}>
          <TouchableOpacity
            style={[s.topBarBtn, { backgroundColor: theme.surface + "CC" }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={19} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.topUsername, { color: theme.text }]} numberOfLines={1}>
            @{username}
          </Text>
          <View style={{ width: 34 }} />
        </View>
      </View>

      {/* FlatList única */}
      <Animated.FlatList
        ref={listRef}
        data={[{ key: "content" }]}
        keyExtractor={item => item.key}
        renderItem={() => (
          <View style={{ paddingBottom: 100 + insets.bottom }}>
            {renderTabContent()}
          </View>
        )}
        ListHeaderComponent={ListHeader}
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
  root:            { flex: 1 },
  topBarWrapper:   { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, justifyContent: "flex-end" },
  topBar:          { height: TOPBAR_H, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBarBtn:       { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  topUsername:     { flex: 1, fontSize: 16, fontWeight: "700", textAlign: "center", paddingHorizontal: 8 },

  headerRow:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 16 },
  statsRow:        { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  statItem:        { alignItems: "center", gap: 1 },
  statValue:       { fontSize: 20, fontWeight: "800" },
  statLabel:       { fontSize: 11 },

  identityBlock:   { paddingHorizontal: 16, marginBottom: 6 },
  displayName:     { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  handle:          { fontSize: 13, marginTop: 2 },
  followsYouBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  followsYouText:  { fontSize: 11, fontWeight: "600" },

  bioText:         { paddingHorizontal: 16, fontSize: 14, lineHeight: 21, marginBottom: 12 },

  actionsRow:      { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 14, alignItems: "center" },
  actionBtn:       { height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  actionBtnText:   { fontSize: 13, fontWeight: "600" },
  actionBtnSq:     { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  metaBlock:       { paddingHorizontal: 16, marginBottom: 16, gap: 6 },
  metaRow:         { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaText:        { fontSize: 13 },
  skillChip:       { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  skillText:       { fontSize: 11, fontWeight: "600" },

  tabsBar:         { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, height: TABS_H },
  tabBtn:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabDot:          { width: 4, height: 4, borderRadius: 2 },

  gridThumb:       { width: GRID_SIZE, height: GRID_SIZE },
  gridImg:         { width: "100%", height: "100%" },
  emptyTab:        { padding: 60, alignItems: "center", gap: 12 },
  emptyTitle:      { fontSize: 15, fontWeight: "700" },
  emptySub:        { fontSize: 13, textAlign: "center", lineHeight: 20 },
  glassItem:       { borderRadius: 16, borderWidth: 1, padding: 14 },
});
