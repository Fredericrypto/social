/**
 * ChatScreen.tsx — Venus v13
 *
 * Reescrita completa. Todos os bugs corrigidos:
 *  [1] ImageViewer fullscreen — ScrollView nativo (zoom pinch funciona no Expo Go)
 *      Swipe para fechar, single tap mostra/esconde UI, lixeira para deletar
 *  [2] Bolha de imagem — moldura arredondada completa, gestos corretos
 *      double-tap = ❤️, long-press = sheet, tap = abre viewer
 *  [3] Scroll sempre vai ao fim ao abrir
 *      Unread highlight + header aparecem apenas uma vez (AsyncStorage)
 *  [4] ReactionsSheet — "Apagar mensagem" disponível para todos (não só isMine)
 *  [5] Clipboard no "Copiar"
 *  [6] Delete emite socket para o outro usuário ver em tempo real
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
import { api } from '../../services/api';
import { socketService } from '../../services/socket.service';
import { uploadImage } from '../../services/supabase.service';
import {
  PresenceStatus, PRESENCE_COLORS, PRESENCE_LABELS,
} from '../../services/presence.service';
import Avatar from '../../components/ui/Avatar';

// ─── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0D1018',
  surface:   'rgba(255,255,255,0.05)',
  surfaceHi: 'rgba(255,255,255,0.07)',
  border:    'rgba(255,255,255,0.08)',
  borderHi:  'rgba(255,255,255,0.14)',
  text:      '#F1F5F9',
  textSec:   'rgba(241,245,249,0.60)',
  textTer:   'rgba(241,245,249,0.38)',
  primaryLt: '#94A3B8',
  cyan:      '#22D3EE',
  danger:    '#F87171',
  success:   '#4ADE80',
  bubble1:   '#1E293B',
  bubble2:   '#334155',
  unread:    'rgba(34,211,238,0.08)',
};

const GRAD_CYAN  = ['#22D3EE', '#3B82F6', '#8B5CF6'] as const;
const GRAD_SLATE = ['#475569', '#94A3B8', '#64748B'] as const;
const { width: SW, height: SH } = Dimensions.get('window');

// ─── Tipos ────────────────────────────────────────────────────────────────────
type CheckState = 'sent' | 'delivered' | 'read';

interface MessageReaction {
  emoji:  string;
  userId: string;
}

// Agrupa reações por emoji com contagem e lista de users
interface ReactionGroup {
  emoji:   string;
  count:   number;
  userIds: string[];
}

function groupReactions(reactions: MessageReaction[] | null | undefined): ReactionGroup[] {
  if (!reactions?.length) return [];
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [] };
    g.count++;
    g.userIds.push(r.userId);
    map.set(r.emoji, g);
  }
  return Array.from(map.values());
}

interface Message {
  id:          string;
  senderId:    string;
  content:     string;
  imageUrl?:   string | null;
  reactions?:  MessageReaction[] | null;
  createdAt:   string;
  deliveredAt: string | null;
  isRead:      boolean;
  isDeleted?:  boolean;
}

interface ViewerData {
  uri:    string;
  msgId:  string;
  isMine: boolean;
}

function getCheckState(msg: Message): CheckState {
  if (msg.isRead)      return 'read';
  if (msg.deliveredAt) return 'delivered';
  return 'sent';
}

function CheckIcon({ state, light = false }: { state: CheckState; light?: boolean }) {
  const color = light
    ? (state === 'read' ? C.cyan : 'rgba(255,255,255,0.75)')
    : (state === 'read' ? C.cyan : C.primaryLt);
  return (
    <Ionicons
      name={state !== 'sent' ? 'checkmark-done' : 'checkmark'}
      size={12}
      color={color}
    />
  );
}

const REPORT_REASONS = [
  { value: 'spam',          label: 'Spam' },
  { value: 'harassment',    label: 'Assédio' },
  { value: 'inappropriate', label: 'Conteúdo inapropriado' },
  { value: 'fake',          label: 'Perfil falso' },
  { value: 'other',         label: 'Outro motivo' },
] as const;
type ReportReason = typeof REPORT_REASONS[number]['value'];

const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

function fmtTime(d: string) { return format(new Date(d), 'HH:mm'); }
function fmtDay(d: string) {
  const dt = new Date(d);
  if (isToday(dt))     return 'Hoje';
  if (isYesterday(dt)) return 'Ontem';
  return format(dt, "d 'de' MMMM", { locale: ptBR });
}
function newDay(msgs: Message[], i: number) {
  if (i === 0) return true;
  return new Date(msgs[i-1].createdAt).toDateString() !== new Date(msgs[i].createdAt).toDateString();
}

// ═════════════════════════════════════════════════════════════════════════════
//  IMAGE VIEWER — fullscreen, zoom nativo via ScrollView
// ═════════════════════════════════════════════════════════════════════════════
function ImageViewer({ data, onClose, onDelete }: {
  data: ViewerData | null;
  onClose: () => void;
  onDelete: (msgId: string) => void;
}) {
  const insets     = useSafeAreaInsets();
  const bgOp       = useRef(new RNAnimated.Value(0)).current;
  const swipeAnim  = useRef(new RNAnimated.Value(0)).current;
  const [uiVisible, setUiVisible] = useState(true);
  const visible = data !== null;

  useEffect(() => {
    if (visible) {
      setUiVisible(true);
      swipeAnim.setValue(0);
      RNAnimated.timing(bgOp, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      RNAnimated.timing(bgOp, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible, bgOp, swipeAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:  () => false,
      onMoveShouldSetPanResponder:   (_, g) => Math.abs(g.dy) > 15 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove:    (_, g) => { swipeAnim.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dy) > 120 || Math.abs(g.vy) > 0.8) {
          RNAnimated.timing(swipeAnim, {
            toValue: g.dy > 0 ? SH : -SH,
            duration: 220,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          RNAnimated.spring(swipeAnim, {
            toValue: 0, useNativeDriver: true, damping: 18, stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <RNAnimated.View style={[iv.container, { opacity: bgOp }]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

        {/* Swipe layer */}
        <RNAnimated.View
          style={[StyleSheet.absoluteFill, { transform: [{ translateY: swipeAnim }] }]}
          {...panResponder.panHandlers}
        >
          {/* ScrollView com zoom nativo — funciona no Expo Go */}
          <ScrollView
            style={StyleSheet.absoluteFill}
            contentContainerStyle={iv.scrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
            bounces={false}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setUiVisible(v => !v)}
              style={iv.imgTouch}
            >
              <Image
                source={{ uri: data.uri }}
                style={iv.image}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </ScrollView>
        </RNAnimated.View>

        {/* UI overlay — some/reaparece com single tap */}
        {uiVisible && (
          <View
            style={[iv.uiOverlay, { paddingTop: insets.top + 12 }]}
            pointerEvents="box-none"
          >
            {/* Fechar — esquerda */}
            <TouchableOpacity
              style={iv.uiBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>

            {/* Lixeira — direita (só para o remetente) */}
            {data.isMine && (
              <TouchableOpacity
                style={[iv.uiBtn, iv.uiBtnRight]}
                onPress={() => { onDelete(data.msgId); onClose(); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
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
  container:   { flex: 1, backgroundColor: '#000' },
  scrollContent:{ flex: 1, alignItems: 'center', justifyContent: 'center' },
  imgTouch:    { width: SW, height: SH, alignItems: 'center', justifyContent: 'center' },
  image:       { width: SW, height: SH },
  uiOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20 },
  uiBtn:       { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  uiBtnRight:  {},
});

// ═════════════════════════════════════════════════════════════════════════════
//  TOAST
// ═════════════════════════════════════════════════════════════════════════════
function Toast({ message, type = 'info' }: { message: string; type?: 'info'|'success'|'error' }) {
  const color = type === 'success' ? C.success : type === 'error' ? C.danger : C.primaryLt;
  const icon  = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'close-circle' : 'information-circle';
  return (
    <View style={ts.wrap}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={ts.inner}>
        <Ionicons name={icon as any} size={16} color={color} />
        <Text style={[ts.txt, { color }]}>{message}</Text>
      </View>
    </View>
  );
}
const ts = StyleSheet.create({
  wrap:  { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.borderHi, maxWidth: SW * 0.8 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(13,16,24,0.7)' },
  txt:   { fontSize: 13, fontWeight: '600' },
});

// ═════════════════════════════════════════════════════════════════════════════
//  GLOW BTN
// ═════════════════════════════════════════════════════════════════════════════
function GlowBtn({ onPress, children, size = 36, radius = 12, disabled = false }: {
  onPress: () => void; children: React.ReactNode;
  size?: number; radius?: number; disabled?: boolean;
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
      withTiming(1,   { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0.8, { duration: 250 }),
      withTiming(0,   { duration: 450, easing: Easing.in(Easing.quad) }),
    );
    onPress();
  };

  const wrapStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: scale.value }],
    shadowColor:   '#94A3B8',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.85,
    shadowRadius:  glow.value * 12,
    elevation:     glow.value * 10,
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
function SendButton({ active, onPress }: { active: boolean; onPress: () => void }) {
  const progress   = useSharedValue(active ? 1 : 0);
  const pressScale = useSharedValue(1);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [active, progress]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: pressScale.value }],
    shadowColor:   active ? '#22D3EE' : '#94A3B8',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.25 + progress.value * 0.55,
    shadowRadius:  4 + progress.value * 10,
    elevation:     2 + progress.value * 8,
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
      <TouchableOpacity
        onPress={() => {
          if (!active) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          pressScale.value = withTiming(0.88, { duration: 80 }, () => {
            pressScale.value = withTiming(1, { duration: 140 });
          });
          onPress();
        }}
        disabled={!active} activeOpacity={0.85}
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
function OptionsMenu({ visible, anchorY, isBlocked, onReport, onBlock, onClear, onClose }: {
  visible: boolean; anchorY: number; isBlocked: boolean;
  onReport: () => void; onBlock: () => void; onClear: () => void; onClose: () => void;
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
  }, [visible, scale, op]);

  if (!visible) return null;

  const items = [
    { icon: 'flag-outline'   as const, label: 'Denunciar',      color: C.text,   action: onReport },
    { icon: (isBlocked ? 'lock-open-outline' : 'ban-outline') as any,
      label: isBlocked ? 'Desbloquear' : 'Bloquear',           color: C.danger, action: onBlock  },
    { icon: 'trash-outline'  as const, label: 'Limpar Conversa', color: C.danger, action: onClear  },
  ];

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <RNAnimated.View style={[om.menu, { top: anchorY + 8, right: 14, opacity: op, transform: [{ scale }] }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={om.inner}>
          {items.map((item, i) => (
            <View key={item.label}>
              {i > 0 && <View style={om.sep} />}
              <TouchableOpacity style={om.item} activeOpacity={0.7}
                onPress={() => { onClose(); setTimeout(item.action, 180); }}>
                <Ionicons name={item.icon} size={18} color={item.color} />
                <Text style={[om.txt, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </RNAnimated.View>
    </View>
  );
}
const om = StyleSheet.create({
  menu:  { position: 'absolute', width: 210, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.borderHi },
  inner: { backgroundColor: 'rgba(13,16,24,0.82)' },
  item:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 14 },
  txt:   { fontSize: 15, fontWeight: '500' },
  sep:   { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 14 },
});

// ═════════════════════════════════════════════════════════════════════════════
//  REPORT MODAL
// ═════════════════════════════════════════════════════════════════════════════
function ReportModal({ visible, targetName, onSubmit, onClose }: {
  visible: boolean; targetName: string;
  onSubmit: (reason: ReportReason, description: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription]       = useState('');
  const [submitting, setSubmitting]          = useState(false);
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
  }, [visible, ty, op]);

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
      <RNAnimated.View style={[rm.backdrop, { opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>
      <RNKeyboardAvoidingView style={rm.kavWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} pointerEvents="box-none">
        <RNAnimated.View style={[rm.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: ty }] }]}>
          <View {...pan.panHandlers} style={rm.handleArea}><View style={rm.handle} /></View>
          <Text style={rm.title}>Denunciar usuário</Text>
          <Text style={rm.sub}>Qual o problema com {targetName}?</Text>
          <ScrollView style={rm.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {REPORT_REASONS.map(r => {
              const active = selectedReason === r.value;
              return (
                <TouchableOpacity key={r.value} style={rm.reasonBtn}
                  onPress={() => setSelectedReason(r.value as ReportReason)} activeOpacity={0.7}>
                  <View style={[rm.radio, active && rm.radioActive]}>
                    {active && <View style={rm.radioDot} />}
                  </View>
                  <Text style={[rm.reasonTxt, active && { color: C.text }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
            <View style={rm.descWrap}>
              <TextInput style={rm.descInput} placeholder="Detalhes adicionais (opcional)..."
                placeholderTextColor={C.textTer} value={description}
                onChangeText={setDescription} multiline maxLength={500}
                underlineColorAndroid="transparent" />
            </View>
          </ScrollView>
          <TouchableOpacity style={[rm.submitBtn, !selectedReason && { opacity: 0.4 }]}
            onPress={async () => {
              if (!selectedReason) return;
              setSubmitting(true);
              await onSubmit(selectedReason, description.trim());
              setSubmitting(false);
            }}
            disabled={!selectedReason || submitting} activeOpacity={0.85}>
            <Text style={rm.submitTxt}>{submitting ? 'Enviando...' : 'Enviar denúncia'}</Text>
          </TouchableOpacity>
        </RNAnimated.View>
      </RNKeyboardAvoidingView>
    </View>
  );
}
const rm = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  kavWrap:     { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end' } as any,
  sheet:       { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: C.borderHi, paddingTop: 8, maxHeight: SH * 0.85 },
  handleArea:  { alignItems: 'center', paddingVertical: 10 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border },
  title:       { fontSize: 18, fontWeight: '700', color: C.text, paddingHorizontal: 24, marginBottom: 4 },
  sub:         { fontSize: 13, color: C.textSec, paddingHorizontal: 24, marginBottom: 16 },
  scroll:      { paddingHorizontal: 24, maxHeight: SH * 0.45 },
  reasonBtn:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  radio:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: C.textTer, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: C.cyan },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.cyan },
  reasonTxt:   { fontSize: 15, color: C.textSec, flex: 1 },
  descWrap:    { marginTop: 16, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, marginBottom: 16 },
  descInput:   { fontSize: 14, color: C.text, minHeight: 72, maxHeight: 120 },
  submitBtn:   { marginHorizontal: 24, backgroundColor: C.danger, borderRadius: 50, height: 52, alignItems: 'center', justifyContent: 'center' },
  submitTxt:   { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ═════════════════════════════════════════════════════════════════════════════
//  REACTIONS SHEET — "Apagar" disponível para todos
// ═════════════════════════════════════════════════════════════════════════════
function ReactionsSheet({ visible, msg, isMine, onPick, onDelete, onCopy, onClose }: {
  visible: boolean; msg: Message | null; isMine: boolean;
  onPick: (e: string) => void; onDelete: () => void;
  onCopy: () => void; onClose: () => void;
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
  }, [visible, ty, op]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
    onPanResponderMove:    (_, g) => { if (g.dy > 0) ty.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.6) onClose();
      else RNAnimated.spring(ty, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
    },
  })).current;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={visible ? 'auto' : 'none'}>
      <RNAnimated.View style={[rs.backdrop, { opacity: op }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </RNAnimated.View>
      <RNAnimated.View style={[rs.sheet, { paddingBottom: insets.bottom + 12, transform: [{ translateY: ty }] }]}>
        <View {...pan.panHandlers} style={rs.handleArea}><View style={rs.handle} /></View>
        <View style={rs.emojis}>
          {REACTIONS.map(e => (
            <TouchableOpacity key={e} style={[rs.eBtn, msg?.reaction === e && rs.eBtnActive]}
              onPress={() => onPick(e)} activeOpacity={0.7}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={rs.div} />
        {/* Copiar — só para mensagens de texto */}
        {!!msg?.content && !msg?.imageUrl && (
          <TouchableOpacity style={rs.action} onPress={onCopy} activeOpacity={0.7}>
            <Ionicons name="copy-outline" size={20} color={C.text} />
            <Text style={rs.actionTxt}>Copiar</Text>
          </TouchableOpacity>
        )}
        {/* Apagar — disponível para TODOS (igual WhatsApp) */}
        <TouchableOpacity style={rs.action} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={20} color={C.danger} />
          <Text style={[rs.actionTxt, { color: C.danger }]}>
            {isMine ? 'Apagar para todos' : 'Apagar para mim'}
          </Text>
        </TouchableOpacity>
      </RNAnimated.View>
    </View>
  );
}
const rs = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderTopColor: C.borderHi, paddingTop: 8 },
  handleArea: { alignItems: 'center', paddingVertical: 10 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border },
  emojis:     { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 8 },
  eBtn:       { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  eBtnActive: { backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.borderHi },
  div:        { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 4 },
  action:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16 },
  actionTxt:  { fontSize: 15, fontWeight: '500', color: C.text },
});

// ═════════════════════════════════════════════════════════════════════════════
//  TYPING BUBBLE
// ═════════════════════════════════════════════════════════════════════════════
function TypingBubble() {
  const dots = [0,1,2].map(() => useRef(new RNAnimated.Value(0.3)).current);
  useEffect(() => {
    const anims = dots.map((v, i) => RNAnimated.loop(RNAnimated.sequence([
      RNAnimated.timing(v, { toValue: 1,   duration: 400, delay: i * 150, useNativeDriver: true }),
      RNAnimated.timing(v, { toValue: 0.3, duration: 400,                 useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={[b.row, b.other]}>
      <View style={[b.bubble, b.bubbleOther, { flexDirection: 'row', gap: 5, paddingVertical: 14 }]}>
        {dots.map((v, i) => (
          <RNAnimated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.primaryLt, opacity: v }} />
        ))}
      </View>
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  BALÃO — gestos corretos, moldura limpa
// ═════════════════════════════════════════════════════════════════════════════
function Bubble({ msg, isMe, onLong, onDouble, highlighted, onImagePress, onReact, user }: {
  msg: Message; isMe: boolean; highlighted: boolean;
  onLong:       (m: Message) => void;
  onDouble:     (m: Message) => void;
  onImagePress: (d: ViewerData) => void;
  onReact:      (m: Message, emoji: string) => void;
  user:         any;
}) {
  const lastTap   = useRef(0);
  const scale     = useRef(new RNAnimated.Value(1)).current;
  const bgOpacity = useRef(new RNAnimated.Value(0)).current;
  const check     = getCheckState(msg);

  // Fade out do highlight — inicia em 1 se highlighted e faz fade após 5s
  useEffect(() => {
    if (highlighted) {
      // Garantir que começa visível (pode ter sido resetado)
      bgOpacity.setValue(1);
      const t = setTimeout(() => {
        RNAnimated.timing(bgOpacity, {
          toValue: 0, duration: 1200, useNativeDriver: false,
        }).start();
      }, 5000);
      return () => clearTimeout(t);
    } else {
      bgOpacity.setValue(0);
    }
  }, [highlighted, bgOpacity]);

  // Double-tap para ❤️
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

  const bgColor = bgOpacity.interpolate({
    inputRange: [0, 1], outputRange: ['rgba(34,211,238,0)', C.unread],
  });

  const imgW = SW * 0.65;
  const imgH = imgW * 0.82;

  if (msg.isDeleted) return (
    <RNAnimated.View style={[b.row, isMe ? b.me : b.other, { backgroundColor: bgColor }]}>
      <View style={b.deleted}><Text style={b.deletedTxt}>Mensagem apagada</Text></View>
    </RNAnimated.View>
  );

  // ── Bolha de imagem — WhatsApp style ──────────────────────────────────────
  // Imagem DENTRO do balão. Sem padding. Texto + hora sobre a imagem (overlay).
  if (msg.imageUrl) {
    const viewerData: ViewerData = { uri: msg.imageUrl, msgId: msg.id, isMine: isMe };
    const hasCaption = !!msg.content;

    return (
      <RNAnimated.View style={[b.row, isMe ? b.me : b.other, { backgroundColor: bgColor }]}>
        <RNAnimated.View style={[b.wrap, { transform: [{ scale }] }]}>

          {/* Balão — mesmo border radius do bubble de texto */}
          <TouchableOpacity
            activeOpacity={0.95}
            delayLongPress={360}
            onPress={() => {
              const now = Date.now();
              const diff = now - lastTap.current;
              lastTap.current = now;
              if (diff < 300) {
                onDouble(msg);
              } else {
                setTimeout(() => onImagePress(viewerData), 180);
              }
            }}
            onLongPress={() => onLong(msg)}
            style={[b.imgBalloon, isMe ? b.imgBalloonMe : b.imgBalloonOther]}
          >
            {/* Padding fino em volta da imagem */}
            <View style={b.imgPadWrap}>
              <Image
                source={{ uri: msg.imageUrl }}
                style={b.imgFill}
                resizeMode="cover"
              />
            </View>

            {/* Área inferior: legenda + hora + check */}
            <View style={hasCaption ? b.imgFooterCaption : b.imgFooterNoCaption}>
              {hasCaption && (
                <Text style={b.imgCaptionText}>{msg.content}</Text>
              )}
              <View style={b.imgMetaRow}>
                <Text style={b.imgMetaTime}>{fmtTime(msg.createdAt)}</Text>
                {isMe && <CheckIcon state={check} />}
              </View>
            </View>
          </TouchableOpacity>

          {/* Badges de reação — estilo Telegram */}
          {groupReactions(msg.reactions).length > 0 && (
            <View style={[b.reactionsRow, isMe ? b.reactionsRowMe : b.reactionsRowOther]}>
              {groupReactions(msg.reactions).map(g => (
                <TouchableOpacity
                  key={g.emoji}
                  style={[
                    b.reactionBadge,
                    g.userIds.includes(user?.id ?? '') && b.reactionBadgeActive,
                  ]}
                  onPress={() => onReact(msg, g.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={b.reactionEmoji}>{g.emoji}</Text>
                  {g.count > 1 && (
                    <Text style={b.reactionCount}>{g.count}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

        </RNAnimated.View>
      </RNAnimated.View>
    );
  }

  // ── Bolha de texto ─────────────────────────────────────────────────────
  return (
    <RNAnimated.View style={[b.row, isMe ? b.me : b.other, { backgroundColor: bgColor }]}>
      <View style={b.wrap}>
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            onPress={handleTap}
            onLongPress={() => onLong(msg)}
            activeOpacity={0.85}
            delayLongPress={360}
          >
            {isMe
              ? <LinearGradient colors={[C.bubble1, C.bubble2]} start={{x:0,y:0}} end={{x:1,y:1}} style={[b.bubble, b.bubbleMe]}>
                  <Text style={b.txtMe}>{msg.content}</Text>
                </LinearGradient>
              : <View style={[b.bubble, b.bubbleOther]}>
                  <Text style={b.txtOther}>{msg.content}</Text>
                </View>
            }
          </TouchableOpacity>
        </RNAnimated.View>
        {groupReactions(msg.reactions).length > 0 && (
          <View style={[b.reactionsRow, isMe ? b.reactionsRowMe : b.reactionsRowOther]}>
            {groupReactions(msg.reactions).map(g => (
              <TouchableOpacity
                key={g.emoji}
                style={[
                  b.reactionBadge,
                  g.userIds.includes(user?.id ?? '') && b.reactionBadgeActive,
                ]}
                onPress={() => onReact(msg, g.emoji)}
                activeOpacity={0.7}
              >
                <Text style={b.reactionEmoji}>{g.emoji}</Text>
                {g.count > 1 && (
                  <Text style={b.reactionCount}>{g.count}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={[b.meta, isMe ? b.metaMe : b.metaOther]}>
          <Text style={b.time}>{fmtTime(msg.createdAt)}</Text>
          {isMe && <CheckIcon state={check} />}
        </View>
      </View>
    </RNAnimated.View>
  );
}

const b = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2, paddingHorizontal: 14, paddingVertical: 2 },
  me:            { justifyContent: 'flex-end' },
  other:         { justifyContent: 'flex-start' },
  wrap:          { maxWidth: '78%', gap: 3 },
  bubble:        { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMe:      { borderBottomRightRadius: 6 },
  bubbleOther:   { backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 6 },
  // Imagem SEM legenda
  // ── Image bubble styles — WhatsApp ──────────────────────────────────────
  // Balão de imagem — padding fino igual WhatsApp
  imgBalloon:        { borderRadius: 18, maxWidth: SW * 0.72 },
  imgBalloonMe:      { borderBottomRightRadius: 4, backgroundColor: C.bubble1 },
  imgBalloonOther:   { borderBottomLeftRadius: 4, backgroundColor: C.surfaceHi, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  // Padding fino de 3px em volta da imagem
  imgPadWrap:        { margin: 3, borderRadius: 14, overflow: 'hidden' },
  imgFill:           { width: SW * 0.72 - 6, height: (SW * 0.72 - 6) * 1.05 },
  // Área inferior: sem legenda = padding fino, com legenda = padding maior
  imgFooterNoCaption:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 8, paddingVertical: 5, gap: 3 },
  imgFooterCaption:  { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8 },
  imgCaptionText:    { fontSize: 14, color: C.text, lineHeight: 19, marginBottom: 5 },
  imgMetaRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  imgMetaTime:       { fontSize: 10, color: C.textTer },
  imgOverlay:      { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingBottom: 7, paddingTop: 20, background: 'transparent' },
  imgOverlayTall:  { paddingTop: 40 },
  imgOverlayShort: { paddingTop: 20 },
  imgCaptionText:  { fontSize: 14, color: '#fff', lineHeight: 19, marginBottom: 3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  imgMetaRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  imgMetaTime:     { fontSize: 10, color: 'rgba(255,255,255,0.88)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  // Reação — badge colado na borda inferior do balão
  // Reactions — estilo Telegram
  reactionsRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  reactionsRowMe:      { justifyContent: 'flex-end' },
  reactionsRowOther:   { justifyContent: 'flex-start' },
  reactionBadge:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.surfaceHi, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 4 },
  reactionBadgeActive: { backgroundColor: 'rgba(148,163,184,0.15)', borderColor: C.primaryLt },
  reactionEmoji:       { fontSize: 13 },
  reactionCount:       { fontSize: 11, fontWeight: '600', color: C.textSec },
    // Texto
  deleted:       { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  deletedTxt:    { fontSize: 13, fontStyle: 'italic', color: C.textTer },
  txtMe:         { color: C.text, fontSize: 15, lineHeight: 21 },
  txtOther:      { color: C.text, fontSize: 15, lineHeight: 21 },
  // badge movido para reactionBadge
  meta:          { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  metaMe:        { justifyContent: 'flex-end' },
  metaOther:     { justifyContent: 'flex-start' },
  time:          { fontSize: 10, color: C.textTer },
});

// ═════════════════════════════════════════════════════════════════════════════
//  CHAT SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function ChatScreen({ route, navigation }: any) {
  const { conversation, other } = route.params;
  const { user }  = useAuthStore();
  const insets    = useSafeAreaInsets();

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
  const [toastMsg,       setToastMsg]       = useState<{ text: string; type: 'info'|'success'|'error' } | null>(null);
  const [firstUnreadIdx, setFirstUnreadIdx] = useState<number>(-1);
  const [viewerData,     setViewerData]     = useState<ViewerData | null>(null);

  const flatRef      = useRef<FlatList>(null);
  const typingTimer  = useRef<any>(null);
  const isTypingRef  = useRef(false);
  const menuBtnRef   = useRef<View>(null);
  const toastTimer   = useRef<any>(null);
  const scrolledOnce = useRef(false);
  const hasContent   = input.trim().length > 0 || selectedImage !== null;

  const DRAFT_KEY    = `@venus:draft:${conversation.id}`;
  const LAST_SEEN_KEY = `@venus:last_seen:${conversation.id}`;

  const showToast = useCallback((text: string, type: 'info'|'success'|'error' = 'info', ms = 2800) => {
    clearTimeout(toastTimer.current);
    setToastMsg({ text, type });
    toastTimer.current = setTimeout(() => setToastMsg(null), ms);
  }, []);

  // ── Interceptar botão voltar ───────────────────────────────────────────
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
    AsyncStorage.getItem(DRAFT_KEY).then(s => { if (s) setInput(s); }).catch(() => {});
  }, [DRAFT_KEY]);

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
    api.get('/blocks')
      .then(({ data }) => {
        if (!Array.isArray(data)) return;
        setIsBlocked(data.some((bl: any) => bl.blockedId === other.id));
        // Guardar todos os IDs bloqueados para filtrar mensagens no socket
        setBlockedIds(new Set(data.map((bl: any) => bl.blockedId)));
      })
      .catch(() => {});
  }, [other?.id]);

  // ── Carregar mensagens ─────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/messages/conversations/${conversation.id}`);
      const msgs: Message[] = (data.messages || data || []).map((m: any) => ({
        ...m,
        isRead:      m.isRead      ?? false,
        deliveredAt: m.deliveredAt ?? null,
        imageUrl:    m.imageUrl    ?? null,
        reactions:   Array.isArray(m.reactions) ? m.reactions : (m.reaction ? [{ emoji: m.reaction, userId: m.senderId }] : null),
      }));
      setMessages(msgs);

      // Calcular unread: só aparece se há msgs novas após o último ID visto
      const lastSeenId = await AsyncStorage.getItem(LAST_SEEN_KEY).catch(() => null);
      let firstUnread = -1;

      if (lastSeenId) {
        const lastSeenIdx = msgs.findIndex(m => m.id === lastSeenId);
        if (lastSeenIdx >= 0 && lastSeenIdx < msgs.length - 1) {
          // Há mensagens após o último visto
          const after = msgs.slice(lastSeenIdx + 1);
          const rel   = after.findIndex(m => m.senderId !== user?.id);
          if (rel >= 0) firstUnread = lastSeenIdx + 1 + rel;
        }
        // Se lastSeenIdx === -1: ID não encontrado → sem highlight (seguro)
      } else {
        // Primeira abertura: destacar não lidas do outro
        firstUnread = msgs.findIndex(m => !m.isRead && m.senderId !== user?.id);
      }

      setFirstUnreadIdx(firstUnread);

      // Salvar último ID visto
      if (msgs.length > 0) {
        AsyncStorage.setItem(LAST_SEEN_KEY, msgs[msgs.length - 1].id).catch(() => {});
      }

      // Flag para onContentSizeChange fazer o scroll inicial
      scrolledOnce.current = false;
    } catch {}
    finally { setLoading(false); }
  }, [conversation.id, user?.id, LAST_SEEN_KEY]);

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
      // Ignorar mensagens de usuários que bloqueámos
      if (blockedIds.has(msg.senderId)) return;
      setMessages(prev => [...prev, {
        ...msg, isRead: false,
        deliveredAt: msg.deliveredAt ?? null,
        imageUrl:    msg.imageUrl    ?? null,
        reactions:   Array.isArray(msg.reactions) ? msg.reactions : null,
      }]);
      // Atualiza last_seen para novas mensagens recebidas
      AsyncStorage.setItem(LAST_SEEN_KEY, msg.id).catch(() => {});
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    });

    socket.on('user_typing', ({ isTyping: t }: any) => setOtherTyping(t));

    socket.on('message_delivered', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deliveredAt: new Date().toISOString() } : m
      ));
    });

    socket.on('messages_read', ({ conversationId: cId }: { conversationId: string }) => {
      if (cId !== conversation.id) return;
      setMessages(prev => prev.map(m =>
        m.senderId === user?.id
          ? { ...m, isRead: true, deliveredAt: m.deliveredAt ?? new Date().toISOString() }
          : m
      ));
    });

    socket.on('message_reaction', ({ messageId, emoji, senderId: reactSenderId }: {
      messageId: string; emoji: string | null; senderId?: string;
    }) => {
      // Ignorar reações de usuários bloqueados
      if (reactSenderId && blockedIds.has(reactSenderId)) return;
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        let next = (m.reactions ?? []).filter(r => r.userId !== reactSenderId);
        if (emoji && reactSenderId) next = [...next, { emoji, userId: reactSenderId }];
        return { ...m, reactions: next.length > 0 ? next : null };
      }));
    });

    // Mensagem deletada pelo outro usuário em tempo real
    socket.on('message_deleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, isDeleted: true, content: '', imageUrl: null } : m
      ));
    });

    socket.on('message_blocked', () => showToast('Não foi possível enviar a mensagem', 'error'));

    const onPresence = ({ userId, status }: { userId: string; status: PresenceStatus }) => {
      if (userId === other?.id) setOtherPresence(status);
    };
    socket.on('presence:update', onPresence);

    return () => {
      socket.emit('leave_conversation', { conversationId: conversation.id });
      unsubMsg();
      socket.off('user_typing');
      socket.off('message_delivered');
      socket.off('messages_read');
      socket.off('message_reaction');
      socket.off('message_deleted');
      socket.off('message_blocked');
      socket.off('presence:update', onPresence);
    };
  }, [conversation.id, loadMessages, other?.id, user?.id, showToast, LAST_SEEN_KEY, blockedIds]);

  // ── Enviar ─────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if ((!content && !selectedImage) || isBlocked) return;

    setInput('');
    AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    const imageToSend = selectedImage;
    setSelectedImage(null);

    const tempId = `temp-${Date.now()}`;
    const temp: Message = {
      id: tempId, senderId: user?.id || '', content,
      imageUrl: imageToSend, createdAt: new Date().toISOString(),
      isRead: false, deliveredAt: null,
    };
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
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('send_message', { conversationId: conversation.id, content, imageUrl: finalImageUrl });
    } else {
      try {
        const { data } = await api.post(`/messages/conversations/${conversation.id}`, { content, imageUrl: finalImageUrl });
        setMessages(prev => prev.map(m => m.id === tempId
          ? { ...data, isRead: false, deliveredAt: data.deliveredAt ?? null, imageUrl: data.imageUrl ?? finalImageUrl }
          : m
        ));
      } catch {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    }
  }, [input, selectedImage, isBlocked, conversation.id, user?.id, DRAFT_KEY, showToast]);

  // ── Typing ─────────────────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInput(text);
    saveDraft(text);
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedImage(result.assets[0].uri);
  }, [isBlocked, showToast]);

  const openMenu = () => {
    menuBtnRef.current?.measure((_x, _y, _w, h, _px, py) => {
      setMenuAnchorY(py + h);
      setMenuOpen(true);
    });
  };

  // ── Block ──────────────────────────────────────────────────────────────
  const handleBlock = useCallback(() => {
    const name = other?.displayName || other?.username;
    if (isBlocked) {
      Alert.alert('Desbloquear', `Desbloquear ${name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desbloquear', onPress: async () => {
          try { await api.delete(`/blocks/${other.id}`); setIsBlocked(false); showToast(`${name} desbloqueado`, 'success'); }
          catch { showToast('Erro ao desbloquear', 'error'); }
        }},
      ]);
    } else {
      Alert.alert('Bloquear', `Bloquear ${name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Bloquear', style: 'destructive', onPress: async () => {
          try { await api.post(`/blocks/${other.id}`); setIsBlocked(true); showToast(`${name} bloqueado`, 'success'); }
          catch (e: any) { if (e?.response?.status === 409) setIsBlocked(true); else showToast('Erro', 'error'); }
        }},
      ]);
    }
  }, [isBlocked, other, showToast]);

  // ── Report ─────────────────────────────────────────────────────────────
  const submitReport = useCallback(async (reason: ReportReason, description: string) => {
    try {
      await api.post(`/reports/user/${other.id}`, { reason, description: description || undefined });
      setReportOpen(false);
      showToast('Denúncia enviada. Obrigado.', 'success');
    } catch { showToast('Erro ao enviar denúncia', 'error'); }
  }, [other?.id, showToast]);

  // ── Clear ──────────────────────────────────────────────────────────────
  const handleClearChat = useCallback(() => {
    Alert.alert('Limpar conversa', 'As mensagens serão removidas para você.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/messages/conversations/${conversation.id}/clear`);
          setMessages([]);
          AsyncStorage.removeItem(LAST_SEEN_KEY).catch(() => {});
          showToast('Conversa limpa', 'success');
        } catch { showToast('Erro ao limpar', 'error'); }
      }},
    ]);
  }, [conversation.id, showToast, LAST_SEEN_KEY]);

  // ── Long press → sheet (dismiss teclado primeiro) ─────────────────────
  const handleLong = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Keyboard.dismiss();
    setTimeout(() => { setSelectedMsg(msg); setSheetOpen(true); }, 100);
  }, []);

  // ── Double tap → ❤️ ───────────────────────────────────────────────────
  const handleDouble = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    applyReactionDirect(msg, '❤️');
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setTimeout(() => setSelectedMsg(null), 300);
  }, []);

  // ── Reação via sheet ───────────────────────────────────────────────────
  // Toggle de reação: mesmo emoji → remove; emoji novo → adiciona/troca
  const applyReactionDirect = useCallback((msg: Message, emoji: string) => {
    if (msg.id.startsWith('temp-')) return;
    const currentReactions = msg.reactions ?? [];
    const myReaction = currentReactions.find(r => r.userId === user?.id);
    const isToggleOff = myReaction?.emoji === emoji;

    // Otimista
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      let next = (m.reactions ?? []).filter(r => r.userId !== user?.id);
      if (!isToggleOff) next = [...next, { emoji, userId: user?.id ?? '' }];
      return { ...m, reactions: next.length > 0 ? next : null };
    }));

    api.patch(`/messages/${msg.id}/reaction`, { emoji: isToggleOff ? null : emoji })
      .then(({ data }) => {
        // Sincronizar com o valor real do servidor
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, reactions: data.reactions ?? null } : m
        ));
      })
      .catch(() => {
        // Reverter em caso de erro
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, reactions: msg.reactions } : m
        ));
      });

    socketService.getSocket()?.emit('message_reaction', {
      conversationId: conversation.id,
      messageId: msg.id,
      emoji: isToggleOff ? null : emoji,
      senderId: user?.id,
    });
  }, [user?.id, conversation.id]);

  const applyReaction = useCallback((emoji: string) => {
    if (!selectedMsg) return;
    closeSheet();
    setTimeout(() => applyReactionDirect(selectedMsg, emoji), 50);
  }, [selectedMsg, closeSheet, applyReactionDirect]);

  // ── Copiar texto ───────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (!selectedMsg?.content) return;
    Clipboard.setStringAsync(selectedMsg.content).catch(() => {});
    closeSheet();
    showToast('Copiado', 'success', 1500);
  }, [selectedMsg, closeSheet, showToast]);

  // ── Deletar mensagem — emite socket + HTTP ─────────────────────────────
  const deleteMsg = useCallback(async (msgId: string) => {
    // Otimista
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, isDeleted: true, content: '', imageUrl: null } : m
    ));
    if (msgId.startsWith('temp-')) return;
    try {
      await api.delete(`/messages/${msgId}`);
      // Emitir para o outro usuário ver em tempo real
      socketService.getSocket()?.emit('delete_message', {
        conversationId: conversation.id,
        messageId: msgId,
      });
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, isDeleted: false } : m
      ));
      showToast('Erro ao apagar mensagem', 'error');
    }
  }, [conversation.id, showToast]);

  const handleDeleteFromSheet = useCallback(() => {
    if (!selectedMsg) return;
    const msgId    = selectedMsg.id;
    const isImage  = !!selectedMsg.imageUrl;
    if (isImage) {
      // Alert de confirmação apenas para imagens
      closeSheet();
      setTimeout(() => {
        Alert.alert(
          'Apagar imagem',
          'Tens a certeza que queres apagar esta imagem?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apagar', style: 'destructive', onPress: () => deleteMsg(msgId) },
          ]
        );
      }, 300); // aguarda sheet fechar
    } else {
      closeSheet();
      deleteMsg(msgId);
    }
  }, [selectedMsg, closeSheet, deleteMsg]);

  // ── Render ─────────────────────────────────────────────────────────────
  const isMe = (msg: Message) => msg.senderId === user?.id;

  // Fade do header "Mensagens não lidas" — sincronizado com o highlight (5s)
  const unreadHeaderOp = useRef(
    new RNAnimated.Value(firstUnreadIdx >= 0 ? 1 : 0)
  ).current;
  useEffect(() => {
    if (firstUnreadIdx < 0) {
      unreadHeaderOp.setValue(0);
      return;
    }
    // Certificar que está visível
    unreadHeaderOp.setValue(1);
    const t = setTimeout(() => {
      RNAnimated.timing(unreadHeaderOp, {
        toValue: 0, duration: 1200, useNativeDriver: true,
      }).start();
    }, 5000);
    return () => clearTimeout(t);
  }, [firstUnreadIdx, unreadHeaderOp]);

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const mine          = isMe(item);
    const isFirstUnread = index === firstUnreadIdx;
    const highlighted   = firstUnreadIdx >= 0 && index >= firstUnreadIdx && !mine;

    return (
      <View>
        {newDay(messages, index) && (
          <View style={s.dayRow}>
            <View style={s.dayLine} />
            <Text style={s.dayTxt}>{fmtDay(item.createdAt)}</Text>
            <View style={s.dayLine} />
          </View>
        )}
        {isFirstUnread && (
          <RNAnimated.View style={[s.unreadHeader, { opacity: unreadHeaderOp }]}>
            <View style={s.unreadLine} />
            <Text style={s.unreadTxt}>Mensagens não lidas</Text>
            <View style={s.unreadLine} />
          </RNAnimated.View>
        )}
        <Bubble
          msg={item}
          isMe={mine}
          highlighted={highlighted}
          onLong={handleLong}
          onDouble={handleDouble}
          onImagePress={d => setViewerData(d)}
          onReact={applyReactionDirect}
          user={user}
        />
      </View>
    );
  }, [messages, firstUnreadIdx, handleLong, handleDouble, user?.id, unreadHeaderOp]);

  const headerSub = useMemo(() => {
    if (otherTyping) return <Text style={[s.hSub, { color: C.primaryLt }]}>digitando...</Text>;
    if (otherPresence && otherPresence !== 'offline') return (
      <View style={s.presRow}>
        <View style={[s.presDot, { backgroundColor: PRESENCE_COLORS[otherPresence] }]} />
        <Text style={[s.hSub, { color: PRESENCE_COLORS[otherPresence] }]}>{PRESENCE_LABELS[otherPresence]}</Text>
      </View>
    );
    return <Text style={s.hSub}>@{other?.username}</Text>;
  }, [otherTyping, otherPresence, other?.username]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <GlowBtn onPress={() => navigation.goBack()} size={36} radius={18}>
          <Ionicons name="chevron-back" size={20} color={C.text} />
        </GlowBtn>
        <TouchableOpacity style={s.hCenter} activeOpacity={0.8}
          onPress={() => other?.username && navigation.navigate('UserProfile', { username: other.username })}>
          <Avatar uri={other?.avatarUrl} name={other?.displayName || other?.username}
            size={38} presenceStatus={otherPresence} />
          <View style={{ flex: 1 }}>
            <Text style={s.hName} numberOfLines={1}>{other?.displayName || other?.username}</Text>
            {headerSub}
          </View>
        </TouchableOpacity>
        <View ref={menuBtnRef} collapsable={false}>
          <GlowBtn onPress={openMenu} size={36} radius={12}>
            <Ionicons name="ellipsis-horizontal" size={18} color={C.textSec} />
          </GlowBtn>
        </View>
      </View>

      <View style={s.divider} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {loading ? (
          <View style={s.loading}><Text style={{ color: C.textTer, fontSize: 13 }}>Carregando...</Text></View>
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
            onContentSizeChange={() => {
              // Scroll inicial garantido quando o conteúdo renderiza
              if (!scrolledOnce.current) {
                scrolledOnce.current = true;
                flatRef.current?.scrollToEnd({ animated: false });
              }
            }}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                flatRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.2 });
              }, 300);
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyTitle}>Say hello.</Text>
                <Text style={s.emptySub}>{`Start a conversation with\n${other?.displayName || other?.username}.`}</Text>
              </View>
            }
            ListFooterComponent={otherTyping ? <TypingBubble /> : null}
          />
        )}

        {/* Input */}
        <View style={[s.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          {isBlocked ? (
            <View style={s.blockedBar}>
              <Ionicons name="ban-outline" size={13} color={C.textTer} />
              <Text style={s.blockedTxt}>Você bloqueou este usuário</Text>
            </View>
          ) : (
            <>
              {selectedImage && (
                <View style={s.previewWrap}>
                  <Image source={{ uri: selectedImage }} style={s.previewImg} resizeMode="cover" />
                  <TouchableOpacity style={s.previewRemove} onPress={() => setSelectedImage(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <Ionicons name="close" size={14} color={C.text} />
                  </TouchableOpacity>
                  {uploadingImage && (
                    <View style={s.previewUploading}>
                      <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                      <Text style={s.previewUploadingTxt}>Enviando...</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={s.inputRow}>
                <GlowBtn onPress={handlePickImage} size={38} radius={19}>
                  <Ionicons name="add" size={20} color={C.textSec} />
                </GlowBtn>
                <View style={s.inputWrap}>
                  <TextInput
                    style={s.input}
                    placeholder={selectedImage ? 'Adicionar legenda...' : 'Message...'}
                    placeholderTextColor={C.textTer}
                    value={input}
                    onChangeText={handleTyping}
                    multiline maxLength={1000}
                    returnKeyType="default"
                    underlineColorAndroid="transparent"
                  />
                  <SendButton active={hasContent} onPress={handleSend} />
                </View>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {toastMsg && (
        <View style={[s.toastWrap, { top: insets.top + 72 }]} pointerEvents="none">
          <Toast message={toastMsg.text} type={toastMsg.type} />
        </View>
      )}

      <ReactionsSheet
        visible={sheetOpen}
        msg={selectedMsg}
        isMine={selectedMsg?.senderId === user?.id}
        onPick={applyReaction}
        onDelete={handleDeleteFromSheet}
        onCopy={handleCopy}
        onClose={closeSheet}
      />

      <OptionsMenu visible={menuOpen} anchorY={menuAnchorY} isBlocked={isBlocked}
        onReport={() => setReportOpen(true)} onBlock={handleBlock}
        onClear={handleClearChat} onClose={() => setMenuOpen(false)} />

      <ReportModal visible={reportOpen}
        targetName={other?.displayName || other?.username || 'usuário'}
        onSubmit={submitReport} onClose={() => setReportOpen(false)} />

      <ImageViewer
        data={viewerData}
        onClose={() => setViewerData(null)}
        onDelete={msgId => {
          Alert.alert(
            'Apagar imagem',
            'Tens a certeza que queres apagar esta imagem?',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Apagar', style: 'destructive', onPress: () => {
                setViewerData(null);
                deleteMsg(msgId);
              }},
            ]
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },
  header:             { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12 },
  hCenter:            { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hName:              { fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: -0.2 },
  hSub:               { fontSize: 12, color: C.textSec, marginTop: 2 },
  presRow:            { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  presDot:            { width: 7, height: 7, borderRadius: 3.5 },
  divider:            { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  loading:            { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unreadHeader:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 28, paddingVertical: 10 },
  unreadLine:         { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.cyan + '55' },
  unreadTxt:          { fontSize: 11, fontWeight: '600', color: C.cyan, opacity: 0.8 },
  dayRow:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 28, paddingVertical: 14 },
  dayLine:            { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  dayTxt:             { fontSize: 11, fontWeight: '600', color: C.textTer, letterSpacing: 0.3 },
  empty:              { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  emptyTitle:         { fontSize: 32, fontWeight: '800', color: C.text, letterSpacing: -0.8 },
  emptySub:           { fontSize: 15, color: C.textSec, textAlign: 'center', lineHeight: 22 },
  inputBar:           { paddingHorizontal: 14, paddingTop: 8, backgroundColor: C.bg },
  previewWrap:        { marginBottom: 8, borderRadius: 14, overflow: 'hidden', alignSelf: 'flex-start' },
  previewImg:         { width: 120, height: 120 },
  previewRemove:      { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewUploading:   { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewUploadingTxt:{ fontSize: 12, color: C.text, fontWeight: '600' },
  inputRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap:          { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 26, paddingLeft: 18, paddingRight: 6, paddingVertical: 6, minHeight: 50, maxHeight: 140 },
  input:              { flex: 1, fontSize: 15, lineHeight: 20, color: C.text, paddingTop: 9, paddingBottom: 9, maxHeight: 120 },
  blockedBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  blockedTxt:         { fontSize: 12, color: C.textTer },
  toastWrap:          { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
