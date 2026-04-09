import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, Switch, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import Avatar from '../../components/ui/Avatar';
import PrimaryButton from '../../components/ui/PrimaryButton';

const { width } = Dimensions.get('window');

function StatItem({ label, value }: { label: string; value: number | string }) {
  const { theme } = useThemeStore();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { isDark, toggle, theme } = useThemeStore();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Cover / Header */}
        <View style={styles.coverArea}>
          <LinearGradient
            colors={['#1a0533', '#0f1a3a', '#0A0A0F']}
            style={styles.cover}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          />

          {/* Top bar */}
          <View style={styles.topBar}>
            <Text style={styles.topTitle}>Perfil</Text>
            <TouchableOpacity style={[styles.topBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="settings-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Avatar + info */}
          <View style={styles.profileInfo}>
            <Avatar
              uri={user?.avatarUrl}
              name={user?.displayName || user?.username}
              size={84}
              showRing
            />
            <View style={styles.nameBlock}>
              <View style={styles.nameRow}>
                <Text style={[styles.displayName, { color: theme.text }]}>
                  {user?.displayName || user?.username}
                </Text>
                {user?.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.verified} />
                )}
              </View>
              <Text style={[styles.username, { color: theme.textSecondary }]}>
                @{user?.username}
              </Text>
              {user?.bio && (
                <Text style={[styles.bio, { color: theme.text }]}>{user.bio}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <StatItem label="posts" value={0} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem label="seguidores" value={0} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatItem label="seguindo" value={0} />
        </View>

        {/* Edit profile button */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <TouchableOpacity style={[styles.editBtn, { borderColor: theme.border, backgroundColor: theme.surface }]} onPress={() => (navigation as any).navigate("EditProfile")}>
            <Text style={[styles.editBtnText, { color: theme.text }]}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        {/* Settings section */}
        <View style={[styles.section, { borderTopColor: theme.border, marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREFERÊNCIAS</Text>

          {/* Dark mode toggle */}
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: theme.surfaceHigh }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={16} color={theme.primaryLight} />
              </View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Tema escuro</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Notifications */}
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: theme.surfaceHigh }]}>
                <Ionicons name="notifications-outline" size={16} color={theme.primaryLight} />
              </View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Notificações</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>

          {/* Privacy */}
          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: theme.surfaceHigh }]}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.primaryLight} />
              </View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Privacidade</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
        </View>

        {/* Logout */}
        <View style={{ paddingHorizontal: 16, marginTop: 24, marginBottom: 40 }}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: theme.error + '44' }]}
            onPress={logout}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.error} />
            <Text style={[styles.logoutText, { color: theme.error }]}>Sair da conta</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  coverArea: { position: 'relative', paddingBottom: 20 },
  cover: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
  },
  topTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  topBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  profileInfo: { paddingHorizontal: 16, flexDirection: 'row', gap: 16, alignItems: 'flex-start', paddingTop: 8 },
  nameBlock: { flex: 1, paddingTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  username: { fontSize: 13, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: 20,
    borderRadius: 16, borderWidth: 1, overflow: 'hidden',
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, marginVertical: 12 },
  editBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '600' },
  section: { borderTopWidth: 1, marginTop: 8, paddingTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 12 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 15 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderRadius: 14, paddingVertical: 14,
  },
  logoutText: { fontSize: 15, fontWeight: '600' },
});
