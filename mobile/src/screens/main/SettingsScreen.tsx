import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, StatusBar, Alert, Linking, Modal,
  Animated, PanResponder, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth.store";
import { useThemeStore, SupportedLocale, LOCALE_LABELS } from "../../store/theme.store";
import { ALL_PALETTES } from "../../theme";
import { presenceService, PresenceStatus, PRESENCE_COLORS, PRESENCE_LABELS } from "../../services/presence.service";
import Avatar from "../../components/ui/Avatar";
import TermsModal from "../../components/modals/TermsModal";

const { height: SCREEN_H } = Dimensions.get("window");
const PANEL_H         = SCREEN_H * 0.80;
const SWIPE_THRESHOLD = 80;

// ── SettingRow ────────────────────────────────────────────────────────────────
interface RowProps {
  icon: string; iconColor: string; label: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean; last?: boolean;
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

// ── StatusModal — seletor manual de presença ───────────────────────────────────
const STATUS_OPTIONS: PresenceStatus[] = ["online", "away", "busy", "offline"];

const STATUS_ICONS: Record<PresenceStatus, string> = {
  online:  "radio-button-on",
  away:    "time-outline",
  busy:    "remove-circle-outline",
  offline: "ellipse-outline",
};

const STATUS_DESC: Record<PresenceStatus, string> = {
  online:  "Visível para todos",
  away:    "Aparece como ausente",
  busy:    "Não pertube",
  offline: "Pareça desconectado",
};

function StatusModal({
  visible,
  onClose,
  currentStatus,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  currentStatus: PresenceStatus;
  onSelect: (s: PresenceStatus) => void;
}) {
  const { theme, isDark } = useThemeStore();
  const insets     = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 400,
      useNativeDriver: true,
      damping: 22, stiffness: 220,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={sm.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[sm.panel, { transform: [{ translateY }], paddingBottom: insets.bottom + 20 }]}
      >
        <BlurView intensity={96} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />

        <View style={sm.handle} />

        <View style={sm.header}>
          <Text style={[sm.title, { color: theme.text }]}>Meu status</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={[sm.note, { color: theme.textSecondary }]}>
          Seu status é visível para todos que te seguem.
        </Text>

        <View style={[sm.optionsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {STATUS_OPTIONS.map((status, idx) => {
            const isActive = currentStatus === status;
            const isLast   = idx === STATUS_OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={status}
                style={[
                  sm.optionRow,
                  !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                  isActive && { backgroundColor: PRESENCE_COLORS[status] + "12" },
                ]}
                onPress={() => { onSelect(status); onClose(); }}
                activeOpacity={0.7}
              >
                {/* Dot colorido */}
                <View style={[sm.dot, { backgroundColor: PRESENCE_COLORS[status] }]} />

                <View style={{ flex: 1 }}>
                  <Text style={[sm.optionLabel, { color: theme.text }]}>
                    {PRESENCE_LABELS[status]}
                  </Text>
                  <Text style={[sm.optionDesc, { color: theme.textSecondary }]}>
                    {STATUS_DESC[status]}
                  </Text>
                </View>

                {isActive && (
                  <Ionicons name="checkmark-circle" size={20} color={PRESENCE_COLORS[status]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
}

const sm = StyleSheet.create({
  backdrop:     { ...StyleSheet.absoluteFillObject },
  panel:        { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingTop: 8 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(128,128,128,0.35)", alignSelf: "center", marginBottom: 16 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 8 },
  title:        { fontSize: 18, fontWeight: "800" },
  note:         { fontSize: 12, paddingHorizontal: 20, marginBottom: 16, lineHeight: 18 },
  optionsCard:  { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  optionRow:    { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  dot:          { width: 12, height: 12, borderRadius: 6 },
  optionLabel:  { fontSize: 15, fontWeight: "600" },
  optionDesc:   { fontSize: 12, marginTop: 1 },
});

// ── PaletteModal ───────────────────────────────────────────────────────────────
function PaletteModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme, isDark, paletteId, setPaletteId, resetToDefault } = useThemeStore();
  const insets     = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(PANEL_H)).current;
  const panY       = useRef(new Animated.Value(0)).current;
  const [filter, setFilter] = useState<"all" | "dark" | "light">("all");

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true,
        damping: 22, stiffness: 220, mass: 0.8,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: PANEL_H, duration: 280, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
    onPanResponderMove: (_, g) => { if (g.dy > 0) panY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SWIPE_THRESHOLD) {
        Animated.timing(translateY, { toValue: PANEL_H, duration: 260, useNativeDriver: true }).start(onClose);
      } else {
        Animated.spring(panY, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      }
    },
  });

  const combinedY     = Animated.add(translateY, panY);
  const darkPalettes  = ALL_PALETTES.filter(p => p.isDark);
  const lightPalettes = ALL_PALETTES.filter(p => !p.isDark);
  const filtered      = filter === "dark" ? darkPalettes : filter === "light" ? lightPalettes : ALL_PALETTES;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={pm.backdrop} activeOpacity={1} onPress={onClose} />

      <Animated.View
        style={[pm.panel, { transform: [{ translateY: combinedY }], paddingBottom: insets.bottom + 16 }]}
        {...panResponder.panHandlers}
      >
        <BlurView intensity={96} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
        <View style={pm.handle} />

        <View style={pm.header}>
          <View>
            <Text style={[pm.title, { color: theme.text }]}>Paleta de cores</Text>
            <Text style={[pm.sub, { color: theme.textSecondary }]}>
              {filtered.length} paletas · toque para aplicar
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={pm.filterRow}>
          {(["all", "dark", "light"] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[pm.filterBtn, filter === f && { backgroundColor: theme.primary }]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[pm.filterText, { color: filter === f ? "#fff" : theme.textSecondary }]}>
                {f === "all" ? "Todas (22)" : f === "dark" ? "🌙 Dark (11)" : "☀️ Light (11)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[pm.resetBtn, { borderColor: theme.border, backgroundColor: theme.surface + "80" }]}
          onPress={() => { resetToDefault(); }}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={13} color={theme.textSecondary} />
          <Text style={[pm.resetText, { color: theme.textSecondary }]}>Restaurar Padrão</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pm.grid} bounces={false}>
          {filtered.map(entry => {
            const p        = entry.theme;
            const isActive = paletteId === entry.paletteId;
            const isDefault = entry.paletteId === "midnight";

            return (
              <TouchableOpacity
                key={entry.paletteId}
                style={[pm.card, { borderColor: isActive ? p.primary : "transparent" }, isActive && { borderWidth: 2.5 }]}
                onPress={() => { setPaletteId(entry.paletteId); }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[p.background, p.surface, p.surfaceHigh]}
                  style={pm.preview}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <View style={[pm.primaryDot, { backgroundColor: p.primary }]} />
                  <View style={[pm.modeBadge, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
                    <Text style={pm.modeBadgeText}>{entry.isDark ? "🌙" : "☀️"}</Text>
                  </View>
                  {isDefault && (
                    <View style={[pm.defaultBadge, { backgroundColor: p.primary + "CC" }]}>
                      <Text style={pm.defaultText}>DEFAULT</Text>
                    </View>
                  )}
                </LinearGradient>

                <View style={[pm.cardLabel, { backgroundColor: p.surface }]}>
                  <Text style={[pm.cardName, { color: p.text }]} numberOfLines={1}>{entry.label}</Text>
                  <View style={[pm.accentDot, { backgroundColor: p.primary }]} />
                </View>

                {isActive && (
                  <View style={[pm.checkBadge, { backgroundColor: p.primary }]}>
                    <Ionicons name="checkmark" size={11} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject },
  panel:         { position: "absolute", bottom: 0, left: 0, right: 0, height: PANEL_H, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingTop: 8 },
  handle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(128,128,128,0.35)", alignSelf: "center", marginBottom: 14 },
  header:        { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 10 },
  title:         { fontSize: 18, fontWeight: "800" },
  sub:           { fontSize: 12, marginTop: 2 },
  filterRow:     { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterBtn:     { flex: 1, paddingVertical: 7, borderRadius: 20, alignItems: "center", backgroundColor: "rgba(128,128,128,0.12)" },
  filterText:    { fontSize: 11, fontWeight: "600" },
  resetBtn:      { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginLeft: 20, marginBottom: 14, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  resetText:     { fontSize: 12, fontWeight: "600" },
  grid:          { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 10, paddingBottom: 16 },
  card:          { width: "30%", borderRadius: 16, overflow: "hidden", borderWidth: 2.5, borderColor: "transparent" },
  preview:       { height: 64, padding: 7, justifyContent: "space-between" },
  primaryDot:    { width: 14, height: 14, borderRadius: 7, alignSelf: "flex-end" },
  modeBadge:     { position: "absolute", top: 6, left: 6, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  modeBadgeText: { fontSize: 9 },
  defaultBadge:  { position: "absolute", bottom: 6, left: 6, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  defaultText:   { fontSize: 7, fontWeight: "700", color: "#fff", letterSpacing: 0.5 },
  cardLabel:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 6 },
  cardName:      { fontSize: 10, fontWeight: "600", flex: 1 },
  accentDot:     { width: 8, height: 8, borderRadius: 4 },
  checkBadge:    { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});

// ── LanguageModal ─────────────────────────────────────────────────────────────
function LanguageModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme, isDark, locale, setLocale } = useThemeStore();
  const { logout }  = useAuthStore();
  const insets      = useSafeAreaInsets();
  const translateY  = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 400, useNativeDriver: true,
      damping: 22, stiffness: 220,
    }).start();
  }, [visible]);

  const selectLocale = (l: SupportedLocale) => {
    if (l === locale) { onClose(); return; }
    setLocale(l);
    Alert.alert(
      "Idioma alterado",
      "O novo idioma será aplicado no próximo login. Deseja sair agora?",
      [
        { text: "Depois", onPress: onClose },
        { text: "Sair agora", style: "destructive", onPress: async () => { onClose(); await logout(); } },
      ]
    );
  };

  if (!visible) return null;
  const locales = Object.entries(LOCALE_LABELS) as [SupportedLocale, string][];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <TouchableOpacity style={lm.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[lm.panel, { transform: [{ translateY }], paddingBottom: insets.bottom + 16 }]}>
        <BlurView intensity={96} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFillObject} />
        <View style={lm.handle} />
        <View style={lm.header}>
          <Text style={[lm.title, { color: theme.text }]}>Idioma</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={[lm.note, { color: theme.textSecondary }]}>
          A troca de idioma requer um novo login para ser aplicada.
        </Text>
        {locales.map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[lm.row, { borderBottomColor: theme.border }]}
            onPress={() => selectLocale(key)}
            activeOpacity={0.7}
          >
            <Text style={[lm.rowLabel, { color: theme.text }]}>{label}</Text>
            {locale === key && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

const lm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  panel:    { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingTop: 8 },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(128,128,128,0.35)", alignSelf: "center", marginBottom: 14 },
  header:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 8 },
  title:    { fontSize: 18, fontWeight: "800" },
  note:     { fontSize: 12, paddingHorizontal: 20, marginBottom: 12, lineHeight: 18 },
  row:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { fontSize: 15, fontWeight: "500" },
});

// ── Tela principal ────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const { isDark, toggle, theme, paletteId, locale } = useThemeStore();
  const insets = useSafeAreaInsets();

  const [termsVisible,    setTermsVisible]    = useState(false);
  const [paletteVisible,  setPaletteVisible]  = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [statusVisible,   setStatusVisible]   = useState(false);
  const [isPrivate,       setIsPrivate]       = useState(user?.isPrivate || false);
  const [showLikes,       setShowLikes]       = useState((user as any)?.showLikesCount ?? true);
  const [myStatus,        setMyStatus]        = useState<PresenceStatus>(
    presenceService.getStatus()
  );

  const currentPaletteName = ALL_PALETTES.find(p => p.paletteId === paletteId)?.label || "Midnight";
  const currentLocaleName  = LOCALE_LABELS[locale] || "Português (Brasil)";

  const handleStatusSelect = useCallback(async (status: PresenceStatus) => {
    setMyStatus(status);
    await presenceService.setStatus(status);
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { await logout(); } },
    ]);
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Excluir conta",
      "Esta ação é irreversível. Todos os seus dados serão removidos permanentemente.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: () => Alert.alert("Em breve", "Funcionalidade disponível em breve.") },
      ]
    );
  }, []);

  // Indicador visual do status atual (dot colorido inline)
  const StatusIndicator = () => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRESENCE_COLORS[myStatus] }} />
      <Text style={{ fontSize: 12, color: PRESENCE_COLORS[myStatus], fontWeight: "600" }}>
        {PRESENCE_LABELS[myStatus]}
      </Text>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />

      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation?.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>Configurações</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Perfil */}
        <TouchableOpacity
          style={[s.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation?.navigate?.("EditProfile")}
          activeOpacity={0.7}
        >
          <Avatar
            uri={user?.avatarUrl}
            name={user?.displayName || user?.username}
            size={52}
            ring="default"
            presenceStatus={myStatus}
          />
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
              <Switch value={isDark} onValueChange={toggle}
                trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
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

        {/* Presença */}
        <Section title="PRESENÇA">
          <SettingRow
            icon="radio-button-on-outline"
            iconColor={PRESENCE_COLORS[myStatus]}
            label="Meu status"
            sub={PRESENCE_LABELS[myStatus]}
            right={<StatusIndicator />}
            onPress={() => setStatusVisible(true)}
            last
          />
        </Section>

        {/* Idioma */}
        <Section title="IDIOMA">
          <SettingRow
            icon="language-outline"
            iconColor="#06B6D4"
            label="Idioma do app"
            sub={currentLocaleName}
            onPress={() => setLanguageVisible(true)}
            last
          />
        </Section>

        {/* Privacidade */}
        <Section title="PRIVACIDADE">
          <SettingRow
            icon="lock-closed-outline" iconColor="#06B6D4"
            label="Perfil privado" sub="Apenas aprovados veem seus posts"
            right={
              <Switch value={isPrivate} onValueChange={async (v) => {
                setIsPrivate(v);
                try { const { api } = await import("../../services/api"); await api.patch("/users/me", { isPrivate: v }); }
                catch { setIsPrivate(!v); }
              }} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            }
          />
          <SettingRow
            icon="heart-outline" iconColor="#F43F5E"
            label="Mostrar curtidas" sub="Exibir contagem nos seus posts"
            right={
              <Switch value={showLikes} onValueChange={async (v) => {
                setShowLikes(v);
                try { const { api } = await import("../../services/api"); await api.patch("/users/me", { showLikesCount: v }); }
                catch { setShowLikes(!v); }
              }} trackColor={{ false: theme.border, true: theme.primary }} thumbColor="#fff" />
            }
          />
          <SettingRow
            icon="ban-outline" iconColor="#F59E0B"
            label="Usuários bloqueados" sub="Gerenciar lista de bloqueados"
            onPress={() => Alert.alert("Em breve", "Disponível em breve.")} last
          />
        </Section>

        {/* Notificações */}
        <Section title="NOTIFICAÇÕES">
          <SettingRow
            icon="notifications-outline" iconColor="#10B981"
            label="Push notifications" sub="Curtidas, comentários e seguidores"
            onPress={() => Alert.alert("Em breve", "Disponível em breve.")}
          />
          <SettingRow icon="mail-outline" iconColor="#7C3AED" label="Email" sub={user?.email} last />
        </Section>

        {/* Conta */}
        <Section title="CONTA">
          <SettingRow icon="key-outline" iconColor="#F59E0B" label="Alterar senha" onPress={() => Alert.alert("Em breve", "Disponível em breve.")} />
          <SettingRow icon="share-social-outline" iconColor="#06B6D4" label="Compartilhar perfil" onPress={() => Alert.alert("Link copiado!", `rede.app/${user?.username}`)} />
          <SettingRow icon="download-outline" iconColor="#7C3AED" label="Exportar meus dados" sub="Conforme LGPD Art. 18" onPress={() => Alert.alert("Solicitado", "Você receberá seus dados em até 15 dias úteis.")} last />
        </Section>

        {/* Legal */}
        <Section title="LEGAL">
          <SettingRow icon="document-text-outline" iconColor="#6B7280" label="Termos de Uso" onPress={() => setTermsVisible(true)} />
          <SettingRow icon="shield-checkmark-outline" iconColor="#6B7280" label="Política de Privacidade" onPress={() => Linking.openURL("https://rede.app/privacidade")} />
          <SettingRow icon="information-circle-outline" iconColor="#6B7280" label="Versão" sub="1.0.0-beta" last />
        </Section>

        {/* Sessão */}
        <Section title="SESSÃO">
          <SettingRow icon="log-out-outline" iconColor="#EF4444" label="Sair da conta" danger onPress={handleLogout} />
          <SettingRow icon="trash-outline" iconColor="#EF4444" label="Excluir conta" sub="Ação irreversível" danger onPress={handleDeleteAccount} last />
        </Section>

      </ScrollView>

      <TermsModal visible={termsVisible} onAccept={() => setTermsVisible(false)} onDecline={() => setTermsVisible(false)} />
      <PaletteModal visible={paletteVisible} onClose={() => setPaletteVisible(false)} />
      <LanguageModal visible={languageVisible} onClose={() => setLanguageVisible(false)} />
      <StatusModal
        visible={statusVisible}
        onClose={() => setStatusVisible(false)}
        currentStatus={myStatus}
        onSelect={handleStatusSelect}
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
