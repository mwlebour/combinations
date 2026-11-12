import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

const COLORS = ['#FFD54F', '#F06292', '#4FC3F7', '#66BB6A', '#AB47BC', '#FF7043', '#FFFFFF'];

interface Piece {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  round: boolean;
}

function makePieces(count: number, width: number): Piece[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    size: 6 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 600,
    duration: 1800 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 1080,
    round: Math.random() < 0.3,
  }));
}

/**
 * One-shot burst of falling confetti across the whole screen. Purely
 * decorative: it ignores touches and renders nothing once the pieces land.
 */
export const Confetti = ({ count = 70 }: { count?: number }) => {
  const { width, height } = useWindowDimensions();
  const pieces = useRef(makePieces(count, width)).current;
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = progress.map((value, i) =>
      Animated.timing(value, {
        toValue: 1,
        duration: pieces[i].duration,
        delay: pieces[i].delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      })
    );
    Animated.parallel(animations).start();
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((piece, i) => {
        const value = progress[i];
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: -20,
              left: piece.x,
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 0.45,
              borderRadius: piece.round ? piece.size / 2 : 1,
              backgroundColor: piece.color,
              opacity: value.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
                { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
                { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
};
