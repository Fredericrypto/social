import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Avatar from '../ui/Avatar';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';

const MOCK_STORIES = [
  { id: '1', username: 'ana', seen: false },
  { id: '2', username: 'marcos', seen: false },
  { id: '3', username: 'julia', seen: true },
  { id: '4', username: 'pedro', seen: true },
  { id: '5', username: 'carol', seen: false },
];

export default function Stories() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Meu story */}
      <TouchableOpacity style={styles.item}>
        <View style={[styles.addRing, { borderColor: theme.border }]}>
          <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={54} />
          <View style={[styles.addBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.addIcon}>+</Text>
          </View>
        </View>
        <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>
          você
        </Text>
      </TouchableOpacity>

      {MOCK_STORIES.map(s => (
        <TouchableOpacity key={s.id} style={styles.item}>
          {s.seen ? (
            <View style={[styles.seenRing, { borderColor: theme.border }]}>
              <Avatar name={s.username} size={54} />
            </View>
          ) : (
            <LinearGradient
              colors={['#7C3AED', '#06B6D4']}
              style={styles.ring}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <View style={[styles.ringInner, { backgroundColor: theme.background }]}>
                <Avatar name={s.username} size={50} />
              </View>
            </LinearGradient>
          )}
          <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>
            {s.username}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  item: { alignItems: 'center', gap: 6, width: 64 },
  ring: { width: 62, height: 62, borderRadius: 31, padding: 2, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 58, height: 58, borderRadius: 29, padding: 2, alignItems: 'center', justifyContent: 'center' },
  seenRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  addRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  addBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  addIcon: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  name: { fontSize: 11, textAlign: 'center' },
});
