import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useThemeStore } from '../../store/theme.store';
import { api } from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import Skeleton from '../../components/ui/Skeleton';

const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  like:    { icon: 'heart',           color: '#F43F5E', label: 'curtiu seu post' },
  comment: { icon: 'chatbubble',      color: '#7C3AED', label: 'comentou no seu post' },
  follow:  { icon: 'person-add',      color: '#06B6D4', label: 'começou a seguir você' },
  mention: { icon: 'at-circle',       color: '#F59E0B', label: 'mencionou você' },
};

export default function NotificationsScreen() {
  const { theme } = useThemeStore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
      await api.patch('/notifications/read-all');
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const renderItem = ({ item }: any) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.like;
    return (
      <TouchableOpacity
        style={[
          styles.item,
          { borderBottomColor: theme.border },
          !item.isRead && { backgroundColor: theme.surface },
        ]}
        activeOpacity={0.7}
      >
        <View style={styles.iconWrap}>
          <Avatar size={46} />
          <View style={[styles.typeIcon, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon as any} size={10} color="#fff" />
          </View>
        </View>
        <View style={styles.content}>
          <Text style={[styles.text, { color: theme.text }]}>
            <Text style={{ fontWeight: '700' }}>@{item.actorId?.slice(0, 8)}</Text>
            {' '}{cfg.label}
          </Text>
          <Text style={[styles.time, { color: theme.textSecondary }]}>
            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
          </Text>
        </View>
        {!item.isRead && (
          <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notificações</Text>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          {[1,2,3,4].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Skeleton width={46} height={46} borderRadius={23} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="70%" height={13} />
                <Skeleton width="30%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Sem notificações</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Quando alguém interagir com você, aparecerá aqui
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
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { position: 'relative' },
  typeIcon: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  text: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySub: { fontSize: 14, textAlign: 'center' },
});
