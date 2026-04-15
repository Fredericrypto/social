// theme.ts — 15 paletas elite para "Minha Rede"
// Cada paleta tem versão dark (profunda) e light (pastel/neutra sofisticada)

export interface Theme {
  id: string;
  background: string;
  surface: string;
  surfaceHigh: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryLight: string;
  error: string;
  success: string;
}

// ─── DARK THEMES ─────────────────────────────────────────────────────────────

export const darkTheme: Theme = {
  id: "midnight",
  background:   "#0A0A0F",
  surface:      "#13131A",
  surfaceHigh:  "#1C1C27",
  border:       "rgba(255,255,255,0.07)",
  text:         "#F0F0F5",
  textSecondary:"rgba(240,240,245,0.5)",
  textTertiary: "rgba(240,240,245,0.28)",
  primary:      "#7C3AED",
  primaryLight: "#A78BFA",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const deepOceanDark: Theme = {
  id: "deepOceanDark",
  background:   "#040D18",
  surface:      "#091525",
  surfaceHigh:  "#0F2035",
  border:       "rgba(14,165,233,0.1)",
  text:         "#E0F2FE",
  textSecondary:"rgba(224,242,254,0.5)",
  textTertiary: "rgba(224,242,254,0.28)",
  primary:      "#0EA5E9",
  primaryLight: "#38BDF8",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const desertDustDark: Theme = {
  id: "desertDustDark",
  background:   "#0F0B07",
  surface:      "#1C1408",
  surfaceHigh:  "#271D0C",
  border:       "rgba(217,119,6,0.1)",
  text:         "#FEF3C7",
  textSecondary:"rgba(254,243,199,0.5)",
  textTertiary: "rgba(254,243,199,0.28)",
  primary:      "#D97706",
  primaryLight: "#FBBF24",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const forestMistDark: Theme = {
  id: "forestMistDark",
  background:   "#050F09",
  surface:      "#091A0E",
  surfaceHigh:  "#0D2415",
  border:       "rgba(16,185,129,0.1)",
  text:         "#D1FAE5",
  textSecondary:"rgba(209,250,229,0.5)",
  textTertiary: "rgba(209,250,229,0.28)",
  primary:      "#10B981",
  primaryLight: "#34D399",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const midnightGoldDark: Theme = {
  id: "midnightGoldDark",
  background:   "#0A0800",
  surface:      "#161000",
  surfaceHigh:  "#211800",
  border:       "rgba(234,179,8,0.1)",
  text:         "#FEFCE8",
  textSecondary:"rgba(254,252,232,0.5)",
  textTertiary: "rgba(254,252,232,0.28)",
  primary:      "#EAB308",
  primaryLight: "#FDE047",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const obsidianRoseDark: Theme = {
  id: "obsidianRoseDark",
  background:   "#0F0508",
  surface:      "#1C0A10",
  surfaceHigh:  "#270F17",
  border:       "rgba(244,63,94,0.1)",
  text:         "#FFE4E6",
  textSecondary:"rgba(255,228,230,0.5)",
  textTertiary: "rgba(255,228,230,0.28)",
  primary:      "#F43F5E",
  primaryLight: "#FB7185",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const auroraDark: Theme = {
  id: "auroraDark",
  background:   "#060312",
  surface:      "#0D0720",
  surfaceHigh:  "#140C2E",
  border:       "rgba(139,92,246,0.1)",
  text:         "#EDE9FE",
  textSecondary:"rgba(237,233,254,0.5)",
  textTertiary: "rgba(237,233,254,0.28)",
  primary:      "#8B5CF6",
  primaryLight: "#A78BFA",
  error:        "#EF4444",
  success:      "#22C55E",
};

export const slateDark: Theme = {
  id: "slateDark",
  background:   "#080C12",
  surface:      "#0F1520",
  surfaceHigh:  "#182030",
  border:       "rgba(100,116,139,0.12)",
  text:         "#F1F5F9",
  textSecondary:"rgba(241,245,249,0.5)",
  textTertiary: "rgba(241,245,249,0.28)",
  primary:      "#64748B",
  primaryLight: "#94A3B8",
  error:        "#EF4444",
  success:      "#22C55E",
};

// ─── LIGHT THEMES ────────────────────────────────────────────────────────────

export const lightTheme: Theme = {
  id: "pearl",
  background:   "#F8F7FF",
  surface:      "#FFFFFF",
  surfaceHigh:  "#EEF0FF",
  border:       "rgba(0,0,0,0.08)",
  text:         "#0F0E1A",
  textSecondary:"rgba(15,14,26,0.5)",
  textTertiary: "rgba(15,14,26,0.3)",
  primary:      "#7C3AED",
  primaryLight: "#6D28D9",
  error:        "#DC2626",
  success:      "#16A34A",
};

export const saltFlatLight: Theme = {
  id: "saltFlatLight",
  background:   "#FAFAF8",
  surface:      "#FFFFFF",
  surfaceHigh:  "#F0EFE8",
  border:       "rgba(0,0,0,0.07)",
  text:         "#1A1A14",
  textSecondary:"rgba(26,26,20,0.5)",
  textTertiary: "rgba(26,26,20,0.3)",
  primary:      "#78716C",
  primaryLight: "#57534E",
  error:        "#DC2626",
  success:      "#16A34A",
};

export const alabasterLight: Theme = {
  id: "alabasterLight",
  background:   "#FAF8F5",
  surface:      "#FFFFFF",
  surfaceHigh:  "#F0ECE4",
  border:       "rgba(0,0,0,0.07)",
  text:         "#1C1917",
  textSecondary:"rgba(28,25,23,0.5)",
  textTertiary: "rgba(28,25,23,0.3)",
  primary:      "#D97706",
  primaryLight: "#B45309",
  error:        "#DC2626",
  success:      "#16A34A",
};

export const seafoamLight: Theme = {
  id: "seafoamLight",
  background:   "#F0FDF8",
  surface:      "#FFFFFF",
  surfaceHigh:  "#DCFCE7",
  border:       "rgba(0,0,0,0.07)",
  text:         "#052E16",
  textSecondary:"rgba(5,46,22,0.5)",
  textTertiary: "rgba(5,46,22,0.3)",
  primary:      "#059669",
  primaryLight: "#047857",
  error:        "#DC2626",
  success:      "#16A34A",
};

export const roseQuartzLight: Theme = {
  id: "roseQuartzLight",
  background:   "#FFF5F7",
  surface:      "#FFFFFF",
  surfaceHigh:  "#FFE4E8",
  border:       "rgba(0,0,0,0.07)",
  text:         "#1F0A10",
  textSecondary:"rgba(31,10,16,0.5)",
  textTertiary: "rgba(31,10,16,0.3)",
  primary:      "#E11D48",
  primaryLight: "#BE123C",
  error:        "#DC2626",
  success:      "#16A34A",
};

export const iceBlueLight: Theme = {
  id: "iceBlueLight",
  background:   "#F0F8FF",
  surface:      "#FFFFFF",
  surfaceHigh:  "#DBEAFE",
  border:       "rgba(0,0,0,0.07)",
  text:         "#0C1A2E",
  textSecondary:"rgba(12,26,46,0.5)",
  textTertiary: "rgba(12,26,46,0.3)",
  primary:      "#2563EB",
  primaryLight: "#1D4ED8",
  error:        "#DC2626",
  success:      "#16A34A",
};

export const lavenderMistLight: Theme = {
  id: "lavenderMistLight",
  background:   "#FAF5FF",
  surface:      "#FFFFFF",
  surfaceHigh:  "#EDE9FE",
  border:       "rgba(0,0,0,0.07)",
  text:         "#1E0A2E",
  textSecondary:"rgba(30,10,46,0.5)",
  textTertiary: "rgba(30,10,46,0.3)",
  primary:      "#7C3AED",
  primaryLight: "#6D28D9",
  error:        "#DC2626",
  success:      "#16A34A",
};

// ─── CATÁLOGO PÚBLICO ────────────────────────────────────────────────────────

export const ALL_THEMES: { id: string; label: string; dark: Theme; light: Theme }[] = [
  { id: "midnight",      label: "Midnight",       dark: darkTheme,         light: lightTheme        },
  { id: "deepOcean",     label: "Deep Ocean",     dark: deepOceanDark,     light: iceBlueLight      },
  { id: "desertDust",    label: "Desert Dust",    dark: desertDustDark,    light: alabasterLight    },
  { id: "forestMist",    label: "Forest Mist",    dark: forestMistDark,    light: seafoamLight      },
  { id: "midnightGold",  label: "Midnight Gold",  dark: midnightGoldDark,  light: saltFlatLight     },
  { id: "obsidianRose",  label: "Obsidian Rose",  dark: obsidianRoseDark,  light: roseQuartzLight   },
  { id: "aurora",        label: "Aurora",         dark: auroraDark,        light: lavenderMistLight },
  { id: "slate",         label: "Slate",          dark: slateDark,         light: saltFlatLight     },
];
