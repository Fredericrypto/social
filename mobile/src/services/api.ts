import axios from "axios";

// Detecta automaticamente o ambiente:
// - Com EXPO_PUBLIC_API_URL definido: usa ele (tunnel ou produção)
// - Sem variável: usa o IP local direto
const getApiUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log("[API] Usando URL do ambiente:", envUrl);
    return envUrl;
  }
  const localUrl = "http://192.168.4.46:3000/api/v1";
  console.log("[API] Usando IP local:", localUrl);
  return localUrl;
};

const API_URL = getApiUrl();

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
  console.log("[API Request]", config.method?.toUpperCase(), config.url);
  return config;
});

api.interceptors.response.use(
  (res) => {
    console.log("[API Response]", res.status, res.config.url);
    return res;
  },
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const msg = error.response?.data?.message;
    console.error("[API Error]", status, url, msg || error.message);

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
        console.error("[API] Refresh falhou:", refreshErr);
        await storage.delete("accessToken");
        await storage.delete("refreshToken");
      }
    }
    return Promise.reject(error);
  }
);

export { storage };
