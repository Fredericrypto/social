// theme.ts — 22 paletas independentes para "Minha Rede"
// Cada paleta é uma entrada única no seletor — dark e light separados
// Dark: fundos profundos e iluminados | Light: saturados e distintos

export interface Theme {
  id:            string;
  background:    string;
  surface:       string;
  surfaceHigh:   string;
  border:        string;
  text:          string;
  textSecondary: string;
  textTertiary:  string;
  primary:       string;
  primaryLight:  string;
  error:         string;
  success:       string;
}

// ─── 11 paletas DARK ──────────────────────────────────────────────────────────

export const darkTheme: Theme = {
  id: "midnight", background: "#0E0E16", surface: "#17172A", surfaceHigh: "#21213A",
  border: "rgba(255,255,255,0.08)", text: "#F0F0F8",
  textSecondary: "rgba(240,240,248,0.52)", textTertiary: "rgba(240,240,248,0.28)",
  primary: "#7C3AED", primaryLight: "#A78BFA", error: "#EF4444", success: "#22C55E",
};

export const auroraDark: Theme = {
  id: "auroraDark", background: "#0A0518", surface: "#130B28", surfaceHigh: "#1C1238",
  border: "rgba(167,139,250,0.1)", text: "#EDE9FE",
  textSecondary: "rgba(237,233,254,0.52)", textTertiary: "rgba(237,233,254,0.28)",
  primary: "#8B5CF6", primaryLight: "#A78BFA", error: "#EF4444", success: "#22C55E",
};

export const deepOceanDark: Theme = {
  id: "deepOceanDark", background: "#091520", surface: "#0F2235", surfaceHigh: "#163048",
  border: "rgba(56,189,248,0.1)", text: "#E0F2FE",
  textSecondary: "rgba(224,242,254,0.52)", textTertiary: "rgba(224,242,254,0.28)",
  primary: "#0EA5E9", primaryLight: "#38BDF8", error: "#EF4444", success: "#22C55E",
};

export const cobaltDark: Theme = {
  id: "cobaltDark", background: "#080E1C", surface: "#0F1830", surfaceHigh: "#172244",
  border: "rgba(99,102,241,0.12)", text: "#EEF2FF",
  textSecondary: "rgba(238,242,255,0.52)", textTertiary: "rgba(238,242,255,0.28)",
  primary: "#6366F1", primaryLight: "#818CF8", error: "#EF4444", success: "#22C55E",
};

export const forestMistDark: Theme = {
  id: "forestMistDark", background: "#071510", surface: "#0C2218", surfaceHigh: "#112E22",
  border: "rgba(52,211,153,0.1)", text: "#D1FAE5",
  textSecondary: "rgba(209,250,229,0.52)", textTertiary: "rgba(209,250,229,0.28)",
  primary: "#10B981", primaryLight: "#34D399", error: "#EF4444", success: "#22C55E",
};

export const desertDustDark: Theme = {
  id: "desertDustDark", background: "#170E05", surface: "#241608", surfaceHigh: "#311F0C",
  border: "rgba(251,191,36,0.1)", text: "#FEF3C7",
  textSecondary: "rgba(254,243,199,0.52)", textTertiary: "rgba(254,243,199,0.28)",
  primary: "#F59E0B", primaryLight: "#FCD34D", error: "#EF4444", success: "#22C55E",
};

export const midnightGoldDark: Theme = {
  id: "midnightGoldDark", background: "#130E00", surface: "#1F1600", surfaceHigh: "#2C1F00",
  border: "rgba(253,224,71,0.1)", text: "#FEFCE8",
  textSecondary: "rgba(254,252,232,0.52)", textTertiary: "rgba(254,252,232,0.28)",
  primary: "#EAB308", primaryLight: "#FDE047", error: "#EF4444", success: "#22C55E",
};

export const copperDark: Theme = {
  id: "copperDark", background: "#160E08", surface: "#221608", surfaceHigh: "#2E1E0A",
  border: "rgba(251,146,60,0.1)", text: "#FFF7ED",
  textSecondary: "rgba(255,247,237,0.52)", textTertiary: "rgba(255,247,237,0.28)",
  primary: "#F97316", primaryLight: "#FB923C", error: "#EF4444", success: "#22C55E",
};

export const obsidianRoseDark: Theme = {
  id: "obsidianRoseDark", background: "#160810", surface: "#22101A", surfaceHigh: "#2E1724",
  border: "rgba(251,113,133,0.1)", text: "#FFE4E6",
  textSecondary: "rgba(255,228,230,0.52)", textTertiary: "rgba(255,228,230,0.28)",
  primary: "#F43F5E", primaryLight: "#FB7185", error: "#EF4444", success: "#22C55E",
};

export const crimsonNightDark: Theme = {
  id: "crimsonNightDark", background: "#140A0A", surface: "#201010", surfaceHigh: "#2C1616",
  border: "rgba(239,68,68,0.1)", text: "#FEF2F2",
  textSecondary: "rgba(254,242,242,0.52)", textTertiary: "rgba(254,242,242,0.28)",
  primary: "#DC2626", primaryLight: "#EF4444", error: "#F87171", success: "#22C55E",
};

export const slateDark: Theme = {
  id: "slateDark", background: "#0D1018", surface: "#151A26", surfaceHigh: "#1D2535",
  border: "rgba(148,163,184,0.1)", text: "#F1F5F9",
  textSecondary: "rgba(241,245,249,0.52)", textTertiary: "rgba(241,245,249,0.28)",
  primary: "#64748B", primaryLight: "#94A3B8", error: "#EF4444", success: "#22C55E",
};

// ─── 11 paletas LIGHT ─────────────────────────────────────────────────────────

export const lightTheme: Theme = {
  id: "pearl", background: "#F5F3FF", surface: "#FFFFFF", surfaceHigh: "#EDE9FE",
  border: "rgba(109,40,217,0.1)", text: "#1E1040",
  textSecondary: "rgba(30,16,64,0.52)", textTertiary: "rgba(30,16,64,0.32)",
  primary: "#7C3AED", primaryLight: "#6D28D9", error: "#DC2626", success: "#16A34A",
};

export const lavenderMistLight: Theme = {
  id: "lavenderMistLight", background: "#F3EEFF", surface: "#FFFFFF", surfaceHigh: "#E4D8FF",
  border: "rgba(124,58,237,0.1)", text: "#1E0A2E",
  textSecondary: "rgba(30,10,46,0.52)", textTertiary: "rgba(30,10,46,0.32)",
  primary: "#7C3AED", primaryLight: "#6D28D9", error: "#DC2626", success: "#16A34A",
};

export const iceBlueLight: Theme = {
  id: "iceBlueLight", background: "#EBF5FF", surface: "#FFFFFF", surfaceHigh: "#D1E9FF",
  border: "rgba(37,99,235,0.12)", text: "#0A1F3C",
  textSecondary: "rgba(10,31,60,0.52)", textTertiary: "rgba(10,31,60,0.32)",
  primary: "#2563EB", primaryLight: "#1D4ED8", error: "#DC2626", success: "#16A34A",
};

export const indigoLight: Theme = {
  id: "indigoLight", background: "#EEF2FF", surface: "#FFFFFF", surfaceHigh: "#E0E7FF",
  border: "rgba(79,70,229,0.12)", text: "#1E1B4B",
  textSecondary: "rgba(30,27,75,0.52)", textTertiary: "rgba(30,27,75,0.32)",
  primary: "#4F46E5", primaryLight: "#4338CA", error: "#DC2626", success: "#16A34A",
};

export const seafoamLight: Theme = {
  id: "seafoamLight", background: "#ECFDF5", surface: "#FFFFFF", surfaceHigh: "#D1FAE5",
  border: "rgba(5,150,105,0.12)", text: "#022C22",
  textSecondary: "rgba(2,44,34,0.52)", textTertiary: "rgba(2,44,34,0.32)",
  primary: "#059669", primaryLight: "#047857", error: "#DC2626", success: "#16A34A",
};

export const alabasterLight: Theme = {
  id: "alabasterLight", background: "#FDF8F0", surface: "#FFFFFF", surfaceHigh: "#F5ECD8",
  border: "rgba(180,83,9,0.1)", text: "#1C0F00",
  textSecondary: "rgba(28,15,0,0.52)", textTertiary: "rgba(28,15,0,0.32)",
  primary: "#B45309", primaryLight: "#92400E", error: "#DC2626", success: "#16A34A",
};

export const sunburstLight: Theme = {
  id: "sunburstLight", background: "#FFFBEB", surface: "#FFFFFF", surfaceHigh: "#FEF3C7",
  border: "rgba(217,119,6,0.12)", text: "#1C0F00",
  textSecondary: "rgba(28,15,0,0.52)", textTertiary: "rgba(28,15,0,0.32)",
  primary: "#D97706", primaryLight: "#B45309", error: "#DC2626", success: "#16A34A",
};

export const coralLight: Theme = {
  id: "coralLight", background: "#FFF5F0", surface: "#FFFFFF", surfaceHigh: "#FFE4D6",
  border: "rgba(234,88,12,0.1)", text: "#1C0800",
  textSecondary: "rgba(28,8,0,0.52)", textTertiary: "rgba(28,8,0,0.32)",
  primary: "#EA580C", primaryLight: "#C2410C", error: "#DC2626", success: "#16A34A",
};

export const roseQuartzLight: Theme = {
  id: "roseQuartzLight", background: "#FFF0F4", surface: "#FFFFFF", surfaceHigh: "#FFD6E0",
  border: "rgba(190,18,60,0.1)", text: "#2D0A14",
  textSecondary: "rgba(45,10,20,0.52)", textTertiary: "rgba(45,10,20,0.32)",
  primary: "#E11D48", primaryLight: "#BE123C", error: "#DC2626", success: "#16A34A",
};

export const crimsonLight: Theme = {
  id: "crimsonLight", background: "#FEF2F2", surface: "#FFFFFF", surfaceHigh: "#FEE2E2",
  border: "rgba(185,28,28,0.1)", text: "#1C0000",
  textSecondary: "rgba(28,0,0,0.52)", textTertiary: "rgba(28,0,0,0.32)",
  primary: "#B91C1C", primaryLight: "#991B1B", error: "#DC2626", success: "#16A34A",
};

export const saltFlatLight: Theme = {
  id: "saltFlatLight", background: "#F9F8F6", surface: "#FFFFFF", surfaceHigh: "#EDEBE4",
  border: "rgba(87,83,78,0.12)", text: "#1C1917",
  textSecondary: "rgba(28,25,23,0.52)", textTertiary: "rgba(28,25,23,0.32)",
  primary: "#78716C", primaryLight: "#57534E", error: "#DC2626", success: "#16A34A",
};

// ─── ALL_THEMES — compatibilidade com theme.store (setThemeId por família) ────

export const ALL_THEMES: { id: string; label: string; dark: Theme; light: Theme }[] = [
  { id: "midnight",     label: "Padrão Original", dark: darkTheme,        light: lightTheme        },
  { id: "aurora",       label: "Aurora",          dark: auroraDark,       light: lavenderMistLight },
  { id: "deepOcean",    label: "Deep Ocean",      dark: deepOceanDark,    light: iceBlueLight      },
  { id: "cobalt",       label: "Cobalt",          dark: cobaltDark,       light: indigoLight       },
  { id: "forestMist",   label: "Forest Mist",     dark: forestMistDark,   light: seafoamLight      },
  { id: "desertDust",   label: "Desert Dust",     dark: desertDustDark,   light: alabasterLight    },
  { id: "midnightGold", label: "Midnight Gold",   dark: midnightGoldDark, light: sunburstLight     },
  { id: "copper",       label: "Copper",          dark: copperDark,       light: coralLight        },
  { id: "obsidianRose", label: "Obsidian Rose",   dark: obsidianRoseDark, light: roseQuartzLight   },
  { id: "crimson",      label: "Crimson",         dark: crimsonNightDark, light: crimsonLight      },
  { id: "slate",        label: "Slate",           dark: slateDark,        light: saltFlatLight     },
];

// ─── ALL_PALETTES — 22 entradas independentes para o seletor visual ───────────
// Cada paleta é selecionável diretamente, sem depender do toggle dark/light.
// paletteId é o `id` do objeto Theme (não o id da família em ALL_THEMES).

export interface PaletteEntry {
  paletteId: string;   // id único da paleta (= Theme.id)
  familyId:  string;   // id da família em ALL_THEMES
  label:     string;   // nome legível
  isDark:    boolean;  // indica o modo
  theme:     Theme;    // objeto completo
}

export const ALL_PALETTES: PaletteEntry[] = [
  // ── Dark ──────────────────────────────────────────────────────────────────
  { paletteId: "midnight",        familyId: "midnight",     label: "Midnight",         isDark: true,  theme: darkTheme        },
  { paletteId: "auroraDark",      familyId: "aurora",       label: "Aurora Night",     isDark: true,  theme: auroraDark       },
  { paletteId: "deepOceanDark",   familyId: "deepOcean",    label: "Deep Ocean",       isDark: true,  theme: deepOceanDark    },
  { paletteId: "cobaltDark",      familyId: "cobalt",       label: "Cobalt",           isDark: true,  theme: cobaltDark       },
  { paletteId: "forestMistDark",  familyId: "forestMist",   label: "Forest Mist",      isDark: true,  theme: forestMistDark   },
  { paletteId: "desertDustDark",  familyId: "desertDust",   label: "Desert Dust",      isDark: true,  theme: desertDustDark   },
  { paletteId: "midnightGoldDark",familyId: "midnightGold", label: "Midnight Gold",    isDark: true,  theme: midnightGoldDark },
  { paletteId: "copperDark",      familyId: "copper",       label: "Copper",           isDark: true,  theme: copperDark       },
  { paletteId: "obsidianRoseDark",familyId: "obsidianRose", label: "Obsidian Rose",    isDark: true,  theme: obsidianRoseDark },
  { paletteId: "crimsonNightDark",familyId: "crimson",      label: "Crimson Night",    isDark: true,  theme: crimsonNightDark },
  { paletteId: "slateDark",       familyId: "slate",        label: "Slate",            isDark: true,  theme: slateDark        },
  // ── Light ─────────────────────────────────────────────────────────────────
  { paletteId: "pearl",           familyId: "midnight",     label: "Pearl",            isDark: false, theme: lightTheme        },
  { paletteId: "lavenderMistLight",familyId:"aurora",       label: "Lavender Mist",    isDark: false, theme: lavenderMistLight  },
  { paletteId: "iceBlueLight",    familyId: "deepOcean",    label: "Ice Blue",         isDark: false, theme: iceBlueLight       },
  { paletteId: "indigoLight",     familyId: "cobalt",       label: "Indigo",           isDark: false, theme: indigoLight        },
  { paletteId: "seafoamLight",    familyId: "forestMist",   label: "Seafoam",          isDark: false, theme: seafoamLight       },
  { paletteId: "alabasterLight",  familyId: "desertDust",   label: "Alabaster",        isDark: false, theme: alabasterLight     },
  { paletteId: "sunburstLight",   familyId: "midnightGold", label: "Sunburst",         isDark: false, theme: sunburstLight      },
  { paletteId: "coralLight",      familyId: "copper",       label: "Coral",            isDark: false, theme: coralLight         },
  { paletteId: "roseQuartzLight", familyId: "obsidianRose", label: "Rose Quartz",      isDark: false, theme: roseQuartzLight    },
  { paletteId: "crimsonLight",    familyId: "crimson",      label: "Crimson Day",      isDark: false, theme: crimsonLight       },
  { paletteId: "saltFlatLight",   familyId: "slate",        label: "Salt Flat",        isDark: false, theme: saltFlatLight      },
];

export { darkTheme as DEFAULT_DARK, lightTheme as DEFAULT_LIGHT };
