import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { messagesService } from '../../services/messages.service';
import Avatar from '../../components/ui/Avatar';
import Skeleton from '../../components/ui/Skeleton';

export default function MessagesScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await messagesService.getConversations();
      setConversations(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const getOtherParticipant = (conv: any) =>
    conv.participantAId === user?.id ? conv.participantB : conv.participantA;

  const renderItem = ({ item }: any) => {
    const other = getOtherParticipant(item);
    return (
      <TouchableOpacity
        style={[styles.convItem, { borderBottomColor: theme.border }]}
        onPress={() => navigation.navigate('Chat', { conversation: item, other })}
        activeOpacity={0.7}
      >
        <Avatar uri={other?.avatarUrl} name={other?.displayName || other?.username} size={50} />
        <View style={styles.convInfo}>
          <View style={styles.convTop}>
            <Text style={[styles.convName, { color: theme.text }]}>
              {other?.displayName || other?.username}
            </Text>
            {item.lastMessageAt && (
              <Text style={[styles.convTime, { color: theme.textSecondary }]}>
                {formatDistanceToNow(new Date(item.lastMessageAt), { locale: ptBR })}
              </Text>
            )}
          </View>
          <Text style={[styles.convPreview, { color: theme.textSecondary }]} numberOfLines={1}>
            Toque para abrir a conversa
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mensagens</Text>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: theme.surface }]}>
          <Ionicons name="create-outline" size={18} color={theme.primaryLight} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          {[1,2,3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Skeleton width={50} height={50} borderRadius={25} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="50%" height={12} />
                <Skeleton width="80%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✉</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem mensagens</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Comece uma conversa com alguém
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  newBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  convItem: { flexDirection: 'row', padding: 16, gap: 12, borderBottomWidth: 1, alignItems: 'center' },
  convInfo: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  convName: { fontSize: 15, fontWeight: '600' },
  convTime: { fontSize: 11 },
  convPreview: { fontSize: 13 },
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
