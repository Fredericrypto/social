import React, { useCallback, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../../store/theme.store';

interface FollowButtonProps {
  isFollowing: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export default function FollowButton({
  isFollowing,
  onPress,
  size = 'md',
  disabled = false,
}: FollowButtonProps) {
  const { theme, isDark } = useThemeStore();

  const scale        = useSharedValue(1);
  const glowPulse    = useSharedValue(0);   // 0→1 loop ambiente
  const clickGlow    = useSharedValue(0);   // 0→1 no clique

  // Glow ambiente — pulsa suavemente em loop
  useEffect(() => {
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinito
      false
    );
  }, []);

  const handlePress = useCallback(() => {
    if (disabled) return;

    Haptics.impactAsync(
      isFollowing
        ? Haptics.ImpactFeedbackStyle.Light
        : Haptics.ImpactFeedbackStyle.Medium
    ).catch(() => {});

    // Bounce rápido
    scale.value = withSequence(
      withTiming(0.93, { duration: 60, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 12, stiffness: 450, mass: 0.5 })
    );

    // Click glow — pulsa forte uma vez
    clickGlow.value = withSequence(
      withTiming(1,   { duration: 80  }),
      withTiming(0,   { duration: 400, easing: Easing.out(Easing.quad) })
    );

    onPress();
  }, [disabled, isFollowing, onPress, scale, clickGlow]);

  const h  = size === 'sm' ? 30 : 36;
  const px = size === 'sm' ? 14 : 18;
  const fs = size === 'sm' ? 12 : 13;
  const br = h / 2;

  // Cores do glow por estado
  const glowColor  = isFollowing ? '#94A3B8' : '#22D3EE';
  const glowColor2 = isFollowing ? '#64748B' : '#3B82F6';

  const animStyle = useAnimatedStyle(() => {
    // Combina glow ambiente + glow de clique
    const ambient = glowPulse.value;
    const click   = clickGlow.value;
    const total   = Math.min(1, ambient * 0.4 + click);

    return {
      transform:     [{ scale: scale.value }],
      shadowColor:   glowColor,
      shadowOffset:  { width: 0, height: 0 },
      shadowOpacity: total,
      shadowRadius:  isFollowing
        ? 6 + ambient * 4 + click * 12
        : 8 + ambient * 6 + click * 16,
      elevation: total * (isFollowing ? 6 : 10),
    };
  });

  return (
    <Animated.View style={[{ borderRadius: br, minWidth: 80 }, animStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.88}
        disabled={disabled}
        style={[
          s.btn,
          { height: h, borderRadius: br, paddingHorizontal: px },
          isFollowing
            ? {
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.2)',
              }
            : {
                backgroundColor: theme.text,
                borderWidth: 0,
              },
        ]}
      >
        <Text style={[
          s.label,
          { fontSize: fs },
          isFollowing
            ? { color: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(100,116,139,0.7)' }
            : { color: theme.background },
        ]}>
          {isFollowing ? 'Seguindo' : 'Seguir'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  btn:   { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', letterSpacing: 0.1 },
});
