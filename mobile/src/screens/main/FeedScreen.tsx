import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, FlatList, RefreshControl, ActivityIndicator,
  StyleSheet, Text, StatusBar, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postsService } from '../../services/posts.service';
import { useThemeStore } from '../../store/theme.store';
import { useFeedSocket } from '../../hooks/useFeedSocket';
import PostCard from '../../components/feed/PostCard';
import Stories from '../../components/feed/Stories';

export default function FeedScreen({ navigation }: any) {
  const [posts,      setPosts]      = useState<any[]>([]);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore,    setHasMore]    = useState(true);
  const { theme, isDark } = useThemeStore();

  // ── Novos posts em tempo real ─────────────────────────────────────────
  const [newPostsQueue, setNewPostsQueue] = useState<any[]>([]);
  const pillAnim = useRef(new Animated.Value(0)).current;
  const listRef  = useRef<FlatList>(null);

  // Aparece/some a pill com animação
  const showPill = useCallback((show: boolean) => {
    Animated.spring(pillAnim, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
  }, [pillAnim]);

  // ── Socket real-time ──────────────────────────────────────────────────
  const { isConnected } = useFeedSocket({
    onNewPost: useCallback((post: any) => {
      // Acumula novos posts na fila sem jogar no feed imediatamente
      // (igual Instagram/Twitter — evita pular conteúdo que o usuário está lendo)
      setNewPostsQueue(prev => {
        const next = [post, ...prev];
        showPill(true);
        return next;
      });
    }, [showPill]),

    onLike: useCallback(({ postId, likesCount }: { postId: string; likesCount: number }) => {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, likesCount } : p
      ));
    }, []),

    onComment: useCallback(({ postId, commentsCount }: { postId: string; commentsCount: number }) => {
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, commentsCount } : p
      ));
    }, []),
  });

  // ── Flush da fila: injeta novos posts e rola para o topo ──────────────
  const flushNewPosts = useCallback(() => {
    if (newPostsQueue.length === 0) return;
    setPosts(prev => [...newPostsQueue, ...prev]);
    setNewPostsQueue([]);
    showPill(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [newPostsQueue, showPill]);

  // ── Load ──────────────────────────────────────────────────────────────
  const loadFeed = useCallback(async (p = 1, refresh = false) => {
    try {
      const data = await postsService.getFeed(p);
      if (refresh || p === 1) {
        setPosts(data.posts);
        setNewPostsQueue([]);
        showPill(false);
      } else {
        setPosts(prev => [...prev, ...data.posts]);
      }
      setHasMore(p < data.pages);
      setPage(p);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [showPill]);

  useFocusEffect(useCallback(() => { loadFeed(1); }, []));

  // ── Header ────────────────────────────────────────────────────────────
  const Header = (
    <View>
      <View style={[
        styles.appHeader,
        { backgroundColor: theme.background, borderBottomColor: theme.border },
      ]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>◈ Rede</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Indicador de conexão real-time */}
          <View style={[
            styles.rtDot,
            { backgroundColor: isConnected ? '#22C55E' : theme.textTertiary },
          ]} />

          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: theme.surface }]}
            onPress={() => navigation?.navigate?.('Explore')}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Stories />
      <View style={{ height: 1, backgroundColor: theme.border }} />
    </View>
  );

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={Header}
        stickyHeaderIndices={[0]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadFeed(1, true); }}
            tintColor={theme.primary}
          />
        }
        onEndReached={() => { if (hasMore && !refreshing) loadFeed(page + 1); }}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>✦</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Seu feed está vazio</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
              Siga pessoas para ver os posts delas aqui
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore && posts.length > 0
            ? <ActivityIndicator color={theme.primary} style={{ padding: 20 }} />
            : null
        }
      />

      {/* Pill "X novos posts" — aparece quando chegam posts via socket */}
      <Animated.View
        style={[
          styles.newPostsPill,
          { backgroundColor: theme.primary },
          {
            opacity: pillAnim,
            transform: [{
              translateY: pillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            }],
          },
        ]}
        pointerEvents={newPostsQueue.length > 0 ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={styles.newPostsPillInner}
          onPress={flushNewPosts}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up-circle" size={16} color="#fff" />
          <Text style={styles.newPostsPillText}>
            {newPostsQueue.length === 1
              ? '1 novo post'
              : `${newPostsQueue.length} novos posts`}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1 },
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appHeader:  {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerBtn:   { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rtDot:       { width: 7, height: 7, borderRadius: 4 },
  empty:       { alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyTitle:  { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub:    { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Pill de novos posts
  newPostsPill: {
    position: 'absolute',
    top: 108,           // abaixo do header + stories
    alignSelf: 'center',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  newPostsPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  newPostsPillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
