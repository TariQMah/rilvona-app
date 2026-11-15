import { useEffect, useRef } from 'react';
import { Animated, Easing, StatusBar, StyleSheet, View } from 'react-native';
import { Text } from './typography';
import { BrandLogo } from './ui';

const BG = '#000000';
const TEXT = '#f5f5f7';
const MUTED = '#8d8d93';
const DOT_COUNT = 3;

/**
 * The animated splash. Android and iOS show the logo on this same dark background the moment the app starts (native
 * splash), so this picks up from exactly the same picture: the logo stays where it is, a soft white ring pulses behind it,
 * then the name and tagline rise in and three dots pulse while the app finishes loading.
 *
 * `visible` going false fades the whole screen out (and the logo grows slightly), then `onHidden` is called.
 */
export function SplashScreen({
  visible,
  onHidden,
}: {
  visible: boolean;
  onHidden?: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const intro = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const dots = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.3)),
  ).current;

  useEffect(() => {
    const ring = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const rise = Animated.timing(intro, {
      toValue: 1,
      duration: 650,
      delay: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const blink = Animated.loop(
      Animated.stagger(
        160,
        dots.map(value =>
          Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0.3,
              duration: 320,
              useNativeDriver: true,
            }),
            Animated.delay(480),
          ]),
        ),
      ),
    );
    ring.start();
    rise.start();
    blink.start();
    return () => {
      ring.stop();
      rise.stop();
      blink.stop();
    };
  }, [pulse, intro, dots]);

  useEffect(() => {
    if (visible) return;
    const out = Animated.timing(exit, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    out.start(({ finished }) => {
      if (finished) onHidden?.();
    });
    return () => out.stop();
  }, [visible, exit, onHidden]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.35, 0],
  });
  const rise = intro.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const logoScale = exit.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.12],
  });
  const opacity = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, styles.root, { opacity }]}
      accessibilityLabel="Rilvona is starting"
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.ring,
            { opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: logoScale }] }}>
          <BrandLogo size={144} />
        </Animated.View>
        <Animated.View
          style={[
            styles.words,
            { opacity: intro, transform: [{ translateY: rise }] },
          ]}
        >
          <Text style={styles.name}>Rilvona</Text>
          <Text style={styles.tagline}>
            Your smart companion for university life
          </Text>
        </Animated.View>
      </View>
      <View style={styles.dots}>
        {dots.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                opacity: value,
                transform: [{ scale: value }],
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  center: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  ring: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: TEXT,
  },
  // the words hang below the logo without moving it, so the logo sits exactly where the native splash drew it
  words: {
    position: 'absolute',
    top: 144 + 28,
    alignItems: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: 24,
  },
  name: { color: TEXT, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  tagline: { color: MUTED, fontSize: 15, textAlign: 'center' },
  dots: { position: 'absolute', bottom: 64, flexDirection: 'row', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEXT },
});
