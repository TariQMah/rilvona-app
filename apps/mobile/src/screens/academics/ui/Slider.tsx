import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { PanResponder, View } from 'react-native';
import { cu } from './graphics';

const THUMB = 28;
const HIT = 48;
const TRACK = 6;

type Props = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  color?: string;
  label: string;
};

/**
 * A plain horizontal slider drawn in JavaScript, so it needs no native module. Drag anywhere on the bar; it keeps
 * hold of the touch so a parent ScrollView does not steal it.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  color = cu.blue,
  label,
}: Props) {
  const [width, setWidth] = useState(0);
  const track = useRef<ComponentRef<typeof View>>(null);
  const originX = useRef(0);
  const live = useRef({ min, max, step, onChange, width: 0, value });
  live.current = { min, max, step, onChange, width, value };

  const valueAt = (pageX: number) => {
    const { min: lo, max: hi, step: unit, width: w } = live.current;
    if (w <= 0 || hi <= lo) return lo;
    const ratio = Math.min(1, Math.max(0, (pageX - originX.current) / w));
    const raw = lo + ratio * (hi - lo);
    return Math.min(hi, Math.max(lo, Math.round(raw / unit) * unit));
  };
  const move = (pageX: number) => {
    if (!Number.isFinite(pageX)) return;
    const next = valueAt(pageX);
    if (next !== live.current.value) live.current.onChange(next);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, g) => {
        // Re-measure at touch time so the bar's position is never stale.
        const startX = g.x0;
        if (track.current)
          track.current.measureInWindow(x => {
            originX.current = x;
            move(startX);
          });
        else move(startX);
      },
      onPanResponderMove: (_, g) => move(g.moveX),
    }),
  ).current;

  // Window position of the bar, so touch coordinates can be turned into a value.
  const measure = () =>
    track.current?.measureInWindow(x => {
      originX.current = x;
    });
  useEffect(() => {
    const id = setTimeout(measure, 350);
    return () => clearTimeout(id);
  }, []);

  const ratio = max > min ? (value - min) / (max - min) : 0;
  const x = ratio * width;
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e =>
        onChange(
          Math.min(
            max,
            Math.max(
              min,
              value + (e.nativeEvent.actionName === 'increment' ? step : -step),
            ),
          ),
        )
      }
      style={{ height: HIT, justifyContent: 'center' }}
      {...pan.panHandlers}
    >
      <View
        ref={track}
        onLayout={e => {
          setWidth(e.nativeEvent.layout.width);
          measure();
        }}
        style={{
          height: TRACK,
          borderRadius: TRACK / 2,
          backgroundColor: cu.cardAlt,
        }}
      >
        <View
          style={{
            width: x,
            height: TRACK,
            borderRadius: TRACK / 2,
            backgroundColor: color,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: x - THUMB / 2,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: '#fff',
          borderWidth: 4,
          borderColor: color,
        }}
      />
    </View>
  );
}
