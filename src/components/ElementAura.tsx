import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AURA_CONFIG, AuraSpec, ParticleDirection, ParticleShape } from '../config/auras';

const AURA_SIZE = 120;
const TILE_SIZE = 80;

// Drives a value 0 -> 1 -> 0(instant) -> 1 ... forever, optionally offset by a start delay.
const useLoop = (duration: number, delay: number, easing = Easing.linear) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [value, duration, delay, easing]);
  return value;
};

const Particle = ({
  duration,
  delay,
  color,
  shape,
  direction,
  left,
  size,
}: {
  duration: number;
  delay: number;
  color: string;
  shape: ParticleShape;
  direction: ParticleDirection;
  left: number;
  size: number;
}) => {
  const progress = useLoop(duration, delay);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'up' ? [8, -46] : [0, 0],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'side' ? [-16, 16] : [0, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: shape === 'sparkle' ? [0.3, 1, 0.3] : [0.75, 1, 0.75],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        bottom: AURA_SIZE / 2 - 8,
        width: size,
        height: size,
        borderRadius: shape === 'grain' ? 1 : size / 2,
        backgroundColor: color,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { scale },
          { rotate: shape === 'sparkle' ? '45deg' : '0deg' },
        ],
      }}
    />
  );
};

const ParticleAura = ({ spec }: { spec: AuraSpec }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        left: AURA_SIZE / 2 - 30 + i * 14 + (i % 2 === 0 ? -6 : 6),
        size: spec.shape === 'sparkle' ? 6 : spec.shape === 'bubble' ? 7 : 4 + (i % 3),
        duration: 1800 + i * 260,
        delay: i * 340,
        color: i % 2 === 0 ? spec.color : spec.secondaryColor || spec.color,
      })),
    [spec.shape, spec.color, spec.secondaryColor]
  );

  return (
    <>
      {particles.map((p, i) => (
        <Particle
          key={i}
          {...p}
          shape={spec.shape || 'dust'}
          direction={spec.direction || 'up'}
        />
      ))}
    </>
  );
};

const RippleRing = ({ delay, color }: { delay: number; color: string }) => {
  const progress = useLoop(2200, delay, Easing.out(Easing.quad));
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.6] });
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.6, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 2,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
};

const RippleAura = ({ spec }: { spec: AuraSpec }) => (
  <>
    <RippleRing delay={0} color={spec.color} />
    <RippleRing delay={1100} color={spec.color} />
  </>
);

const SweepAura = ({ spec }: { spec: AuraSpec }) => {
  const progress = useLoop(1600, 900, Easing.inOut(Easing.quad));
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-AURA_SIZE, AURA_SIZE] });
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.5, 0.9, 1], outputRange: [0, 1, 1, 1, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: AURA_SIZE / 2 - 50,
        width: 14,
        height: 100,
        backgroundColor: spec.color,
        opacity,
        transform: [{ translateX }, { rotate: '20deg' }],
      }}
    />
  );
};

// A jagged lightning bolt silhouette (viewBox 0 0 24 24).
const BOLT_PATH = 'M13 0 L3 14 H10 L7 24 L21 8 H12 L13 0 Z';

const BoltStrike = ({ delay, x, boltScale, mirrored }: { delay: number; x: number; boltScale: number; mirrored?: boolean }) => {
  const progress = useLoop(2600, delay, Easing.linear);
  const opacity = progress.interpolate({
    inputRange: [0, 0.04, 0.09, 0.13, 0.2, 1],
    outputRange: [0, 1, 0.2, 1, 0, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x,
        top: 2,
        opacity,
        transform: [{ scale: boltScale }, { scaleX: mirrored ? -1 : 1 }],
      }}
    >
      <Svg width={22} height={30} viewBox="0 0 24 24">
        <Path d={BOLT_PATH} fill="#FFFDE7" stroke="#FFF176" strokeWidth={0.5} />
      </Svg>
    </Animated.View>
  );
};

const BoltAura = ({ spec }: { spec: AuraSpec }) => {
  const flash = useLoop(2600, 0, Easing.linear);
  const flashOpacity = flash.interpolate({
    inputRange: [0, 0.04, 0.08, 0.12, 0.16, 1],
    outputRange: [0, 0.5, 0.05, 0.35, 0, 0],
  });
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: AURA_SIZE,
          height: AURA_SIZE,
          borderRadius: AURA_SIZE / 2,
          backgroundColor: spec.color,
          opacity: flashOpacity,
        }}
      />
      <BoltStrike delay={0} x={AURA_SIZE / 2 - 34} boltScale={1} />
      <BoltStrike delay={1500} x={AURA_SIZE / 2 + 12} boltScale={0.7} mirrored />
    </>
  );
};

interface ElementAuraProps {
  elementId: string;
}

// Renders a looping, themed background effect behind an element tile on the board
// (e.g. lightning strikes flashing behind the lightning element). No-op for
// elements without a defined aura.
export const ElementAura = ({ elementId }: ElementAuraProps) => {
  const spec = AURA_CONFIG[elementId];
  if (!spec) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      {spec.type === 'particles' && <ParticleAura spec={spec} />}
      {spec.type === 'ripple' && <RippleAura spec={spec} />}
      {spec.type === 'sweep' && <SweepAura spec={spec} />}
      {spec.type === 'bolt' && <BoltAura spec={spec} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: AURA_SIZE,
    height: AURA_SIZE,
    top: -(AURA_SIZE - TILE_SIZE) / 2,
    left: -(AURA_SIZE - TILE_SIZE) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: AURA_SIZE / 2,
  },
});
