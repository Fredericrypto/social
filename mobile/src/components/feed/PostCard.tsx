import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Animated, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import { RichText } from '../ui/RichText';
import ProjectCard, { parseProjectData } from '../ui/ProjectCard';
import Avatar from '../ui/Avatar';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { postsService } from '../../services/posts.service';
import { savedService } from '../../services/saved.service';

const { width } = Dimensions.get('window');
const LIKE_COLOR = '#F43F5E';

// ─── Syntax highlight ─────────────────────────────────────────────────────────
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
  return code.split('\n').map((line, li) => {
    const parts: { text: string; color: string }[] = [];
    let rem = line;
    while (rem.length > 0) {
      if (rem.startsWith('//') || rem.startsWith('#')) {
        parts.push({ text: rem, color: TOKEN_COLORS.comment }); break;
      }
      const str = rem.match(/^(['"`])(.*?)\1/);
      if (str) { parts.push({ text: str[0], color: TOKEN_COLORS.string }); rem = rem.slice(str[0].length); continue; }
      const kw = rem.match(/^(const|let|var|function|return|if|else|for|while|import|export|from|class|async|await|def|print|val|fun|type|interface|extends|implements)\b/);
      if (kw) { parts.push({ text: kw[0], color: TOKEN_COLORS.keyword }); rem = rem.slice(kw[0].length); continue; }
      const num = rem.match(/^\d+\.?\d*/);
      if (num) { parts.push({ text: num[0], color: TOKEN_COLORS.number }); rem = rem.slice(num[0].length); continue; }
      const fn = rem.match(/^([a-zA-Z_]\w*)\s*(?=\()/);
      if (fn) { parts.push({ text: fn[0], color: TOKEN_COLORS.function }); rem = rem.slice(fn[0].length); continue; }
      parts.push({ text: rem[0], color: TOKEN_COLORS.default }); rem = rem.slice(1);
    }
    return { parts, key: li };
  });
}

function CodeBlock({ caption }: { caption: string }) {
  const match     = caption.match(/```([a-z]*)\n?([\s\S]*?)```/);
  const lang      = match?.[1] || 'code';
  const code      = match?.[2]?.trim() || caption;
  const desc      = caption.match(/^([\s\S]*?)```/)?.[1]?.trim();
  const lines     = tokenize(code);

  return (
    <View>
      {desc ? (
        <Text style={{ color: '#CDD6F4', fontSize: 14, lineHeight: 20, padding: 12, paddingBottom: 0 }}>
          {desc}
        </Text>
      ) : null}
      <View style={cs.container}>
        <View style={cs.topBar}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['#FF5F57', '#FFBD2E', '#28C840'].map(c => (
              <View key={c} style={[cs.dot, { backgroundColor: c }]} />
            ))}
          </View>
          <Text style={cs.lang}>{lang}</Text>
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

const cs = StyleSheet.create({
  container: { backgroundColor: '#1E1E2E', marginTop: 8 },
  topBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#313244' },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  lang:      { color: '#6C7086', fontSize: 11, fontWeight: '600' },
});

// ─── PostCard ─────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: any;
  onLikeUpdate?: (postId: string, likesCount: number) => void;
}

export default function PostCard({ post, onLikeUpdate }: PostCardProps) {
  const { theme }  = useThemeStore();
  const { user }   = useAuthStore();
  const navigation = useNavigation<any>();

  // Estado inicial correto — respeita o que vem da API
  const [liked,  setLiked]  = useState<boolean>(post.isLiked  ?? false);
  const [saved,  setSaved]  = useState<boolean>(post.isSaved  ?? false);
  const [likes,  setLikes]  = useState<number>(post.likesCount ?? 0);

  const heartScale  = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTap     = useRef(0);

  const isCode    = post.postType === 'code' || post.caption?.includes('```');
  const isProject = post.postType === 'project';
  const isOwnPost = user?.id === (post.user?.id || post.userId);

  // ── Navegar para perfil ──────────────────────────────────────────────────
  const goToProfile = useCallback(() => {
    const username = post.user?.username;
    if (!username) return;
    if (isOwnPost) {
      navigation.navigate('Tabs', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { username });
    }
  }, [post.user?.username, isOwnPost, navigation]);

  // ── Like com animação ────────────────────────────────────────────────────
  const triggerLikeAnim = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
  }, [heartScale]);

  const handleLike = useCallback(async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    const newCount = wasLiked ? likes - 1 : likes + 1;
    setLikes(newCount);
    triggerLikeAnim();
    onLikeUpdate?.(post.id, newCount);
    try {
      if (wasLiked) await postsService.unlike(post.id);
      else          await postsService.like(post.id);
    } catch {
      setLiked(wasLiked);
      setLikes(likes);
      onLikeUpdate?.(post.id, likes);
    }
  }, [liked, likes, post.id, triggerLikeAnim, onLikeUpdate]);

  // ── Double tap na imagem para curtir ─────────────────────────────────────
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) handleLike();
      // Animação do coração flutuante
      heartOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.6, useNativeDriver: true, speed: 40 }),
        Animated.timing(heartOpacity, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]).start();
    }
    lastTap.current = now;
  }, [liked, handleLike, heartOpacity, heartScale]);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) await savedService.unsave(post.id);
      else          await savedService.save(post.id);
    } catch {
      setSaved(wasSaved);
    }
  }, [saved, post.id]);

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <View style={[styles.card, {
      backgroundColor: isCode ? '#13131A' : theme.background,
      borderBottomColor: theme.border,
    }]}>

      {/* Projeto — renderiza o ProjectCard completo */}
      {isProject ? (
        <View style={{ padding: 14 }}>
          <ProjectCard post={post} />
          <View style={styles.actions}>
            <View style={styles.leftActions}>
              <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? LIKE_COLOR : theme.textSecondary} />
                </Animated.View>
                {likes > 0 && (
                  <Text style={[styles.actionCount, { color: liked ? LIKE_COLOR : theme.textSecondary }]}>
                    {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? theme.primary : theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {isProject ? null : (

      {/* ── Header — clicável para perfil ───────────────────────────────── */}
      <TouchableOpacity
        style={styles.header}
        onPress={goToProfile}
        activeOpacity={0.8}
      >
        <Avatar
          uri={post.user?.avatarUrl}
          name={post.user?.displayName || post.user?.username}
          size={38}
        />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, { color: theme.text }]}>
              {post.user?.displayName || post.user?.username}
            </Text>
            {post.user?.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color="#06B6D4" />
            )}
            {isCode && (
              <View style={styles.codeBadge}>
                <Ionicons name="code-slash" size={10} color="#CBA6F7" />
                <Text style={styles.codeBadgeText}>código</Text>
              </View>
            )}
          </View>
          <Text style={[styles.time, { color: theme.textSecondary }]}>
            @{post.user?.username} · {timeAgo}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.moreBtn, { backgroundColor: theme.surfaceHigh }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      {isCode ? (
        <CodeBlock caption={post.caption || ''} />
      ) : (
        <>
          {post.caption ? (
            <RichText
              text={post.caption}
              style={[styles.caption, { color: theme.text }]}
            />
          ) : null}
          {post.mediaUrls?.length > 0 && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={handleDoubleTap}
              style={styles.mediaContainer}
            >
              <Image
                source={{ uri: post.mediaUrls[0] }}
                style={styles.media}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.25)']}
                style={StyleSheet.absoluteFillObject}
              />
              {/* Coração flutuante no double-tap */}
              <Animated.View style={[
                styles.floatingHeart,
                { opacity: heartOpacity, transform: [{ scale: heartScale }] },
              ]}>
                <Ionicons name="heart" size={72} color="#fff" />
              </Animated.View>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>

          {/* Like */}
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={22}
                color={liked ? LIKE_COLOR : theme.textSecondary}
              />
            </Animated.View>
            {likes > 0 && (
              <Text style={[styles.actionCount, { color: liked ? LIKE_COLOR : theme.textSecondary }]}>
                {likes >= 1000 ? `${(likes / 1000).toFixed(1)}k` : likes}
              </Text>
            )}
          </TouchableOpacity>

          {/* Comentários */}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
            {(post.commentsCount ?? 0) > 0 && (
              <Text style={[styles.actionCount, { color: theme.textSecondary }]}>
                {post.commentsCount}
              </Text>
            )}
          </TouchableOpacity>

          {/* Compartilhar */}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-redo-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

        </View>

        {/* Salvar */}
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? theme.primary : theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* fim do bloco não-projeto */}
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card:           { borderBottomWidth: StyleSheet.hairlineWidth },
  header:         { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  meta:           { flex: 1 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username:       { fontSize: 14, fontWeight: '700' },
  time:           { fontSize: 11, marginTop: 2 },
  moreBtn:        { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2D1B69', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  codeBadgeText:  { color: '#CBA6F7', fontSize: 9, fontWeight: '700' },
  caption:        { paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, lineHeight: 21 },
  mediaContainer: { width, height: width * 0.85, overflow: 'hidden', position: 'relative' },
  media:          { width: '100%', height: '100%' },
  floatingHeart:  { position: 'absolute', top: '35%', left: '38%', zIndex: 10 },
  actions:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  leftActions:    { flexDirection: 'row', gap: 20, alignItems: 'center' },
  actionBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount:    { fontSize: 13, fontWeight: '600' },
});
