import { api } from './api';

export const postsService = {
  async create(caption: string, mediaUrls: string[] = [], mediaType = 'text', postType = 'text') {
    const { data } = await api.post('/posts', { caption, mediaUrls, mediaType, postType });
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

  // ── Upload de mídia ────────────────────────────────────────────────────────
  // Envia o arquivo para o backend que faz upload direto no Supabase
  async uploadMedia(
    localUri: string,
    folder: 'avatars' | 'posts' | 'covers' | 'stories',
  ): Promise<string> {
    const uriParts  = localUri.split('.');
    const ext       = uriParts[uriParts.length - 1].split('?')[0].toLowerCase() || 'jpg';
    const safeExt   = ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext) ? ext : 'jpg';
    const mimeType  = safeExt === 'jpg' || safeExt === 'jpeg' ? 'image/jpeg'
                    : safeExt === 'png'  ? 'image/png'
                    : safeExt === 'webp' ? 'image/webp'
                    : 'image/jpeg';

    const formData = new FormData();
    formData.append('file', {
      uri:  localUri,
      name: `upload.${safeExt}`,
      type: mimeType,
    } as any);
    formData.append('folder', folder);

    const { data } = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return data.publicUrl;
  },

  // Mantido para compatibilidade com MinIO local em dev
  async getUploadUrl(folder: 'avatars' | 'posts' | 'covers' | 'stories', ext: string) {
    const { data } = await api.post('/media/upload-url', { folder, ext });
    return data;
  },
};
