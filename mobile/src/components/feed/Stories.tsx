import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, ScrollView, TouchableOpacity, Text, StyleSheet,
  Image, Modal, Dimensions, StatusBar, Animated,
  TouchableWithoutFeedback, Alert, PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { storiesService } from "../../services/stories.service";
import Avatar from "../ui/Avatar";

const { width: SW, height: SH } = Dimensions.get("window");
const STORY_DURATION = 5000;

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
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [paused, setPaused]         = useState(false);
  const [uiVisible, setUiVisible]   = useState(true);

  const progress  = useRef(new Animated.Value(0)).current;
  const animRef   = useRef<any>(null);
  const elapsed   = useRef(0);
  const startedAt = useRef(0);

  const currentGroup = allGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const isOwn = currentGroup?.isOwn || currentGroup?.user?.id === me?.id;

  // Swipe down para fechar
  const swipeY = useRef(new Animated.Value(0)).current;
  const swipePan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) swipeY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100) { onClose(); }
      else { Animated.spring(swipeY, { toValue: 0, useNativeDriver: true }).start(); }
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
    if (storyIndex < currentGroup.stories.length - 1) { setStoryIndex(i => i + 1); }
    else if (groupIndex < allGroups.length - 1) { setGroupIndex(i => i + 1); setStoryIndex(0); }
    else { onClose(); }
  };

  const goPrev = () => {
    if (storyIndex > 0) { setStoryIndex(i => i - 1); }
    else if (groupIndex > 0) { setGroupIndex(i => i - 1); setStoryIndex(0); }
  };

  const handleLongPressIn  = () => { setPaused(true);  setUiVisible(false); };
  const handleLongPressOut = () => { setPaused(false); setUiVisible(true);  };

  const handleDelete = () => {
    Alert.alert("Deletar Flash?", "Essa ação não pode ser desfeita.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Deletar", style: "destructive",
        onPress: async () => {
          await storiesService.delete(currentStory.id);
          onDeleteStory(currentStory.id);
          if (currentGroup.stories.length <= 1) {
            groupIndex < allGroups.length - 1
              ? (setGroupIndex(i => i + 1), setStoryIndex(0))
              : onClose();
          } else { goNext(); }
        },
      },
    ]);
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <Animated.View style={[vw.root, { transform: [{ translateY: swipeY }] }]} {...swipePan.panHandlers}>
        <StatusBar hidden />

        {currentStory.mediaUrl ? (
          <Image source={{ uri: currentStory.mediaUrl }} style={vw.bg} resizeMode="cover" />
        ) : (
          <LinearGradient colors={["#7C3AED", "#06B6D4"]} style={vw.bg} />
        )}
        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent", "transparent", "rgba(0,0,0,0.4)"]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

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

        {uiVisible && (
          <View style={vw.header}>
            <Avatar uri={currentGroup.user.avatarUrl} name={currentGroup.user.displayName || currentGroup.user.username} size={34} showRing={currentGroup.hasUnviewed} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={vw.username}>{currentGroup.user.displayName || currentGroup.user.username}</Text>
              <Text style={vw.time}>
                {currentStory.expiresAt
                  ? `Some em ${Math.max(0, Math.ceil((new Date(currentStory.expiresAt).getTime() - Date.now()) / 3600000))}h`
                  : "Agora"}
              </Text>
            </View>
            {isOwn && (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <TouchableOpacity
                  onPress={() => { onClose(); onAddNew(); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={vw.headerBtn}
                >
                  <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={() => { onClose(); navigation.navigate('Tabs', { screen: 'Feed' }); }} style={{ marginLeft: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {currentStory.caption && uiVisible && (
          <View style={vw.captionWrap}>
            <Text style={vw.caption}>{currentStory.caption}</Text>
          </View>
        )}

        <View style={vw.touchRow} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={goPrev} onLongPress={handleLongPressIn} onPressOut={handleLongPressOut} delayLongPress={200}>
            <View style={{ flex: 1, height: "100%" }} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={goNext} onLongPress={handleLongPressIn} onPressOut={handleLongPressOut} delayLongPress={200}>
            <View style={{ flex: 1, height: "100%" }} />
          </TouchableWithoutFeedback>
        </View>
      </Animated.View>
    </Modal>
  );
}

const vw = StyleSheet.create({
  root:        { flex: 1, backgroundColor: "#000" },
  bg:          { ...StyleSheet.absoluteFillObject },
  progressRow: { flexDirection: "row", gap: 3, paddingHorizontal: 12, paddingTop: 52, zIndex: 10 },
  track:       { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1, overflow: "hidden" },
  fill:        { height: "100%", backgroundColor: "#fff" },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, zIndex: 10 },
  username:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  time:        { color: "rgba(255,255,255,0.6)", fontSize: 11 },
  captionWrap: { position: "absolute", bottom: 80, left: 16, right: 16, zIndex: 10 },
  caption:     { color: "#fff", fontSize: 15, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  touchRow:    { ...StyleSheet.absoluteFillObject, flexDirection: "row", top: 100, zIndex: 5 },
  headerBtn:   { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});

// ─── Componente principal ─────────────────────────────────────────────────────
interface StoriesProps { navigation: any; refreshKey?: number; }

export default function Stories({ navigation, refreshKey = 0 }: StoriesProps) {
  const { theme } = useThemeStore();
  const { user }  = useAuthStore();
  const [groups, setGroups]                     = useState<any[]>([]);
  const [viewerOpen, setViewerOpen]             = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(0);

  const loadStories = async () => {
    try { setGroups(await storiesService.getFeed()); } catch {}
  };

  useEffect(() => { loadStories(); }, [refreshKey]);

  const openViewer = (index: number) => {
    setViewerGroupIndex(index); setViewerOpen(true);
  };

  // ── Obs1 fix: clique no próprio avatar com story → Ver ou Novo Flash ──────
  const handleMyStoryPress = () => {
    const myGroup = groups.find(g => g.isOwn);
    if (myGroup) {
      Alert.alert("Seu Flash", "O que deseja fazer?", [
        { text: "Ver Flash",  onPress: () => openViewer(groups.indexOf(myGroup)) },
        { text: "Novo Flash", onPress: () => navigation.navigate("FlashEditor") },
        { text: "Cancelar",   style: "cancel" },
      ]);
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
            <LinearGradient colors={["#7C3AED", "#06B6D4"]} style={styles.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View style={[styles.ringInner, { backgroundColor: theme.background }]}>
                <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={52} />
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.myRing}>
              <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={56} />
              <View style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                <Text style={styles.addIcon}>+</Text>
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
                    <Avatar uri={group.user.avatarUrl} name={group.user.displayName || group.user.username} size={52} />
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
  item:       { alignItems: "center", gap: 5, width: 68 },
  myRing:     { width: 64, height: 64, borderRadius: 32, position: "relative", alignItems: "center", justifyContent: "center" },
  addBtn:     { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addIcon:    { color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 20 },
  ring:       { width: 64, height: 64, borderRadius: 32, padding: 2, alignItems: "center", justifyContent: "center" },
  ringInner:  { width: 60, height: 60, borderRadius: 30, padding: 2, alignItems: "center", justifyContent: "center" },
  ringViewed: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  name:       { fontSize: 11, textAlign: "center" },
});
