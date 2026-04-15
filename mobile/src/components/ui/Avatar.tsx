import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../../store/theme.store";

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** false = sem ring | "default" = ring cinza | "active" = ring gradiente colorido */
  ring?: false | "default" | "active";
  /** @deprecated use ring="active" */
  showRing?: boolean;
}

export default function Avatar({
  uri,
  name,
  size = 40,
  ring,
  showRing,
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

  const innerSize  = ringMode ? size - 6 : size;   // 3px gap de cada lado
  const totalSize  = ringMode ? size : size;

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

  if (ringMode === "active") {
    return (
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
  }

  if (ringMode === "default") {
    return (
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
  }

  return innerView;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
