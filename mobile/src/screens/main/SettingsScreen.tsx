import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, StatusBar, Alert, Linking, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore } from "../../store/theme.store";
import Avatar from "../../components/ui/Avatar";
import TermsModal from "../../components/modals/TermsModal";

interface RowProps {
  icon: string;
  iconColor: string;
  label: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ icon, iconColor, label, sub, right, onPress, danger }: RowProps) {
  const { theme } = useThemeStore();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress && !right}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconColor + "22" }]}>
        <Ionicons name={icon as any} size={17} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, { color: danger ? theme.error : theme.text }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: theme.textSecondary }]}>{sub}</Text> : null}
      </View>
      {right || (onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null)}
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useThemeStore();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { isDark, toggle, theme } = useThemeStore();
  const [termsVisible, setTermsVisible] = useState(false);
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [showLikes, setShowLikes] = useState((user as any)?.showLikesCount ?? true);

  const handleLogout = useCallback(() => {
    Alert.alert(
      "Sair da conta",
      "Tem certeza que deseja sair?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
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
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity
          onPress={() => navigation?.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Configurações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Perfil resumido */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation?.navigate?.("EditProfile")}
          activeOpacity={0.7}
        >
          <Avatar uri={user?.avatarUrl} name={user?.displayName || user?.username} size={52} showRing />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.text }]}>
              {user?.displayName || user?.username}
            </Text>
            <Text style={[styles.profileHandle, { color: theme.textSecondary }]}>
              @{user?.username} · Editar perfil
            </Text>
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
                  } catch {
                    setIsPrivate(!v);
                  }
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
                  } catch {
                    setShowLikes(!v);
                  }
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
          />
        </Section>

        {/* Ações destrutivas */}
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
          />
        </Section>

      </ScrollView>

      <TermsModal
        visible={termsVisible}
        onAccept={() => setTermsVisible(false)}
        onDecline={() => setTermsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 12, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    margin: 16, padding: 14, borderRadius: 16, borderWidth: 1,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: "700" },
  profileHandle: { fontSize: 12, marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 11, fontWeight: "600", letterSpacing: 0.8, marginBottom: 8 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "500" },
  rowSub: { fontSize: 11, marginTop: 1 },
});
