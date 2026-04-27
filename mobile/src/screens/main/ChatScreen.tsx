/**
 * ChatScreen.tsx — Venus v14
 * Tema 100% dinâmico — todos os estilos são funções de C (ChatColors)
 * passado como prop para cada subcomponente. StyleSheet.create() estático
 * apenas para valores que não dependem do tema (layout, dimensões).
 */

import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Platform, StatusBar, Image, Alert,
  Animated as RNAnimated, Pressable, PanResponder,
  Dimensions, ScrollView, Keyboard, Modal,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { KeyboardAvoidingView as RNKeyboardAvoidingView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
  withSpring, withSequence, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/auth.store';
import { useThemeStore } from '../../store/theme.store';
import { api } from '../../services/api';
import { socketService } from '../../services/socket.service';
import { uploadImage } from '../../services/supabase.service';
import {
  PresenceStatus, PRESENCE_COLORS, PRESENCE_LABELS,
} from '../../services/presence.service';
import Avatar from '../../components/ui/Avatar';

// ─── Tema ─────────────────────────────────────────────────────────────────────
export interface ChatColors {
  bg: string; surface: string; surfaceHi: string;
  border: string; borderHi: string;
  text: string; textSec: string; textTer: string; primaryLt: string;
  cyan: string; danger: string; success: string;
  bubble1: string; bubble2: string; bubbleMe: string; bubbleMeLight: string; unread: string;
}

function buildColors(theme: any, isDark: boolean): ChatColors {
  return {
    bg:        theme.background,
    surface:   theme.surface,
    surfaceHi: theme.surfaceHigh,
    border:    theme.border,
    borderHi:  theme.border,
    text:      theme.text,
    textSec:   theme.textSecondary,
    textTer:   theme.textSecondary,
    primaryLt: theme.primaryLight ?? '#94A3B8',
    cyan:      '#22D3EE',
    danger:    '#F87171',
    success:   '#4ADE80',
    // Bolhas: meu balão usa primary da paleta, outro usa surface/surfaceHigh
    bubble1:   theme.surfaceHigh,
    bubble2:   theme.surface,
    bubbleMe:      theme.primary,
    bubbleMeLight: theme.primaryLight ?? theme.primary,
    unread:    'rgba(34,211,238,0.08)',
  };
}

const GRAD_CYAN  = ['#22D3EE', '#3B82F6', '#8B5CF6'] as const;
const GRAD_SLATE = ['#475569', '#94A3B8', '#64748B'] as const;
const { width: SW, height: SH } = Dimensions.get('window');

// ─── Tipos ────────────────────────────────────────────────────────────────────
type CheckState = 'sent' | 'delivered' | 'read';
interface MessageReaction { emoji: string; userId: string; }
interface ReactionGroup { emoji: string; count: number; userIds: string[]; }
interface Message {
  id: string; senderId: string; content: string;
  imageUrl?: string | null; reactions?: MessageReaction[] | null;
  createdAt: string; deliveredAt: string | null;
  isRead: boolean; isDeleted?: boolean;
}
interface ViewerData { uri: string; msgId: string; isMine: boolean; }
type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'fake' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam',          label: 'Spam' },
  { value: 'harassment',    label: 'Assédio' },
  { value: 'inappropriate', label: 'Conteúdo inapropriado' },
  { value: 'fake',          label: 'Perfil falso' },
  { value: 'other',         label: 'Outro motivo' },
];
const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function groupReactions(reactions: MessageReaction[] | null | undefined): ReactionGroup[] {
  if (!reactions?.length) return [];
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [] };
    g.count++; g.userIds.push(r.userId); map.set(r.emoji, g);
  }
  return Array.from(map.values());
}
function getCheckState(msg: Message): CheckState {
  if (msg.isRead) return 'read';
  if (msg.deliveredAt) return 'delivered';
  return 'sent';
}
function fmtTime(d: string) { return format(new Date(d), 'HH:mm'); }
function fmtDay(d: string) {
  const dt = new Date(d);
  if (isToday(dt)) return 'Hoje';
  if (isYesterday(dt)) return 'Ontem';
  return format(dt, "d 'de' MMMM", { locale: ptBR });
}
function newDay(msgs: Message[], i: number) {
  if (i === 0) return true;
  return new Date(msgs[i-1].createdAt).toDateString() !== new Date(msgs[i].createdAt).toDateString();
}

// ─── CheckIcon ────────────────────────────────────────────────────────────────
function CheckIcon({ state }: { state: CheckState; C?: ChatColors }) {
  // Cyan = lido, Slate = entregue/enviado — fixo, independente do tema
  const color = state === 'read' ? '#22D3EE' : '#94A3B8';
  return <Ionicons name={state !== 'sent' ? 'checkmark-done' : 'checkmark'} size={12} color={color} />;
}

// ═════════════════════════════════════════════════════════════════════════════
//  IMAGE VIEWER
// ═════════════════════════════════════════════════════════════════════════════
function ImageViewer({ data, onClose, onDelete, C }: {
  data: ViewerData | null; onClose: () => void;
  onDelete: (msgId: string) => void; C: ChatColors;
}) {
  const insets    = useSafeAreaInsets();
  const bgOp      = useRef(new RNAnimated.Value(0)).current;
  const swipeAnim = useRef(new RNAnimated.Value(0)).current;
  const [uiVisible, setUiVisible] = useState(true);
  const visible = data !== null;

  useEffect(() => {
    if (visible) {
      setUiVisible(true); swipeAnim.setValue(0);
      RNAnimated.timing(bgOp, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      RNAnimated.timing(bgOp, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 15 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { swipeAnim.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dy) > 120 || Math.abs(g.vy) > 0.8) {
        RNAnimated.timing(swipeAnim, { toValue: g.dy > 0 ? SH : -SH, duration: 220, useNativeDriver: true }).start(onClose);
      } else {
        RNAnimated.spring(swipeAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200 }).start();
      }
    },
  })).current;

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <RNAnimated.View style={[iv.container, { opacity: bgOp }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
        <RNAnimated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: swipeAnim }] }]} {...panResponder.panHandlers}>
          <ScrollView style={StyleSheet.absoluteFill} contentContainerStyle={iv.scrollContent}
            maximumZoomScale={4} minimumZoomScale={1} centerContent bounces={false}
            showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
            <TouchableOpacity activeOpacity={1} onPress={() => setUiVisible(v => !v)} style={iv.imgTouch}>
              <Image source={{ uri: data.uri }} style={iv.image} resizeMode="contain" />
            </TouchableOpacity>
          </ScrollView>
        </RNAnimated.View>
        {uiVisible && (
          <View style={[iv.uiOverlay, { paddingTop: insets.top + 12 }]} pointerEvents="box-none">
            <TouchableOpacity style={iv.uiBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            {data.isMine && (
              <TouchableOpacity style={[iv.uiBtn]} onPress={() => { onDelete(data.msgId); onClose(); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="trash-outline" size={20} color={C.danger} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </RNAnimated.View>
    </Modal>
  );
}
const iv = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#000' },
  scrollContent:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  imgTouch:     { width: SW, height: SH, alignItems: 'center', justifyContent: 'center' },
  image:        { width: SW, height: SH },
  uiOverlay:    { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  uiBtn:        { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

// ═════════════════════════════════════════════════════════════════════════════
//  TOAST
// ═════════════════════════════════════════════════════════════════════════════
function Toast({ message, type = 'info', C }: { message: string; type?: 'info'|'success'|'error'; C: ChatColors }) {
  const color = type === 'success' ? C.success : type === 'error' ? C.danger : C.primaryLt;
  const icon  = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'close-circle' : 'information-circle';
  return (
    <View style={[ts.wrap, { borderColor: C.borderHi }]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[ts.inner, { backgroundColor: C.bg + 'BB' }]}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={[ts.txt, { color }]}>{message}</Text>
      </View>
    </View>
  );
}
const ts = StyleSheet.create({
  wrap:  { borderRadius: 24, overflow: 'hidden', borderWidth: 1, maxWidth: SW * 0.8 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  txt:   { fontSize: 13, fontWeight: '600' },
});

// ═════════════════════════════════════════════════════════════════════════════
//  GLOW BTN
// ═════════════════════════════════════════════════════════════════════════════
function GlowBtn({ onPress, children, size = 36, radius = 12, disabled = false, C }: {
  onPress: () => void; children: React.ReactNode;
  size?: number; radius?: number; disabled?: boolean; C: ChatColors;
}) {
  const glow  = useSharedValue(0);
  const scale = useSharedValue(1);

  const press = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.value = withSequence(
      withTiming(0.92, { duration: 60, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 14, stiffness: 500, mass: 0.4 }),
    );
    glow.value = withSequence(
      withTiming(1,   { duration: 100 }),
      withTiming(0.8, { duration: 250 }),
      withTiming(0,   { duration: 450 }),
    );
    onPress();
  };

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.85, shadowRadius: glow.value * 12, elevation: glow.value * 10,
  }));
  const borderOp = useAnimatedStyle(() => ({ opacity: 0.25 + glow.value * 0.75 }));
  const BORDER = 1.5;

  return (
    <Animated.View style={[{ width: size, height: size }, wrapStyle]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }, borderOp]}>
        <LinearGradient colors={GRAD_SLATE} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <TouchableOpacity onPress={press} disabled={disabled} activeOpacity={0.85}
        style={{ position: 'absolute', top: BORDER, left: BORDER, right: BORDER, bottom: BORDER,
          borderRadius: radius - BORDER, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  SEND BUTTON
// ═════════════════════════════════════════════════════════════════════════════
function SendButton({ active, onPress, C }: { active: boolean; onPress: () => void; C: ChatColors }) {
  const progress   = useSharedValue(active ? 1 : 0);
  const pressScale = useSharedValue(1);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [active]);

  const wrapStyle  = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
    shadowColor: active ? '#22D3EE' : '#94A3B8', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25 + progress.value * 0.55, shadowRadius: 4 + progress.value * 10,
    elevation: 2 + progress.value * 8,
  }), [active]);
  const slateOp = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const cyanOp  = useAnimatedStyle(() => ({ opacity: progress.value }));
  const iconOp  = useAnimatedStyle(() => ({ opacity: 0.55 + progress.value * 0.45 }));
  const SIZE = 38; const BORDER = 1.5;

  return (
    <Animated.View style={[{ width: SIZE, height: SIZE }, wrapStyle]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: SIZE/2, overflow: 'hidden' }, slateOp]}>
        <LinearGradient colors={GRAD_SLATE} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFillObject, { borderRadius: SIZE/2, overflow: 'hidden' }, cyanOp]}>
        <LinearGradient colors={GRAD_CYAN} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <TouchableOpacity onPress={() => {
        if (!active) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        pressScale.value = withTiming(0.88, { duration: 80 }, () => { pressScale.value = withTiming(1, { duration: 140 }); });
        onPress();
      }} disabled={!active} activeOpacity={0.85}
        style={{ position: 'absolute', top: BORDER, left: BORDER, right: BORDER, bottom: BORDER,
          borderRadius: (SIZE - BORDER*2)/2, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={iconOp}>
          <Ionicons name="arrow-up" size={18} color={C.text} />
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  OPTIONS MENU
// ═════════════════════════════════════════════════════════════════════════════
function OptionsMenu({ visible, anchorY, isBlocked, onReport, onBlock, onClear, onClose, C }: {
  visible: boolean; anchorY: number; isBlocked: boolean;
  onReport: () => void; onBlock: () => void; onClear: () => void; onClose: () => void; C: ChatColors;
}) {
  const scale = useRef(new RNAnimated.Value(0)).current;
  const op    = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.parallel([
        RNAnimated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 280 }),
        RNAnimated.timing(op,    { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(scale, { toValue: 0, duration: 160, useNativeDriver: true }),
        RNAnimated.timing(op,    { toValue: 0, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;
  const items = [
    { icon: 'flag-outline'   as const, label: 'Denunciar',      color: C.text,   action: onReport },
    { icon: (isBlocked ? 'lock-open-outline' : 'ban-outline') as any,
      label: isBlocked ? 'Desbloquear' : 'Bloquear',           color: C.danger, action: onBlock },
    { icon: 'trash-outline'  as const, label: 'Limpar Conversa', color: C.danger, action: onClear },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <RNAnimated.View style={[{ position: 'absolute', width: 210, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.borderHi, top: anchorY + 8, right: 14, opacity: op, transform: [{ scale }] }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={{ backgroundColor: C.bg + 'D0' }}>
          {items.map((item, i) => (
            <View key={item.label}>
              {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 14 }} />}
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 }}
                activeOpacity={0.7} onPress={() => { onClose(); setTimeout(item.action, 180); }}>
                <Ionicons name={item.icon} size={18} color={item.color} />
                <Text style={{ fontSize: 15, fontWeight: '500', color: item.color }}>{item.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </RNAnimated.View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  REPORT MODAL
// ═════════════════════════════════════════════════════════════════════════════
function ReportModal({ visible, targetName, onSubmit, onClose, C }: {
  visible: boolean; targetName: string;
  onSubmit: (reason: ReportReason, description: string) => void;
  onClose: () => void; C: ChatColors;
}) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const ty = useRef(new RNAnimated.Value(SH)).current;
  const op = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedReason(null); setDescription('');
      RNAnimated.parallel([
        RNAnimated.spring(ty, { toValue: 0,  useNativeDriver: true, damping: 18, stiffness: 220 }),
        RNAnimated.timing(op, { toValue: 1,  duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(ty, { toValue: SH, duration: 220, useNativeDriver: true }),
        RNAnimated.timing(op, { toValue: 0,  duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (_, g) => g.dy > 4,
    onMoveShouldSetPanResponder:  (_, g) => g.dy > 4,
    onPanResponderMove:    (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) onClose();
      else RNAnimated.spring(ty, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    },
  })).current;

  if (!visible && (ty as any)._value >= SH) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      <RNAnimated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.65)', opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>
      <RNKeyboardAvoidingView style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' } as any}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
        <RNAnimated.View style={[{ backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: C.borderHi, paddingTop: 8, maxHeight: SH * 0.85, paddingBottom: insets.bottom + 16 }, { transform: [{ translateY: ty }] }]}>
          <View {...pan.panHandlers} style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, paddingHorizontal: 24, marginBottom: 4 }}>Denunciar usuário</Text>
          <Text style={{ fontSize: 13, color: C.textSec, paddingHorizontal: 24, marginBottom: 16 }}>Qual o problema com {targetName}?</Text>
          <ScrollView style={{ paddingHorizontal: 24, maxHeight: SH * 0.45 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {REPORT_REASONS.map(r => {
              const active = selectedReason === r.value;
              return (
                <TouchableOpacity key={r.value} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}
                  onPress={() => setSelectedReason(r.value)} activeOpacity={0.7}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: active ? C.cyan : C.textTer, alignItems: 'center', justifyContent: 'center' }}>
                    {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.cyan }} />}
                  </View>
                  <Text style={{ fontSize: 15, color: active ? C.text : C.textSec, flex: 1 }}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ marginTop: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 }}>
              <TextInput style={{ fontSize: 14, color: C.text, minHeight: 72, maxHeight: 120 }}
                placeholder="Detalhes adicionais (opcional)..." placeholderTextColor={C.textTer}
                value={description} onChangeText={setDescription} multiline maxLength={500} underlineColorAndroid="transparent" />
            </View>
          </ScrollView>
          <TouchableOpacity style={{ marginHorizontal: 24, backgroundColor: C.danger, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center', opacity: !selectedReason ? 0.4 : 1 }}
            onPress={async () => {
              if (!selectedReason) return;
              setSubmitting(true);
              await onSubmit(selectedReason, description.trim());
              setSubmitting(false);
            }} disabled={!selectedReason || submitting} activeOpacity={0.85}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{submitting ? 'Enviando...' : 'Enviar denúncia'}</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      </RNKeyboardAvoidingView>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  REACTIONS SHEET
// ═════════════════════════════════════════════════════════════════════════════
function ReactionsSheet({ visible, msg, isMine, onPick, onDelete, onCopy, onClose, C }: {
  visible: boolean; msg: Message | null; isMine: boolean;
  onPick: (e: string) => void; onDelete: () => void;
  onCopy: () => void; onClose: () => void; C: ChatColors;
}) {
  const insets = useSafeAreaInsets();
  const ty = useRef(new RNAnimated.Value(SH)).current;
  const op = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      RNAnimated.parallel([
        RNAnimated.spring(ty, { toValue: 0,  useNativeDriver: true, damping: 18, stiffness: 220 }),
        RNAnimated.timing(op, { toValue: 1,  duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(ty, { toValue: SH, duration: 220, useNativeDriver: true }),
        RNAnimated.timing(op, { toValue: 0,  duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderMove:    (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.6) onClose();
      else RNAnimated.spring(ty, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    },
  })).current;

  const myEmoji = msg?.reactions?.find(r => r.userId)?.emoji;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      <RNAnimated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>
      <RNAnimated.View style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: C.borderHi, paddingTop: 8, paddingBottom: insets.bottom + 12 }, { transform: [{ translateY: ty }] }]}>
        <View {...pan.panHandlers} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8 }}>
          {REACTIONS.map(e => (
            <TouchableOpacity key={e} style={[{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, myEmoji === e && { backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.borderHi }]}
              onPress={() => onPick(e)} activeOpacity={0.7}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 }} />
        {!!msg?.content && !msg?.imageUrl && (
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16 }} onPress={onCopy} activeOpacity={0.7}>
            <Ionicons name="copy-outline" size={20} color={C.text} />
            <Text style={{ fontSize: 15, fontWeight: '500', color: C.text }}>Copiar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16 }} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color={C.danger} />
          <Text style={{ fontSize: 15, fontWeight: '500', color: C.danger }}>{isMine ? 'Apagar para todos' : 'Apagar para mim'}</Text>
        </TouchableOpacity>
      </RNAnimated.View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  TYPING BUBBLE
// ═════════════════════════════════════════════════════════════════════════════
function TypingBubble({ C }: { C: ChatColors }) {
  const dots = [0,1,2].map(() => useRef(new RNAnimated.Value(0.3)).current);
  useEffect(() => {
    const anims = dots.map((v, i) => RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(v, { toValue: 1,   duration: 400, delay: i * 150, useNativeDriver: true }),
      RNAnimated.timing(v, { toValue: 0.3, duration: 400, useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 2, paddingHorizontal: 14, paddingVertical: 2 }}>
      <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.border, borderRadius: 20, borderBottomLeftRadius: 6 }}>
        {dots.map((v, i) => (
          <RNAnimated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primaryLt, opacity: v }} />
        ))}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  BUBBLE
// ═════════════════════════════════════════════════════════════════════════════
function Bubble({ msg, isMe, onLong, onDouble, highlighted, onImagePress, onReact, user, C }: {
  msg: Message; isMe: boolean; highlighted: boolean;
  onLong: (m: Message) => void; onDouble: (m: Message) => void;
  onImagePress: (d: ViewerData) => void; onReact: (m: Message, emoji: string) => void;
  user: any; C: ChatColors;
}) {
  const lastTap   = useRef(0);
  const scale     = useRef(new RNAnimated.Value(1)).current;
  const bgOpacity = useRef(new RNAnimated.Value(0)).current;
  const check     = getCheckState(msg);

  useEffect(() => {
    if (highlighted) {
      bgOpacity.setValue(1);
      const t = setTimeout(() => {
        RNAnimated.timing(bgOpacity, { toValue: 0, duration: 1200, useNativeDriver: false }).start();
      }, 5000);
      return () => clearTimeout(t);
    } else {
      bgOpacity.setValue(0);
    }
  }, [highlighted]);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onDouble(msg);
      RNAnimated.sequence([
        RNAnimated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 50 }),
        RNAnimated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
      ]).start();
    }
    lastTap.current = now;
  };

  const bgColor = bgOpacity.interpolate({ inputRange: [0, 1], outputRange: ['rgba(34,211,238,0)', C.unread] });
  const reactions = groupReactions(msg.reactions);

  if (msg.isDeleted) return (
    <RNAnimated.View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2, paddingHorizontal: 14, paddingVertical: 2, justifyContent: isMe ? 'flex-end' : 'flex-start', backgroundColor: bgColor }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' }}>
        <Text style={{ fontSize: 13, fontStyle: 'italic', color: C.textTer }}>Mensagem apagada</Text>
      </View>
    </RNAnimated.View>
  );

  const ReactionBadges = () => reactions.length > 0 ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
      {reactions.map(g => (
        <TouchableOpacity key={g.emoji}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: g.userIds.includes(user?.id ?? '') ? C.surfaceHi + 'AA' : C.surface, borderWidth: 1, borderColor: g.userIds.includes(user?.id ?? '') ? C.primaryLt : C.border, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 4 }}
          onPress={() => onReact(msg, g.emoji)} activeOpacity={0.7}>
          <Text style={{ fontSize: 13 }}>{g.emoji}</Text>
          {g.count > 1 && <Text style={{ fontSize: 11, fontWeight: '600', color: C.textSec }}>{g.count}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  // Bolha de imagem
  if (msg.imageUrl) {
    const viewerData: ViewerData = { uri: msg.imageUrl, msgId: msg.id, isMine: isMe };
    const hasCaption = !!msg.content;
    return (
      <RNAnimated.View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2, paddingHorizontal: 14, paddingVertical: 2, justifyContent: isMe ? 'flex-end' : 'flex-start', backgroundColor: bgColor }}>
        <View style={{ maxWidth: '78%', gap: 3 }}>
          <TouchableOpacity activeOpacity={0.95} delayLongPress={360}
            onPress={() => {
              const now = Date.now();
              const diff = now - lastTap.current;
              lastTap.current = now;
              if (diff < 300) { onDouble(msg); }
              else { setTimeout(() => onImagePress(viewerData), 180); }
            }}
            onLongPress={() => onLong(msg)}
            style={{ borderRadius: 18, maxWidth: SW * 0.72, backgroundColor: isMe ? C.bubbleMe : C.surfaceHi, borderWidth: isMe ? 0 : StyleSheet.hairlineWidth, borderColor: C.border, ...(isMe ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }) }}>
            <View style={{ margin: 3, borderRadius: 14, overflow: 'hidden' }}>
              <Image source={{ uri: msg.imageUrl }} style={{ width: SW * 0.72 - 6, height: (SW * 0.72 - 6) * 1.05 }} resizeMode="cover" />
            </View>
            {hasCaption ? (
              <View style={{ paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8 }}>
                <Text style={{ fontSize: 14, color: C.text, lineHeight: 19, marginBottom: 5 }}>{msg.content}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                  <Text style={{ fontSize: 10, color: C.textTer }}>{fmtTime(msg.createdAt)}</Text>
                  {isMe && <CheckIcon state={check} />}
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8, paddingVertical: 5, gap: 3 }}>
                <Text style={{ fontSize: 10, color: C.textTer }}>{fmtTime(msg.createdAt)}</Text>
                {isMe && <CheckIcon state={check} />}
              </View>
            )}
          </TouchableOpacity>
          <ReactionBadges />
        </View>
      </RNAnimated.View>
    );
  }

  // Bolha de texto
  return (
    <RNAnimated.View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2, paddingHorizontal: 14, paddingVertical: 2, justifyContent: isMe ? 'flex-end' : 'flex-start', backgroundColor: bgColor }}>
      <View style={{ maxWidth: '78%', gap: 3 }}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity onPress={handleTap} onLongPress={() => onLong(msg)} activeOpacity={0.85} delayLongPress={360}>
            {isMe
              ? <LinearGradient colors={[C.bubbleMe, C.bubbleMeLight]} start={{x:0,y:0}} end={{x:1,y:1}}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomRightRadius: 6 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 21 }}>{msg.content}</Text>
                </LinearGradient>
              : <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.border }}>
                  <Text style={{ color: C.text, fontSize: 15, lineHeight: 21 }}>{msg.content}</Text>
                </View>
            }
          </TouchableOpacity>
        </RNAnimated.View>
        <ReactionBadges />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
          <Text style={{ fontSize: 10, color: C.textTer }}>{fmtTime(msg.createdAt)}</Text>
          {isMe && <CheckIcon state={check} />}
        </View>
      </View>
    </RNAnimated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  CHAT SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function ChatScreen({ route, navigation }: any) {
  const { conversation, other } = route.params;
  const { user }          = useAuthStore();
  const { theme, isDark } = useThemeStore();
  const insets            = useSafeAreaInsets();

  // C dinâmico — reconstrói quando o tema muda
  const C = useMemo(() => buildColors(theme, isDark), [theme, isDark]);

  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [selectedImage,  setSelectedImage]  = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [otherTyping,    setOtherTyping]    = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [otherPresence,  setOtherPresence]  = useState<PresenceStatus | null>(null);
  const [selectedMsg,    setSelectedMsg]    = useState<Message | null>(null);
  const [sheetOpen,      setSheetOpen]      = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [menuAnchorY,    setMenuAnchorY]    = useState(0);
  const [reportOpen,     setReportOpen]     = useState(false);
  const [isBlocked,      setIsBlocked]      = useState(false);
  const [blockedIds,     setBlockedIds]     = useState<Set<string>>(new Set());
  const blockedIdsRef = useRef<Set<string>>(new Set());
  const [toastMsg,       setToastMsg]       = useState<{ text: string; type: 'info'|'success'|'error' } | null>(null);
  const [firstUnreadIdx, setFirstUnreadIdx] = useState<number>(-1);
  const [viewerData,     setViewerData]     = useState<ViewerData | null>(null);
  const [isLoadingMore,  setIsLoadingMore]  = useState(false);

  const flatRef       = useRef<FlatList>(null);
  const typingTimer   = useRef<any>(null);
  const isTypingRef   = useRef(false);
  const menuBtnRef    = useRef<View>(null);
  const toastTimer    = useRef<any>(null);
  const didInitialScroll = useRef(false);
  const currentPage   = useRef(1);
  const hasMorePages  = useRef(true);
  const loadingMore   = useRef(false);

  const hasContent = input.trim().length > 0 || selectedImage !== null;

  const DRAFT_KEY             = `@venus:draft:${conversation.id}`;
  const BLOCKED_MSGS_KEY      = `@venus:blocked_msgs:${conversation.id}`;
  const BLOCKED_REACTIONS_KEY = `@venus:blocked_reactions:${conversation.id}`;
  const LAST_SEEN_KEY         = `@venus:last_seen:${conversation.id}`;

  useEffect(() => { blockedIdsRef.current = blockedIds; }, [blockedIds]);

  const showToast = useCallback((text: string, type: 'info'|'success'|'error' = 'info', ms = 2800) => {
    clearTimeout(toastTimer.current);
    setToastMsg({ text, type });
    toastTimer.current = setTimeout(() => setToastMsg(null), ms);
  }, []);

  // ── Back intercept ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (sheetOpen)  { e.preventDefault(); setSheetOpen(false);  setTimeout(() => setSelectedMsg(null), 300); return; }
      if (reportOpen) { e.preventDefault(); setReportOpen(false); return; }
      if (menuOpen)   { e.preventDefault(); setMenuOpen(false);   return; }
    });
    return unsub;
  }, [navigation, sheetOpen, reportOpen, menuOpen]);

  // ── Draft ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setInput(''); setSelectedImage(null);
    AsyncStorage.getItem(DRAFT_KEY).then(s => { setInput(s ?? ''); }).catch(() => {});
  }, [conversation.id]);

  const saveDraftTimer = useRef<any>(null);
  const saveDraft = useCallback((text: string) => {
    clearTimeout(saveDraftTimer.current);
    saveDraftTimer.current = setTimeout(() => {
      if (text.trim()) AsyncStorage.setItem(DRAFT_KEY, text).catch(() => {});
      else AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    }, 500);
  }, [DRAFT_KEY]);

  // ── Bloqueio ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!other?.id) return;
    api.get('/blocks').then(({ data }) => {
      if (!Array.isArray(data)) return;
      setIsBlocked(data.some((bl: any) => bl.blockedId === other.id));
      setBlockedIds(new Set(data.map((bl: any) => bl.blockedId)));
    }).catch(() => {});
  }, [other?.id]);

  // ── Carregar mensagens ─────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    currentPage.current  = 1;
    hasMorePages.current = true;
    loadingMore.current  = false;
    try {
      const { data } = await api.get(`/messages/conversations/${conversation.id}`);
      const msgs: Message[] = (data.messages || data || []).map((m: any) => ({
        ...m, isRead: m.isRead ?? false, deliveredAt: m.deliveredAt ?? null,
        imageUrl: m.imageUrl ?? null,
        reactions: Array.isArray(m.reactions) ? m.reactions : (m.reaction ? [{ emoji: m.reaction, userId: m.senderId }] : null),
      }));

      // Mesclar msgs bloqueadas do AsyncStorage
      try {
        const raw = await AsyncStorage.getItem(BLOCKED_MSGS_KEY);
        const blockedMsgs: Message[] = raw ? JSON.parse(raw) : [];
        if (blockedMsgs.length > 0) {
          const bankIds = new Set(msgs.map(m => m.id));
          const stillBlocked = blockedMsgs.filter(m => !bankIds.has(m.id));
          const merged = [...msgs, ...stillBlocked].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setMessages(merged);
          if (stillBlocked.length !== blockedMsgs.length)
            await AsyncStorage.setItem(BLOCKED_MSGS_KEY, JSON.stringify(stillBlocked));
        } else { setMessages(msgs); }
      } catch { setMessages(msgs); }

      // Reações bloqueadas
      try {
        const rawR = await AsyncStorage.getItem(BLOCKED_REACTIONS_KEY);
        if (rawR) {
          const blockedReactions: Record<string, MessageReaction[]> = JSON.parse(rawR);
          setMessages(prev => prev.map(m => {
            const saved = blockedReactions[m.id];
            return saved ? { ...m, reactions: saved } : m;
          }));
        }
      } catch {}

      // Calcular firstUnread
      const lastSeenId = await AsyncStorage.getItem(LAST_SEEN_KEY).catch(() => null);
      let firstUnread = -1;
      if (lastSeenId) {
        const lastSeenIdx = msgs.findIndex(m => m.id === lastSeenId);
        if (lastSeenIdx >= 0 && lastSeenIdx < msgs.length - 1) {
          const after = msgs.slice(lastSeenIdx + 1);
          const rel   = after.findIndex(m => m.senderId !== user?.id);
          if (rel >= 0) firstUnread = lastSeenIdx + 1 + rel;
        }
      } else {
        firstUnread = msgs.findIndex(m => !m.isRead && m.senderId !== user?.id);
      }
      setFirstUnreadIdx(firstUnread);

      if (msgs.length > 0)
        AsyncStorage.setItem(LAST_SEEN_KEY, msgs[msgs.length - 1].id).catch(() => {});

      didInitialScroll.current = false;
    } catch {}
    finally { setLoading(false); }
  }, [conversation.id, user?.id, LAST_SEEN_KEY, BLOCKED_MSGS_KEY, BLOCKED_REACTIONS_KEY]);


  // ── Paginação ──────────────────────────────────────────────────────────
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore.current || !hasMorePages.current) return;
    loadingMore.current = true; setIsLoadingMore(true);
    const nextPage = currentPage.current + 1;
    try {
      const { data } = await api.get(`/messages/conversations/${conversation.id}?page=${nextPage}`);
      const older: Message[] = (data.messages || data || []).map((m: any) => ({
        ...m, isRead: m.isRead ?? false, deliveredAt: m.deliveredAt ?? null,
        imageUrl: m.imageUrl ?? null,
        reactions: Array.isArray(m.reactions) ? m.reactions : (m.reaction ? [{ emoji: m.reaction, userId: m.senderId }] : null),
      }));
      if (older.length === 0) { hasMorePages.current = false; }
      else {
        currentPage.current = nextPage;
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          return [...older.filter(m => !existingIds.has(m.id)), ...prev];
        });
      }
    } catch {}
    finally { loadingMore.current = false; setIsLoadingMore(false); }
  }, [conversation.id]);

  // ── Presença ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!other?.id) return;
    api.get(`/users/${other.username || other.id}/presence`)
      .then(({ data }) => { if (data?.status) setOtherPresence(data.status as PresenceStatus); })
      .catch(() => {});
  }, [other?.id, other?.username]);

  // ── Socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMessages();
    const socket = socketService.connect();
    if (!socket) return;
    socket.emit('join_conversation', { conversationId: conversation.id });

    const unsubMsg = socketService.onNewMessage((msg: any) => {
      if (blockedIdsRef.current.has(msg.senderId)) return;
      setMessages(prev => [...prev, { ...msg, isRead: false, deliveredAt: msg.deliveredAt ?? null, imageUrl: msg.imageUrl ?? null, reactions: Array.isArray(msg.reactions) ? msg.reactions : null }]);
      AsyncStorage.setItem(LAST_SEEN_KEY, msg.id).catch(() => {});
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    });

    socket.on('user_typing', ({ isTyping: t }: any) => setOtherTyping(t));
    socket.on('message_delivered', ({ messageId }: any) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deliveredAt: new Date().toISOString() } : m));
    });
    socket.on('messages_read', ({ conversationId: cId }: any) => {
      if (cId !== conversation.id) return;
      setMessages(prev => prev.map(m => m.senderId === user?.id ? { ...m, isRead: true, deliveredAt: m.deliveredAt ?? new Date().toISOString() } : m));
    });
    socket.on('message_reaction', ({ messageId, emoji, senderId: reactSenderId }: any) => {
      if (reactSenderId && blockedIdsRef.current.has(reactSenderId)) return;
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        let next = (m.reactions ?? []).filter(r => r.userId !== reactSenderId);
        if (emoji && reactSenderId) next = [...next, { emoji, userId: reactSenderId }];
        return { ...m, reactions: next.length > 0 ? next : null };
      }));
    });
    socket.on('message_deleted', ({ messageId }: any) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isDeleted: true, content: '', imageUrl: null } : m));
    });
    socket.on('message_blocked', async () => {
      setMessages(prev => {
        const temps = prev.filter(m => m.id.startsWith('temp-'));
        if (temps.length > 0) {
          AsyncStorage.getItem(BLOCKED_MSGS_KEY).then(raw => {
            const existing: Message[] = raw ? JSON.parse(raw) : [];
            const existingIds = new Set(existing.map(m => m.id));
            const toAdd = temps.filter(m => !existingIds.has(m.id));
            if (toAdd.length > 0) AsyncStorage.setItem(BLOCKED_MSGS_KEY, JSON.stringify([...existing, ...toAdd])).catch(() => {});
          }).catch(() => {});
        }
        return prev;
      });
    });
    const onPresence = ({ userId, status }: any) => { if (userId === other?.id) setOtherPresence(status); };
    socket.on('presence:update', onPresence);

    return () => {
      socket.emit('leave_conversation', { conversationId: conversation.id });
      unsubMsg();
      socket.off('user_typing'); socket.off('message_delivered'); socket.off('messages_read');
      socket.off('message_reaction'); socket.off('message_deleted'); socket.off('message_blocked');
      socket.off('presence:update', onPresence);
    };
  }, [conversation.id, loadMessages, other?.id, user?.id, LAST_SEEN_KEY, blockedIds]);

  // ── Enviar ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if ((!content && !selectedImage) || isBlocked) return;
    setInput(''); AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    const imageToSend = selectedImage; setSelectedImage(null);
    const tempId = `temp-${Date.now()}`;
    const temp: Message = { id: tempId, senderId: user?.id || '', content, imageUrl: imageToSend, createdAt: new Date().toISOString(), isRead: false, deliveredAt: null };
    setMessages(prev => [...prev, temp]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);

    let finalImageUrl: string | null = null;
    if (imageToSend) {
      setUploadingImage(true);
      try {
        finalImageUrl = await uploadImage(imageToSend, 'messages');
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, imageUrl: finalImageUrl } : m));
      } catch {
        showToast('Erro ao enviar imagem', 'error');
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setUploadingImage(false); return;
      }
      setUploadingImage(false);
    }

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('send_message', { conversationId: conversation.id, content, imageUrl: finalImageUrl });
    } else {
      try {
        const { data } = await api.post(`/messages/conversations/${conversation.id}`, { content, imageUrl: finalImageUrl });
        setMessages(prev => prev.map(m => m.id === tempId ? { ...data, isRead: false, deliveredAt: data.deliveredAt ?? null, imageUrl: data.imageUrl ?? finalImageUrl } : m));
      } catch (e: any) {
        if (e?.response?.status === 403) {
          setMessages(prev => {
            const temps = prev.filter(m => m.id.startsWith('temp-'));
            if (temps.length > 0) {
              AsyncStorage.getItem(BLOCKED_MSGS_KEY).then(raw => {
                const existing: Message[] = raw ? JSON.parse(raw) : [];
                const existingIds = new Set(existing.map(m => m.id));
                const toAdd = temps.filter(m => !existingIds.has(m.id));
                if (toAdd.length > 0) AsyncStorage.setItem(BLOCKED_MSGS_KEY, JSON.stringify([...existing, ...toAdd])).catch(() => {});
              }).catch(() => {});
            }
            return prev;
          });
        } else { setMessages(prev => prev.filter(m => m.id !== tempId)); }
      }
    }
  }, [input, selectedImage, isBlocked, conversation.id, user?.id, DRAFT_KEY, BLOCKED_MSGS_KEY, showToast]);

  // ── Typing ─────────────────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInput(text); saveDraft(text);
    const socket = socketService.getSocket();
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', { conversationId: conversation.id, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing', { conversationId: conversation.id, isTyping: false });
    }, 1500);
  };

  const handlePickImage = useCallback(async () => {
    if (isBlocked) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast('Permita acesso à galeria', 'error'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedImage(result.assets[0].uri);
  }, [isBlocked, showToast]);

  const openMenu = () => {
    menuBtnRef.current?.measure((_x, _y, _w, h, _px, py) => { setMenuAnchorY(py + h); setMenuOpen(true); });
  };

  // ── Block ──────────────────────────────────────────────────────────────
  const handleBlock = useCallback(() => {
    const name = other?.displayName || other?.username;
    if (isBlocked) {
      Alert.alert('Desbloquear', `Desbloquear ${name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desbloquear', onPress: async () => {
          try {
            await api.delete(`/blocks/${other.id}`);
            setIsBlocked(false);
            setBlockedIds(prev => { const s = new Set(prev); s.delete(other.id); return s; });
            showToast(`${name} desbloqueado`, 'success');
          } catch { showToast('Erro ao desbloquear', 'error'); }
        }},
      ]);
    } else {
      Alert.alert('Bloquear', `Bloquear ${name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: async () => {
          try {
            await api.post(`/blocks/${other.id}`);
            setIsBlocked(true);
            setBlockedIds(prev => new Set([...prev, other.id]));
            showToast(`${name} bloqueado`, 'success');
          } catch (e: any) { if (e?.response?.status === 409) setIsBlocked(true); else showToast('Erro', 'error'); }
        }},
      ]);
    }
  }, [isBlocked, other, showToast]);

  // ── Report ─────────────────────────────────────────────────────────────
  const submitReport = useCallback(async (reason: ReportReason, description: string) => {
    try {
      await api.post(`/reports/user/${other.id}`, { reason, description: description || undefined });
      setReportOpen(false); showToast('Denúncia enviada. Obrigado.', 'success');
    } catch { showToast('Erro ao enviar denúncia', 'error'); }
  }, [other?.id, showToast]);

  // ── Clear ──────────────────────────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    Alert.alert('Limpar conversa', 'As mensagens serão removidas para você.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/messages/conversations/${conversation.id}/clear`);
          setMessages([]); AsyncStorage.removeItem(LAST_SEEN_KEY).catch(() => {});
          showToast('Conversa limpa', 'success');
        } catch { showToast('Erro ao limpar', 'error'); }
      }},
    ]);
  }, [conversation.id, showToast, LAST_SEEN_KEY]);

  // ── Long press ─────────────────────────────────────────────────────────
  const handleLong = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Keyboard.dismiss();
    setTimeout(() => { setSelectedMsg(msg); setSheetOpen(true); }, 100);
  }, []);

  // ── Double tap ─────────────────────────────────────────────────────────
  const handleDouble = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (msg.id.startsWith('temp-')) return;
    const myReaction = (msg.reactions ?? []).find(r => r.userId === user?.id);
    const isToggleOff = myReaction?.emoji === '❤️';
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      let next = (m.reactions ?? []).filter(r => r.userId !== user?.id);
      if (!isToggleOff) next = [...next, { emoji: '❤️', userId: user?.id ?? '' }];
      return { ...m, reactions: next.length > 0 ? next : null };
    }));
    api.patch(`/messages/${msg.id}/reaction`, { emoji: isToggleOff ? null : '❤️' })
      .then(({ data }) => {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: data.reactions ?? null } : m));
        socketService.getSocket()?.emit('message_reaction', { conversationId: conversation.id, messageId: msg.id, emoji: isToggleOff ? null : '❤️', senderId: user?.id });
      })
      .catch((e: any) => {
        if (e?.response?.status !== 403)
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m));
      });
  }, [user?.id, conversation.id]);

  const closeSheet = useCallback(() => { setSheetOpen(false); setTimeout(() => setSelectedMsg(null), 300); }, []);

  // ── Reação via sheet ───────────────────────────────────────────────────
  const applyReactionDirect = useCallback((msg: Message, emoji: string) => {
    if (msg.id.startsWith('temp-')) return;
    const myReaction  = (msg.reactions ?? []).find(r => r.userId === user?.id);
    const isToggleOff = myReaction?.emoji === emoji;
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      let next = (m.reactions ?? []).filter(r => r.userId !== user?.id);
      if (!isToggleOff) next = [...next, { emoji, userId: user?.id ?? '' }];
      return { ...m, reactions: next.length > 0 ? next : null };
    }));
    api.patch(`/messages/${msg.id}/reaction`, { emoji: isToggleOff ? null : emoji })
      .then(({ data }) => {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: data.reactions ?? null } : m));
        socketService.getSocket()?.emit('message_reaction', { conversationId: conversation.id, messageId: msg.id, emoji: isToggleOff ? null : emoji, senderId: user?.id });
      })
      .catch((e: any) => {
        if (e?.response?.status === 403) {
          setMessages(prev => {
            const updated = prev.find(m => m.id === msg.id);
            if (!updated) return prev;
            AsyncStorage.getItem(BLOCKED_REACTIONS_KEY).then(raw => {
              const existing: Record<string, MessageReaction[]> = raw ? JSON.parse(raw) : {};
              existing[msg.id] = updated.reactions ?? [];
              AsyncStorage.setItem(BLOCKED_REACTIONS_KEY, JSON.stringify(existing)).catch(() => {});
            }).catch(() => {});
            return prev;
          });
          return;
        }
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m));
      });
  }, [user?.id, conversation.id, BLOCKED_REACTIONS_KEY]);

  const applyReaction = useCallback((emoji: string) => {
    if (!selectedMsg) return;
    closeSheet();
    setTimeout(() => applyReactionDirect(selectedMsg, emoji), 50);
  }, [selectedMsg, closeSheet, applyReactionDirect]);

  const handleCopy = useCallback(() => {
    if (!selectedMsg?.content) return;
    Clipboard.setStringAsync(selectedMsg.content).catch(() => {});
    closeSheet(); showToast('Copiado', 'success', 1500);
  }, [selectedMsg, closeSheet, showToast]);

  // ── Delete ─────────────────────────────────────────────────────────────
  const deleteMsg = useCallback(async (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, content: '', imageUrl: null } : m));
    if (msgId.startsWith('temp-')) return;
    try {
      await api.delete(`/messages/${msgId}`);
      socketService.getSocket()?.emit('delete_message', { conversationId: conversation.id, messageId: msgId });
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: false } : m));
      showToast('Erro ao apagar mensagem', 'error');
    }
  }, [conversation.id, showToast]);

  const handleDeleteFromSheet = useCallback(() => {
    if (!selectedMsg) return;
    const msgId = selectedMsg.id; const isImage = !!selectedMsg.imageUrl;
    if (isImage) {
      closeSheet();
      setTimeout(() => {
        Alert.alert('Apagar imagem', 'Tens a certeza?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Apagar', style: 'destructive', onPress: () => deleteMsg(msgId) },
        ]);
      }, 300);
    } else { closeSheet(); deleteMsg(msgId); }
  }, [selectedMsg, closeSheet, deleteMsg]);

  // ── Render ─────────────────────────────────────────────────────────────
  const isMe = (msg: Message) => msg.senderId === user?.id;

  const unreadHeaderOp = useRef(new RNAnimated.Value(firstUnreadIdx >= 0 ? 1 : 0)).current;
  useEffect(() => {
    if (firstUnreadIdx < 0) { unreadHeaderOp.setValue(0); return; }
    unreadHeaderOp.setValue(1);
    const t = setTimeout(() => {
      RNAnimated.timing(unreadHeaderOp, { toValue: 0, duration: 1200, useNativeDriver: true }).start();
    }, 5000);
    return () => clearTimeout(t);
  }, [firstUnreadIdx]);

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const mine          = isMe(item);
    const isFirstUnread = index === firstUnreadIdx;
    const highlighted   = firstUnreadIdx >= 0 && index >= firstUnreadIdx && !mine;
    return (
      <View>
        {newDay(messages, index) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 28, paddingVertical: 14 }}>
            <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.textTer, letterSpacing: 0.3 }}>{fmtDay(item.createdAt)}</Text>
            <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />
          </View>
        )}
        {isFirstUnread && (
          <RNAnimated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 10, opacity: unreadHeaderOp }}>
            <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.cyan + '55' }} />
            <Text style={{ fontSize: 11, fontWeight: '600', color: C.cyan, opacity: 0.8 }}>Mensagens não lidas</Text>
            <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.cyan + '55' }} />
          </RNAnimated.View>
        )}
        <Bubble msg={item} isMe={mine} highlighted={highlighted}
          onLong={handleLong} onDouble={handleDouble}
          onImagePress={d => setViewerData(d)}
          onReact={applyReactionDirect} user={user} C={C} />
      </View>
    );
  }, [messages, firstUnreadIdx, handleLong, handleDouble, user?.id, unreadHeaderOp, C]);

  const headerSub = useMemo(() => {
    if (otherTyping) return <Text style={{ fontSize: 12, color: C.primaryLt, marginTop: 2 }}>digitando...</Text>;
    if (otherPresence && otherPresence !== 'offline') return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: PRESENCE_COLORS[otherPresence] }} />
        <Text style={{ fontSize: 12, color: PRESENCE_COLORS[otherPresence] }}>{PRESENCE_LABELS[otherPresence]}</Text>
      </View>
    );
    return <Text style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>@{other?.username}</Text>;
  }, [otherTyping, otherPresence, other?.username, C]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, paddingTop: insets.top + 8 }}>
        <GlowBtn onPress={() => navigation.goBack()} size={36} radius={18} C={C}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </GlowBtn>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }} activeOpacity={0.8}
          onPress={() => other?.username && navigation.navigate('UserProfile', { username: other.username })}>
          <Avatar uri={other?.avatarUrl} name={other?.displayName || other?.username} size={38} presenceStatus={otherPresence} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>
              {other?.displayName || other?.username}
            </Text>
            {headerSub}
          </View>
        </TouchableOpacity>
        <View ref={menuBtnRef} collapsable={false}>
          <GlowBtn onPress={openMenu} size={36} radius={12} C={C}>
            <Ionicons name="ellipsis-horizontal" size={18} color={C.textSec} />
          </GlowBtn>
        </View>
      </View>

      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.border }} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.textTer, fontSize: 13 }}>Carregando...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 16, gap: 2, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScroll={({ nativeEvent }) => {
              if (nativeEvent.contentOffset.y < 80) loadMoreMessages();
            }}
            scrollEventThrottle={200}
            ListHeaderComponent={
              isLoadingMore ? (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ color: C.textTer, fontSize: 12 }}>Carregando...</Text>
                </View>
              ) : !hasMorePages.current ? (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ color: C.textTer, fontSize: 12 }}>Início da conversa</Text>
                </View>
              ) : null
            }
            initialScrollIndex={
              firstUnreadIdx >= 0 && firstUnreadIdx < messages.length
                ? firstUnreadIdx
                : messages.length > 0 ? messages.length - 1 : undefined
            }
            getItemLayout={(_data, index) => ({
              length: 72,
              offset: 72 * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                try { flatRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.15 }); }
                catch { flatRef.current?.scrollToEnd({ animated: false }); }
              }, 300);
            }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
                <Text style={{ fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -0.8 }}>Say hello.</Text>
                <Text style={{ fontSize: 15, color: C.textSec, textAlign: 'center', lineHeight: 22 }}>
                  {`Start a conversation with\n${other?.displayName || other?.username}.`}
                </Text>
              </View>
            }
            ListFooterComponent={otherTyping ? <TypingBubble C={C} /> : null}
          />
        )}

        {/* Input bar */}
        <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 8, backgroundColor: C.bg }}>
          {isBlocked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 }}>
              <Ionicons name="ban-outline" size={13} color={C.textTer} />
              <Text style={{ fontSize: 12, color: C.textTer }}>Você bloqueou este usuário</Text>
            </View>
          ) : (
            <>
              {selectedImage && (
                <View style={{ marginBottom: 8, borderRadius: 14, overflow: 'hidden', alignSelf: 'flex-start' }}>
                  <Image source={{ uri: selectedImage }} style={{ width: 120, height: 120 }} resizeMode="cover" />
                  <TouchableOpacity style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setSelectedImage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <Ionicons name="close" size={14} color={C.text} />
                  </TouchableOpacity>
                  {uploadingImage && (
                    <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                      <Text style={{ fontSize: 12, color: C.text, fontWeight: '600' }}>Enviando...</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <GlowBtn onPress={handlePickImage} size={38} radius={19} C={C}>
                  <Ionicons name="add" size={20} color={C.textSec} />
                </GlowBtn>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 26, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, minHeight: 50, maxHeight: 140 }}>
                  <TextInput
                    style={{ flex: 1, fontSize: 15, lineHeight: 20, color: C.text, paddingTop: 9, paddingBottom: 9, maxHeight: 120 }}
                    placeholder={selectedImage ? 'Adicionar legenda...' : 'Message...'}
                    placeholderTextColor={C.textTer}
                    value={input} onChangeText={handleTyping}
                    multiline maxLength={1000} returnKeyType="default" underlineColorAndroid="transparent"
                  />
                  <SendButton active={hasContent} onPress={handleSend} C={C} />
                </View>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {toastMsg && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 72, alignItems: 'center' }} pointerEvents="none">
          <Toast message={toastMsg.text} type={toastMsg.type} C={C} />
        </View>
      )}

      <ReactionsSheet visible={sheetOpen} msg={selectedMsg} isMine={selectedMsg?.senderId === user?.id}
        onPick={applyReaction} onDelete={handleDeleteFromSheet} onCopy={handleCopy} onClose={closeSheet} C={C} />

      <OptionsMenu visible={menuOpen} anchorY={menuAnchorY} isBlocked={isBlocked}
        onReport={() => setReportOpen(true)} onBlock={handleBlock}
        onClear={handleClearChat} onClose={() => setMenuOpen(false)} C={C} />

      <ReportModal visible={reportOpen} targetName={other?.displayName || other?.username || 'usuário'}
        onSubmit={submitReport} onClose={() => setReportOpen(false)} C={C} />

      <ImageViewer data={viewerData} onClose={() => setViewerData(null)} C={C}
        onDelete={msgId => {
          Alert.alert('Apagar imagem', 'Tens a certeza?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => { setViewerData(null); deleteMsg(msgId); } },
          ]);
        }} />
    </View>
  );
}
