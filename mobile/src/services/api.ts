import axios from "axios";

const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  return "http://192.168.4.46:3000/api/v1";
};

const API_URL = getApiUrl();

// Erros conhecidos que não precisam de log
const SILENT_ERRORS = [
  'property bannerGradient should not exist',
  'property showLikesCount should not exist',
];

const isSilent = (msg: string) => SILENT_ERRORS.some(e => msg?.includes(e));

const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (typeof localStorage !== "undefined") return localStorage.getItem(key);
      const { getItemAsync } = await import("expo-secure-store");
      return await getItemAsync(key);
    } catch { return null; }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== "undefined") { localStorage.setItem(key, value); return; }
      const { setItemAsync } = await import("expo-secure-store");
      await setItemAsync(key, value);
    } catch {}
  },
  async delete(key: string): Promise<void> {
    try {
      if (typeof localStorage !== "undefined") { localStorage.removeItem(key); return; }
      const { deleteItemAsync } = await import("expo-secure-store");
      await deleteItemAsync(key);
    } catch {}
  },
};

export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await storage.get("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const msg = Array.isArray(error.response?.data?.message)
      ? error.response.data.message.join(', ')
      : error.response?.data?.message || error.message;

    // Silenciar erros conhecidos e não críticos
    if (!isSilent(msg) && status !== 401) {
      console.error("[API Error]", status, url, msg);
    }

    const original = error.config;
    if (status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = await storage.get("refreshToken");
        if (!refresh) throw new Error("no refresh token");
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: refresh });
        await storage.set("accessToken", data.accessToken);
        await storage.set("refreshToken", data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        await storage.delete("accessToken");
        await storage.delete("refreshToken");
      }
    }
    return Promise.reject(error);
  }
);

export { storage };
