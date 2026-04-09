import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '../../store/theme.store';

interface Props {
  uri?: string | null;
  name?: string | null;
  size?: number;
  showRing?: boolean;
}

export default function Avatar({ uri, name, size = 40, showRing = false }: Props) {
  const { theme } = useThemeStore();
  const initials = name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const inner = (
    <View style={[styles.container, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: theme.surfaceHigh,
      borderWidth: showRing ? 0 : 1.5,
      borderColor: theme.border,
    }]}>
      {uri
        ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        : <Text style={{ fontSize: size * 0.35, fontWeight: '700', color: theme.primaryLight }}>
            {initials}
          </Text>
      }
    </View>
  );

  if (showRing) {
    return (
      <LinearGradient
        colors={['#7C3AED', '#06B6D4']}
        style={{
          width: size + 4, height: size + 4,
          borderRadius: (size + 4) / 2,
          padding: 2,
          alignItems: 'center', justifyContent: 'center',
        }}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        {inner}
      </LinearGradient>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
