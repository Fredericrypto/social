import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../../store/theme.store";
import PresenceDot from "./PresenceDot";
import { PresenceStatus } from "../../services/presence.service";

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** false = sem ring | "default" = ring cinza | "active" = ring gradiente colorido */
  ring?: false | "default" | "active";
  /** @deprecated use ring="active" */
  showRing?: boolean;
  /**
   * Quando fornecido, exibe um PresenceDot posicionado no canto inferior direito.
   * O dot se adapta ao tamanho do avatar automaticamente.
   */
  presenceStatus?: PresenceStatus | null;
}

export default function Avatar({
  uri,
  name,
  size = 40,
  ring,
  showRing,
  presenceStatus,
}: Props) {
  const { theme } = useThemeStore();

  // Compatibilidade retroativa com showRing
  const ringMode: false | "default" | "active" =
    ring !== undefined
      ? ring
      : showRing
      ? "active"
      : false;

  const initials =
    name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  const innerSize = ringMode ? size - 6 : size;
  const totalSize = ringMode ? size : size;

  // Tamanho do dot proporcional ao avatar (mínimo 8, máximo 14)
  const dotSize = Math.max(8, Math.min(14, Math.round(size * 0.28)));

  const innerView = (
    <View
      style={[
        styles.container,
        {
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          backgroundColor: theme.surfaceHigh,
          borderWidth: ringMode ? 0 : 1.5,
          borderColor: theme.border,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2 }}
        />
      ) : (
        <Text
          style={{
            fontSize: innerSize * 0.35,
            fontWeight: "700",
            color: theme.primaryLight,
          }}
        >
          {initials}
        </Text>
      )}
    </View>
  );

  // ── Wrapper que adiciona o PresenceDot (se fornecido) ──────────────────
  const withDot = (child: React.ReactNode, containerSize: number) => {
    if (!presenceStatus) return child as React.ReactElement;
    return (
      <View style={{ width: containerSize, height: containerSize }}>
        {child}
        <PresenceDot
          status={presenceStatus}
          size={dotSize}
          absolute
        />
      </View>
    );
  };

  if (ringMode === "active") {
    const gradient = (
      <LinearGradient
        colors={["#7C3AED", "#06B6D4"]}
        style={{
          width: totalSize,
          height: totalSize,
          borderRadius: totalSize / 2,
          padding: 3,
          alignItems: "center",
          justifyContent: "center",
        }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Gap branco/escuro entre ring e foto */}
        <View
          style={{
            width: innerSize + 4,
            height: innerSize + 4,
            borderRadius: (innerSize + 4) / 2,
            backgroundColor: theme.background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {innerView}
        </View>
      </LinearGradient>
    );
    return withDot(gradient, totalSize);
  }

  if (ringMode === "default") {
    const defaultRing = (
      <View
        style={{
          width: totalSize,
          height: totalSize,
          borderRadius: totalSize / 2,
          padding: 3,
          borderWidth: 2,
          borderColor: "#6B7280",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {innerView}
      </View>
    );
    return withDot(defaultRing, totalSize);
  }

  return withDot(innerView, totalSize) as React.ReactElement;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
