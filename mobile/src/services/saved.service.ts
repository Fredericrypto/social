import { api } from './api';

export const savedService = {
  async getMySaved(page = 1) {
    const { data } = await api.get(`/saved?page=${page}`);
    return data;
  },

  async save(postId: string) {
    const { data } = await api.post(`/saved/${postId}`);
    return data;
  },

  async unsave(postId: string) {
    const { data } = await api.delete(`/saved/${postId}`);
    return data;
  },
};
