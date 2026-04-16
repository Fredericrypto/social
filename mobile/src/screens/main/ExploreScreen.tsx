import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import Avatar from '../../components/ui/Avatar';

interface UserResult {
  id:           string;
  username:     string;
  displayName?: string;
  avatarUrl?:   string;
  isVerified?:  boolean;
  isFollowing?: boolean;
}

export default function ExploreScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const { user: me }      = useAuthStore();
  const insets            = useSafeAreaInsets();

  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<UserResult[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [searched,  setSearched]  = useState(false);
  const debounceRef = useRef<any>(null);

  // ── Busca com debounce ──────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 380);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  // ── Follow / Unfollow optimistic ────────────────────────────────────────────
  const toggleFollow = async (item: UserResult) => {
    if (item.id === me?.id) return;
    const wasFollowing = item.isFollowing;

    // Optimistic update
    setResults(prev =>
      prev.map(u => u.id === item.id ? { ...u, isFollowing: !wasFollowing } : u)
    );

    try {
      if (wasFollowing) {
        await api.delete(`/follows/${item.id}`);
      } else {
        await api.post(`/follows/${item.id}`);
      }
    } catch {
      // Reverter
      setResults(prev =>
        prev.map(u => u.id === item.id ? { ...u, isFollowing: wasFollowing } : u)
      );
    }
  };

  // ── Navegar para perfil ─────────────────────────────────────────────────────
  const goToProfile = (item: UserResult) => {
    if (item.id === me?.id) {
      navigation.navigate('Tabs', { screen: 'Profile' });
    } else {
      navigation.navigate('UserProfile', { username: item.username });
    }
  };

  // ── Row de usuário ──────────────────────────────────────────────────────────
  const renderUser = ({ item }: { item: UserResult }) => {
    const isMe        = item.id === me?.id;
    const isFollowing = item.isFollowing;

    return (
      <TouchableOpacity
        style={[styles.userRow, { borderBottomColor: theme.border }]}
        onPress={() => goToProfile(item)}
        activeOpacity={0.75}
      >
        <Avatar
          uri={item.avatarUrl}
          name={item.displayName || item.username}
          size={48}
        />

        <View style={styles.userInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color="#06B6D4" />
            )}
          </View>
          <Text style={[styles.userHandle, { color: theme.textSecondary }]}>
            @{item.username}
          </Text>
        </View>

        {!isMe && (
          <TouchableOpacity
            style={[
              styles.followBtn,
              isFollowing
                ? { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 1 }
                : { backgroundColor: theme.primary, borderWidth: 0 },
            ]}
            onPress={() => toggleFollow(item)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.followBtnText,
              { color: isFollowing ? theme.textSecondary : '#fff' },
            ]}>
              {isFollowing ? 'Seguindo' : 'Seguir'}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ── Skeleton loader ─────────────────────────────────────────────────────────
  const SkeletonRow = () => (
    <View style={[styles.userRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.skeletonAvatar, { backgroundColor: theme.surfaceHigh }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skeletonLine, { width: '45%', backgroundColor: theme.surfaceHigh }]} />
        <View style={[styles.skeletonLine, { width: '30%', backgroundColor: theme.surfaceHigh }]} />
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Explorar</Text>
      </View>

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Buscar pessoas..."
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={handleChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => search(query)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Conteúdo */}
      {loading ? (
        <View style={{ paddingTop: 8 }}>
          {[1, 2, 3, 4].map(i => <SkeletonRow key={i} />)}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderUser}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              {searched ? (
                <>
                  <Text style={styles.emptyEmoji}>🔍</Text>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Nenhum resultado
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Tente outro nome ou @username
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyEmoji}>✦</Text>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Descubra pessoas
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Digite um nome para começar
                  </Text>
                </>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },
  header:        {
    paddingHorizontal: 20,
    paddingBottom:     14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },

  searchWrap:    {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              10,
    margin:           16,
    marginTop:        14,
    borderRadius:     14,
    borderWidth:      1,
    paddingHorizontal: 14,
    height:           48,
  },
  searchInput:   { flex: 1, fontSize: 15 },

  userRow:       {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo:      { flex: 1, minWidth: 0 },
  userName:      { fontSize: 15, fontWeight: '600' },
  userHandle:    { fontSize: 12, marginTop: 2 },

  followBtn:     {
    paddingHorizontal: 16,
    paddingVertical:   7,
    borderRadius:      20,
    minWidth:          80,
    alignItems:        'center',
  },
  followBtnText: { fontSize: 13, fontWeight: '700' },

  // Skeleton
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24 },
  skeletonLine:   { height: 12, borderRadius: 6 },

  // Empty state
  empty:         { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyEmoji:    { fontSize: 38, marginBottom: 4 },
  emptyTitle:    { fontSize: 18, fontWeight: '700' },
  emptySub:      { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
