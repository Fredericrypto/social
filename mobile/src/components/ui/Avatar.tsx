import React from "react";
import { View, Image, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../../store/theme.store";
import PresenceDot from "./PresenceDot";
import { PresenceStatus } from "../../services/presence.service";

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  ring?: false | "default" | "active";
  /** @deprecated use ring="active" */
  showRing?: boolean;
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

  const ringMode: false | "default" | "active" =
    ring !== undefined ? ring : showRing ? "active" : false;

  const initials =
    name?.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  const photoSize = ringMode ? size - 10 : size;
  const dotSize   = photoSize <= 40 ? 10 : photoSize <= 56 ? 12 : Math.round(photoSize * 0.22);

  const photo = (
    <View style={{
      width: photoSize, height: photoSize, borderRadius: photoSize / 2,
      backgroundColor: theme.surfaceHigh,
      borderWidth: ringMode ? 0 : 1.5, borderColor: theme.border,
      alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      {uri
        ? <Image source={{ uri }} style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2 }} />
        : <Text style={{ fontSize: photoSize * 0.35, fontWeight: "700", color: theme.primaryLight }}>{initials}</Text>
      }
    </View>
  );

  // Dot sempre relativo ao photoSize — envolve a foto num container
  // e posiciona o dot no canto inferior direito com offset fixo de 2px
  const dotOffset = 2;
  const photoWithDot = (
    <View style={{ width: photoSize, height: photoSize }}>
      {photo}
      {presenceStatus && (
        <View style={{ position: "absolute", bottom: dotOffset, right: dotOffset }}>
          <PresenceDot status={presenceStatus} size={dotSize} />
        </View>
      )}
    </View>
  );

  if (!ringMode) {
    return photoWithDot as React.ReactElement;
  }

  if (ringMode === "default") {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 2, borderColor: "#6B7280",
        alignItems: "center", justifyContent: "center",
      }}>
        {photoWithDot}
      </View>
    );
  }

  // Ring active
  return (
    <LinearGradient
      colors={["#7C3AED", "#06B6D4"]}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <View style={{
        width: size - 6, height: size - 6, borderRadius: (size - 6) / 2,
        backgroundColor: theme.background, alignItems: "center", justifyContent: "center",
      }}>
        {photoWithDot}
      </View>
    </LinearGradient>
  );
}
