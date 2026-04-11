import React, { useEffect, useState, useRef } from "react";
import {
  View, ScrollView, TouchableOpacity, Text, StyleSheet,
  Image, Modal, Dimensions, StatusBar, Animated, TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { storiesService } from "../../services/stories.service";
import Avatar from "../ui/Avatar";

const { width, height } = Dimensions.get("window");

// Viewer de story individual
function StoryViewer({ group, allGroups, startIndex, onClose }: any) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<any>(null);

  const currentGroup = allGroups[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];
  const DURATION = 5000;

  useEffect(() => {
    startProgress();
    if (currentStory) storiesService.markViewed(currentStory.id);
  }, [groupIndex, storyIndex]);

  const startProgress = () => {
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
  };

  const goNext = () => {
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else if (groupIndex < allGroups.length - 1) {
      setGroupIndex(i => i + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(i => i - 1);
      setStoryIndex(0);
    }
  };

  if (!currentGroup || !currentStory) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={viewerStyles.root}>
        <StatusBar hidden />
        <Image source={{ uri: currentStory.mediaUrl }} style={viewerStyles.bg} resizeMode="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.5)", "transparent", "rgba(0,0,0,0.3)"]} style={StyleSheet.absoluteFillObject} />

        {/* Progress bars */}
        <View style={viewerStyles.progressRow}>
          {currentGroup.stories.map((_: any, i: number) => (
            <View key={i} style={viewerStyles.progressTrack}>
              <Animated.View style={[
                viewerStyles.progressFill,
                {
                  width: i < storyIndex ? "100%" :
                    i === storyIndex ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) : "0%"
                }
              ]} />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={viewerStyles.header}>
          <Avatar uri={currentGroup.user.avatarUrl} name={currentGroup.user.displayName || currentGroup.user.username} size={36} showRing={currentGroup.hasUnviewed} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={viewerStyles.username}>{currentGroup.user.displayName || currentGroup.user.username}</Text>
            <Text style={viewerStyles.time}>Agora</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {currentStory.caption && (
          <View style={viewerStyles.captionWrap}>
            <Text style={viewerStyles.caption}>{currentStory.caption}</Text>
          </View>
        )}

        {/* Touch areas */}
        <View style={viewerStyles.touchRow}>
          <TouchableWithoutFeedback onPress={goPrev}>
            <View style={{ flex: 1, height: "100%" }} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback onPress={goNext}>
            <View style={{ flex: 1, height: "100%" }} />
          </TouchableWithoutFeedback>
        </View>
      </View>
    </Modal>
  );
}

const viewerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bg: { ...StyleSheet.absoluteFillObject },
  progressRow: { flexDirection: "row", gap: 3, paddingHorizontal: 12, paddingTop: 52, zIndex: 10 },
  progressTrack: { flex: 1, height: 2, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 1, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, zIndex: 10 },
  username: { color: "#fff", fontWeight: "700", fontSize: 14 },
  time: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  captionWrap: { position: "absolute", bottom: 80, left: 16, right: 16 },
  caption: { color: "#fff", fontSize: 15, textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  touchRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row", top: 100, zIndex: 5 },
});

// Componente principal Stories
export default function Stories() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<any[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIndex, setViewerGroupIndex] = useState(0);

  useEffect(() => { loadStories(); }, []);

  const loadStories = async () => {
    try {
      const data = await storiesService.getFeed();
      setGroups(data);
    } catch {}
  };

  const openViewer = (index: number) => {
    setViewerGroupIndex(index);
    setViewerOpen(true);
  };

  // Criar story mock se não tem nenhum do próprio usuário
  const myGroup = groups.find(g => g.isOwn);
  const otherGroups = groups.filter(g => !g.isOwn);

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Meu story */}
        <TouchableOpacity
          style={styles.item}
          onPress={() => myGroup ? openViewer(groups.indexOf(myGroup)) : null}
          activeOpacity={0.8}
        >
          <View style={styles.myRing}>
            <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={56} />
            <View style={[styles.addBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.addIcon}>+</Text>
            </View>
          </View>
          <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>você</Text>
        </TouchableOpacity>

        {/* Stories de outros */}
        {otherGroups.map((group, i) => {
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
          group={groups[viewerGroupIndex]}
          allGroups={groups}
          startIndex={viewerGroupIndex}
          onClose={() => { setViewerOpen(false); loadStories(); }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingVertical: 10, gap: 14 },
  item: { alignItems: "center", gap: 5, width: 68 },
  myRing: { width: 64, height: 64, borderRadius: 32, position: "relative", alignItems: "center", justifyContent: "center" },
  addBtn: { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  addIcon: { color: "#fff", fontSize: 16, fontWeight: "700", lineHeight: 20 },
  ring: { width: 64, height: 64, borderRadius: 32, padding: 2, alignItems: "center", justifyContent: "center" },
  ringInner: { width: 60, height: 60, borderRadius: 30, padding: 2, alignItems: "center", justifyContent: "center" },
  ringViewed: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 11, textAlign: "center" },
});
