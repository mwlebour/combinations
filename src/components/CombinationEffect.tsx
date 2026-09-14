import React, { useEffect, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ActiveCombinationAnimation } from '../types/game';
import { generateParticleConfigs } from '../utils/gameLogic';

interface CombinationEffectProps {
  animation: ActiveCombinationAnimation;
  onComplete: (id: string) => void;
}

const ElementIcon = ({ path, color, size = 28 }: { path: string; color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={path} fill={color} />
  </Svg>
);

const SparkleStar = ({ color, size = 16 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5z" fill={color} />
  </Svg>
);

export const CombinationEffect: React.FC<CombinationEffectProps> = ({
  animation,
  onComplete,
}) => {
  const {
    id,
    startX1,
    startY1,
    startX2,
    startY2,
    targetX,
    targetY,
    elementA,
    elementB,
    product,
    productName,
  } = animation;

  // Midpoint center coordinates
  const centerX = targetX + 40;
  const centerY = targetY + 40;

  // Animation values
  const convergeAnim = useRef(new Animated.Value(0)).current;
  const burstProgress = useRef(new Animated.Value(0)).current;
  const shockwave1 = useRef(new Animated.Value(0)).current;
  const shockwave2 = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  // Generate 26 rich elemental particles tailored to ingredients and product
  const particles = useMemo(() => {
    return generateParticleConfigs(26, elementA, elementB, product);
  }, [elementA, elementB, product]);

  useEffect(() => {
    // 1. Phase 1: Rapid convergence of ingredients into midpoint (190ms)
    Animated.timing(convergeAnim, {
      toValue: 1,
      duration: 190,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
      useNativeDriver: false,
    }).start(() => {
      // 2. Phase 2: Explosive burst & shockwaves
      Animated.parallel([
        // Core energy flash
        Animated.sequence([
          Animated.timing(flashAnim, {
            toValue: 1,
            duration: 90,
            useNativeDriver: false,
          }),
          Animated.timing(flashAnim, {
            toValue: 0,
            duration: 160,
            useNativeDriver: false,
          }),
        ]),

        // Shockwave 1 (Element A color)
        Animated.timing(shockwave1, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),

        // Shockwave 2 (Element B color, slight stagger)
        Animated.sequence([
          Animated.delay(45),
          Animated.timing(shockwave2, {
            toValue: 1,
            duration: 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
          }),
        ]),

        // Particles outward expansion
        Animated.timing(burstProgress, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),

        // Floating product announcement badge
        Animated.sequence([
          Animated.timing(badgeAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.back(1.5)),
            useNativeDriver: false,
          }),
          Animated.delay(350),
          Animated.timing(badgeAnim, {
            toValue: 2,
            duration: 350,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: false,
          }),
        ]),
      ]).start(() => {
        onComplete(id);
      });
    });
  }, []);

  // Converging positions for element A and B
  const posXA = convergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [startX1, targetX],
  });
  const posYA = convergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [startY1, targetY],
  });
  const posXB = convergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [startX2, targetX],
  });
  const posYB = convergeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [startY2, targetY],
  });

  const convergeScale = convergeAnim.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0.85, 0.4],
  });

  const convergeOpacity = convergeAnim.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [1, 0.9, 0],
  });

  // Shockwave 1 styles
  const sw1Scale = shockwave1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 2.6],
  });
  const sw1Opacity = shockwave1.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0.95, 0.85, 0.2, 0],
  });

  // Shockwave 2 styles
  const sw2Scale = shockwave2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 2.1],
  });
  const sw2Opacity = shockwave2.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0.9, 0.75, 0.15, 0],
  });

  // Core flash styles
  const flashScale = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1.8],
  });

  // Badge styles
  const badgeTranslateY = badgeAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [targetY - 15, targetY - 38, targetY - 55],
  });
  const badgeOpacity = badgeAnim.interpolate({
    inputRange: [0, 0.3, 1, 1.4, 2],
    outputRange: [0, 1, 1, 0.8, 0],
  });
  const badgeScale = badgeAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0.5, 1.05, 0.9],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 1. Converging Element A */}
      <Animated.View
        style={[
          styles.convergingOrb,
          {
            left: posXA,
            top: posYA,
            transform: [{ scale: convergeScale }],
            opacity: convergeOpacity,
            borderColor: elementA.color,
            shadowColor: elementA.color,
          },
        ]}
      >
        <ElementIcon path={elementA.svgPath} color={elementA.color} size={28} />
      </Animated.View>

      {/* 2. Converging Element B */}
      <Animated.View
        style={[
          styles.convergingOrb,
          {
            left: posXB,
            top: posYB,
            transform: [{ scale: convergeScale }],
            opacity: convergeOpacity,
            borderColor: elementB.color,
            shadowColor: elementB.color,
          },
        ]}
      >
        <ElementIcon path={elementB.svgPath} color={elementB.color} size={28} />
      </Animated.View>

      {/* 3. Central Core Energy Flash */}
      <Animated.View
        style={[
          styles.coreFlash,
          {
            left: centerX - 35,
            top: centerY - 35,
            transform: [{ scale: flashScale }],
            opacity: flashAnim,
            backgroundColor: product.color || '#FFFFFF',
            shadowColor: '#FFFFFF',
          },
        ]}
      />

      {/* 4. Shockwave Ring 1 (Ingredient A Color) */}
      <Animated.View
        style={[
          styles.shockwaveRing,
          {
            left: centerX - 45,
            top: centerY - 45,
            transform: [{ scale: sw1Scale }],
            opacity: sw1Opacity,
            borderColor: elementA.color,
            shadowColor: elementA.color,
          },
        ]}
      />

      {/* 5. Shockwave Ring 2 (Ingredient B Color) */}
      <Animated.View
        style={[
          styles.shockwaveRing,
          {
            left: centerX - 45,
            top: centerY - 45,
            transform: [{ scale: sw2Scale }],
            opacity: sw2Opacity,
            borderColor: elementB.color,
            shadowColor: elementB.color,
          },
        ]}
      />

      {/* 6. Dynamic Elemental Particles */}
      {particles.map((p) => {
        const radX = Math.cos(p.angle) * p.distance;
        const radY = Math.sin(p.angle) * p.distance + p.driftY;

        const partX = burstProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, radX],
        });
        const partY = burstProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, radY],
        });
        const partScale = burstProgress.interpolate({
          inputRange: [0, 0.25, 0.8, 1],
          outputRange: [0.2, 1.25, 0.85, 0],
        });
        const partOpacity = burstProgress.interpolate({
          inputRange: [0, 0.1, 0.7, 1],
          outputRange: [0, 1, 0.8, 0],
        });
        const partRotation = burstProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [`${p.rotation}deg`, `${p.rotation + 180}deg`],
        });

        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particleWrapper,
              {
                left: centerX,
                top: centerY,
                transform: [
                  { translateX: partX },
                  { translateY: partY },
                  { scale: partScale },
                  { rotate: partRotation },
                ],
                opacity: partOpacity,
              },
            ]}
          >
            {p.shape === 'sparkle' ? (
              <SparkleStar color={p.color} size={p.size * 1.5} />
            ) : p.shape === 'diamond' ? (
              <View
                style={[
                  styles.diamondParticle,
                  {
                    width: p.size,
                    height: p.size,
                    backgroundColor: p.color,
                    shadowColor: p.color,
                  },
                ]}
              />
            ) : p.shape === 'ember' ? (
              <View
                style={[
                  styles.emberParticle,
                  {
                    width: p.size * 0.7,
                    height: p.size * 1.4,
                    backgroundColor: p.color,
                    shadowColor: p.color,
                  },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.circleParticle,
                  {
                    width: p.size,
                    height: p.size,
                    borderRadius: p.size / 2,
                    backgroundColor: p.color,
                    shadowColor: p.color,
                  },
                ]}
              />
            )}
          </Animated.View>
        );
      })}

      {/* 7. Floating Celebration Banner */}
      <Animated.View
        style={[
          styles.badgeContainer,
          {
            left: centerX - 70,
            top: badgeTranslateY,
            opacity: badgeOpacity,
            transform: [{ scale: badgeScale }],
            borderColor: product.color,
            shadowColor: product.color,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: product.color }]}>
          ✨ {productName} ✨
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  convergingOrb: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#121926',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 8,
  },
  coreFlash: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  shockwaveRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 12,
  },
  particleWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleParticle: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 6,
    elevation: 4,
  },
  diamondParticle: {
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  emberParticle: {
    borderRadius: 99,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeContainer: {
    position: 'absolute',
    width: 140,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 14, 23, 0.92)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 7,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    userSelect: 'none' as any,
  },
});
