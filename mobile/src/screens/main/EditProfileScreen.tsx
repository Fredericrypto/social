import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert, ActivityIndicator, Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeStore } from "../../store/theme.store";
import { useAuthStore } from "../../store/auth.store";
import { usersService } from "../../services/users.service";
import { postsService } from "../../services/posts.service";
import Avatar from "../../components/ui/Avatar";
import EarlyAdopterBadge from "../../components/ui/EarlyAdopterBadge";

export default function EditProfileScreen({ navigation }: any) {
  const { theme, isDark } = useThemeStore();
  const { user, loadUser } = useAuthStore() as any;
  const userData = user as any;
  const insets   = useSafeAreaInsets();

  const [form, setForm] = useState({
    displayName:          userData?.displayName          || "",
    bio:                  userData?.bio                  || "",
    jobTitle:             userData?.jobTitle             || "",
    company:              userData?.company              || "",
    website:              userData?.website              || "",
    skillsText:           (userData?.skills || []).join(", "),
    isPrivate:            userData?.isPrivate            || false,
    showLikesCount:       userData?.showLikesCount       ?? true,
    showEarlyAdopterBadge: userData?.showEarlyAdopterBadge ?? true,
  });

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);

  const set = (k: string) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled) setAvatarUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let avatarUrl = userData?.avatarUrl;
      if (avatarUri) {
        const ext = avatarUri.split(".").pop()?.split("?")[0] || "jpg";
        const { uploadUrl, publicUrl } = await postsService.getUploadUrl("avatars", ext);
        const blob = await fetch(avatarUri).then(r => r.blob());
        await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
        avatarUrl = publicUrl;
      }
      const skills = form.skillsText
        .split(",")
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);

      await usersService.updateMe({
        displayName:          form.displayName,
        bio:                  form.bio,
        jobTitle:             form.jobTitle,
        company:              form.company,
        website:              form.website,
        skills,
        isPrivate:            form.isPrivate,
        showLikesCount:       form.showLikesCount,
        showEarlyAdopterBadge: form.showEarlyAdopterBadge,
        avatarUrl,
      });
      await loadUser();
      Alert.alert("✓ Perfil atualizado!");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.message || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = avatarUri || userData?.avatarUrl;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Editar perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {loading
            ? <ActivityIndicator color={theme.primaryLight} size="small" />
            : <Text style={[styles.saveBtn, { color: theme.primaryLight }]}>Salvar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarWrap}>
            <Avatar uri={currentAvatar} name={form.displayName || userData?.username} size={88} ring="default" />
            <View style={[styles.editAvatarBtn, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>Toque para alterar a foto</Text>
        </View>

        {/* Campos */}
        <View style={styles.form}>

          {/* Básico */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>BÁSICO</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nome</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={form.displayName} onChangeText={set("displayName")}
                placeholder="Nome de exibição" placeholderTextColor={theme.textSecondary} maxLength={50}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bio</Text>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={form.bio} onChangeText={set("bio")}
                placeholder="Fale sobre você..." placeholderTextColor={theme.textSecondary}
                multiline maxLength={150}
              />
            </View>
          </View>
          <Text style={[styles.charCount, { color: theme.textSecondary }]}>{form.bio.length}/150</Text>

          {/* Profissional */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>PROFISSIONAL</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Cargo</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.jobTitle} onChangeText={set("jobTitle")} placeholder="Ex: Dev Full Stack" placeholderTextColor={theme.textSecondary} maxLength={60} />
            </View>
            <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Empresa</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.company} onChangeText={set("company")} placeholder="Ex: Startup XYZ" placeholderTextColor={theme.textSecondary} maxLength={60} />
            </View>
            <View style={styles.fieldRow}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Website</Text>
              <TextInput style={[styles.fieldInput, { color: theme.text }]} value={form.website} onChangeText={set("website")} placeholder="https://..." placeholderTextColor={theme.textSecondary} maxLength={100} autoCapitalize="none" keyboardType="url" />
            </View>
          </View>

          {/* Skills — com dica de UX */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>HABILIDADES</Text>
          <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={form.skillsText}
                onChangeText={set("skillsText")}
                placeholder="React, Node.js, Python..."
                placeholderTextColor={theme.textSecondary}
                maxLength={200}
              />
            </View>
          </View>
          {/* Dica de UX — texto auxiliar pequeno */}
          <Text style={[styles.hint, { color: theme.textTertiary }]}>
            Separe habilidades com vírgula · máx. 200 caracteres
          </Text>

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
              <Switch value={form.isPrivate} onValueChange={set("isPrivate")} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <Ionicons name="heart-outline" size={16} color={theme.primaryLight} />
                <View>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Mostrar curtidas</Text>
                  <Text style={[styles.switchSub, { color: theme.textSecondary }]}>Exibir contagem nos seus posts</Text>
                </View>
              </View>
              <Switch value={form.showLikesCount} onValueChange={set("showLikesCount")} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            </View>
          </View>

          {/* Early Adopter Badge */}
          {userData?.earlyAdopterNumber ? (
            <>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 20 }]}>BADGE FUNDADOR</Text>
              <View style={[styles.fieldGroup, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.switchRow}>
                  <View style={styles.switchLeft}>
                    <EarlyAdopterBadge number={userData.earlyAdopterNumber} size="md" showTooltip={false} />
                    <View>
                      <Text style={[styles.switchLabel, { color: theme.text }]}>Mostrar badge no perfil</Text>
                      <Text style={[styles.switchSub, { color: theme.textSecondary }]}>
                        #{String(userData.earlyAdopterNumber).padStart(3,"0")} · Fundador da plataforma
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={form.showEarlyAdopterBadge}
                    onValueChange={set("showEarlyAdopterBadge")}
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle:  { fontSize: 16, fontWeight: "700" },
  saveBtn:      { fontSize: 15, fontWeight: "700" },
  content:      { paddingBottom: 60 },
  avatarSection: { alignItems: "center", paddingVertical: 28 },
  avatarWrap:   { position: "relative" },
  editAvatarBtn: { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarHint:   { fontSize: 12, marginTop: 10 },
  form:         { paddingHorizontal: 16, paddingTop: 0 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  fieldGroup:   { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  fieldRow:     { flexDirection: "row", alignItems: "flex-start", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  fieldLabel:   { width: 64, fontSize: 13, paddingTop: 2 },
  fieldInput:   { flex: 1, fontSize: 15, lineHeight: 20 },
  charCount:    { fontSize: 11, textAlign: "right", marginTop: 4 },
  hint:         { fontSize: 11, marginTop: 6, marginBottom: 4 },
  switchRow:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  switchLeft:   { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  switchLabel:  { fontSize: 14, fontWeight: "500" },
  switchSub:    { fontSize: 11, marginTop: 2 },
});
