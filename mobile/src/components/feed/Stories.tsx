import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, ScrollView, TouchableOpacity, Text, StyleSheet,
  Image, Modal, Dimensions, StatusBar, Animated,
  TouchableWithoutFeedback, PanResponder, BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { storiesService } from "../../services/stories.service";
import Avatar from "../ui/Avatar";

const { width: SW, height: SH } = Dimensions.get("window");
const STORY_DURATION = 5000;

// ─── Modal customizado next-gen (substitui Alert.alert) ──────────────────────
function FlashActionModal({ visible, onClose, onView, onNew, isDark }: {
  visible: boolean;
  onClose: () => void;
  onView: () => void;
  onNew: () => void;
  isDark: boolean;
}) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, tension: 180, friction: 12 }),
        Animated.timing(opacity, { toValue: 1,   duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale,   { toValue: 0.92, duration: 140, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,    duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={am.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[am.sheet, { transform: [{ scale }], opacity }]}>
              <BlurView intensity={isDark ? 60 : 80} tint={isDark ? "dark" : "light"} style={am.blur}>
                {/* Header */}
                <View style={am.header}>
                  <View style={am.flashIcon}>
                    <Text style={{ fontSize: 22 }}>⚡</Text>
                  </View>
                  <Text style={[am.title, { color: isDark ? "#fff" : "#000" }]}>Seu Flash</Text>
                  <Text style={[am.sub, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }]}>
                    O que deseja fazer?
                  </Text>
                </View>

                <View style={am.divider} />

                {/* Ver Flash */}
                <TouchableOpacity style={am.action} onPress={onView} activeOpacity={0.7}>
                  <View style={[am.actionIcon, { backgroundColor: "rgba(124,58,237,0.15)" }]}>
                    <Ionicons name="play-circle-outline" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[am.actionLabel, { color: isDark ? "#fff" : "#000" }]}>Ver Flash</Text>
                    <Text style={[am.actionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }]}>
                      Visualizar seus flashes ativos
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"} />
                </TouchableOpacity>

                <View style={am.divider} />

                {/* Novo Flash */}
                <TouchableOpacity style={am.action} onPress={onNew} activeOpacity={0.7}>
                  <View style={[am.actionIcon, { backgroundColor: "rgba(6,182,212,0.15)" }]}>
                    <Ionicons name="add-circle-outline" size={20} color="#06B6D4" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[am.actionLabel, { color: isDark ? "#fff" : "#000" }]}>Novo Flash</Text>
                    <Text style={[am.actionSub, { color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)" }]}>
                      Criar um novo conteúdo efêmero
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)"} />
                </TouchableOpacity>

                <View style={am.divider} />

                {/* Cancelar */}
                <TouchableOpacity style={[am.action, { justifyContent: "center" }]} onPress={onClose} activeOpacity={0.7}>
                  <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)", fontSize: 15, fontWeight: "500" }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </BlurView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const am = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 32 },
  sheet:       { borderRadius: 22, overflow: "hidden" },
  blur:        { paddingBottom: 4 },
  header:      { alignItems: "center", paddingVertical: 20, paddingHorizontal: 20, gap: 6 },
  flashIcon:   { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(124,58,237,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title:       { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  sub:         { fontSize: 13 },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(128,128,128,0.2)" },
  action:      { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  actionIcon:  { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 15, fontWeight: "600" },
  actionSub:   { fontSize: 12, marginTop: 1 },
});

// ─── Viewer ───────────────────────────────────────────────────────────────────
function StoryViewer({ allGroups, startIndex, onClose, onDeleteStory, onAddNew, navigation }: {
  allGroups: any[];
  startIndex: number;
  onClose: () => void;
  onDeleteStory: (storyId: string) => void;
  onAddNew: () => void;
  navigation: any;
}) {
  const { user: me } = useAuthStore();
  const { isDark }   = useThemeStore();
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused,     setPaused]     = useState(false);
  const [uiVisible,  setUiVisible]  = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const progress  = useRef(new Animated.Value(0)).current;
  const animRef   = useRef<any>(null);
  const elapsed   = useRef(0);
  const startedAt = useRef(0);

  // Android back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, []);

  const currentGroup = allGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isOwn = currentGroup?.isOwn || currentGroup?.user?.id === me?.id;

  // Swipe down
  const swipeY  = useRef(new Animated.Value(0)).current;
  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) swipeY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100) onClose();
      else Animated.spring(swipeY, { toValue: 0, useNativeDriver: true }).start();
    },
  })).current;

  useEffect(() => {
    if (currentStory) storiesService.markViewed(currentStory.id);
    startAnim();
    return () => animRef.current?.stop();
  }, [groupIndex, storyIndex]);

  useEffect(() => {
    if (paused) {
      animRef.current?.stop();
      elapsed.current += Date.now() - startedAt.current;
    } else {
      resumeAnim();
    }
  }, [paused]);

  const startAnim = () => {
    elapsed.current = 0;
    progress.setValue(0);
    animRef.current?.stop();
    startedAt.current = Date.now();
    animRef.current = Animated.timing(progress, {
      toValue: 1, duration: STORY_DURATION, useNativeDriver: false,
    });
    animRef.current.start(({ finished }: { finished: boolean }) => { if (finished) goNext(); });
  };

  const resumeAnim = () => {
    const remaining = STORY_DURATION - elapsed.current;
    if (remaining <= 0) { goNext(); return; }
    startedAt.current = Date.now();
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1, duration: remaining, useNativeDriver: false,
    });
    animRef.current.start(({ finished }: { finished: boolean }) => { if (finished) goNext(); });
  };

  const goNext = () => {
    if (storyIndex < currentGroup.stories.length - 1) setStoryIndex(i => i + 1);
    else if (groupIndex < allGroups.length - 1) { setGroupIndex(i => i + 1); setStoryIndex(0); }
    else onClose();
  };

  const goPrev = () => {
    if (storyIndex > 0) setStoryIndex(i => i - 1);
    else if (groupIndex > 0) { setGroupIndex(i => i - 1); setStoryIndex(0); }
  };

  const handleLongPressIn  = () => { setPaused(true);  setUiVisible(false); };
  const handleLongPressOut = () => { setPaused(false); setUiVisible(true);  };

  const handleDelete = async () => {
    await storiesService.delete(currentStory.id);
    onDeleteStory(currentStory.id);
    setShowDeleteModal(false);
    if (currentGroup.stories.length <= 1) {
      groupIndex < allGroups.length - 1
        ? (setGroupIndex(i => i + 1), setStoryIndex(0))
        : onClose();
    } else goNext();
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <Animated.View style={[vw.root, { transform: [{ translateY: swipeY }] }]} {...swipePan.panHandlers}>
        <StatusBar hidden />

        {/* Fundo */}
        {currentStory.mediaUrl
          ? <Image source={{ uri: currentStory.mediaUrl }} style={vw.bg} resizeMode="cover" />
          : <LinearGradient colors={["#7C3AED", "#06B6D4"]} style={vw.bg} />
        }
        <LinearGradient
          colors={["rgba(0,0,0,0.6)", "transparent", "transparent", "rgba(0,0,0,0.45)"]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        {/* Progress bars */}
        {uiVisible && (
          <View style={vw.progressRow}>
            {currentGroup.stories.map((_: any, i: number) => (
              <View key={i} style={vw.track}>
                <Animated.View style={[vw.fill, {
                  width: i < storyIndex ? "100%"
                    : i === storyIndex
                    ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                    : "0%",
                }]} />
              </View>
            ))}
          </View>
        )}

        {/* Header */}
        {uiVisible && (
          <View style={vw.header}>
            <Avatar uri={currentGroup.user.avatarUrl} name={currentGroup.user.displayName || currentGroup.user.username} size={36} showRing={currentGroup.hasUnviewed} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={vw.username}>{currentGroup.user.displayName || currentGroup.user.username}</Text>
              <Text style={vw.time}>
                {currentStory.expiresAt
                  ? `Some em ${Math.max(0, Math.ceil((new Date(currentStory.expiresAt).getTime() - Date.now()) / 3600000))}h`
                  : "Agora"}
              </Text>
            </View>

            {isOwn && (
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <TouchableOpacity style={vw.headerBtn} onPress={() => { onClose(); onAddNew(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[vw.headerBtn, { backgroundColor: "rgba(239,68,68,0.3)" }]} onPress={() => setShowDeleteModal(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.9)" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={[vw.headerBtn, { marginLeft: 6 }]}
              onPress={() => { onClose(); navigation.navigate("Tabs", { screen: "Feed" }); }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Caption */}
        {currentStory.caption && uiVisible && (
          <View style={vw.captionWrap}>
            <BlurView intensity={40} tint="dark" style={vw.captionBlur}>
              <Text style={vw.caption}>{currentStory.caption}</Text>
            </BlurView>
          </View>
        )}

        {/* Touch areas */}
        <View style={vw.touchRow} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={goPrev} onLongPress={handleLongPressIn} onPressOut={handleLongPressOut} delayLongPress={200}>
            <View style={{ flex: 1, height: "100%" }} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={goNext} onLongPress={handleLongPressIn} onPressOut={handleLongPressOut} delayLongPress={200}>
            <View style={{ flex: 1, height: "100%" }} />
          </TouchableWithoutFeedback>
        </View>
      </Animated.View>

      {/* Modal de confirmação de delete — next-gen */}
      {showDeleteModal && (
        <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowDeleteModal(false)}>
          <TouchableWithoutFeedback onPress={() => setShowDeleteModal(false)}>
            <View style={am.backdrop}>
              <TouchableWithoutFeedback>
                <View style={[am.sheet]}>
                  <BlurView intensity={isDark ? 60 : 80} tint={isDark ? "dark" : "light"} style={am.blur}>
                    <View style={am.header}>
                      <View style={[am.flashIcon, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                      </View>
                      <Text style={[am.title, { color: isDark ? "#fff" : "#000" }]}>Deletar Flash?</Text>
                      <Text style={[am.sub, { color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)" }]}>
                        Essa ação não pode ser desfeita.
                      </Text>
                    </View>
                    <View style={am.divider} />
                    <TouchableOpacity style={[am.action, { justifyContent: "center" }]} onPress={handleDelete} activeOpacity={0.7}>
                      <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700" }}>Deletar</Text>
                    </TouchableOpacity>
                    <View style={am.divider} />
                    <TouchableOpacity style={[am.action, { justifyContent: "center" }]} onPress={() => setShowDeleteModal(false)} activeOpacity={0.7}>
                      <Text style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)", fontSize: 15 }}>Cancelar</Text>
                    </TouchableOpacity>
                  </BlurView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </Modal>
  );
}

const vw = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#000" },
  bg:          { ...StyleSheet.absoluteFillObject },
  progressRow: { flexDirection: "row", gap: 3, paddingHorizontal: 12, paddingTop: 52, zIndex: 10 },
  track:       { flex: 1, height: 2.5, backgroundColor: "rgba(255,255,255,0.35)", borderRadius: 2, overflow: "hidden" },
  fill:        { height: "100%", backgroundColor: "#fff" },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 12, zIndex: 10 },
  username:    { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: -0.2 },
  time:        { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 1 },
  captionWrap: { position: "absolute", bottom: 80, left: 16, right: 16, zIndex: 10 },
  captionBlur: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, overflow: "hidden" },
  caption:     { color: "#fff", fontSize: 15, lineHeight: 22 },
  touchRow:    { ...StyleSheet.absoluteFillObject, flexDirection: "row", top: 100, zIndex: 5 },
  headerBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
});

// ─── Componente principal ─────────────────────────────────────────────────────
interface StoriesProps { navigation: any; refreshKey?: number; }

export default function Stories({ navigation, refreshKey = 0 }: StoriesProps) {
  const { theme, isDark } = useThemeStore();
  const { user }          = useAuthStore();
  const [groups, setGroups]                     = useState<any[]>([]);
  const [viewerOpen, setViewerOpen]             = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(0);
  const [actionModalOpen, setActionModalOpen]   = useState(false);

  const loadStories = async () => {
    try { setGroups(await storiesService.getFeed()); } catch {}
  };

  useEffect(() => { loadStories(); }, [refreshKey]);

  const openViewer = (index: number) => {
    setViewerGroupIndex(index);
    setViewerOpen(true);
  };

  const handleMyStoryPress = () => {
    const myGroup = groups.find(g => g.isOwn);
    if (myGroup) {
      setActionModalOpen(true);
    } else {
      navigation.navigate("FlashEditor");
    }
  };

  const handleDeleteStory = (storyId: string) => {
    setGroups(prev =>
      prev
        .map(g => ({ ...g, stories: g.stories.filter((s: any) => s.id !== storyId) }))
        .filter(g => g.stories.length > 0)
    );
  };

  const myGroup     = groups.find(g => g.isOwn);
  const otherGroups = groups.filter(g => !g.isOwn);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>

        {/* Meu story */}
        <TouchableOpacity style={styles.item} onPress={handleMyStoryPress} activeOpacity={0.8}>
          {myGroup ? (
            // Ring gradiente mais grosso (padding: 4)
            <LinearGradient colors={["#7C3AED", "#06B6D4"]} style={styles.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={[styles.ringInner, { backgroundColor: theme.background }]}>
                <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={50} />
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.myRing}>
              <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={56} />
              {/* Botão + com cor da paleta */}
              <View style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                <Ionicons name="add" size={12} color="#fff" />
              </View>
            </View>
          )}
          <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>você</Text>
        </TouchableOpacity>

        {/* Outros */}
        {otherGroups.map(group => {
          const realIndex = groups.indexOf(group);
          return (
            <TouchableOpacity key={group.user.id} style={styles.item} onPress={() => openViewer(realIndex)} activeOpacity={0.8}>
              {group.hasUnviewed ? (
                <LinearGradient colors={["#7C3AED", "#06B6D4"]} style={styles.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <View style={[styles.ringInner, { backgroundColor: theme.background }]}>
                    <Avatar uri={group.user.avatarUrl} name={group.user.displayName || group.user.username} size={50} />
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.ringViewed, { borderColor: theme.border }]}>
                  <Avatar uri={group.user.avatarUrl} name={group.user.displayName || group.user.username} size={56} />
                </View>
              )}
              <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>
                {group.user.username}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Modal next-gen para ação no próprio story */}
      <FlashActionModal
        visible={actionModalOpen}
        isDark={isDark}
        onClose={() => setActionModalOpen(false)}
        onView={() => {
          setActionModalOpen(false);
          const idx = groups.indexOf(myGroup);
          if (idx >= 0) openViewer(idx);
        }}
        onNew={() => {
          setActionModalOpen(false);
          navigation.navigate("FlashEditor");
        }}
      />

      {viewerOpen && (
        <StoryViewer
          allGroups={groups}
          startIndex={viewerGroupIndex}
          onClose={() => { setViewerOpen(false); loadStories(); }}
          onDeleteStory={handleDeleteStory}
          onAddNew={() => navigation.navigate("FlashEditor")}
          navigation={navigation}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container:  { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  item:       { alignItems: "center", gap: 5, width: 72 },
  myRing:     { width: 68, height: 68, borderRadius: 34, position: "relative", alignItems: "center", justifyContent: "center" },
  addBtn:     { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  ring:       { width: 68, height: 68, borderRadius: 34, padding: 4, alignItems: "center", justifyContent: "center" },
  ringInner:  { width: 60, height: 60, borderRadius: 30, padding: 2, alignItems: "center", justifyContent: "center" },
  ringViewed: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  name:       { fontSize: 11, textAlign: "center" },
});
