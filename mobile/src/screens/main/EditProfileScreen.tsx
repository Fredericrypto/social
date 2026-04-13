import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert, ActivityIndicator, Switch, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { usersService } from '../../services/users.service';
import { postsService } from '../../services/posts.service';
import Avatar from '../../components/ui/Avatar';

const { width } = Dimensions.get('window');

// Gradientes disponíveis para o banner — fixos, não afetados pelo tema
const BANNER_GRADIENTS = [
  { id: 'purple',  colors: ['#1a0533', '#3b0764', '#0f1a3a'] as const, label: 'Roxo' },
  { id: 'ocean',   colors: ['#0c1445', '#1e3a8a', '#0891b2'] as const, label: 'Oceano' },
  { id: 'sunset',  colors: ['#1a0a00', '#7c2d12', '#dc2626'] as const, label: 'Pôr do sol' },
  { id: 'forest',  colors: ['#052e16', '#14532d', '#065f46'] as const, label: 'Floresta' },
  { id: 'night',   colors: ['#000000', '#111827', '#1f2937'] as const, label: 'Noite' },
  { id: 'rose',    colors: ['#1a0010', '#881337', '#be185d'] as const, label: 'Rosa' },
  { id: 'gold',    colors: ['#1c0a00', '#78350f', '#d97706'] as const, label: 'Dourado' },
  { id: 'cosmic',  colors: ['#0d0221', '#1e1b4b', '#4c1d95'] as const, label: 'Cósmico' },
];

export default function EditProfileScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const { user, loadUser } = useAuthStore() as any;
  const userData = user as any;

  const currentGradient = BANNER_GRADIENTS.find(g => g.id === userData?.bannerGradient) || BANNER_GRADIENTS[0];

  const [form, setForm] = useState({
    displayName: userData?.displayName || '',
    bio: userData?.bio || '',
    jobTitle: userData?.jobTitle || '',
    company: userData?.company || '',
    website: userData?.website || '',
    skillsText: (userData?.skills || []).join(', '),
    isPrivate: userData?.isPrivate || false,
    showLikesCount: userData?.showLikesCount ?? true,
    bannerGradient: userData?.bannerGradient || 'purple',
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGradients, setShowGradients] = useState(false);

  const set = (k: string) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  const selectedGradient = BANNER_GRADIENTS.find(g => g.id === form.bannerGradient) || BANNER_GRADIENTS[0];

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let avatarUrl = userData?.avatarUrl;
      if (avatarUri) {
        const ext = avatarUri.split('.').pop()?.split('?')[0] || 'jpg';
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl('avatars', ext);
        const blob = await fetch(avatarUri).then(r => r.blob());
        await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
        avatarUrl = publicUrl;
      }

      const skills = form.skillsText
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      await usersService.updateMe({
        displayName: form.displayName,
        bio: form.bio,
        jobTitle: form.jobTitle,
        company: form.company,
        website: form.website,
        skills,
        isPrivate: form.isPrivate,
        showLikesCount: form.showLikesCount,
        bannerGradient: form.bannerGradient,
        avatarUrl,
      });
      await loadUser();
      Alert.alert('✓ Perfil atualizado!');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Erro', e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = avatarUri || userData?.avatarUrl;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

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

        {/* Banner preview — cor fixa, não afetada pelo tema */}
        <View style={styles.bannerSection}>
          <LinearGradient
            colors={selectedGradient.colors}
            style={styles.bannerPreview}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <TouchableOpacity
              style={styles.changeBannerBtn}
              onPress={() => setShowGradients(!showGradients)}
              activeOpacity={0.8}
            >
              <Ionicons name="color-palette-outline" size={14} color="#fff" />
              <Text style={styles.changeBannerText}>Mudar banner</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Seletor de gradientes */}
          {showGradients && (
            <View style={[styles.gradientPicker, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.gradientPickerTitle, { color: theme.textSecondary }]}>Escolha o banner</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gradientList}>
                {BANNER_GRADIENTS.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => { set('bannerGradient')(g.id); setShowGradients(false); }}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={g.colors}
                      style={[
                        styles.gradientThumb,
                        form.bannerGradient === g.id && styles.gradientThumbSelected,
                      ]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    >
                      {form.bannerGradient === g.id && (
                        <Ionicons name="checkmark" size={18} color="#fff" />
                      )}
                    </LinearGradient>
                    <Text style={[styles.gradientLabel, { color: theme.textSecondary }]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Avatar sobre o banner */}
          <View style={styles.avatarWrapper}>
            <Avatar uri={currentAvatar} name={form.displayName || userData?.username} size={88} showRing />
            <TouchableOpacity style={[styles.editAvatarBtn, { backgroundColor: theme.primary }]} onPress={pickAvatar}>
              <Ionicons name="camera" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Campos básicos */}
        <View style={styles.form}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>BÁSICO</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nome</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.displayName} onChangeText={set('displayName')} placeholder="Nome de exibição" placeholderTextColor={theme.textSecondary} maxLength={50} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bio</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.bio} onChangeText={set('bio')} placeholder="Fale sobre você..." placeholderTextColor={theme.textSecondary} multiline maxLength={150} />
            </View>
          </View>
          <Text style={[styles.charCount, { color: theme.textSecondary }]}>{form.bio.length}/150</Text>

          {/* Campos profissionais */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>PROFISSIONAL</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Cargo</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.jobTitle} onChangeText={set('jobTitle')} placeholder="Ex: Dev Full Stack" placeholderTextColor={theme.textSecondary} maxLength={60} />
            </View>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Empresa</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.company} onChangeText={set('company')} placeholder="Ex: Startup XYZ" placeholderTextColor={theme.textSecondary} maxLength={60} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Website</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.website} onChangeText={set('website')} placeholder="https://..." placeholderTextColor={theme.textSecondary} maxLength={100} autoCapitalize="none" keyboardType="url" />
            </View>
          </View>

          {/* Skills */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>HABILIDADES</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={form.skillsText}
                onChangeText={set('skillsText')}
                placeholder="React, Node.js, Python (separadas por vírgula)"
                placeholderTextColor={theme.textSecondary}
                maxLength={200}
              />
            </View>
          </View>

          {/* Privacidade */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>PRIVACIDADE</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.switchRow, { borderBottomColor: theme.border }]}>
              <View style={styles.switchLeft}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.primaryLight} />
                <View>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Perfil privado</Text>
                  <Text style={[styles.switchSub, { color: theme.textSecondary }]}>Apenas aprovados veem seus posts</Text>
                </View>
              </View>
              <Switch value={form.isPrivate} onValueChange={set('isPrivate')} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Ionicons name="heart-outline" size={16} color={theme.primaryLight} />
                <View>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Mostrar curtidas</Text>
                  <Text style={[styles.switchSub, { color: theme.textSecondary }]}>Exibir contagem nos seus posts</Text>
                </View>
              </View>
              <Switch value={form.showLikesCount} onValueChange={set('showLikesCount')} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  saveBtn: { fontSize: 15, fontWeight: '700' },
  content: { paddingBottom: 60 },
  bannerSection: { position: 'relative', marginBottom: 60 },
  bannerPreview: { height: 140, justifyContent: 'flex-end', alignItems: 'flex-end', paddingHorizontal: 14, paddingBottom: 12 },
  changeBannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  changeBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  gradientPicker: { borderBottomWidth: 1, paddingVertical: 12 },
  gradientPickerTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 16, marginBottom: 10 },
  gradientList: { paddingHorizontal: 16, gap: 10 },
  gradientThumb: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  gradientThumbSelected: { borderWidth: 2.5, borderColor: '#fff' },
  gradientLabel: { fontSize: 10, textAlign: 'center' },
  avatarWrapper: { position: 'absolute', bottom: -44, left: 20 },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A0A0F' },
  form: { paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginBottom: 8 },
  fieldGroup: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, gap: 12 },
  fieldLabel: { width: 64, fontSize: 13, paddingTop: 2 },
  fieldInput: { flex: 1, fontSize: 15, lineHeight: 20 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1 },
  switchLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  switchLabel: { fontSize: 14, fontWeight: '500' },
  switchSub: { fontSize: 11, marginTop: 2 },
});
