/**
 * EarlyAdopterBadge.tsx
 *
 * Badge minimalista para os primeiros 1000 usuários da plataforma.
 * Exibe o número de inscrição (ex: #042) com design inspirado em
 * badges de acesso antecipado — estilo Elon Musk no X para usuários verificados.
 *
 * Características:
 * - Gradiente dourado exclusivo (não pode ser comprado ou obtido depois)
 * - Número de inscrição único e permanente
 * - Tooltip ao pressionar (mostra o significado)
 * - Respeita a preferência showEarlyAdopterBadge do usuário
 */

import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../../store/theme.store";

interface Props {
  number: number;               // 1–1000
  size?: "sm" | "md" | "lg";   // tamanho do badge
  showTooltip?: boolean;        // permite abrir o modal explicativo
}

const SIZE_MAP = {
  sm: { badge: 18, font: 8,  icon: 8  },
  md: { badge: 24, font: 10, icon: 10 },
  lg: { badge: 32, font: 13, icon: 12 },
};

// Gradientes por faixa de número — os menores são mais raros e dourados
function getBadgeGradient(n: number): [string, string, string] {
  if (n <= 10)   return ["#FFD700", "#FFA500", "#FF8C00"]; // Ouro puro  — top 10
  if (n <= 50)   return ["#E8C96A", "#C9A227", "#A07D1C"]; // Ouro velho — top 50
  if (n <= 100)  return ["#C0C0C0", "#A9A9A9", "#808080"]; // Prata      — top 100
  if (n <= 250)  return ["#CD7F32", "#B87333", "#8B4513"]; // Bronze     — top 250
  return               ["#7C3AED", "#6D28D9", "#5B21B6"]; // Violeta    — top 1000
}

function getBadgeTier(n: number): string {
  if (n <= 10)  return "Fundador Lendário";
  if (n <= 50)  return "Fundador Ouro";
  if (n <= 100) return "Fundador Prata";
  if (n <= 250) return "Fundador Bronze";
  return               "Early Adopter";
}

export default function EarlyAdopterBadge({
  number,
  size = "md",
  showTooltip = true,
}: Props) {
  const { theme } = useThemeStore();
  const [modalVisible, setModalVisible] = useState(false);
  const dim     = SIZE_MAP[size];
  const colors  = getBadgeGradient(number);
  const tier    = getBadgeTier(number);
  const numStr  = String(number).padStart(3, "0"); // "042"

  const badge = (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.badge,
        {
          height:       dim.badge,
          borderRadius: dim.badge / 2,
          paddingHorizontal: size === "sm" ? 5 : size === "md" ? 7 : 10,
          gap: size === "sm" ? 2 : 4,
        },
      ]}
    >
      <Ionicons name="flash" size={dim.icon} color="#fff" />
      <Text style={[styles.badgeText, { fontSize: dim.font }]}>
        #{numStr}
      </Text>
    </LinearGradient>
  );

  if (!showTooltip) return badge;

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        {badge}
      </TouchableOpacity>

      {/* Modal explicativo */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Badge grande no topo */}
            <LinearGradient
              colors={colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalBadgeLarge}
            >
              <Ionicons name="flash" size={24} color="#fff" />
              <Text style={styles.modalBadgeNum}>#{numStr}</Text>
            </LinearGradient>

            <Text style={[styles.modalTier, { color: theme.text }]}>{tier}</Text>

            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Este usuário foi um dos primeiros{" "}
              {number <= 10  ? "10"  :
               number <= 50  ? "50"  :
               number <= 100 ? "100" :
               number <= 250 ? "250" : "1.000"}{" "}
              a criar uma conta na Rede.
            </Text>

            <Text style={[styles.modalDesc, { color: theme.textSecondary, marginTop: 4 }]}>
              Este badge é único, intransferível e permanente — uma marca da história da plataforma.
            </Text>

            <View style={[styles.modalDivider, { backgroundColor: theme.border }]} />

            <View style={styles.modalStats}>
              <View style={styles.modalStat}>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>#{numStr}</Text>
                <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>Inscrição</Text>
              </View>
              <View style={[styles.modalStatDivider, { backgroundColor: theme.border }]} />
              <View style={styles.modalStat}>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>Eterno</Text>
                <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>Duração</Text>
              </View>
              <View style={[styles.modalStatDivider, { backgroundColor: theme.border }]} />
              <View style={styles.modalStat}>
                <Text style={[styles.modalStatValue, { color: theme.text }]}>1.000</Text>
                <Text style={[styles.modalStatLabel, { color: theme.textSecondary }]}>Total</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { backgroundColor: theme.primary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Fechar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge:      { flexDirection: "row", alignItems: "center" },
  badgeText:  { color: "#fff", fontWeight: "800", letterSpacing: 0.3 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  modalBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 4,
  },
  modalBadgeNum:    { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 1 },
  modalTier:        { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  modalDesc:        { fontSize: 13, textAlign: "center", lineHeight: 20 },
  modalDivider:     { width: "100%", height: StyleSheet.hairlineWidth, marginVertical: 4 },
  modalStats:       { flexDirection: "row", alignItems: "center", width: "100%", justifyContent: "space-around" },
  modalStat:        { alignItems: "center", gap: 2 },
  modalStatValue:   { fontSize: 15, fontWeight: "800" },
  modalStatLabel:   { fontSize: 11 },
  modalStatDivider: { width: StyleSheet.hairlineWidth, height: 32 },
  modalCloseBtn:    { borderRadius: 14, paddingHorizontal: 32, paddingVertical: 11, marginTop: 6 },
  modalCloseBtnText:{ color: "#fff", fontWeight: "700", fontSize: 14 },
});
