import React, { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Avatar from '../ui/Avatar';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { postsService } from '../../services/posts.service';

const { width } = Dimensions.get('window');

export default function PostCard({ post }: any) {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likesCount ?? 0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleLike = async () => {
    // Micro-interaction: scale pulse
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();

    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes((n: number) => wasLiked ? n - 1 : n + 1);
    try {
      if (wasLiked) await postsService.unlike(post.id);
      else await postsService.like(post.id);
    } catch {
      setLiked(wasLiked);
      setLikes((n: number) => wasLiked ? n + 1 : n - 1);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR });

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar
          uri={post.user?.avatarUrl}
          name={post.user?.displayName || post.user?.username}
          size={38}
          showRing={false}
        />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: theme.text }]}>
              {post.user?.displayName || post.user?.username}
            </Text>
            {post.user?.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color={theme.verified} style={styles.verified} />
            )}
          </View>
          <Text style={[styles.time, { color: theme.textSecondary }]}>{timeAgo}</Text>
        </View>
        <TouchableOpacity style={[styles.moreBtn, { backgroundColor: theme.surfaceHigh }]}>
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {post.caption ? (
        <Text style={[styles.caption, { color: theme.text }]}>{post.caption}</Text>
      ) : null}

      {/* Media */}
      {post.mediaUrls?.length > 0 && (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: post.mediaUrls[0] }}
            style={styles.media}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          {/* Like com micro-animation */}
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? theme.like : theme.textSecondary}
              />
            </Animated.View>
            <Text style={[styles.actionCount, { color: liked ? theme.like : theme.textSecondary }]}>
              {likes > 0 ? likes : ''}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
              {post.commentsCount > 0 ? post.commentsCount : ''}
            </Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-redo-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity activeOpacity={0.7}>
          <Ionicons name="bookmark-outline" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderBottomWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  meta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  username: { fontSize: 14, fontWeight: '600' },
  verified: { marginTop: 1 },
  time: { fontSize: 11, marginTop: 1 },
  moreBtn: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  caption: { paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, lineHeight: 20 },
  mediaContainer: { width, height: width * 0.85, overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  leftActions: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13, fontWeight: '500' },
});
