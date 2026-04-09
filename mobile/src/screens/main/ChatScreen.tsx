import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../store/theme.store';
import { useAuthStore } from '../../store/auth.store';
import { messagesService } from '../../services/messages.service';
import Avatar from '../../components/ui/Avatar';

export default function ChatScreen({ route, navigation }: any) {
  const { conversation, other } = route.params;
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);

  useEffect(() => {
    loadMessages();
    setupSocket();
    return () => { messagesService.getSocket()?.off('new_message'); };
  }, []);

  const loadMessages = async () => {
    const data = await messagesService.getMessages(conversation.id);
    setMessages(data.messages);
  };

  const setupSocket = async () => {
    const socket = await messagesService.connectSocket();
    socket.emit('join_conversation', { conversationId: conversation.id });
    socket.on('new_message', (msg: any) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
    socket.on('user_typing', ({ isTyping }: any) => setOtherTyping(isTyping));
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const content = input.trim();
    setInput('');
    const socket = messagesService.getSocket();
    if (socket?.connected) {
      socket.emit('send_message', { conversationId: conversation.id, content });
    } else {
      const msg = await messagesService.sendMessageHttp(conversation.id, content);
      setMessages(prev => [...prev, msg]);
    }
  };

  const handleTyping = (text: string) => {
    setInput(text);
    const socket = messagesService.getSocket();
    if (!socket) return;
    if (!typing) {
      setTyping(true);
      socket.emit('typing', { conversationId: conversation.id, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setTyping(false);
      socket.emit('typing', { conversationId: conversation.id, isTyping: false });
    }, 1500);
  };

  const isMe = (msg: any) => msg.senderId === user?.id;

  const renderMessage = ({ item, index }: any) => {
    const mine = isMe(item);
    const showAvatar = !mine && (index === 0 || messages[index - 1]?.senderId !== item.senderId);

    return (
      <View style={[styles.msgRow, mine ? styles.msgRowMe : styles.msgRowOther]}>
        {!mine && (
          <View style={{ width: 28 }}>
            {showAvatar && <Avatar uri={other?.avatarUrl} name={other?.displayName} size={28} />}
          </View>
        )}
        {mine ? (
          <LinearGradient
            colors={['#7C3AED', '#6D28D9']}
            style={[styles.bubble, styles.bubbleMe]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          >
            <Text style={styles.bubbleTextMe}>{item.content}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.bubble, styles.bubbleOther, { backgroundColor: theme.surfaceHigh }]}>
            <Text style={[styles.bubbleTextOther, { color: theme.text }]}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Avatar uri={other?.avatarUrl} name={other?.displayName || other?.username} size={36} />
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.text }]}>
            {other?.displayName || other?.username}
          </Text>
          {otherTyping && (
            <Text style={[styles.typingText, { color: theme.primaryLight }]}>digitando...</Text>
          )}
        </View>
        <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.surface }]}>
          <Ionicons name="call-outline" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={i => i.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        />

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
          <TouchableOpacity style={[styles.attachBtn, { backgroundColor: theme.surface }]}>
            <Ionicons name="add" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.inputWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Mensagem..."
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={handleTyping}
              multiline
              maxLength={1000}
            />
          </View>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={input.trim() ? ['#7C3AED', '#6D28D9'] : [theme.surface, theme.surface]}
              style={styles.sendBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <Ionicons name="send" size={16} color={input.trim() ? '#fff' : theme.textSecondary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingTop: 52, paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 15, fontWeight: '700' },
  typingText: { fontSize: 11, marginTop: 1 },
  headerBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: 16, gap: 4 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  bubbleTextMe: { color: '#fff', fontSize: 15, lineHeight: 20 },
  bubbleTextOther: { fontSize: 15, lineHeight: 20 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1,
  },
  attachBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 100 },
  input: { fontSize: 15, lineHeight: 20 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
