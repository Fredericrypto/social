/**
 * ProjectCard.tsx
 *
 * Card de projeto Next-Gen:
 * - Header: título + badge de status
 * - Body: descrição + tech stack chips
 * - Footer: botões repo, demo + métricas
 * - Parse seguro do JSON serializado no caption
 * - Sem JSON bruto na UI
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ScrollView, Linking, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ProjectData {
  title:   string;
  desc?:   string;
  repo?:   string;
  demo?:   string;
  status?: "wip" | "done" | "archived";
  techs?:  string[];
}

interface ProjectCardProps {
  post: any;               // post completo da API
  compact?: boolean;       // modo compacto para grid do perfil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  wip:      { label: "Em Dev",    color: "#F59E0B", icon: "construct-outline"   },
  done:     { label: "Live",      color: "#22C55E", icon: "checkmark-circle-outline" },
  archived: { label: "Arquivado", color: "#6B7280", icon: "archive-outline"     },
};

/**
 * Tenta parsear o caption como JSON de projeto.
 * Se falhar, cria um objeto minimal com o caption como título.
 */
export function parseProjectData(caption: string): ProjectData {
  if (!caption) return { title: "Projeto sem título" };
  try {
    const parsed = JSON.parse(caption);
    if (parsed && typeof parsed === "object" && parsed.title) {
      return parsed as ProjectData;
    }
  } catch {}
  // Fallback: caption simples não é JSON
  return {
    title: caption.split("\n")[0] || "Projeto",
    desc:  caption.split("\n").slice(1).join(" ") || undefined,
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ProjectCard({ post, compact = false }: ProjectCardProps) {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(false);

  const data    = parseProjectData(post.caption || "");
  const status  = data.status || "wip";
  const cfg     = STATUS_CONFIG[status] || STATUS_CONFIG.wip;
  const images: string[] = post.mediaUrls || [];

  const openLink = (url?: string) => {
    if (!url) return;
    const full = url.startsWith("http") ? url : `https://${url}`;
    Linking.openURL(full).catch(() => Alert.alert("Não foi possível abrir o link."));
  };

  // ── Modo compacto (grid do perfil) ────────────────────────────────────
  if (compact) {
    return (
      <View style={[c.compact, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {images[0] ? (
          <Image source={{ uri: images[0] }} style={c.compactImg} resizeMode="cover" />
        ) : (
          <View style={[c.compactNoImg, { backgroundColor: theme.surfaceHigh }]}>
            <Ionicons name="briefcase-outline" size={22} color={theme.textTertiary} />
          </View>
        )}
        <View style={c.compactBody}>
          <Text style={[c.compactTitle, { color: theme.text }]} numberOfLines={1}>
            {data.title}
          </Text>
          <View style={[c.statusPill, { backgroundColor: cfg.color + "22" }]}>
            <View style={[c.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[c.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Modo completo ─────────────────────────────────────────────────────
  return (
    <View style={[c.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>

      {/* Galeria de screenshots */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={c.gallery}
          contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }}
        >
          {images.map((uri, i) => (
            <Image
              key={i}
              source={{ uri }}
              style={c.galleryImg}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      )}

      {/* Header */}
      <View style={c.header}>
        <View style={c.headerLeft}>
          <Text style={[c.title, { color: theme.text }]} numberOfLines={2}>
            {data.title}
          </Text>
          <View style={[c.statusPill, { backgroundColor: cfg.color + "22" }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[c.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={[c.expandBtn, { backgroundColor: theme.surfaceHigh }]}
          onPress={() => setExpanded(v => !v)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Body */}
      {data.desc && (
        <Text
          style={[c.desc, { color: theme.textSecondary }]}
          numberOfLines={expanded ? undefined : 2}
        >
          {data.desc}
        </Text>
      )}

      {/* Tech stack */}
      {(data.techs?.length || 0) > 0 && (
        <View style={c.techRow}>
          {data.techs!.map(t => (
            <View key={t} style={[c.techChip, {
              backgroundColor: theme.primary + "18",
              borderColor:     theme.primary + "40",
            }]}>
              <Text style={[c.techText, { color: theme.primaryLight }]}>{t}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={[c.footer, { borderTopColor: theme.border }]}>

        {/* Métricas */}
        <View style={c.metrics}>
          <View style={c.metric}>
            <Ionicons name="heart-outline" size={13} color={theme.textTertiary} />
            <Text style={[c.metricText, { color: theme.textTertiary }]}>
              {post.likesCount ?? 0}
            </Text>
          </View>
          <View style={c.metric}>
            <Ionicons name="chatbubble-outline" size={12} color={theme.textTertiary} />
            <Text style={[c.metricText, { color: theme.textTertiary }]}>
              {post.commentsCount ?? 0}
            </Text>
          </View>
        </View>

        {/* Ações */}
        <View style={c.actions}>
          {data.repo && (
            <TouchableOpacity
              style={[c.actionBtn, { borderColor: theme.border }]}
              onPress={() => openLink(data.repo)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-github" size={14} color={theme.text} />
              <Text style={[c.actionBtnText, { color: theme.text }]}>Repo</Text>
            </TouchableOpacity>
          )}
          {data.demo && (
            <TouchableOpacity
              style={[c.actionBtn, { backgroundColor: theme.primary, borderColor: "transparent" }]}
              onPress={() => openLink(data.demo)}
              activeOpacity={0.8}
            >
              <Ionicons name="open-outline" size={14} color="#fff" />
              <Text style={[c.actionBtnText, { color: "#fff" }]}>Demo</Text>
            </TouchableOpacity>
          )}
          {/* Preparado para funcionalidades futuras */}
          <TouchableOpacity
            style={[c.actionBtn, { borderColor: theme.border }]}
            onPress={() => Alert.alert("Em breve", "Fork de projetos disponível em breve.")}
            activeOpacity={0.8}
          >
            <Ionicons name="git-branch-outline" size={14} color={theme.textSecondary} />
            <Text style={[c.actionBtnText, { color: theme.textSecondary }]}>Fork</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  // Card completo
  card:          { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 2 },
  gallery:       { marginBottom: 2 },
  galleryImg:    { width: 200, height: 120, borderRadius: 10 },

  header:        { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, paddingBottom: 8, gap: 10 },
  headerLeft:    { flex: 1, gap: 6 },
  title:         { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },

  statusPill:    { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },
  statusText:    { fontSize: 11, fontWeight: "700" },

  expandBtn:     { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  desc:          { paddingHorizontal: 14, paddingBottom: 10, fontSize: 13, lineHeight: 20 },

  techRow:       { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  techChip:      { borderRadius: 20, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  techText:      { fontSize: 11, fontWeight: "600" },

  footer:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  metrics:       { flexDirection: "row", gap: 12 },
  metric:        { flexDirection: "row", alignItems: "center", gap: 4 },
  metricText:    { fontSize: 12 },
  actions:       { flexDirection: "row", gap: 8 },
  actionBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: "600" },

  // Modo compacto
  compact:       { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 10 },
  compactImg:    { width: "100%", height: 100 },
  compactNoImg:  { width: "100%", height: 80, alignItems: "center", justifyContent: "center" },
  compactBody:   { padding: 10, gap: 4 },
  compactTitle:  { fontSize: 13, fontWeight: "700" },
});
