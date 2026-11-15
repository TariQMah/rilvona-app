import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text } from '../../../components/typography';
import { cu } from './graphics';

/** Fades and slides children in on mount. `delay` staggers lists. */
export function FadeIn({
  children,
  delay = 0,
  distance = 14,
  scaleFrom,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  scaleFrom?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay: Math.min(delay, 600),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [delay, progress]);
  const transform = [
    {
      translateY: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [distance, 0],
      }),
    },
    ...(scaleFrom !== undefined
      ? [
          {
            scale: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [scaleFrom, 1],
            }),
          },
        ]
      : []),
  ];
  return (
    <Animated.View style={[{ opacity: progress, transform }, style]}>
      {children}
    </Animated.View>
  );
}

/** Springy press feedback for tappable cards. */
export function PressScale({
  children,
  onPress,
  style,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 5,
    }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/** A soft pulsing dot, used for "live" states. */
export function PulseDot({
  color,
  size = 8,
}: {
  color: string;
  size?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View
      style={{
        width: size * 2.4,
        height: size * 2.4,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          width: size * 2.4,
          height: size * 2.4,
          borderRadius: size * 1.2,
          backgroundColor: color,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 0],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1.1],
              }),
            },
          ],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Counts a number up to its target whenever the target changes. */
export function useCountUp(
  target: number | null,
  decimals = 1,
  duration = 850,
): number {
  const [shown, setShown] = useState(0);
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (target === null) return;
    const factor = 10 ** decimals;
    value.setValue(0);
    const id = value.addListener(({ value: v }) =>
      setShown(Math.round(v * factor) / factor),
    );
    Animated.timing(value, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      value.removeListener(id);
      setShown(target);
    });
    return () => {
      value.removeListener(id);
      value.stopAnimation();
    };
  }, [target, decimals, duration, value]);
  return target === null ? 0 : shown;
}

export function CountText({
  value,
  decimals = 1,
  suffix = '',
  style,
}: {
  value: number | null;
  decimals?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const shown = useCountUp(value, decimals);
  return (
    <Text style={style}>
      {value === null ? 'N/A' : `${shown.toFixed(decimals)}${suffix}`}
    </Text>
  );
}

/** Horizontal bar that grows to its percentage; optional marker line (e.g. the 75% target). */
export function AnimatedBar({
  percent,
  color,
  marker,
  height = 6,
}: {
  percent: number;
  color: string;
  marker?: number;
  height?: number;
}) {
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, grow]);
  return (
    <View
      style={{ height, borderRadius: height / 2, backgroundColor: cu.line }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: grow.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
      {marker !== undefined ? (
        <View
          style={{
            position: 'absolute',
            left: `${marker}%`,
            top: -3,
            width: 2,
            height: height + 6,
            backgroundColor: cu.text,
            opacity: 0.55,
          }}
        />
      ) : null}
    </View>
  );
}

/** Chevron that rotates smoothly between closed and open. */
export function Chevron({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, turn]);
  return (
    <Animated.View
      style={{
        transform: [
          {
            rotate: turn.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Pulsing placeholder used while data loads. */
export function Skeleton({
  height,
  radius = 18,
  style,
}: {
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: radius,
          backgroundColor: cu.card,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.5, 1],
          }),
        },
        style,
      ]}
    />
  );
}

/**
 * Bottom sheet that springs up, fades a backdrop and can be dragged down to dismiss.
 * The parent owns `visible`; content stays mounted until the closing animation ends.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  heightRatio = 0.9,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  heightRatio?: number;
}) {
  const { height } = useWindowDimensions();
  const sheetHeight = Math.round(height * heightRatio);
  const offset = useRef(new Animated.Value(sheetHeight)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      offset.setValue(sheetHeight);
      Animated.spring(offset, {
        toValue: 0,
        useNativeDriver: true,
        speed: 14,
        bounciness: 3,
      }).start();
    } else if (mounted) {
      Animated.timing(offset, {
        toValue: sheetHeight,
        duration: 230,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sheetHeight]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1) onClose();
        else
          Animated.spring(offset, {
            toValue: 0,
            useNativeDriver: true,
            speed: 20,
          }).start();
      },
    }),
  ).current;

  if (!mounted) return null;
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={{
            ...({
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            } as const),
            backgroundColor: '#000',
            opacity: offset.interpolate({
              inputRange: [0, sheetHeight],
              outputRange: [0.62, 0],
              extrapolate: 'clamp',
            }),
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={{
            height: sheetHeight,
            backgroundColor: cu.bg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: cu.line,
            overflow: 'hidden',
            transform: [{ translateY: offset }],
          }}
        >
          <View
            {...pan.panHandlers}
            style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 3,
                backgroundColor: cu.line,
              }}
            />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
