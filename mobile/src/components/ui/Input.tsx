import React, { useRef } from "react";
import {
  View, TextInput, Text, TouchableOpacity,
  StyleSheet, TextInputProps, Platform,
} from "react-native";
import { useThemeStore } from "../../store/theme.store";

interface Props extends TextInputProps {
  icon?: string;
  rightLabel?: string;
  onRightPress?: () => void;
}

export default function Input({ icon, rightLabel, onRightPress, style, ...props }: Props) {
  const { theme } = useThemeStore();
  const ref = useRef<TextInput>(null);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => ref.current?.focus()}
      style={[styles.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, { color: theme.text }, style]}
        placeholderTextColor={theme.textSecondary}
        underlineColorAndroid="transparent"
        {...props}
      />
      {rightLabel ? (
        <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.right, { color: theme.textSecondary }]}>{rightLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 54,
  },
  icon: { fontSize: 16, marginRight: 10, opacity: 0.5 },
  input: { flex: 1, fontSize: 15, height: "100%" as any },
  right: { fontSize: 11, fontWeight: "600", paddingLeft: 8 },
});
