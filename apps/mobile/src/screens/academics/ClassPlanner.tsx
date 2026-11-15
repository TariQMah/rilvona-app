import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../components/typography';
import type { AttendanceCourse, TimetableSlotItem } from '../../api/types';
import { AnimatedBar, CountText, PressScale } from './ui/motion';
import { cu, Icon } from './ui/graphics';
import { Surface } from './ui/parts';
import {
  clock12,
  maxSkippable,
  projectPlan,
  spreadSkips,
  upcomingSessions,
} from './model';

const HORIZONS = [
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 28, label: '4 weeks' },
];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function dayText(date: Date, today: Date): string {
  const diff = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).getTime()) /
      86400000,
  );
  const base = `${WEEKDAY[date.getDay()]} ${date.getDate()} ${
    MONTH[date.getMonth()]
  }`;
  return diff === 0
    ? `Today · ${base}`
    : diff === 1
    ? `Tomorrow · ${base}`
    : base;
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: on ? cu.blue : cu.cardAlt,
        borderWidth: 1,
        borderColor: on ? cu.blue : cu.line,
      }}
    >
      <Text
        style={{
          color: on ? '#fff' : cu.text,
          fontWeight: '800',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type Props = {
  course: AttendanceCourse;
  slots: TimetableSlotItem[];
  target: number;
};

/**
 * Plans the next weeks from the real timetable: every upcoming class of this subject can be marked attend or skip and
 * the projected attendance updates. Assumes each timetable class takes place (holidays are not known).
 */
export function ClassPlanner({ course, slots, target }: Props) {
  const today = useMemo(() => new Date(), []);
  const [days, setDays] = useState(14);
  const sessions = useMemo(
    () => upcomingSessions(slots, today, days),
    [slots, today, days],
  );
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  useEffect(() => setSkipped(new Set()), [course.id, days]);

  const attend = sessions.map(s => !skipped.has(s.key));
  const projection = projectPlan(
    course.attendedClasses,
    course.deliveredClasses,
    attend,
  );
  const final = Math.round(projection.finalPercent * 10) / 10;
  const delta =
    Math.round((projection.finalPercent - course.percentage) * 10) / 10;
  const allowed = maxSkippable(
    course.attendedClasses,
    course.deliveredClasses,
    sessions.length,
    target,
  );
  const skippedCount = attend.filter(x => !x).length;
  const ok = projection.finalPercent + 1e-9 >= target;
  const color = ok ? cu.green : cu.red;
  const perWeek = new Set(slots.map(s => `${s.dayOfWeek}|${s.startTime}`)).size;

  const applySmart = () => {
    if (allowed === null) return;
    const flags = spreadSkips(sessions.length, allowed);
    setSkipped(new Set(sessions.filter((_, i) => !flags[i]).map(s => s.key)));
  };
  const toggle = (key: string) =>
    setSkipped(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const grouped: {
    label: string;
    items: { index: number; key: string; slot: TimetableSlotItem }[];
  }[] = [];
  sessions.forEach((s, index) => {
    const label = dayText(s.date, today);
    const last = grouped[grouped.length - 1];
    if (last?.label === label)
      last.items.push({ index, key: s.key, slot: s.slot });
    else grouped.push({ label, items: [{ index, key: s.key, slot: s.slot }] });
  });

  return (
    <Surface style={{ gap: 14 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '800' }}>
          PLAN FROM YOUR TIMETABLE
        </Text>
        <Text style={{ color: cu.muted, fontSize: 12, lineHeight: 18 }}>
          {perWeek} class{perWeek === 1 ? '' : 'es'} a week. Tap a class to skip
          it and see where your attendance lands.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {HORIZONS.map(h => (
          <Chip
            key={h.days}
            label={h.label}
            on={h.days === days}
            onPress={() => setDays(h.days)}
          />
        ))}
      </View>

      {sessions.length === 0 ? (
        <Text style={{ color: cu.muted }}>
          No classes of this subject in the next {days} days.
        </Text>
      ) : (
        <>
          <View
            style={{
              backgroundColor: `${color}14`,
              borderRadius: 18,
              padding: 14,
              gap: 10,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}
            >
              <CountText
                value={final}
                decimals={1}
                suffix="%"
                style={{ color, fontSize: 36, fontWeight: '800' }}
              />
              <Text
                style={{
                  color: delta === 0 ? cu.muted : delta > 0 ? cu.green : cu.red,
                  fontWeight: '800',
                }}
              >
                {delta === 0
                  ? 'no change'
                  : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}%`}
              </Text>
            </View>
            <AnimatedBar
              percent={projection.finalPercent}
              color={color}
              marker={target}
              height={7}
            />
            <Text style={{ color: cu.text, fontWeight: '700' }}>
              {ok
                ? `You finish ${
                    days === 7 ? 'the week' : `these ${days / 7} weeks`
                  } at or above ${target}%.`
                : `You would end ${(target - projection.finalPercent).toFixed(
                    1,
                  )}% below ${target}%.`}
            </Text>
            <Text style={{ color: cu.muted, fontSize: 12 }}>
              {skippedCount} of {sessions.length} classes skipped
              {projection.lowest < course.percentage - 0.05
                ? ` · lowest point ${projection.lowest.toFixed(1)}%`
                : ''}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip
              label="Attend all"
              on={skippedCount === 0}
              onPress={() => setSkipped(new Set())}
            />
            <Chip
              label="Skip all"
              on={skippedCount === sessions.length}
              onPress={() => setSkipped(new Set(sessions.map(s => s.key)))}
            />
            {allowed !== null && allowed > 0 ? (
              <Chip
                label={`Smart plan · skip ${allowed}`}
                on={false}
                onPress={applySmart}
              />
            ) : null}
          </View>
          <Text
            style={{
              color: allowed === null ? cu.orange : cu.muted,
              fontSize: 12,
              lineHeight: 18,
            }}
          >
            {allowed === null
              ? `Even attending every class, you cannot reach ${target}% in this window. Try a longer window.`
              : allowed === 0
              ? `You need to attend all ${sessions.length} to stay at ${target}% or above.`
              : `You can skip at most ${allowed} of these ${sessions.length} and still finish at ${target}% or above.`}
          </Text>

          <View style={{ gap: 14 }}>
            {grouped.map(group => (
              <View key={group.label} style={{ gap: 8 }}>
                <Text
                  style={{ color: cu.text, fontWeight: '800', fontSize: 14 }}
                >
                  {group.label}
                </Text>
                {group.items.map(({ index, key, slot }) => {
                  const skip = skipped.has(key);
                  const running = projection.running[index] ?? 0;
                  return (
                    <PressScale key={key} onPress={() => toggle(key)}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          backgroundColor: cu.cardAlt,
                          borderRadius: 16,
                          padding: 12,
                          opacity: skip ? 0.85 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: `${skip ? cu.red : cu.green}26`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon
                            name={skip ? 'close' : 'check'}
                            size={17}
                            color={skip ? cu.red : cu.green}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: cu.text, fontWeight: '700' }}>
                            {clock12(slot.startTime)} – {clock12(slot.endTime)}
                          </Text>
                          <Text
                            style={{ color: cu.muted, fontSize: 12 }}
                            numberOfLines={1}
                          >
                            {[
                              slot.slotType.charAt(0) +
                                slot.slotType.slice(1).toLowerCase(),
                              slot.room,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text
                            style={{
                              color: skip ? cu.red : cu.green,
                              fontWeight: '800',
                              fontSize: 12,
                            }}
                          >
                            {skip ? 'SKIP' : 'ATTEND'}
                          </Text>
                          <Text
                            style={{
                              color: running >= target ? cu.muted : cu.red,
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {running.toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    </PressScale>
                  );
                })}
              </View>
            ))}
          </View>
        </>
      )}
    </Surface>
  );
}
