import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  StatusBar, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/theme.store';
import { api } from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import Skeleton from '../../components/ui/Skeleton';

export default function ExploreScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = React.useRef<any>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setSearched(true);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 400);
  };

  const renderUser = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.userRow, { borderBottomColor: theme.border }]}
      activeOpacity={0.7}
    >
      <Avatar uri={item.avatarUrl} name={item.displayName || item.username} size={48} />
      <View style={styles.userInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[styles.userName, { color: theme.text }]}>
            {item.displayName || item.username}
          </Text>
          {item.isVerified && (
            <Ionicons name="checkmark-circle" size={14} color={theme.verified} />
          )}
        </View>
        <Text style={[styles.userHandle, { color: theme.textSecondary }]}>
          @{item.username}
        </Text>
      </View>
      <TouchableOpacity style={[styles.followBtn, { borderColor: theme.primary }]}>
        <Text style={[styles.followBtnText, { color: theme.primary }]}>Seguir</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
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
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          {[1,2,3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="45%" height={13} />
                <Skeleton width="30%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          renderItem={renderUser}
          ListEmptyComponent={
            <View style={styles.empty}>
              {searched ? (
                <>
                  <Text style={{ fontSize: 36, marginBottom: 12 }}>🔍</Text>
                  <Text style={[styles.emptyTitle, { color: theme.text }]}>
                    Nenhum resultado
                  </Text>
                  <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                    Tente outro nome ou username
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 36, marginBottom: 12 }}>✦</Text>
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
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, height: 48,
  },
  searchInput: { flex: 1, fontSize: 15 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600' },
  userHandle: { fontSize: 12, marginTop: 2 },
  followBtn: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  followBtnText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
