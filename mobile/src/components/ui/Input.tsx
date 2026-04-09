import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { useThemeStore } from '../../store/theme.store';

interface Props extends TextInputProps {
  icon?: string;
  rightLabel?: string;
  onRightPress?: () => void;
}

export default function Input({ icon, rightLabel, onRightPress, style, ...props }: Props) {
  const { theme } = useThemeStore();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[
      styles.wrap,
      {
        backgroundColor: theme.surface,
        borderColor: focused ? theme.primary : theme.border,
        shadowColor: focused ? theme.primary : 'transparent',
        shadowOpacity: focused ? 0.2 : 0,
        shadowRadius: 8,
        elevation: focused ? 4 : 0,
      },
    ]}>
      {icon && <Text style={[styles.icon, { opacity: focused ? 1 : 0.4 }]}>{icon}</Text>}
      <TextInput
        style={[styles.input, { color: theme.text }, style]}
        placeholderTextColor={theme.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {rightLabel && (
        <TouchableOpacity onPress={onRightPress}>
          <Text style={[styles.right, { color: theme.textSecondary }]}>{rightLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 16, height: 54,
    transition: 'border-color 0.2s',
  } as any,
  icon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 15 },
  right: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, paddingLeft: 8 },
});
