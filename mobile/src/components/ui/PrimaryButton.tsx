import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  fontSize?: number;
}

export default function PrimaryButton({ label, onPress, loading, disabled, height = 52, fontSize = 15 }: Props) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}>
      <LinearGradient
        colors={['#7C3AED', '#6D28D9']}
        style={[styles.btn, { height, opacity: (disabled || loading) ? 0.6 : 1 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={[styles.label, { fontSize }]}>{label}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#fff', fontWeight: '700', letterSpacing: 0.3 },
});
