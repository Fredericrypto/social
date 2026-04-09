import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { usersService } from '../../services/users.service';
import { postsService } from '../../services/posts.service';
import Avatar from '../../components/ui/Avatar';
import PrimaryButton from '../../components/ui/PrimaryButton';

export default function EditProfileScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const { user, loadUser } = useAuthStore() as any;
  const [form, setForm] = useState({
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    isPrivate: user?.isPrivate || false,
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let avatarUrl = user?.avatarUrl;
      if (avatarUri) {
        const ext = avatarUri.split('.').pop()?.split('?')[0] || 'jpg';
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl('avatars', ext);
        const blob = await fetch(avatarUri).then(r => r.blob());
        await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
        avatarUrl = publicUrl;
      }
      await usersService.updateMe({ ...form, avatarUrl });
      Alert.alert('✓ Perfil atualizado!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = avatarUri || user?.avatarUrl;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Editar perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading
            ? <ActivityIndicator color={theme.primaryLight} size="small" />
            : <Text style={[styles.saveBtn, { color: theme.primaryLight }]}>Salvar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <LinearGradient colors={['#1a0533', '#0f1a3a']} style={styles.coverPreview}>
            <View style={styles.avatarWrapper}>
              <Avatar uri={currentAvatar} name={form.displayName || user?.username} size={90} showRing />
              <TouchableOpacity style={[styles.editAvatarBtn, { backgroundColor: theme.primary }]} onPress={pickAvatar}>
                <Ionicons name="camera" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Form fields */}
        <View style={styles.form}>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nome</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={form.displayName}
                onChangeText={set('displayName')}
                placeholder="Seu nome de exibição"
                placeholderTextColor={theme.textSecondary}
                maxLength={50}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bio</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={form.bio}
                onChangeText={set('bio')}
                placeholder="Fale um pouco sobre você..."
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={150}
              />
            </View>
          </View>

          {/* Bio char count */}
          <Text style={[styles.charCount, { color: theme.textSecondary }]}>
            {form.bio.length}/150
          </Text>

          {/* Privacy */}
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 8 }]}>
            <View style={[styles.settingRow]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: theme.surfaceHigh }]}>
                  <Ionicons name="lock-closed-outline" size={15} color={theme.primaryLight} />
                </View>
                <View>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Perfil privado</Text>
                  <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
                    Apenas seguidores aprovados veem seus posts
                  </Text>
                </View>
              </View>
              <Switch
                value={form.isPrivate}
                onValueChange={set('isPrivate')}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  content: { paddingBottom: 40 },
  avatarSection: { marginBottom: 24 },
  coverPreview: { height: 140, justifyContent: 'flex-end', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 16 },
  avatarWrapper: { position: 'relative' },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0A0A0F',
  },
  form: { paddingHorizontal: 16 },
  fieldGroup: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  fieldLabel: { width: 60, fontSize: 14, paddingTop: 2 },
  fieldInput: { flex: 1, fontSize: 15, lineHeight: 20 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { fontSize: 14, fontWeight: '500' },
  settingSub: { fontSize: 11, marginTop: 2 },
});
