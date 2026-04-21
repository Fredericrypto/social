/**
 * GlowButton — borda slate metálica brilhante ao clicar
 * Mesmo mecanismo do FollowButton, mas para botões de ícone (DM, Compartilhar)
 */
import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withSequence, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Props {
  onPress: () => void;
  children: React.ReactNode;
  style?: any;
  disabled?: boolean;
}

const BORDER_COLORS = ['#475569', '#94A3B8', '#64748B'] as const;
const SHADOW_COLOR  = '#94A3B8';
const BORDER = 1.5;

export default function GlowButton({ onPress, children, style, disabled = false }: Props) {
  const glow  = useSharedValue(0);
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    scale.value = withSequence(
      withTiming(0.93, { duration: 60, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 14, stiffness: 500, mass: 0.4 })
    );

    glow.value = withSequence(
      withTiming(1,   { duration: 100, easing: Easing.out(Easing.quad) }),
      withTiming(0.8, { duration: 250 }),
      withTiming(0,   { duration: 450, easing: Easing.in(Easing.quad) })
    );

    onPress();
  }, [disabled, onPress, scale, glow]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform:     [{ scale: scale.value }],
    shadowColor:   SHADOW_COLOR,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: glow.value * 0.85,
    shadowRadius:  glow.value * 12,
    elevation:     glow.value * 10,
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + glow.value * 0.75,
  }));

  // Extrai borderRadius do style passado (padrão 10 para actionBtnSq)
  const br = style?.borderRadius ?? 10;

  return (
    <Animated.View style={[style, wrapStyle]}>
      {/* Borda gradiente slate */}
      <Animated.View style={[
        StyleSheet.absoluteFillObject,
        { borderRadius: br, overflow: 'hidden' },
        borderStyle,
      ]}>
        <LinearGradient
          colors={BORDER_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Botão por cima — margin cobre a borda */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled}
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: br - BORDER,
            margin: BORDER,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}
