import { api } from './api';
import { io, Socket } from 'socket.io-client';
import { storage } from './api';

const SOCKET_URL = 'http://192.168.4.46:3000/messages';
let socket: Socket | null = null;

export const messagesService = {
  async getConversations() {
    const { data } = await api.get('/messages/conversations');
    return data;
  },

  async startConversation(userId: string) {
    const { data } = await api.post('/messages/conversations', { userId });
    return data;
  },

  async getMessages(conversationId: string, page = 1) {
    const { data } = await api.get(`/messages/conversations/${conversationId}?page=${page}`);
    return data;
  },

  async sendMessageHttp(conversationId: string, content: string) {
    const { data } = await api.post(`/messages/conversations/${conversationId}`, { content });
    return data;
  },

  async getUnreadCount() {
    const { data } = await api.get('/messages/unread-count');
    return data;
  },

  async connectSocket(): Promise<Socket> {
    if (socket?.connected) return socket;
    const token = await storage.get('accessToken');
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
    });
    return socket;
  },

  getSocket() { return socket; },

  disconnectSocket() {
    socket?.disconnect();
    socket = null;
  },
};
