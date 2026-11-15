import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const cu = {
  bg: '#0f0f10',
  card: '#1b1b1d',
  cardAlt: '#242427',
  line: '#2c2c30',
  text: '#f5f5f7',
  muted: '#8d8d93',
  blue: '#3b9be8',
  green: '#34c759',
  orange: '#ff9f0a',
  red: '#ff453a',
  purple: '#a374ff',
} as const;

export type IconName =
  | 'marks'
  | 'home'
  | 'calendar'
  | 'chart'
  | 'refresh'
  | 'bell'
  | 'menu'
  | 'clock'
  | 'pin'
  | 'user'
  | 'flask'
  | 'check'
  | 'chevron'
  | 'book'
  | 'doc'
  | 'phone'
  | 'mail'
  | 'arrowUp'
  | 'arrowDown'
  | 'hive'
  | 'unlink'
  | 'shield'
  | 'idcard'
  | 'sparkle'
  | 'close';

export function Icon({
  name,
  size = 22,
  color = cu.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const stroke = {
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'marks' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Circle cx={12} cy={12} r={5} {...stroke} />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
        </>
      ) : null}
      {name === 'home' ? (
        <Path
          d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
          {...stroke}
        />
      ) : null}
      {name === 'calendar' ? (
        <>
          <Rect x={4} y={5} width={16} height={16} rx={2.5} {...stroke} />
          <Path d="M4 10h16M8 3v4M16 3v4" {...stroke} />
          <Circle cx={9} cy={14.5} r={0.9} fill={color} />
          <Circle cx={12} cy={14.5} r={0.9} fill={color} />
          <Circle cx={15} cy={14.5} r={0.9} fill={color} />
        </>
      ) : null}
      {name === 'chart' ? (
        <Path d="M6 20V11M12 20V4M18 20v-6" {...stroke} strokeWidth={3} />
      ) : null}
      {name === 'refresh' ? (
        <Path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" {...stroke} />
      ) : null}
      {name === 'bell' ? (
        <Path
          d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7M10 20a2 2 0 0 0 4 0"
          {...stroke}
        />
      ) : null}
      {name === 'menu' ? (
        <Path d="M4 7h16M4 12h16M4 17h16" {...stroke} />
      ) : null}
      {name === 'clock' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M12 7v5l3 2" {...stroke} />
        </>
      ) : null}
      {name === 'pin' ? (
        <>
          <Path
            d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"
            {...stroke}
          />
          <Circle cx={12} cy={10} r={2.4} {...stroke} />
        </>
      ) : null}
      {name === 'user' ? (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...stroke} />
        </>
      ) : null}
      {name === 'flask' ? (
        <Path
          d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"
          {...stroke}
        />
      ) : null}
      {name === 'check' ? (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M8 12l3 3 5-6" {...stroke} />
        </>
      ) : null}
      {name === 'chevron' ? <Path d="M6 9l6 6 6-6" {...stroke} /> : null}
      {name === 'book' ? (
        <Path
          d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"
          {...stroke}
        />
      ) : null}
      {name === 'doc' ? (
        <Path d="M7 3h7l5 5v13H7zM14 3v5h5" {...stroke} />
      ) : null}
      {name === 'phone' ? (
        <Path
          d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"
          {...stroke}
        />
      ) : null}
      {name === 'mail' ? (
        <>
          <Rect x={3} y={5} width={18} height={14} rx={2.5} {...stroke} />
          <Path d="M3 7l9 6 9-6" {...stroke} />
        </>
      ) : null}
      {name === 'arrowUp' ? (
        <Path d="M12 19V5M6 11l6-6 6 6" {...stroke} />
      ) : null}
      {name === 'arrowDown' ? (
        <Path d="M12 5v14M6 13l6 6 6-6" {...stroke} />
      ) : null}
      {name === 'hive' ? (
        <>
          <Path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z" {...stroke} />
          <Path d="M12 8.5l3.5 2v4L12 16.5l-3.5-2v-4z" {...stroke} />
        </>
      ) : null}
      {name === 'unlink' ? (
        <Path
          d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.700l1-1M4 4l16 16"
          {...stroke}
        />
      ) : null}
      {name === 'idcard' ? (
        <>
          <Path
            d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
            {...stroke}
          />
          <Circle cx={8.5} cy={11} r={2} {...stroke} />
          <Path
            d="M5.5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14 10h4M14 14h4"
            {...stroke}
          />
        </>
      ) : null}
      {name === 'shield' ? (
        <>
          <Path
            d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.200-8-4.500-8-9V6z"
            {...stroke}
          />
          <Path d="M9 12l2 2 4-4" {...stroke} />
        </>
      ) : null}
      {name === 'sparkle' ? (
        <>
          <Path
            d="M10.5 3c.7 4.8 2.5 6.6 7.3 7.3-4.8.7-6.6 2.5-7.3 7.3-.7-4.8-2.5-6.6-7.3-7.3C8 9.6 9.8 7.8 10.5 3z"
            {...stroke}
          />
          <Path
            d="M18.5 15.5c.3 1.7 1 2.4 2.7 2.7-1.7.3-2.4 1-2.7 2.7-.3-1.7-1-2.4-2.7-2.7 1.7-.3 2.4-1 2.7-2.7z"
            {...stroke}
            strokeWidth={1.5}
          />
        </>
      ) : null}
      {name === 'close' ? <Path d="M6 6l12 12M18 6L6 18" {...stroke} /> : null}
    </Svg>
  );
}

/** Circular progress with a centred label. The arc sweeps in on mount and whenever the value changes. */
export function Ring({
  percent,
  size = 64,
  stroke = 6,
  color,
  children,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(sweep, {
      toValue: clamped,
      duration: 950,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, sweep]);
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={cu.line}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={sweep.interpolate({
            inputRange: [0, 100],
            outputRange: [
              `0 ${circumference}`,
              `${circumference} ${circumference}`,
            ],
          })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Line chart of the running attendance percentage with a dashed target line. */
export function Trend({
  series,
  target,
  width,
  height = 120,
  color,
}: {
  series: number[];
  target: number;
  width: number;
  height?: number;
  color: string;
}) {
  const pad = 8;
  const low = Math.max(0, Math.min(...series, target) - 8);
  const high = 100;
  const x = (i: number) =>
    pad + (i * (width - pad * 2)) / Math.max(1, series.length - 1);
  const y = (v: number) =>
    pad + ((high - v) * (height - pad * 2)) / (high - low);
  const points = series.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const last = series[series.length - 1] ?? 0;
  return (
    <Svg width={width} height={height}>
      <Line
        x1={pad}
        x2={width - pad}
        y1={y(target)}
        y2={y(target)}
        stroke={cu.muted}
        strokeWidth={1}
        strokeDasharray="5 5"
      />
      <SvgText
        x={width - pad}
        y={y(target) - 5}
        fill={cu.muted}
        fontSize={10}
        fontWeight="700"
        textAnchor="end"
      >
        {`${target}%`}
      </SvgText>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={x(series.length - 1)} cy={y(last)} r={4.5} fill={color} />
    </Svg>
  );
}

export type RadarPoint = { label: string; percent: number };

/** Polar chart of subject percentages. Needs at least three subjects. */
export function Radar({
  points,
  size,
}: {
  points: RadarPoint[];
  size: number;
}) {
  const center = size / 2;
  const radius = size / 2 - 84;
  const n = points.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, fraction: number) => ({
    x: center + Math.cos(angle(i)) * radius * fraction,
    y: center + Math.sin(angle(i)) * radius * fraction,
  });
  const ring = (fraction: number) =>
    points.map((_, i) => `${at(i, fraction).x},${at(i, fraction).y}`).join(' ');
  const shape = points
    .map(
      (p, i) =>
        `${at(i, Math.max(0, Math.min(100, p.percent)) / 100).x},${
          at(i, Math.max(0, Math.min(100, p.percent)) / 100).y
        }`,
    )
    .join(' ');
  return (
    <Svg width={size} height={size - 70} viewBox={`0 35 ${size} ${size - 70}`}>
      {[0.2, 0.4, 0.6, 0.8, 1].map(f => (
        <Polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke={cu.line}
          strokeWidth={1}
        />
      ))}
      {points.map((_, i) => (
        <Line
          key={i}
          x1={center}
          y1={center}
          x2={at(i, 1).x}
          y2={at(i, 1).y}
          stroke={cu.line}
          strokeWidth={1}
        />
      ))}
      <Polygon
        points={shape}
        fill={cu.blue}
        fillOpacity={0.22}
        stroke={cu.blue}
        strokeWidth={2}
      />
      {points.map((p, i) => {
        const dot = at(i, Math.max(0, Math.min(100, p.percent)) / 100);
        const label = at(i, 1.2);
        const anchor =
          label.x < center - 8
            ? 'end'
            : label.x > center + 8
            ? 'start'
            : 'middle';
        return (
          <G key={`${p.label}-${i}`}>
            <Circle cx={dot.x} cy={dot.y} r={4.5} fill={cu.blue} />
            <SvgText
              x={label.x}
              y={label.y - 2}
              fill={cu.text}
              fontSize={11}
              fontWeight="700"
              textAnchor={anchor}
            >
              {p.label}
            </SvgText>
            <SvgText
              x={label.x}
              y={label.y + 13}
              fill={cu.muted}
              fontSize={12}
              fontWeight="700"
              textAnchor={anchor}
            >
              {`${Math.round(p.percent)}%`}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
