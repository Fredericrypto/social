/**
 * VenusLogo — "A Órbita"
 *
 * Conceito: V cortante dentro de uma elipse inclinada 30°
 * com planeta sólido em movimento orbital.
 *
 * Props:
 *   size        — lado do quadrado bounding box (default 40)
 *   color       — cor do V e da elipse (default #94A3B8 slate)
 *   planetColor — cor do planeta (default igual a `color`)
 *   animated    — se true, o planeta orbita continuamente (default false)
 *   pulsing     — se true, o V pulsa 1→1.08→1 uma vez (default false)
 *
 * Uso no header do feed:
 *   <VenusLogo size={32} color={theme.text} />
 *
 * Uso no pull-to-refresh (loading):
 *   <VenusLogo size={36} color={theme.primary} animated pulsing={!refreshing} />
 */

import React, { useEffect } from 'react';
import Svg, { Path, Ellipse, Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { View } from 'react-native';

// ─── Planeta animado ───────────────────────────────────────────────────────────
// O planeta percorre a elipse inclinada 30° usando uma rotação 2D.
// Simulamos a órbita com: rotateZ(angle) → translate(rx, 0) → rotateZ(-angle)
// para que o planeta se mova ao longo da elipse projetada.
const AnimatedG = Animated.createAnimatedComponent(G);

interface VenusLogoProps {
  size?:        number;
  color?:       string;
  planetColor?: string;
  animated?:    boolean;   // planeta orbita continuamente
  pulsing?:     boolean;   // V pulsa uma vez (chamado ao soltar pull-to-refresh)
}

export default function VenusLogo({
  size        = 40,
  color       = '#94A3B8',
  planetColor,
  animated    = false,
  pulsing     = false,
}: VenusLogoProps) {
  const planet = planetColor ?? color;

  // ─── Valores de animação ──────────────────────────────────────────────
  const orbitAngle = useSharedValue(0);   // 0 → 360 graus em radianos
  const logoScale  = useSharedValue(1);   // escala do V ao soltar

  // ─── Orbita contínua ──────────────────────────────────────────────────
  useEffect(() => {
    if (animated) {
      orbitAngle.value = withRepeat(
        withTiming(360, { duration: 1800, easing: Easing.linear }),
        -1, // infinito
        false,
      );
    } else {
      cancelAnimation(orbitAngle);
      orbitAngle.value = 0;
    }
    return () => cancelAnimation(orbitAngle);
  }, [animated]);

  // ─── Pulso do V ao soltar ──────────────────────────────────────────────
  useEffect(() => {
    if (pulsing) {
      logoScale.value = withSequence(
        withSpring(1.08, { damping: 4, stiffness: 300 }),
        withSpring(1.0,  { damping: 6, stiffness: 200 }),
      );
    }
  }, [pulsing]);

  // ─── Geometria ────────────────────────────────────────────────────────
  // Tudo normalizado em viewBox 100×100, depois escalado por `size`
  const cx = 50;  // centro X
  const cy = 52;  // centro Y (levemente abaixo do centro visual)
  const rx = 28;  // semi-eixo maior da elipse
  const ry = 11;  // semi-eixo menor da elipse
  const tilt = -30; // graus de inclinação

  // Raio do planeta (proporcional ao logo)
  const pr = size * 0.07;

  // ─── Estilo animado do planeta ─────────────────────────────────────────
  // Usa rotação em torno do centro da elipse para simular a órbita.
  // A transformação é aplicada no <G> que contém o planeta.
  const planetStyle = useAnimatedStyle(() => {
    const deg = orbitAngle.value;
    return {
      transform: [
        { translateX: (size / 2) },
        { translateY: (size / 2) },
        { rotate: `${deg}deg` },
        { translateX: -(size / 2) },
        { translateY: -(size / 2) },
      ],
    };
  });

  // ─── Estilo do V (escala) ──────────────────────────────────────────────
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  // Posição inicial do planeta: ponto mais à direita da elipse inclinada
  // Em coordenadas normalizadas (0–100):
  const planetX = cx + rx * Math.cos((tilt * Math.PI) / 180);
  const planetY = cy + rx * Math.sin((tilt * Math.PI) / 180);

  // Escala do viewBox para pixels
  const scale = size / 100;

  return (
    <Animated.View style={[{ width: size, height: size }, logoStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">

        {/* ── Elipse inclinada 30° ──────────────────────────────────── */}
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeOpacity={0.85}
          transform={`rotate(${tilt}, ${cx}, ${cy})`}
        />

        {/* ── V cortante ───────────────────────────────────────────── */}
        {/* Dois traços que formam o V com ângulo agudo (70°) */}
        <Path
          d={`
            M 32 34
            L 50 66
            L 68 34
          `}
          fill="none"
          stroke={color}
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

      </Svg>

      {/* ── Planeta (animated) ────────────────────────────────────────
          Renderizado fora do SVG para poder usar Reanimated.
          Posicionado absolutamente sobre o SVG.
      ──────────────────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          {
            position:  'absolute',
            top:       0,
            left:      0,
            width:     size,
            height:    size,
          },
          animated ? planetStyle : undefined,
        ]}
        pointerEvents="none"
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle
            cx={planetX}
            cy={planetY}
            r={6.5}
            fill={planet}
            opacity={0.95}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
