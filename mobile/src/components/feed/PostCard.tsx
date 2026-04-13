import React, { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Avatar from '../ui/Avatar';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { postsService } from '../../services/posts.service';
import { savedService } from '../../services/saved.service';

const { width } = Dimensions.get('window');

// Syntax highlight simples sem dependência externa
const TOKEN_COLORS: Record<string, string> = {
  keyword:  '#CBA6F7',
  string:   '#A6E3A1',
  comment:  '#6C7086',
  number:   '#FAB387',
  function: '#89B4FA',
  operator: '#89DCEB',
  default:  '#CDD6F4',
};

function tokenize(code: string) {
  const lines = code.split('\n');
  return lines.map((line, li) => {
    const parts: { text: string; color: string }[] = [];
    let remaining = line;

    while (remaining.length > 0) {
      // Comment
      if (remaining.startsWith('//') || remaining.startsWith('#')) {
        parts.push({ text: remaining, color: TOKEN_COLORS.comment });
        break;
      }
      // String
      const strMatch = remaining.match(/^(['"`])(.*?)\1/);
      if (strMatch) {
        parts.push({ text: strMatch[0], color: TOKEN_COLORS.string });
        remaining = remaining.slice(strMatch[0].length);
        continue;
      }
      // Keywords
      const kwMatch = remaining.match(/^(const|let|var|function|return|if|else|for|while|import|export|from|class|async|await|def|print|val|fun|type|interface|extends|implements)\b/);
      if (kwMatch) {
        parts.push({ text: kwMatch[0], color: TOKEN_COLORS.keyword });
        remaining = remaining.slice(kwMatch[0].length);
        continue;
      }
      // Number
      const numMatch = remaining.match(/^\d+\.?\d*/);
      if (numMatch) {
        parts.push({ text: numMatch[0], color: TOKEN_COLORS.number });
        remaining = remaining.slice(numMatch[0].length);
        continue;
      }
      // Function call
      const fnMatch = remaining.match(/^([a-zA-Z_]\w*)\s*(?=\()/);
      if (fnMatch) {
        parts.push({ text: fnMatch[0], color: TOKEN_COLORS.function });
        remaining = remaining.slice(fnMatch[0].length);
        continue;
      }
      // Default char
      parts.push({ text: remaining[0], color: TOKEN_COLORS.default });
      remaining = remaining.slice(1);
    }

    return { parts, key: li };
  });
}

function CodeBlock({ caption }: { caption: string }) {
  const match = caption.match(/```([a-z]*)\n?([\s\S]*?)```/);
  const lang = match?.[1] || 'code';
  const code = match?.[2]?.trim() || caption;
  const descMatch = caption.match(/^([\s\S]*?)```/);
  const desc = descMatch?.[1]?.trim();
  const lines = tokenize(code);

  return (
    <View>
      {desc ? <Text style={{ color: '#CDD6F4', fontSize: 14, lineHeight: 20, padding: 12, paddingBottom: 0 }}>{desc}</Text> : null}
      <View style={codeStyles.container}>
        <View style={codeStyles.topBar}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['#FF5F57','#FFBD2E','#28C840'].map(c => (
              <View key={c} style={[codeStyles.dot, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={codeStyles.lang}>{lang}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ padding: 12 }}>
            {lines.map(({ parts, key }) => (
              <View key={key} style={{ flexDirection: 'row', flexWrap: 'nowrap' }}>
                {parts.map((p, i) => (
                  <Text key={i} style={{ color: p.color, fontFamily: 'monospace', fontSize: 12, lineHeight: 20 }}>
                    {p.text}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const codeStyles = StyleSheet.create({
  container: { backgroundColor: '#1E1E2E', marginTop: 8, borderRadius: 0 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#313244' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  lang: { color: '#6C7086', fontSize: 11, fontWeight: '600' },
});

export default function PostCard({ post }: any) {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likesCount ?? 0);
  const [saved, setSaved] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isCode = post.postType === 'code' || post.caption?.includes('```');

  const handleLike = async () => {
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

  const handleSave = async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) await savedService.unsave(post.id);
      else await savedService.save(post.id);
    } catch {
      setSaved(wasSaved);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR });

  return (
    <View style={[styles.card, { backgroundColor: isCode ? '#13131A' : theme.card, borderBottomColor: theme.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Avatar uri={post.user?.avatarUrl} name={post.user?.displayName || post.user?.username} size={38} />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: theme.text }]}>
              {post.user?.displayName || post.user?.username}
            </Text>
            {post.user?.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color={theme.verified} />
            )}
            {isCode && (
              <View style={styles.codeBadge}>
                <Ionicons name="code-slash" size={10} color="#CBA6F7" />
                <Text style={styles.codeBadgeText}>código</Text>
              </View>
            )}
          </View>
          <Text style={[styles.time, { color: theme.textSecondary }]}>{timeAgo}</Text>
        </View>
        <TouchableOpacity style={[styles.moreBtn, { backgroundColor: theme.surfaceHigh }]}>
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isCode ? (
        <CodeBlock caption={post.caption || ''} />
      ) : (
        <>
          {post.caption ? (
            <Text style={[styles.caption, { color: theme.text }]}>{post.caption}</Text>
          ) : null}
          {post.mediaUrls?.length > 0 && (
            <View style={styles.mediaContainer}>
              <Image source={{ uri: post.mediaUrls[0] }} style={styles.media} resizeMode="cover" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)']} style={StyleSheet.absoluteFillObject} />
            </View>
          )}
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? theme.like : theme.textSecondary} />
            </Animated.View>
            <Text style={[styles.actionCount, { color: liked ? theme.like : theme.textSecondary }]}>
              {likes > 0 ? likes : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
              {post.commentsCount > 0 ? post.commentsCount : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-redo-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? theme.primary : theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderBottomWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  meta: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { fontSize: 14, fontWeight: '600' },
  time: { fontSize: 11, marginTop: 1 },
  moreBtn: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2D1B69', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  codeBadgeText: { color: '#CBA6F7', fontSize: 9, fontWeight: '700' },
  caption: { paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, lineHeight: 20 },
  mediaContainer: { width, height: width * 0.85, overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  leftActions: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 13, fontWeight: '500' },
});
