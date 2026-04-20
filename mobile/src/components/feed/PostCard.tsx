/**
 * PostCard.tsx
 *
 * CORREÇÕES:
 *  - Sem Modal do RN → overlay absoluto dentro da hierarquia (tab bar não some)
 *  - Sem Alert branco → ConfirmModal customizado para tudo
 *  - Share com card miniatura (nome app + usuário + caption + tipo)
 *  - /feed/not-interested silenciado (endpoint não existe ainda)
 *  - Denúncia com modal de seleção de motivo
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Dimensions, Animated, ScrollView, Platform, Share,
  PanResponder, TouchableWithoutFeedback, Modal,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { RichText } from '../ui/RichText';
import ProjectCard from '../ui/ProjectCard';
import Avatar from '../ui/Avatar';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { postsService } from '../../services/posts.service';
import { savedService } from '../../services/saved.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// ─── Posts ignorados — persistidos localmente ─────────────────────────────────
// Enquanto o backend não tem endpoint /feed/not-interested,
// salvamos os IDs no AsyncStorage e filtramos no FeedScreen ao carregar.
const IGNORED_KEY = 'feed:ignored_posts';

async function addIgnoredPost(postId: string) {
  try {
    const raw  = await AsyncStorage.getItem(IGNORED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(postId)) {
      list.push(postId);
      if (list.length > 500) list.splice(0, list.length - 500);
      await AsyncStorage.setItem(IGNORED_KEY, JSON.stringify(list));
    }
  } catch {}
}

// Exportada para o FeedScreen usar no loadFeed
export async function getIgnoredPosts(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(IGNORED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function removeIgnoredPost(postId: string) {
  try {
    const raw  = await AsyncStorage.getItem(IGNORED_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(IGNORED_KEY, JSON.stringify(list.filter(id => id !== postId)));
  } catch {}
}
const LIKE_COLOR  = '#F43F5E';
const APP_NAME    = 'Minha Rede Social';
const APP_URL     = 'https://social-production-8e37.up.railway.app';

// ─── Syntax highlight ────────────────────────────────────────────────────────
const TOKEN_COLORS: Record<string, string> = {
  keyword: '#CBA6F7', string: '#A6E3A1', comment: '#6C7086',
  number:  '#FAB387', function: '#89B4FA', operator: '#89DCEB', default: '#CDD6F4',
};
function tokenize(code: string) {
  return code.split('\n').map((line, li) => {
    const parts: { text: string; color: string }[] = [];
    let rem = line;
    while (rem.length > 0) {
      if (rem.startsWith('//') || rem.startsWith('#')) { parts.push({ text: rem, color: TOKEN_COLORS.comment }); break; }
      const str = rem.match(/^(['"`])(.*?)\1/);
      if (str) { parts.push({ text: str[0], color: TOKEN_COLORS.string }); rem = rem.slice(str[0].length); continue; }
      const kw = rem.match(/^(const|let|var|function|return|if|else|for|while|import|export|from|class|async|await|def|print|val|fun|type|interface|extends|implements)\b/);
      if (kw) { parts.push({ text: kw[0], color: TOKEN_COLORS.keyword }); rem = rem.slice(kw[0].length); continue; }
      const num = rem.match(/^\d+\.?\d*/);
      if (num) { parts.push({ text: num[0], color: TOKEN_COLORS.number }); rem = rem.slice(num[0].length); continue; }
      const fn = rem.match(/^([a-zA-Z_]\w*)\s*(?=\()/);
      if (fn) { parts.push({ text: fn[0], color: TOKEN_COLORS.function }); rem = rem.slice(fn[0].length); continue; }
      parts.push({ text: rem[0], color: TOKEN_COLORS.default }); rem = rem.slice(1);
    }
    return { parts, key: li };
  });
}
function CodeBlock({ caption }: { caption: string }) {
  const match = caption.match(/```([a-z]*)\n?([\s\S]*?)```/);
  const lang  = match?.[1] || 'code';
  const code  = match?.[2]?.trim() || caption;
  const desc  = caption.match(/^([\s\S]*?)```/)?.[1]?.trim();
  const lines = tokenize(code);
  return (
    <View>
      {desc ? <Text style={{ color: '#CDD6F4', fontSize: 14, lineHeight: 20, padding: 12, paddingBottom: 0 }}>{desc}</Text> : null}
      <View style={cs.container}>
        <View style={cs.topBar}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['#FF5F57', '#FFBD2E', '#28C840'].map(c => <View key={c} style={[cs.dot, { backgroundColor: c }]} />)}
          </View>
          <Text style={cs.lang}>{lang}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ padding: 12 }}>
            {lines.map(({ parts, key }) => (
              <View key={key} style={{ flexDirection: 'row', flexWrap: 'nowrap' }}>
                {parts.map((p, i) => (
                  <Text key={i} style={{ color: p.color, fontFamily: 'monospace', fontSize: 12, lineHeight: 20 }}>{p.text}</Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
const cs = StyleSheet.create({
  container: { backgroundColor: '#1E1E2E', marginTop: 8 },
  topBar:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#313244' },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  lang:      { color: '#6C7086', fontSize: 11, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY SHEET — Modal do RN com fix de tab bar no Android

type SheetType = 'options' | 'report' | 'confirm_delete' | null;

interface OverlaySheetProps {
  type:      SheetType;
  isDark:    boolean;
  theme:     any;
  isOwn:     boolean;
  onClose:   () => void;
  onNotInterested: () => void;
  onHidePost:      () => void;
  onDelete:        () => void;
  onShare:         () => void;
  onInvisible:     () => void;
  onOpenReport:    () => void;
  onReport: (reason: string) => void;
  onConfirmDelete: () => void;
}

const REPORT_REASONS = [
  { key: 'spam',       label: 'Spam ou conteúdo repetitivo',  icon: 'ban-outline'         },
  { key: 'nudity',     label: 'Nudez ou conteúdo sexual',     icon: 'alert-circle-outline' },
  { key: 'hate',       label: 'Discurso de ódio',             icon: 'warning-outline'      },
  { key: 'violence',   label: 'Violência ou automutilação',   icon: 'skull-outline'        },
  { key: 'false_info', label: 'Informação falsa',             icon: 'information-outline'  },
  { key: 'other',      label: 'Outro motivo',                 icon: 'ellipsis-horizontal'  },
];

function OverlaySheet(props: OverlaySheetProps) {
  const { type, isDark, theme, isOwn, onClose } = props;
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  // Abre o modal e força nav bar transparente no Android
  const openSheet = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        await NavigationBar.setBackgroundColorAsync('#00000000');
        await NavigationBar.setPositionAsync('absolute');
      } catch {}
    }
    setVisible(true);
    slideAnim.setValue(500);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 14 }),
      Animated.timing(fadeAnim,  { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const closeSheet = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 500, duration: 220, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      cb?.();
    });
  }, [slideAnim, fadeAnim]);

  useEffect(() => {
    if (type) openSheet();
  }, [type]);

  // Swipe down para fechar
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder:  (_, g) => g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove:   (_, g) => { if (g.dy > 0) slideAnim.setValue(g.dy); },
    onPanResponderRelease:(_, g) => {
      if (g.dy > 80 || g.vy > 0.6) closeSheet(onClose);
      else Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }).start();
    },
  })).current;

  if (!type && !visible) return null;

  const textColor = '#E8EEFF';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => closeSheet(onClose)}
    >
      {/* Backdrop — tap fora fecha */}
      <TouchableWithoutFeedback onPress={() => closeSheet(onClose)}>
        <Animated.View style={[ov.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* Sheet centralizado — não segue a posição do card */}
      <View style={ov.sheetWrapper} pointerEvents="box-none">
        <Animated.View
          style={[ov.sheet, { transform: [{ translateY: slideAnim }] }]}
          {...pan.panHandlers}
        >
          {/* Fundo sólido escuro atrás do blur */}
          <View style={[StyleSheet.absoluteFill, {
            backgroundColor: '#060912',
            borderRadius: 24,
          }]} />

          <BlurView intensity={95} tint="dark" style={ov.blur}>
            {/* Handle */}
            <View style={ov.handleWrap}>
              <View style={ov.handle} />
            </View>

            {/* ── Opções principais ──────────────────────────── */}
            {type === 'options' && (
              isOwn ? (
                <>
                  <SheetRow icon="trash-outline"        label="Excluir post"     color="#EF4444"   isDestructive onPress={() => closeSheet(() => { onClose(); setTimeout(props.onDelete,    50); })} />
                  <SheetDivider />
                  <SheetRow icon="eye-off-outline"      label="Tornar invisível" color={textColor}             onPress={() => closeSheet(() => { onClose(); setTimeout(props.onInvisible, 50); })} />
                  <SheetDivider />
                  <SheetRow icon="share-social-outline" label="Compartilhar"     color={textColor}             onPress={() => closeSheet(() => { onClose(); setTimeout(props.onShare,     50); })} />
                </>
              ) : (
                <>
                  <SheetRow icon="close-circle-outline" label="Não me interessa"  color={textColor}           onPress={() => closeSheet(() => { onClose(); setTimeout(props.onNotInterested, 50); })} />
                  <SheetDivider />
                  <SheetRow icon="eye-off-outline"      label="Ocultar post"       color={textColor}           onPress={() => closeSheet(() => { onClose(); setTimeout(props.onHidePost,      50); })} />
                  <SheetDivider />
                  <SheetRow icon="flag-outline"         label="Denunciar"          color="#EF4444" isDestructive onPress={() => { props.onOpenReport(); }} />
                  <SheetDivider />
                  <SheetRow icon="share-social-outline" label="Compartilhar"       color={textColor}           onPress={() => closeSheet(() => { onClose(); setTimeout(props.onShare,        50); })} />
                </>
              )
            )}

            {/* ── Motivo de denúncia ──────────────────────────── */}
            {type === 'report' && (
              <>
                <Text style={ov.reportTitle}>Por que você está denunciando?</Text>
                <Text style={ov.reportSub}>Sua denúncia é anônima e será revisada pelo administrador.</Text>
                {REPORT_REASONS.map((r, i) => (
                  <React.Fragment key={r.key}>
                    {i > 0 && <SheetDivider />}
                    <SheetRow
                      icon={r.icon as any}
                      label={r.label}
                      color={textColor}
                      onPress={() => closeSheet(() => { onClose(); setTimeout(() => props.onReport(r.key), 50); })}
                    />
                  </React.Fragment>
                ))}
              </>
            )}

            {/* ── Confirmação de exclusão ─────────────────────── */}
            {type === 'confirm_delete' && (
              <>
                <View style={ov.confirmHeader}>
                  <View style={ov.confirmIconWrap}>
                    <Ionicons name="trash-outline" size={28} color="#EF4444" />
                  </View>
                  <Text style={ov.confirmTitle}>Excluir este post?</Text>
                  <Text style={ov.confirmSub}>Esta ação é irreversível e não pode ser desfeita.</Text>
                </View>
                <TouchableOpacity style={[ov.confirmBtn, { backgroundColor: '#EF4444' }]} onPress={() => closeSheet(() => { onClose(); setTimeout(props.onConfirmDelete, 50); })} activeOpacity={0.8}>
                  <Text style={ov.confirmBtnText}>Sim, excluir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[ov.confirmBtn, { backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8 }]} onPress={() => closeSheet(onClose)} activeOpacity={0.8}>
                  <Text style={[ov.confirmBtnText, { color: 'rgba(255,255,255,0.5)' }]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}

            <SheetDivider />
            <TouchableOpacity onPress={() => closeSheet(onClose)} style={ov.cancelBtn} activeOpacity={0.6}>
              <Text style={ov.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <View style={{ height: Platform.OS === 'ios' ? 34 : 20 }} />
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function SheetRow({ icon, label, color, onPress, isDestructive = false }: {
  icon: string; label: string; color: string;
  onPress: () => void; isDestructive?: boolean;
}) {
  return (
    <TouchableOpacity style={ov.row} onPress={onPress} activeOpacity={0.65}>
      <View style={[ov.iconWrap, { backgroundColor: isDestructive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.09)' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[ov.rowLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.18)" />
    </TouchableOpacity>
  );
}
function SheetDivider() {
  return <View style={ov.divider} />;
}

const ov = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.68)' },
  // sheetWrapper centraliza o sheet na tela — não segue o card
  sheetWrapper:{ position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:       {
    marginHorizontal: 12,
    marginBottom:     Platform.OS === 'ios' ? 32 : 20,
    borderRadius:     24,  // bordas em todos os 4 cantos
    overflow:         'hidden',
  },
  blur:        { paddingTop: 0 },
  handleWrap:  { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  iconWrap:    { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowLabel:    { flex: 1, fontSize: 15, fontWeight: '500' },
  divider:     { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20 },
  cancelBtn:   { alignItems: 'center', paddingVertical: 16 },
  cancelText:  { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.38)' },
  reportTitle: { color: '#E8EEFF', fontSize: 16, fontWeight: '700', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  reportSub:   { color: 'rgba(232,238,255,0.45)', fontSize: 12, paddingHorizontal: 20, paddingBottom: 12 },
  confirmHeader:  { alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20, gap: 10 },
  confirmIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(239,68,68,0.12)', alignItems: 'center', justifyContent: 'center' },
  confirmTitle:   { color: '#E8EEFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  confirmSub:     { color: 'rgba(232,238,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  confirmBtn:     { marginHorizontal: 20, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

// ─── Toast ────────────────────────────────────────────────────────────────────
// Usa Modal transparente para ficar fixo na tela mesmo após o card colapsar.
function Toast({ message, action, onDismiss }: {
  message: string;
  action?: { label: string; onPress: () => void };
  onDismiss: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 12 }),
      Animated.delay(action ? 5000 : 2800),
      Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => { if (finished) onDismiss(); });
  }, []);

  return (
    <Modal transparent animationType="none" statusBarTranslucent>
      <View style={tt.container} pointerEvents="box-none">
        <Animated.View style={[tt.wrap, {
          opacity:   anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [16, 0] }) }],
        }]}>
          <BlurView intensity={88} tint="dark" style={tt.blur}>
            <Text style={tt.msg}>{message}</Text>
            {action && (
              <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
                <Text style={tt.actionText}>{action.label}</Text>
              </TouchableOpacity>
            )}
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}
const tt = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 100 },
  wrap:      { borderRadius: 16, overflow: 'hidden', maxWidth: width - 48 },
  blur:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, gap: 12 },
  msg:       { color: '#E8EEFF', fontSize: 13, fontWeight: '500', flexShrink: 1 },
  actionText:{ color: '#818CF8', fontSize: 13, fontWeight: '700' },
});

// ─── PostCard ─────────────────────────────────────────────────────────────────
interface PostCardProps {
  post:          any;
  onLikeUpdate?: (postId: string, likesCount: number) => void;
  onRemovePost?: (postId: string) => void;
  onShowToast?:  (message: string, action?: { label: string; onPress: () => void }) => void;
}

export default function PostCard({ post, onLikeUpdate, onRemovePost, onShowToast }: PostCardProps) {
  const { theme, isDark } = useThemeStore();
  const { user }          = useAuthStore();
  const navigation        = useNavigation<any>();

  const [liked,      setLiked]      = useState<boolean>(post.isLiked  ?? false);
  const [saved,      setSaved]      = useState<boolean>(post.isSaved  ?? false);
  const [likes,      setLikes]      = useState<number>(post.likesCount ?? 0);
  const [sheetType,  setSheetType]  = useState<SheetType>(null);
  const [hidden,     setHidden]     = useState(false);
  const [dismissed,  setDismissed]  = useState(false);

  const collapseAnim = useRef(new Animated.Value(1)).current;
  const heartScale   = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTap      = useRef(0);

  const isCode    = post.postType === 'code' || post.caption?.includes('```');
  const isProject = post.postType === 'project';
  const isOwnPost = user?.id === (post.user?.id || post.userId);

  const collapseAndRemove = useCallback((postId: string) => {
    Animated.timing(collapseAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start(() => {
      setDismissed(true);
      onRemovePost?.(postId);
    });
  }, [collapseAnim, onRemovePost]);

  const goToProfile = useCallback(() => {
    const username = post.user?.username;
    if (!username) return;
    if (isOwnPost) navigation.navigate('Tabs', { screen: 'Profile' });
    else           navigation.navigate('UserProfile', { username });
  }, [post.user?.username, isOwnPost, navigation]);

  const triggerLikeAnim = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1,    useNativeDriver: true, speed: 30 }),
    ]).start();
  }, [heartScale]);

  const handleLike = useCallback(async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    const newCount = wasLiked ? likes - 1 : likes + 1;
    setLikes(newCount);
    triggerLikeAnim();
    onLikeUpdate?.(post.id, newCount);
    try {
      if (wasLiked) await postsService.unlike(post.id);
      else          await postsService.like(post.id);
    } catch (e: any) {
      const status = e?.response?.status;
      if (!wasLiked && status === 409) {
        setLiked(true); setLikes(likes); onLikeUpdate?.(post.id, likes);
      } else {
        setLiked(wasLiked); setLikes(likes); onLikeUpdate?.(post.id, likes);
      }
    }
  }, [liked, likes, post.id, triggerLikeAnim, onLikeUpdate]);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) handleLike();
      heartOpacity.setValue(1);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.6, useNativeDriver: true, speed: 40 }),
        Animated.timing(heartOpacity, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]).start();
    }
    lastTap.current = now;
  }, [liked, handleLike, heartOpacity, heartScale]);

  const handleSave = useCallback(async () => {
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      if (wasSaved) await savedService.unsave(post.id);
      else          await savedService.save(post.id);
    } catch { setSaved(wasSaved); }
  }, [saved, post.id]);

  // ── Não me interessa ────────────────────────────────────────────────────
  // Sem chamada de API (endpoint não existe). Persistido localmente no
  // AsyncStorage — o FeedScreen filtra os IDs ignorados ao carregar o feed.
  const handleNotInterested = useCallback(() => {
    const postId = post.id;
    addIgnoredPost(postId);
    collapseAndRemove(postId);
    onShowToast?.('Recomendaremos menos posts dessa pessoa.', {
      label: 'Desfazer',
      onPress: () => {
        removeIgnoredPost(postId);
        setDismissed(false);
        collapseAnim.setValue(1);
      },
    });
  }, [post.id, collapseAndRemove, collapseAnim, onShowToast]);

  // ── Ocultar post ────────────────────────────────────────────────────────
  const handleHidePost = useCallback(() => {
    setHidden(true);
    onShowToast?.('Post oculto.', {
      label: 'Desfazer',
      onPress: () => setHidden(false),
    });
  }, [onShowToast]);

  // ── Excluir (abre confirm modal) ────────────────────────────────────────
  const handleDeleteRequest = useCallback(() => {
    setSheetType('confirm_delete');
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await api.delete(`/posts/${post.id}`);
      collapseAndRemove(post.id);
      onShowToast?.('Post excluído.');
    } catch {
      onShowToast?.('Erro ao excluir o post.');
    }
  }, [post.id, collapseAndRemove, onShowToast]);

  // ── Denunciar ───────────────────────────────────────────────────────────
  const handleReport = useCallback(async (reason: string) => {
    try {
      await api.post('/reports', { type: 'post', targetId: post.id, reason }).catch(() => {});
    } finally {
      onShowToast?.('Denúncia enviada. Obrigado pelo feedback.');
    }
  }, [post.id, onShowToast]);

  const handleInvisible = useCallback(() => {
    onShowToast?.('Modo invisível disponível em breve.');
  }, [onShowToast]);

  // ── Compartilhar — card miniatura estilo Instagram ──────────────────────
  // Monta uma mensagem rica com nome do app, usuário, tipo de conteúdo e link
  const handleShare = useCallback(() => {
    const username  = post.user?.username || 'usuario';
    const postType  = post.postType === 'code'    ? '💻 Código'
                    : post.postType === 'project' ? '🚀 Projeto'
                    : post.mediaUrls?.length > 0  ? '📸 Foto'
                    : '✍️ Post';
    const caption   = post.caption
      ? post.caption.length > 100
        ? post.caption.slice(0, 100) + '...'
        : post.caption
      : '';
    const postLink  = `${APP_URL}/post/${post.id}`;

    const message = [
      `⚡ ${APP_NAME}`,
      ``,
      `${postType} de @${username}`,
      caption ? `"${caption}"` : '',
      ``,
      `Ver post: ${postLink}`,
    ].filter(Boolean).join('\n');

    Share.share({ message, url: postLink });
  }, [post]);

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR });

  if (dismissed) return null;

  return (
    <View style={{ position: 'relative' }}>
      <Animated.View style={{
        overflow: 'hidden',
        maxHeight: collapseAnim.interpolate({ inputRange: [0,1], outputRange: [0, 2000] }),
        opacity:   collapseAnim,
      }}>
        <View style={[styles.card, {
          backgroundColor:   isCode ? '#13131A' : theme.background,
          borderBottomColor: theme.border,
        }]}>

          {/* ── POST OCULTO ──────────────────────────────────────────── */}
          {hidden ? (
            <View style={[styles.hiddenRow, { borderBottomColor: theme.border }]}>
              <Ionicons name="eye-off-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.hiddenText, { color: theme.textSecondary }]}>Post oculto</Text>
              <TouchableOpacity onPress={() => setHidden(false)} activeOpacity={0.7}>
                <Text style={[styles.undoText, { color: theme.primary }]}>Desfazer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ── PROJETO ─────────────────────────────────────────── */}
              {isProject ? (
                <View style={{ padding: 14 }}>
                  <ProjectCard post={post} />
                  <View style={styles.actions}>
                    <View style={styles.leftActions}>
                      <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
                        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? LIKE_COLOR : theme.textSecondary} />
                        </Animated.View>
                        {likes > 0 && <Text style={styles.actionCount}>{likes >= 1000 ? `${(likes/1000).toFixed(1)}k` : likes}</Text>}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
                      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? theme.primary : theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {/* ── HEADER ──────────────────────────────────────── */}
                  <TouchableOpacity style={styles.header} onPress={goToProfile} activeOpacity={0.8}>
                    <Avatar uri={post.user?.avatarUrl} name={post.user?.displayName || post.user?.username} size={38} presenceStatus={post.user?.presenceStatus ?? null} />
                    <View style={styles.meta}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.username, { color: theme.text }]}>
                          {post.user?.displayName || post.user?.username}
                        </Text>
                        {post.user?.isVerified && <Ionicons name="checkmark-circle" size={14} color="#06B6D4" />}
                        {isCode && (
                          <View style={styles.codeBadge}>
                            <Ionicons name="code-slash" size={10} color="#CBA6F7" />
                            <Text style={styles.codeBadgeText}>código</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.time, { color: theme.textSecondary }]}>
                        @{post.user?.username} · {timeAgo}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.moreBtn, {
                        backgroundColor: theme.surfaceHigh,
                        borderWidth: 1,
                        borderColor: theme.primary + '33',
                      }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setSheetType('options')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {/* ── CONTEÚDO ────────────────────────────────────── */}
                  {isCode ? (
                    <CodeBlock caption={post.caption || ''} />
                  ) : (
                    <>
                      {post.caption ? (
                        <RichText text={post.caption} style={[styles.caption, { color: theme.text }]} />
                      ) : null}
                      {post.mediaUrls?.length > 0 && (
                        <TouchableOpacity activeOpacity={1} onPress={handleDoubleTap} style={styles.mediaContainer}>
                          <Image source={{ uri: post.mediaUrls[0] }} style={styles.media} resizeMode="cover" />
                          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)']} style={StyleSheet.absoluteFillObject} />
                          <Animated.View style={[styles.floatingHeart, { opacity: heartOpacity, transform: [{ scale: heartScale }] }]}>
                            <Ionicons name="heart" size={72} color="#fff" />
                          </Animated.View>
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  {/* ── ACTIONS ─────────────────────────────────────── */}
                  <View style={styles.actions}>
                    <View style={styles.leftActions}>
                      <TouchableOpacity onPress={handleLike} style={styles.actionBtn} activeOpacity={0.7}>
                        <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? LIKE_COLOR : theme.textSecondary} />
                        </Animated.View>
                        {likes > 0 && (
                          <Text style={[styles.actionCount, { color: liked ? LIKE_COLOR : theme.textSecondary }]}>
                            {likes >= 1000 ? `${(likes/1000).toFixed(1)}k` : likes}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                        <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
                        {(post.commentsCount ?? 0) > 0 && (
                          <Text style={[styles.actionCount, { color: theme.textSecondary }]}>{post.commentsCount}</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.7}>
                        <Ionicons name="arrow-redo-outline" size={20} color={theme.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
                      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? theme.primary : theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}
        </View>
      </Animated.View>

      {/* Overlay sheet */}
      <OverlaySheet
        type={sheetType}
        isDark={isDark}
        theme={theme}
        isOwn={isOwnPost}
        onClose={() => setSheetType(null)}
        onNotInterested={handleNotInterested}
        onHidePost={handleHidePost}
        onDelete={handleDeleteRequest}
        onShare={handleShare}
        onInvisible={handleInvisible}
        onOpenReport={() => setSheetType('report')}
        onReport={handleReport}
        onConfirmDelete={handleConfirmDelete}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  card:          { borderBottomWidth: StyleSheet.hairlineWidth },
  hiddenRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  hiddenText:    { flex: 1, fontSize: 13 },
  undoText:      { fontSize: 13, fontWeight: '600' },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  meta:          { flex: 1 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username:      { fontSize: 14, fontWeight: '700' },
  time:          { fontSize: 11, marginTop: 2 },
  moreBtn:       { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#2D1B69', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  codeBadgeText: { color: '#CBA6F7', fontSize: 9, fontWeight: '700' },
  caption:       { paddingHorizontal: 14, paddingBottom: 10, fontSize: 14, lineHeight: 21 },
  mediaContainer:{ width, height: width * 0.85, overflow: 'hidden', position: 'relative' },
  media:         { width: '100%', height: '100%' },
  floatingHeart: { position: 'absolute', top: '35%', left: '38%', zIndex: 10 },
  actions:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  leftActions:   { flexDirection: 'row', gap: 20, alignItems: 'center' },
  actionBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount:   { fontSize: 13, fontWeight: '700', color: '#111111' },
});
