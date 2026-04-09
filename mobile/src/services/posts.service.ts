import { api } from './api';

export const postsService = {
  async create(caption: string, mediaUrls: string[] = [], mediaType = 'text') {
    const { data } = await api.post('/posts', { caption, mediaUrls, mediaType });
    return data;
  },

  async getFeed(page = 1) {
    const { data } = await api.get(`/feed?page=${page}`);
    return data;
  },

  async getByUser(username: string, page = 1) {
    const { data } = await api.get(`/posts/user/${username}?page=${page}`);
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/posts/${id}`);
    return data;
  },

  async delete(id: string) {
    await api.delete(`/posts/${id}`);
  },

  async like(postId: string) {
    const { data } = await api.post(`/likes/${postId}`);
    return data;
  },

  async unlike(postId: string) {
    const { data } = await api.delete(`/likes/${postId}`);
    return data;
  },

  async comment(postId: string, content: string) {
    const { data } = await api.post(`/comments/${postId}`, { content });
    return data;
  },

  async getComments(postId: string, page = 1) {
    const { data } = await api.get(`/comments/${postId}?page=${page}`);
    return data;
  },

  async getUploadUrl(folder: 'avatars' | 'posts' | 'covers', ext: string) {
    const { data } = await api.post('/media/upload-url', { folder, ext });
    return data;
  },
};
