import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import FollowButton from '../../components/ui/FollowButton';
import { useFollowStore } from '../../store/follow.store';
import { PresenceStatus } from '../../services/presence.service';

interface UserResult {
  id:              string;
  username:        string;
  displayName?:    string;
  avatarUrl?:      string;
  isVerified?:     boolean;
  isFollowing?:    boolean;
  presenceStatus?: PresenceStatus;
}

export default function ExploreScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const { user: me }      = useAuthStore();
  const insets            = useSafeAreaInsets();
  const followStore       = useFollowStore();

  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState<UserResult[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<any>(null);


  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      const raw: UserResult[] = Array.isArray(data) ? data : [];

      // Hidrata o store global com os estados vindos da API
      followStore.hydrate(raw.map(u => ({ userId: u.id, isFollowing: !!u.isFollowing })));
      setResults(raw);
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
    setQuery(''); setResults([]); setSearched(false);
  };

  const toggleFollow = useCallback(async (userId: string) => {
    if (userId === me?.id) return;
    await followStore.toggle(userId);
  }, [me?.id, followStore]);

  const goToProfile = (item: UserResult) => {
    if (item.id === me?.id) navigation.navigate('Tabs', { screen: 'Profile' });
    else navigation.navigate('UserProfile', { username: item.username });
  };

  const renderUser = ({ item }: { item: UserResult }) => {
    const isMe = item.id === me?.id;

    return (
      <TouchableOpacity
        style={[s.userRow, { borderBottomColor: theme.border }]}
        onPress={() => goToProfile(item)}
        activeOpacity={0.75}
      >
        <Avatar
          uri={item.avatarUrl}
          name={item.displayName || item.username}
          size={48}
          presenceStatus={item.presenceStatus ?? null}
        />

        <View style={s.userInfo}>
          <View style={s.nameRow}>
            <Text style={[s.userName, { color: theme.text }]} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            {item.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color="#06B6D4" />
            )}
          </View>
          <Text style={[s.userHandle, { color: theme.textSecondary }]}>
            @{item.username}
          </Text>
        </View>

        {!isMe && (
          <FollowButton
            isFollowing={followStore.states[item.id] ?? !!item.isFollowing}
            onPress={() => toggleFollow(item.id)}
          />
        )}
      </TouchableOpacity>
    );
  };

  const SkeletonRow = () => (
    <View style={[s.userRow, { borderBottomColor: theme.border }]}>
      <View style={[s.skeletonAvatar, { backgroundColor: theme.surfaceHigh }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[s.skeletonLine, { width: '45%', backgroundColor: theme.surfaceHigh }]} />
        <View style={[s.skeletonLine, { width: '30%', backgroundColor: theme.surfaceHigh }]} />
      </View>
      <View style={[s.skeletonBtn, { backgroundColor: theme.surfaceHigh }]} />
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.text }]}>Explorar</Text>
      </View>

      {/* Search bar */}
      <View style={[s.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          style={[s.searchInput, { color: theme.text }]}
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
            <View style={s.empty}>
              {searched ? (
                <>
                  <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                    <Ionicons name="search-outline" size={28} color={theme.textSecondary} />
                  </View>
                  <Text style={[s.emptyTitle, { color: theme.text }]}>Nenhum resultado</Text>
                  <Text style={[s.emptySub, { color: theme.textSecondary }]}>
                    Tente outro nome ou @username
                  </Text>
                </>
              ) : (
                <>
                  <View style={[s.emptyIcon, { backgroundColor: theme.surface }]}>
                    <Ionicons name="compass-outline" size={28} color={theme.primaryLight} />
                  </View>
                  <Text style={[s.emptyTitle, { color: theme.text }]}>Descubra pessoas</Text>
                  <Text style={[s.emptySub, { color: theme.textSecondary }]}>
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

const s = StyleSheet.create({
  root:           { flex: 1 },
  header:         { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  searchWrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginTop: 14, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, height: 48 },
  searchInput:    { flex: 1, fontSize: 15 },
  userRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  userInfo:       { flex: 1, minWidth: 0 },
  nameRow:        { flexDirection: 'row', alignItems: 'center', gap: 5 },
  userName:       { fontSize: 15, fontWeight: '600' },
  userHandle:     { fontSize: 12, marginTop: 2 },
  skeletonAvatar: { width: 48, height: 48, borderRadius: 24 },
  skeletonLine:   { height: 12, borderRadius: 6 },
  skeletonBtn:    { width: 80, height: 36, borderRadius: 18 },
  empty:          { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIcon:      { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:     { fontSize: 18, fontWeight: '700' },
  emptySub:       { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
