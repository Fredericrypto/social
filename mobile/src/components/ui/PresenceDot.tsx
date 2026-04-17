import React from "react";
import { View } from "react-native";
import { PresenceStatus, PRESENCE_COLORS } from "../../services/presence.service";

interface PresenceDotProps {
  status:    PresenceStatus;
  size?:     number;
  absolute?: boolean; // posiciona sobre avatar (bottom-right)
}

/**
 * Dot colorido de presença.
 * Uso: <PresenceDot status="online" size={12} absolute />
 */
export default function PresenceDot({ status, size = 10, absolute = false }: PresenceDotProps) {
  return (
    <View
      style={[
        {
          width:           size,
          height:          size,
          borderRadius:    size / 2,
          backgroundColor: PRESENCE_COLORS[status],
          borderWidth:     1.5,
          borderColor:     "#fff",
        },
        absolute && {
          position: "absolute",
          bottom:   0,
          right:    0,
        },
      ]}
    />
  );
}
