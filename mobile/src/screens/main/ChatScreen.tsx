import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, StatusBar,
  Animated, Alert, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../services/api';
import { socketService } from '../../services/socket.service';
import Avatar from '../../components/ui/Avatar';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Message {
  id:          string;
  senderId:    string;
  content:     string;
  createdAt:   string;
  readAt?:     string | null;
  reaction?:   string | null;
  isDeleted?:  boolean;
}

// ─── Emojis de reação ─────────────────────────────────────────────────────────
const REACTIONS = ['❤️', '😂', '😮', '😢', '👏', '🔥'];

// ─── Helpers de data ──────────────────────────────────────────────────────────
function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  return format(d, 'HH:mm');
}

function formatDayDivider(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d))     return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM", { locale: ptBR });
}

function shouldShowDivider(msgs: Message[], index: number) {
  if (index === 0) return true;
  const prev = new Date(msgs[index - 1].createdAt);
  const curr = new Date(msgs[index].createdAt);
  return prev.toDateString() !== curr.toDateString();
}

// ─── Componente de balão ──────────────────────────────────────────────────────
function MessageBubble({
  msg, isMe, showAvatar, other, theme,
  onLongPress, onDoubleTap,
}: {
  msg: Message; isMe: boolean; showAvatar: boolean;
  other: any; theme: any;
  onLongPress: (msg: Message) => void;
  onDoubleTap: (msg: Message) => void;
}) {
  const lastTap   = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap — reagir com ❤️
      onDoubleTap(msg);
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true, speed: 50 }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 30 }),
      ]).start();
    }
    lastTap.current = now;
  };

  if (msg.isDeleted) {
    return (
      <View style={[b.row, isMe ? b.rowMe : b.rowOther]}>
        {!isMe && <View style={{ width: 28 }} />}
        <View style={[b.bubble, b.deleted, { borderColor: theme.border }]}>
          <Text style={[b.deletedText, { color: theme.textTertiary }]}>
            Mensagem apagada
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[b.row, isMe ? b.rowMe : b.rowOther]}>
      {/* Avatar do outro (agrupa mensagens consecutivas) */}
      {!isMe && (
        <View style={{ width: 28, alignSelf: 'flex-end', marginBottom: msg.reaction ? 16 : 0 }}>
          {showAvatar ? (
            <Avatar uri={other?.avatarUrl} name={other?.displayName} size={26} />
          ) : null}
        </View>
      )}

      <View style={b.bubbleWrap}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            onPress={handleTap}
            onLongPress={() => onLongPress(msg)}
            activeOpacity={0.85}
            delayLongPress={380}
          >
            {isMe ? (
              <LinearGradient
                colors={[theme.primary, theme.primaryLight]}
                style={[b.bubble, b.bubbleMe]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <Text style={b.textMe}>{msg.content}</Text>
              </LinearGradient>
            ) : (
              <View style={[b.bubble, b.bubbleOther, { backgroundColor: theme.surfaceHigh }]}>
                <Text style={[b.textOther, { color: theme.text }]}>{msg.content}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Reaction badge */}
        {msg.reaction && (
          <View style={[b.reactionBadge, isMe ? b.reactionBadgeMe : b.reactionBadgeOther]}>
            <Text style={b.reactionEmoji}>{msg.reaction}</Text>
          </View>
        )}

        {/* Timestamp + read receipt */}
        <View style={[b.meta, isMe ? b.metaMe : b.metaOther]}>
          <Text style={[b.time, { color: theme.textTertiary }]}>
            {formatMsgTime(msg.createdAt)}
          </Text>
          {isMe && (
            <Ionicons
              name={msg.readAt ? "checkmark-done" : "checkmark"}
              size={12}
              color={msg.readAt ? theme.primary : theme.textTertiary}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  row:           { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2, paddingHorizontal: 14 },
  rowMe:         { justifyContent: 'flex-end' },
  rowOther:      { justifyContent: 'flex-start' },
  bubbleWrap:    { maxWidth: '75%', gap: 2 },
  bubble:        { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe:      { borderBottomRightRadius: 4 },
  bubbleOther:   { borderBottomLeftRadius: 4 },
  deleted:       { borderWidth: 1, backgroundColor: 'transparent' },
  deletedText:   { fontSize: 13, fontStyle: 'italic' },
  textMe:        { color: '#fff', fontSize: 15, lineHeight: 21 },
  textOther:     { fontSize: 15, lineHeight: 21 },
  reactionBadge: { position: 'absolute', bottom: 18, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', elevation: 2 },
  reactionBadgeMe:    { right: -8 },
  reactionBadgeOther: { left: -8 },
  reactionEmoji: { fontSize: 13 },
  meta:          { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  metaMe:        { justifyContent: 'flex-end' },
  metaOther:     { justifyContent: 'flex-start' },
  time:          { fontSize: 10 },
});

// ─── ChatScreen ───────────────────────────────────────────────────────────────
export default function ChatScreen({ route, navigation }: any) {
  const { conversation, other } = route.params;
  const { theme, isDark } = useThemeStore();
  const { user }          = useAuthStore();
  const insets            = useSafeAreaInsets();

  const [messages,     setMessages]     = useState<Message[]>([]);
  const [input,        setInput]        = useState('');
  const [otherTyping,  setOtherTyping]  = useState(false);
  const [loading,      setLoading]      = useState(true);
  // Modal de ações na mensagem
  const [selectedMsg,  setSelectedMsg]  = useState<Message | null>(null);
  const [reactionModal, setReactionModal] = useState(false);

  const flatRef      = useRef<FlatList>(null);
  const typingTimer  = useRef<any>(null);
  const isTyping     = useRef(false);

  // ── Carregar mensagens ──────────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const { data } = await api.get(`/messages/conversations/${conversation.id}`);
      setMessages(data.messages || data || []);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
    finally { setLoading(false); }
  }, [conversation.id]);

  // ── Socket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMessages();

    const socket = socketService.connect();
    if (!socket) return;

    socket.emit('join_room', { conversationId: conversation.id });

    const unsubMsg = socketService.onNewMessage((msg: any) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    });

    socket.on('user_typing', ({ isTyping: t }: any) => setOtherTyping(t));

    return () => {
      socket.emit('leave_room', { conversationId: conversation.id });
      unsubMsg();
      socket.off('user_typing');
    };
  }, [conversation.id, loadMessages]);

  // ── Enviar mensagem ────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setInput('');

    // Optimistic
    const tempMsg: Message = {
      id:        `temp-${Date.now()}`,
      senderId:  user?.id || '',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 60);

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('send_message', { conversationId: conversation.id, content });
    } else {
      try {
        const { data } = await api.post(`/messages/conversations/${conversation.id}`, { content });
        setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m));
      } catch {
        setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      }
    }
  }, [input, conversation.id, user?.id]);

  // ── Typing indicator ───────────────────────────────────────────────────
  const handleTyping = (text: string) => {
    setInput(text);
    const socket = socketService.getSocket();
    if (!socket) return;
    if (!isTyping.current) {
      isTyping.current = true;
      socket.emit('typing', { conversationId: conversation.id, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      socket.emit('typing', { conversationId: conversation.id, isTyping: false });
    }, 1500);
  };

  // ── Double tap — react ❤️ ──────────────────────────────────────────────
  const handleDoubleTap = useCallback((msg: Message) => {
    const newReaction = msg.reaction === '❤️' ? null : '❤️';
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reaction: newReaction } : m));
    // Opcional: persistir reação via API
  }, []);

  // ── Long press — menu de ações ─────────────────────────────────────────
  const handleLongPress = useCallback((msg: Message) => {
    setSelectedMsg(msg);
    setReactionModal(true);
  }, []);

  const applyReaction = (emoji: string) => {
    if (!selectedMsg) return;
    const newReaction = selectedMsg.reaction === emoji ? null : emoji;
    setMessages(prev => prev.map(m => m.id === selectedMsg.id ? { ...m, reaction: newReaction } : m));
    setReactionModal(false);
    setSelectedMsg(null);
  };

  const deleteMessage = (forEveryone: boolean) => {
    if (!selectedMsg) return;
    setMessages(prev => prev.map(m =>
      m.id === selectedMsg.id ? { ...m, isDeleted: true, content: '' } : m
    ));
    setReactionModal(false);
    setSelectedMsg(null);
    // api.delete(`/messages/${selectedMsg.id}?forEveryone=${forEveryone}`)
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const isMe = (msg: Message) => msg.senderId === user?.id;

  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const mine       = isMe(item);
    const showAvatar = !mine && (index === 0 || messages[index - 1]?.senderId !== item.senderId);
    const showDay    = shouldShowDivider(messages, index);

    return (
      <View>
        {showDay && (
          <View style={t.dayDivider}>
            <Text style={[t.dayText, { color: theme.textTertiary }]}>
              {formatDayDivider(item.createdAt)}
            </Text>
          </View>
        )}
        <MessageBubble
          msg={item}
          isMe={mine}
          showAvatar={showAvatar}
          other={other}
          theme={theme}
          onLongPress={handleLongPress}
          onDoubleTap={handleDoubleTap}
        />
      </View>
    );
  }, [messages, other, theme, handleLongPress, handleDoubleTap]);

  return (
    <View style={[t.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* Header */}
      <View style={[t.header, { paddingTop: insets.top + 8, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={t.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={t.headerCenter}
          onPress={() => other?.username && navigation.navigate('UserProfile', { username: other.username })}
          activeOpacity={0.8}
        >
          <Avatar uri={other?.avatarUrl} name={other?.displayName || other?.username} size={36} />
          <View>
            <Text style={[t.headerName, { color: theme.text }]}>
              {other?.displayName || other?.username}
            </Text>
            {otherTyping ? (
              <Text style={[t.typingText, { color: theme.primary }]}>digitando...</Text>
            ) : (
              <Text style={[t.headerSub, { color: theme.textTertiary }]}>@{other?.username}</Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[t.headerBtn, { backgroundColor: theme.surface }]}>
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.textTertiary, fontSize: 13 }}>Carregando...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 16, gap: 2 }}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={t.emptyChat}>
                <Text style={{ fontSize: 36 }}>👋</Text>
                <Text style={[t.emptyText, { color: theme.textSecondary }]}>
                  Diga olá para {other?.displayName || other?.username}
                </Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={[t.inputBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <View style={[t.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[t.input, { color: theme.text }]}
              placeholder="Mensagem..."
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={handleTyping}
              multiline
              maxLength={1000}
              returnKeyType="default"
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={input.trim() ? [theme.primary, theme.primaryLight] : [theme.surfaceHigh, theme.surfaceHigh]}
              style={t.sendBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="send" size={16} color={input.trim() ? '#fff' : theme.textTertiary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modal de reações + ações */}
      <Modal
        visible={reactionModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setReactionModal(false); setSelectedMsg(null); }}
      >
        <Pressable style={t.modalBackdrop} onPress={() => { setReactionModal(false); setSelectedMsg(null); }}>
          <Pressable style={[t.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>

            {/* Reações */}
            <View style={t.reactionsRow}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={[t.reactionBtn, selectedMsg?.reaction === emoji && { backgroundColor: theme.primary + "33" }]}
                  onPress={() => applyReaction(emoji)}
                >
                  <Text style={t.reactionBtnEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[t.modalDivider, { backgroundColor: theme.border }]} />

            {/* Ações */}
            <TouchableOpacity style={t.actionRow} onPress={() => { /* copy */ setReactionModal(false); }}>
              <Ionicons name="copy-outline" size={18} color={theme.text} />
              <Text style={[t.actionText, { color: theme.text }]}>Copiar</Text>
            </TouchableOpacity>

            {selectedMsg?.senderId === user?.id && (
              <>
                <TouchableOpacity style={t.actionRow} onPress={() => deleteMessage(false)}>
                  <Ionicons name="trash-outline" size={18} color={theme.error} />
                  <Text style={[t.actionText, { color: theme.error }]}>Apagar para mim</Text>
                </TouchableOpacity>
                <TouchableOpacity style={t.actionRow} onPress={() => deleteMessage(true)}>
                  <Ionicons name="trash" size={18} color={theme.error} />
                  <Text style={[t.actionText, { color: theme.error }]}>Apagar para todos</Text>
                </TouchableOpacity>
              </>
            )}

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const t = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:       { padding: 4 },
  headerCenter:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName:    { fontSize: 15, fontWeight: '700' },
  headerSub:     { fontSize: 11, marginTop: 1 },
  typingText:    { fontSize: 11, marginTop: 1 },
  headerBtn:     { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayDivider:    { alignItems: 'center', paddingVertical: 12 },
  dayText:       { fontSize: 11, fontWeight: '600' },
  emptyChat:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60, gap: 10 },
  emptyText:     { fontSize: 14, textAlign: 'center' },
  inputBar:      { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrap:     { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  input:         { fontSize: 15, lineHeight: 20 },
  sendBtn:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalCard:     { width: '100%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  reactionsRow:  { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 14, paddingHorizontal: 8 },
  reactionBtn:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reactionBtnEmoji: { fontSize: 24 },
  modalDivider:  { height: StyleSheet.hairlineWidth },
  actionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'transparent' },
  actionText:    { fontSize: 15, fontWeight: '500' },
});
