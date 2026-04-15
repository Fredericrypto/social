import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, StatusBar, Alert, Linking, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import { ALL_THEMES } from "../../theme";
import Avatar from "../../components/ui/Avatar";
import TermsModal from "../../components/modals/TermsModal";

// expo-navigation-bar — só no Android
let NavigationBar: any = null;
if (Platform.OS === "android") {
  try { NavigationBar = require("expo-navigation-bar"); } catch {}
}

// ── Componentes internos ───────────────────────────────────────────────────

interface RowProps {
  icon: string;
  iconColor: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}

function SettingRow({ icon, iconColor, label, sub, right, onPress, danger, last }: RowProps) {
  const { theme } = useThemeStore();
  return (
    <TouchableOpacity
      style={[s.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={[s.rowIcon, { backgroundColor: iconColor + "22" }]}>
        <Ionicons name={icon as any} size={17} color={iconColor} />
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, { color: danger ? theme.error : theme.text }]}>{label}</Text>
        {sub ? <Text style={[s.rowSub, { color: theme.textSecondary }]}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null)}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[s.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

// ── Seletor de paleta ──────────────────────────────────────────────────────

function PaletteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme, isDark, themeId, setThemeId } = useThemeStore();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={pm.overlay}>
        <View style={[pm.panel, { paddingBottom: insets.bottom + 16 }]}>
          <BlurView
            intensity={95}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={pm.handle} />
          <View style={pm.header}>
            <Text style={[pm.title, { color: theme.text }]}>Paleta de cores</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={[pm.sub, { color: theme.textSecondary }]}>
            {isDark ? "Modo escuro" : "Modo claro"} · {ALL_THEMES.length} paletas
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pm.grid}>
            {ALL_THEMES.map(t => {
              const palette = isDark ? t.dark : t.light;
              const isActive = themeId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[pm.card, isActive && { borderWidth: 2, borderColor: palette.primary }]}
                  onPress={() => setThemeId(t.id)}
                  activeOpacity={0.8}
                >
                  {/* Preview das cores */}
                  <LinearGradient
                    colors={[palette.background, palette.surface, palette.surfaceHigh]}
                    style={pm.preview}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  >
                    {/* Bolinha da cor primária */}
                    <View style={[pm.dot, { backgroundColor: palette.primary }]} />
                  </LinearGradient>

                  <View style={pm.cardLabel}>
                    <Text style={[pm.cardName, { color: theme.text }]} numberOfLines={1}>{t.label}</Text>
                    <Text style={[pm.cardMode, { color: theme.textSecondary }]}>
                      {isDark ? "escuro" : "claro"}
                    </Text>
                  </View>

                  {isActive && (
                    <View style={[pm.checkBadge, { backgroundColor: palette.primary }]}>
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: "flex-end" },
  panel:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingTop: 8 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(128,128,128,0.4)", alignSelf: "center", marginBottom: 12 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 4 },
  title:      { fontSize: 17, fontWeight: "700" },
  sub:        { fontSize: 12, paddingHorizontal: 20, marginBottom: 16 },
  grid:       { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  card:       { width: "30%", borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: "transparent" },
  preview:    { height: 72, alignItems: "flex-end", justifyContent: "flex-end", padding: 8 },
  dot:        { width: 16, height: 16, borderRadius: 8 },
  cardLabel:  { padding: 8, paddingTop: 6 },
  cardName:   { fontSize: 12, fontWeight: "600" },
  cardMode:   { fontSize: 10, marginTop: 1 },
  checkBadge: { position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});

// ── Tela principal ─────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { isDark, toggle, theme, themeId } = useThemeStore();
  const insets = useSafeAreaInsets();

  const [termsVisible,   setTermsVisible]   = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(false);
  const [isPrivate,      setIsPrivate]      = useState(user?.isPrivate || false);
  const [showLikes,      setShowLikes]      = useState((user as any)?.showLikesCount ?? true);

  // Sincroniza barra de navegação Android com o tema
  useEffect(() => {
    if (Platform.OS !== "android" || !NavigationBar) return;
    NavigationBar.setBackgroundColorAsync(theme.background);
    NavigationBar.setButtonStyleAsync(isDark ? "light" : "dark");
  }, [isDark, theme.background]);

  const currentPaletteName = ALL_THEMES.find(t => t.id === themeId)?.label || "Midnight";

  const handleLogout = useCallback(() => {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { await logout(); } },
    ]);
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Excluir conta",
      "Esta ação é irreversível. Todos os seus dados, posts e seguidores serão removidos permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => Alert.alert("Em breve", "Funcionalidade disponível em breve.") },
      ]
    );
  }, []);

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation?.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Configurações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Perfil resumido */}
        <TouchableOpacity
          style={[s.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation?.navigate?.("EditProfile")}
          activeOpacity={0.7}
        >
          <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={52} ring="active" />
          <View style={s.profileInfo}>
            <Text style={[s.profileName, { color: theme.text }]}>{user?.displayName || user?.username}</Text>
            <Text style={[s.profileHandle, { color: theme.textSecondary }]}>@{user?.username} · Editar perfil</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>

        {/* Aparência */}
        <Section title="APARÊNCIA">
          <SettingRow
            icon={isDark ? "moon" : "sunny"}
            iconColor="#7C3AED"
            label="Tema escuro"
            sub={isDark ? "Ativado" : "Desativado"}
            right={
              <Switch
                value={isDark}
                onValueChange={toggle}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="color-palette-outline"
            iconColor={theme.primary}
            label="Paleta de cores"
            sub={currentPaletteName}
            onPress={() => setPaletteVisible(true)}
            last
          />
        </Section>

        {/* Privacidade */}
        <Section title="PRIVACIDADE">
          <SettingRow
            icon="lock-closed-outline"
            iconColor="#06B6D4"
            label="Perfil privado"
            sub="Apenas aprovados veem seus posts"
            right={
              <Switch
                value={isPrivate}
                onValueChange={async (v) => {
                  setIsPrivate(v);
                  try {
                    const { api } = await import("../../services/api");
                    await api.patch("/users/me", { isPrivate: v });
                  } catch { setIsPrivate(!v); }
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="heart-outline"
            iconColor="#F43F5E"
            label="Mostrar curtidas"
            sub="Exibir contagem nos seus posts"
            right={
              <Switch
                value={showLikes}
                onValueChange={async (v) => {
                  setShowLikes(v);
                  try {
                    const { api } = await import("../../services/api");
                    await api.patch("/users/me", { showLikesCount: v });
                  } catch { setShowLikes(!v); }
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingRow
            icon="ban-outline"
            iconColor="#F59E0B"
            label="Usuários bloqueados"
            sub="Gerenciar lista de bloqueados"
            onPress={() => Alert.alert("Em breve", "Gerenciamento de bloqueados disponível em breve.")}
            last
          />
        </Section>

        {/* Notificações */}
        <Section title="NOTIFICAÇÕES">
          <SettingRow
            icon="notifications-outline"
            iconColor="#10B981"
            label="Push notifications"
            sub="Curtidas, comentários e seguidores"
            onPress={() => Alert.alert("Em breve", "Configurações de notificação disponíveis em breve.")}
          />
          <SettingRow
            icon="mail-outline"
            iconColor="#7C3AED"
            label="Email"
            sub={user?.email}
            last
          />
        </Section>

        {/* Conta */}
        <Section title="CONTA">
          <SettingRow
            icon="key-outline"
            iconColor="#F59E0B"
            label="Alterar senha"
            onPress={() => Alert.alert("Em breve", "Troca de senha disponível em breve.")}
          />
          <SettingRow
            icon="share-social-outline"
            iconColor="#06B6D4"
            label="Compartilhar perfil"
            onPress={() => Alert.alert("Link copiado!", `rede.app/${user?.username}`)}
          />
          <SettingRow
            icon="download-outline"
            iconColor="#7C3AED"
            label="Exportar meus dados"
            sub="Conforme LGPD Art. 18"
            onPress={() => Alert.alert("Solicitação registrada", "Você receberá seus dados em até 15 dias úteis.")}
            last
          />
        </Section>

        {/* Legal */}
        <Section title="LEGAL">
          <SettingRow
            icon="document-text-outline"
            iconColor="#6B7280"
            label="Termos de Uso"
            onPress={() => setTermsVisible(true)}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            iconColor="#6B7280"
            label="Política de Privacidade (LGPD)"
            onPress={() => Linking.openURL("https://rede.app/privacidade")}
          />
          <SettingRow
            icon="information-circle-outline"
            iconColor="#6B7280"
            label="Versão"
            sub="1.0.0-beta"
            last
          />
        </Section>

        {/* Sessão */}
        <Section title="SESSÃO">
          <SettingRow
            icon="log-out-outline"
            iconColor="#EF4444"
            label="Sair da conta"
            danger
            onPress={handleLogout}
          />
          <SettingRow
            icon="trash-outline"
            iconColor="#EF4444"
            label="Excluir conta"
            sub="Ação irreversível"
            danger
            onPress={handleDeleteAccount}
            last
          />
        </Section>

      </ScrollView>

      <TermsModal
        visible={termsVisible}
        onAccept={() => setTermsVisible(false)}
        onDecline={() => setTermsVisible(false)}
      />

      <PaletteModal
        visible={paletteVisible}
        onClose={() => setPaletteVisible(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:       { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle:   { fontSize: 18, fontWeight: "800" },
  profileCard:   { flexDirection: "row", alignItems: "center", gap: 12, margin: 16, padding: 14, borderRadius: 16, borderWidth: 1 },
  profileInfo:   { flex: 1 },
  profileName:   { fontSize: 15, fontWeight: "700" },
  profileHandle: { fontSize: 12, marginTop: 2 },
  section:       { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle:  { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  sectionCard:   { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row:           { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowIcon:       { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowContent:    { flex: 1 },
  rowLabel:      { fontSize: 14, fontWeight: "500" },
  rowSub:        { fontSize: 11, marginTop: 1 },
});
