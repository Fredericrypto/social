import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, FlatList, RefreshControl, ActivityIndicator,
  StyleSheet, Text, StatusBar, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { postsService } from '../../services/posts.service';
import { useThemeStore } from '../../store/theme.store';
import PostCard from '../../components/feed/PostCard';
import Stories from '../../components/feed/Stories';

export default function FeedScreen({ navigation }: any) {
  const [posts, setPosts] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { theme } = useThemeStore();

  const loadFeed = useCallback(async (p = 1, refresh = false) => {
    try {
      const data = await postsService.getFeed(p);
      if (refresh || p === 1) setPosts(data.posts);
      else setPosts(prev => [...prev, ...data.posts]);
      setHasMore(p < data.pages);
      setPage(p);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadFeed(1); }, []));

  const Header = (
    <View>
      <View style={[styles.appHeader, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>◈ Rede</Text>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: theme.surface }]}
          onPress={() => navigation?.navigate?.('Explore')}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
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
      <StatusBar barStyle="light-content" backgroundColor={theme.background} />
      <FlatList
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
        onEndReached={() => { if (hasMore) loadFeed(page + 1); }}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  appHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  headerBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
