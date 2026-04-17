import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Theme, darkTheme, lightTheme, ALL_THEMES, ALL_PALETTES,
} from "../theme";

export type SupportedLocale = "pt-BR" | "en-US" | "es-ES";

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
  "es-ES": "Español",
};

interface ThemeState {
  isDark:     boolean;
  themeId:    string;   // id da família (ex: "midnight")
  paletteId:  string;   // id da paleta individual (ex: "auroraDark")
  theme:      Theme;
  locale:     SupportedLocale;

  // Actions
  toggle:         () => void;
  setDark:        (v: boolean) => void;
  setThemeId:     (id: string) => void;
  setPaletteId:   (paletteId: string) => void; // ← nova: seleciona 1 das 22
  setLocale:      (locale: SupportedLocale) => void;
  resetToDefault: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark:    true,
      themeId:   "midnight",
      paletteId: "midnight",
      theme:     darkTheme,
      locale:    "pt-BR",

      // Toggle dark/light — mantém a família, troca o modo
      toggle: () => {
        const { isDark, themeId } = get();
        const next  = !isDark;
        const found = ALL_THEMES.find(t => t.id === themeId);
        const newTheme = next
          ? (found?.dark  ?? darkTheme)
          : (found?.light ?? lightTheme);
        set({
          isDark:    next,
          theme:     newTheme,
          paletteId: newTheme.id,
        });
      },

      setDark: (isDark) => {
        const { themeId } = get();
        const found = ALL_THEMES.find(t => t.id === themeId);
        const newTheme = isDark
          ? (found?.dark  ?? darkTheme)
          : (found?.light ?? lightTheme);
        set({ isDark, theme: newTheme, paletteId: newTheme.id });
      },

      // Seleciona família — respeita o modo atual
      setThemeId: (id) => {
        const { isDark } = get();
        const found = ALL_THEMES.find(t => t.id === id);
        if (!found) return;
        const newTheme = isDark ? found.dark : found.light;
        set({ themeId: id, theme: newTheme, paletteId: newTheme.id });
      },

      // ── Nova action: seleciona qualquer uma das 22 paletas diretamente ──
      // Atualiza isDark e themeId automaticamente conforme a paleta escolhida
      setPaletteId: (paletteId) => {
        const entry = ALL_PALETTES.find(p => p.paletteId === paletteId);
        if (!entry) return;
        set({
          paletteId,
          themeId: entry.familyId,
          isDark:  entry.isDark,
          theme:   entry.theme,
        });
      },

      setLocale: (locale) => set({ locale }),

      resetToDefault: () => set({
        themeId:   "midnight",
        paletteId: "midnight",
        isDark:    true,
        theme:     darkTheme,
      }),
    }),
    {
      name:    "minha-rede-theme",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isDark:    state.isDark,
        themeId:   state.themeId,
        paletteId: state.paletteId,
        locale:    state.locale,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Tenta restaurar pela paletteId primeiro (mais preciso)
        const entry = ALL_PALETTES.find(p => p.paletteId === state.paletteId);
        if (entry) {
          state.theme  = entry.theme;
          state.isDark = entry.isDark;
          return;
        }
        // Fallback pela família
        const found = ALL_THEMES.find(t => t.id === state.themeId);
        if (found) {
          state.theme = state.isDark ? found.dark : found.light;
        }
      },
    }
  )
);
