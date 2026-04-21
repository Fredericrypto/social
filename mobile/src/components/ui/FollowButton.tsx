/**
 * FollowButton — borda gradiente brilhante ao clicar
 * Técnica: LinearGradient como borda (container) + corpo com margin:2
 * Glow: shadowColor animado no container — borda brilha, sem blob externo
 */
import React, { useCallback, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useThemeStore } from '../../store/theme.store';

interface Props {
  isFollowing: boolean;
  onPress: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  label?: string;
  flex?: boolean;
}

// Cores da borda por estado
const BORDER_FOLLOW    = ['#22D3EE', '#3B82F6', '#8B5CF6'] as const;
const BORDER_FOLLOWING = ['#64748B', '#94A3B8', '#475569'] as const;

export default function FollowButton({
  isFollowing, onPress,
  size = 'md', disabled = false, label, flex = false,
}: Props) {
  const { theme, isDark } = useThemeStore();
  const isProcessing = useRef(false);

  const glow  = useSharedValue(0);
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled || isProcessing.current) return;
    isProcessing.current = true;
    setTimeout(() => { isProcessing.current = false; }, 700);

    Haptics.impactAsync(
      isFollowing ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    ).catch(() => {});

    // Bounce rápido
    scale.value = withSequence(
      withTiming(0.95, { duration: 60, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 14, stiffness: 500, mass: 0.4 })
    );

    // Glow na borda: acende → sustenta → some
    glow.value = withSequence(
      withTiming(1,   { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0.8, { duration: 250 }),
      withTiming(0,   { duration: 450, easing: Easing.in(Easing.quad) })
    );

    onPress();
  }, [disabled, isFollowing, onPress, scale, glow]);

  const h  = size === 'sm' ? 30 : 34;
  const br = h / 2;
  const px = size === 'sm' ? 14 : 16;
  const fs = size === 'sm' ? 12 : 13;
  const BORDER = 1.5;

  const colors = isFollowing ? BORDER_FOLLOWING : BORDER_FOLLOW;
  const shadowC = isFollowing ? '#94A3B8' : '#22D3EE';

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowColor:   shadowC,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.85,
    shadowRadius:  glow.value * 12,
    elevation:     glow.value * 10,
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.7, // borda sempre visível, brilha no clique
  }));

  return (
    <Animated.View style={[
      wrapStyle,
      flex ? { flex: 1 } : { minWidth: size === 'sm' ? 76 : 86 },
    ]}>
      {/* Borda gradiente animada */}
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: br, overflow: 'hidden' },
        borderStyle,
      ]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Corpo do botão — margin 1.5px cobre a borda por dentro */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.88}
        disabled={disabled}
        style={[
          s.body,
          {
            height: h - BORDER * 2,
            borderRadius: br - BORDER,
            paddingHorizontal: px,
            margin: BORDER,
          },
          isFollowing
            ? {
                backgroundColor: isDark ? 'rgba(13,16,24,0.97)' : 'rgba(249,248,246,0.97)',
              }
            : {
                backgroundColor: '#0D1018',
              },
        ]}
      >
        <Text style={[
          s.label,
          { fontSize: fs },
          isFollowing
            ? { color: isDark ? 'rgba(148,163,184,0.8)' : 'rgba(100,116,139,0.8)' }
            : { color: '#F1F5F9' },
        ]}>
          {label ?? (isFollowing ? 'Seguindo' : 'Seguir')}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  body:  { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '700', letterSpacing: 0.2 },
});
