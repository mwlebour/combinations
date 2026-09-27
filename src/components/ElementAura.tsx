import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AURA_CONFIG, AuraSpec, ParticleDirection, ParticleShape } from '../config/auras';

const AURA_SIZE = 120;
const TILE_SIZE = 80;
const CENTER = AURA_SIZE / 2;

// Drives a value 0 -> 1 -> 0(instant) -> 1 ... forever, optionally offset by a start delay.
// A reset from 1 back to 0 is used both for looping timelines (fine to jump while invisible)
// and for full-circle rotations (360deg looks identical to 0deg, so the jump is invisible).
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

// Drives a smooth back-and-forth 0 -> 1 -> 0 (no jump), for organic flicker/pulse motion.
const usePingPong = (duration: number, delay: number, easing = Easing.inOut(Easing.quad)) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [value, duration, delay, easing]);
  return value;
};

// --- Particles: drifting motes used for sand, ice frost, and crude oil bubbles ---

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
  const isDown = direction === 'down';
  const isUp = direction === 'up';

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: isUp ? [8, -46] : isDown ? [-8, 46] : [0, 0],
  });
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'side' ? [-16, 16] : [0, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });
  const isDiamond = shape === 'sparkle' || shape === 'frost';
  const scale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: isDiamond ? [0.3, 1, 0.3] : [0.75, 1, 0.75],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top: isDown ? CENTER - 46 : undefined,
        bottom: !isDown ? CENTER - 8 : undefined,
        width: size,
        height: size,
        borderRadius: shape === 'grain' ? 1 : size / 2,
        backgroundColor: color,
        opacity,
        transform: [
          { translateY },
          { translateX },
          { scale },
          { rotate: isDiamond ? '45deg' : '0deg' },
        ],
      }}
    />
  );
};

const ParticleAura = ({ spec }: { spec: AuraSpec }) => {
  const particles = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => ({
        left: CENTER - 30 + i * 14 + (i % 2 === 0 ? -6 : 6),
        size: spec.shape === 'sparkle' || spec.shape === 'frost' ? 6 : spec.shape === 'bubble' ? 7 : 4 + (i % 3),
        duration: 1800 + i * 260,
        delay: i * 340,
        color: i % 2 === 0 ? spec.color : spec.secondaryColor || spec.color,
      })),
    [spec.shape, spec.color, spec.secondaryColor]
  );

  return (
    <>
      {particles.map((p, i) => (
        <Particle key={i} {...p} shape={spec.shape || 'dust'} direction={spec.direction || 'up'} />
      ))}
    </>
  );
};

// --- Ripple: expanding rings, used for water ---

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

// --- Flame: layered flickering flame silhouettes, used for fire ---

const FLAME_PATH =
  'M12 2C9 6 6 9 6 13a6 6 0 0 0 12 0c0-2-1-4-2-5 .5 2-1 3-2 3-1 0-1.5-1-1-3 .5-2-.5-4-1-6Z';

const FlameLayer = ({
  color,
  width,
  height,
  left,
  bottom,
  duration,
  delay,
  flickerRange,
}: {
  color: string;
  width: number;
  height: number;
  left: number;
  bottom: number;
  duration: number;
  delay: number;
  flickerRange: [number, number];
}) => {
  const progress = usePingPong(duration, delay);
  const scaleY = progress.interpolate({ inputRange: [0, 1], outputRange: flickerRange });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        bottom,
        opacity,
        transform: [{ scaleY }, { rotate }],
      }}
    >
      <Svg width={width} height={height} viewBox="0 0 24 24">
        <Path d={FLAME_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
};

const FlameAura = ({ spec }: { spec: AuraSpec }) => (
  <>
    <FlameLayer
      color={spec.color}
      width={48}
      height={58}
      left={CENTER - 24}
      bottom={CENTER - 48}
      duration={900}
      delay={0}
      flickerRange={[0.88, 1.1]}
    />
    <FlameLayer
      color={spec.secondaryColor || spec.color}
      width={26}
      height={34}
      left={CENTER - 13}
      bottom={CENTER - 42}
      duration={620}
      delay={100}
      flickerRange={[0.82, 1.18]}
    />
  </>
);

// --- Orbit: small debris chunks circling the tile, used for earth ---

const OrbitAura = ({ spec }: { spec: AuraSpec }) => {
  const progress = useLoop(4200, 0, Easing.linear);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const chunks = useMemo(
    () => [0, 90, 180, 270].map((angle, i) => ({
      angle,
      size: i % 2 === 0 ? 8 : 6,
      color: i % 2 === 0 ? spec.color : spec.secondaryColor || spec.color,
    })),
    [spec.color, spec.secondaryColor]
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: AURA_SIZE, height: AURA_SIZE, transform: [{ rotate }] }}
    >
      {chunks.map((c, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: CENTER - c.size / 2,
            left: CENTER - c.size / 2,
            width: c.size,
            height: c.size,
            borderRadius: 2,
            backgroundColor: c.color,
            transform: [{ rotate: `${c.angle}deg` }, { translateY: -46 }, { rotate: '15deg' }],
          }}
        />
      ))}
    </Animated.View>
  );
};

// --- Wind: curved gusts sweeping across, used for air ---

const WindGust = ({ delay, top, color, scaleY }: { delay: number; top: number; color: string; scaleY: number }) => {
  const progress = useLoop(1500, delay, Easing.inOut(Easing.quad));
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', top, opacity, transform: [{ translateX }, { scaleY }] }}
    >
      <Svg width={54} height={16} viewBox="0 0 24 12">
        <Path d="M1 6 C 7 1, 13 11, 23 6" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
};

const WindAura = ({ spec }: { spec: AuraSpec }) => (
  <>
    <WindGust delay={0} top={CENTER - 26} color={spec.color} scaleY={1} />
    <WindGust delay={380} top={CENTER} color={spec.color} scaleY={-0.8} />
    <WindGust delay={760} top={CENTER + 24} color={spec.color} scaleY={0.6} />
  </>
);

// --- Shine: a rotating glint of light, used for metal ---

const ShineAura = ({ spec }: { spec: AuraSpec }) => {
  const progress = useLoop(spec.speed ?? 1700, 0, Easing.linear);
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', width: AURA_SIZE, height: AURA_SIZE, transform: [{ rotate }] }}
    >
      <View
        style={{
          position: 'absolute',
          top: CENTER - 40,
          left: CENTER - 2,
          width: 4,
          height: 22,
          borderRadius: 2,
          backgroundColor: spec.color,
          shadowColor: spec.color,
          shadowOpacity: 0.9,
          shadowRadius: 6,
        }}
      />
      {spec.secondaryColor ? (
        <View
          style={{
            position: 'absolute',
            top: CENTER + 30,
            left: CENTER - 1,
            width: 2,
            height: 10,
            borderRadius: 1,
            backgroundColor: spec.secondaryColor,
            shadowColor: spec.secondaryColor,
            shadowOpacity: 0.8,
            shadowRadius: 4,
          }}
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            top: CENTER + 18,
            left: CENTER - 1,
            width: 2,
            height: 12,
            borderRadius: 1,
            backgroundColor: spec.color,
            opacity: 0.45,
          }}
        />
      )}
    </Animated.View>
  );
};

// --- Leaf: falling, swaying leaves, used for wood ---

const LEAF_PATH = 'M12 2C6 8 4 14 8 20c2 2 6 2 8 0 4-6 2-12-4-18Z';

const Leaf = ({
  delay,
  left,
  duration,
  color,
  driftDir,
}: {
  delay: number;
  left: number;
  duration: number;
  color: string;
  driftDir: 1 | -1;
}) => {
  const progress = useLoop(duration, delay, Easing.linear);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-46, 46] });
  const translateX = progress.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: driftDir > 0 ? [0, 9, -5, 9, 0] : [0, -9, 5, -9, 0],
  });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${driftDir * 200}deg`] });
  const opacity = progress.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left,
        top: CENTER - 30,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    >
      <Svg width={11} height={11} viewBox="0 0 24 24">
        <Path d={LEAF_PATH} fill={color} />
      </Svg>
    </Animated.View>
  );
};

const LeafAura = ({ spec }: { spec: AuraSpec }) => {
  const leaves = useMemo(
    () =>
      Array.from({ length: 4 }).map((_, i) => ({
        left: CENTER - 24 + i * 16,
        duration: 2600 + i * 320,
        delay: i * 450,
        color: i % 2 === 0 ? spec.color : spec.secondaryColor || spec.color,
        driftDir: (i % 2 === 0 ? 1 : -1) as 1 | -1,
      })),
    [spec.color, spec.secondaryColor]
  );

  return (
    <>
      {leaves.map((l, i) => (
        <Leaf key={i} {...l} />
      ))}
    </>
  );
};

// --- Bolt: flickering lightning strikes, used for lightning ---

const BOLT_PATH = 'M13 0 L3 14 H10 L7 24 L21 8 H12 L13 0 Z';

const BoltStrike = ({
  delay,
  x,
  boltScale,
  mirrored,
}: {
  delay: number;
  x: number;
  boltScale: number;
  mirrored?: boolean;
}) => {
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
      <BoltStrike delay={0} x={CENTER - 34} boltScale={1} />
      <BoltStrike delay={1500} x={CENTER + 12} boltScale={0.7} mirrored />
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
      {spec.type === 'flame' && <FlameAura spec={spec} />}
      {spec.type === 'orbit' && <OrbitAura spec={spec} />}
      {spec.type === 'wind' && <WindAura spec={spec} />}
      {spec.type === 'shine' && <ShineAura spec={spec} />}
      {spec.type === 'leaf' && <LeafAura spec={spec} />}
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
