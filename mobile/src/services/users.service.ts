import { api } from './api';

export const usersService = {
  async getProfile(username: string) {
    const { data } = await api.get(`/users/${username}`);
    return data;
  },

  async updateMe(updates: { displayName?: string; bio?: string; avatarUrl?: string; coverUrl?: string }) {
    const { data } = await api.patch('/users/me', updates);
    return data;
  },

  async follow(userId: string) {
    const { data } = await api.post(`/follows/${userId}`);
    return data;
  },

  async unfollow(userId: string) {
    const { data } = await api.delete(`/follows/${userId}`);
    return data;
  },

  async getFollowers(userId: string, page = 1) {
    const { data } = await api.get(`/follows/${userId}/followers?page=${page}`);
    return data;
  },

  async getFollowing(userId: string, page = 1) {
    const { data } = await api.get(`/follows/${userId}/following?page=${page}`);
    return data;
  },
};
