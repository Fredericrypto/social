import { api, storage } from "./api";

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post("/auth/login", { email, password });
    await storage.set("accessToken", data.accessToken);
    await storage.set("refreshToken", data.refreshToken);
    return data;
  },

  async register(email: string, username: string, password: string, displayName?: string) {
    const { data } = await api.post("/auth/register", { email, username, password, displayName });
    await storage.set("accessToken", data.accessToken);
    await storage.set("refreshToken", data.refreshToken);
    return data;
  },

  async logout() {
    try { await api.post("/auth/logout"); } catch {}
    await storage.delete("accessToken");
    await storage.delete("refreshToken");
  },

  async getMe() {
    const { data } = await api.get("/users/me");
    return data;
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await storage.get("accessToken");
    return !!token;
  },
};
