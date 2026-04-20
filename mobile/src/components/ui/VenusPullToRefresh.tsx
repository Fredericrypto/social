/**
 * VenusPullToRefresh
 *
 * Substitui o <RefreshControl> nativo.
 * Deve ser renderizado como o PRIMEIRO filho do ListHeaderComponent.
 *
 * Como funciona:
 *  - Enquanto `refreshing === true`:  planeta orbita + logo pulsa suavemente
 *  - Ao mudar `refreshing` para false: V pulsa uma vez (efeito "lançamento")
 *  - A altura colapsa suavemente quando não está visível
 *
 * Uso no FeedScreen:
 *
 *   const [refreshing, setRefreshing] = useState(false);
 *
 *   const FeedHeader = (
 *     <View style={{ backgroundColor: theme.background }}>
 *       <VenusPullToRefresh
 *         refreshing={refreshing}
 *         color={theme.primary}
 *       />
 *       { ...resto do header }
 *     </View>
 *   );
 *
 *   <FlatList
 *     refreshControl={
 *       <RefreshControl
 *         refreshing={refreshing}
 *         onRefresh={() => { setRefreshing(true); loadFeed(1, true); }}
 *         tintColor="transparent"   // esconde o spinner nativo
 *         colors={['transparent']}  // Android
 *       />
 *     }
 *     ...
 *   />
 *
 * NOTA: o <RefreshControl> fica com tintColor transparent — ele ainda controla
 * o gesto de arrastar, mas o spinner nativo fica invisível.
 * O VenusPullToRefresh no ListHeaderComponent faz o visual.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import VenusLogo from './VenusLogo';

interface Props {
  refreshing: boolean;
  color?:     string;
}

export default function VenusPullToRefresh({
  refreshing,
  color = '#6366F1',
}: Props) {
  // Altura do container: expande ao aparecer, colapsa ao sumir
  const heightAnim  = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Controla o estado do logo para o pulso "ao soltar"
  const [logoPulsing, setLogoPulsing] = React.useState(false);
  const wasRefreshing = useRef(false);

  useEffect(() => {
    if (refreshing) {
      // Aparece
      wasRefreshing.current = true;
      Animated.parallel([
        Animated.spring(heightAnim,  { toValue: 64, useNativeDriver: false, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1,  duration: 200, useNativeDriver: false }),
      ]).start();
    } else {
      if (wasRefreshing.current) {
        // Pulso ao soltar — só dispara quando passa de true → false
        wasRefreshing.current = false;
        setLogoPulsing(true);
        setTimeout(() => setLogoPulsing(false), 600);
      }
      // Colapsa
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 0, duration: 300, useNativeDriver: false }),
        Animated.timing(heightAnim,  { toValue: 0, duration: 350, useNativeDriver: false, delay: 200 }),
      ]).start();
    }
  }, [refreshing]);

  return (
    <Animated.View style={[styles.container, { height: heightAnim, opacity: opacityAnim }]}>
      <VenusLogo
        size={36}
        color={color}
        animated={refreshing}
        pulsing={logoPulsing}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow:       'hidden',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
  },
});
