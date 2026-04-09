import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeStore } from '../../store/theme.store';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const { theme } = useThemeStore();
  const anim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[
      { width: width as any, height, borderRadius, backgroundColor: theme.surfaceHigh, opacity: anim },
      style,
    ]} />
  );
}

export function PostCardSkeleton() {
  const { theme } = useThemeStore();
  return (
    <View style={[skStyles.card, { borderBottomColor: theme.border }]}>
      <View style={skStyles.header}>
        <Skeleton width={42} height={42} borderRadius={21} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="25%" height={10} />
        </View>
      </View>
      <Skeleton width="90%" height={13} style={{ marginHorizontal: 14, marginBottom: 6 }} />
      <Skeleton width="70%" height={13} style={{ marginHorizontal: 14, marginBottom: 10 }} />
      <Skeleton width="100%" height={280} borderRadius={0} />
      <View style={skStyles.actions}>
        <Skeleton width={60} height={20} />
        <Skeleton width={60} height={20} />
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  card: { borderBottomWidth: 1, paddingBottom: 8 },
  header: { flexDirection: 'row', padding: 14, gap: 10, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 16, paddingHorizontal: 14, paddingVertical: 10 },
});
