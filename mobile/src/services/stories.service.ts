import { api } from "./api";

export const storiesService = {
  async getFeed() {
    const { data } = await api.get("/stories/feed");
    return data;
  },
  async create(mediaUrl: string, caption?: string) {
    const { data } = await api.post("/stories", { mediaUrl, caption });
    return data;
  },
  async markViewed(storyId: string) {
    await api.post(`/stories/${storyId}/view`).catch(() => {});
  },
  async delete(id: string) {
    await api.delete(`/stories/${id}`);
  },
};
