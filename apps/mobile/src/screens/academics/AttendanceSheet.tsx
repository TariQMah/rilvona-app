import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/typography';
import type {
  AttendanceCourse,
  AttendanceHistoryEntry,
  TimetableSlotItem,
} from '../../api/types';
import { ClassPlanner } from './ClassPlanner';
import { Segmented } from './PageShell';
import { cu, Icon, Ring, Trend } from './ui/graphics';
import {
  AnimatedBar,
  BottomSheet,
  CountText,
  FadeIn,
  PressScale,
} from './ui/motion';
import { Avatar, Chip, Pill, Surface } from './ui/parts';
import {
  dayLabel,
  slotsOfCourse,
  teachersOfCourse,
  type Teacher,
  historyStats,
  monthGroups,
  planForTarget,
  simulate,
  toneOf,
  trendSeries,
  TARGETS,
  type Tone,
} from './model';

const toneColor: Record<Tone, string> = {
  safe: cu.green,
  edge: cu.orange,
  short: cu.red,
};

const statusStyle: Record<
  AttendanceHistoryEntry['status'],
  { label: string; color: string }
> = {
  PRESENT: { label: 'Present', color: cu.green },
  ABSENT: { label: 'Absent', color: cu.red },
  DUTY_LEAVE: { label: 'Duty leave', color: cu.orange },
  OTHER: { label: 'Other', color: cu.muted },
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One person who teaches the subject: initial, name, what they take, and when and where. */
function TeacherRow({
  teacher,
  divider,
}: {
  teacher: Teacher;
  divider: boolean;
}) {
  const when = [
    teacher.days.map(d => WEEKDAY[d]).join(', '),
    teacher.weekly > 0
      ? `${teacher.weekly} class${teacher.weekly === 1 ? '' : 'es'} a week`
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: divider ? 12 : 0,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: cu.line,
      }}
    >
      <Avatar name={teacher.name} size={44} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: cu.text, fontSize: 16, fontWeight: '800' }}>
          {teacher.name}
        </Text>
        {teacher.roles.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {teacher.roles.map(role => (
              <Pill key={role} label={role} color={cu.blue} />
            ))}
          </View>
        ) : null}
        {when ? (
          <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}>
            {when}
          </Text>
        ) : null}
        {teacher.rooms.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={13} color={cu.muted} />
            <Text
              style={{
                color: cu.muted,
                fontSize: 12,
                fontWeight: '600',
                flexShrink: 1,
              }}
            >
              {teacher.rooms.join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type TabKey = 'overview' | 'plan' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'plan', label: 'Plan' },
  { key: 'history', label: 'History' },
];

function Stepper({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  color: string;
}) {
  const button = (symbol: string, delta: number) => (
    <PressScale
      onPress={() => onChange(Math.max(0, Math.min(60, value + delta)))}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: cu.cardAlt,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: cu.text,
            fontSize: 20,
            fontWeight: '700',
            marginTop: -2,
          }}
        >
          {symbol}
        </Text>
      </View>
    </PressScale>
  );
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: `${color}14`,
        borderRadius: 16,
        padding: 12,
        gap: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {button('−', -1)}
        <Text
          style={{
            color,
            fontSize: 26,
            fontWeight: '800',
            minWidth: 30,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
        {button('+', 1)}
      </View>
    </View>
  );
}

function Body({
  course,
  timetable,
  onClose,
}: {
  course: AttendanceCourse;
  timetable: TimetableSlotItem[];
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const tone = toneOf(course);
  const color = toneColor[tone];
  const [target, setTarget] = useState<number>(Math.round(course.minRequired));
  const [tab, setTab] = useState<TabKey>('overview');
  const [attendNext, setAttendNext] = useState(0);
  const [missNext, setMissNext] = useState(0);
  useEffect(() => {
    setTarget(Math.round(course.minRequired));
    setTab('overview');
    setAttendNext(0);
    setMissNext(0);
  }, [course.id, course.minRequired]);

  const targets = useMemo(
    () =>
      Array.from(
        new Set<number>([...TARGETS, Math.round(course.minRequired)]),
      ).sort((a, b) => a - b),
    [course.minRequired],
  );
  const plan = planForTarget(
    course.attendedClasses,
    course.deliveredClasses,
    target,
  );
  const projected = simulate(
    course.attendedClasses,
    course.deliveredClasses,
    attendNext,
    missNext,
  );
  const delta = Math.round((projected - course.percentage) * 10) / 10;
  const projectedColor = projected >= target ? cu.green : cu.red;
  const courseSlots = useMemo(
    () => slotsOfCourse(course, timetable),
    [course, timetable],
  );
  const stats = useMemo(
    () => historyStats(course.history ?? []),
    [course.history],
  );
  const groups = useMemo(
    () => monthGroups(course.history ?? []),
    [course.history],
  );
  const series = useMemo(
    () => trendSeries(course.history ?? []),
    [course.history],
  );
  const missed = Math.max(0, course.deliveredClasses - course.attendedClasses);
  const teachers = useMemo(
    () => teachersOfCourse(course, courseSlots),
    [course, courseSlots],
  );
  const hasHistory = (course.history ?? []).length > 0;

  const targetChips = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      {targets.map(t => {
        const on = t === target;
        return (
          <Pressable
            key={t}
            onPress={() => setTarget(t)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 9,
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
              }}
            >
              {t}%
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  let headline = '';
  let detail = '';
  if (plan.kind === 'above') {
    headline =
      plan.canMiss === 0
        ? 'No spare classes'
        : `You can miss ${plan.canMiss} more class${
            plan.canMiss === 1 ? '' : 'es'
          }`;
    detail =
      plan.canMiss === 0
        ? `You are right at ${target}%. Missing the next class drops you below it.`
        : `and still stay at ${target}% or above.`;
  } else if (plan.kind === 'below') {
    headline = `Attend the next ${plan.needToAttend} class${
      plan.needToAttend === 1 ? '' : 'es'
    }`;
    detail = `without missing any to reach ${target}%.`;
  } else if (plan.kind === 'impossible') {
    headline = '100% is out of reach';
    detail = 'Missed classes cannot be undone. Pick a lower target.';
  } else {
    headline = 'No classes yet';
    detail = 'Predictions start once the first class is marked.';
  }
  const headlineColor =
    plan.kind === 'above'
      ? cu.green
      : plan.kind === 'below'
      ? cu.orange
      : cu.muted;

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingHorizontal: 20,
          paddingBottom: 8,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: cu.text, fontSize: 22, fontWeight: '800' }}>
            {course.courseName}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 2,
            }}
          >
            <Chip label={course.courseCode} icon="book" />
          </View>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: cu.card,
            borderWidth: 1,
            borderColor: cu.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="close" size={18} />
        </Pressable>
      </View>

      <Segmented options={TABS} value={tab} onChange={setTab} />
      <ScrollView
        key={tab}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 4,
          paddingBottom: 48,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'overview' ? (
          <>
            <FadeIn>
              <Surface
                style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}
              >
                <Ring
                  percent={course.percentage}
                  size={118}
                  stroke={10}
                  color={color}
                >
                  <CountText
                    value={course.percentage}
                    decimals={1}
                    suffix="%"
                    style={{ color: cu.text, fontWeight: '800', fontSize: 22 }}
                  />
                </Ring>
                <View style={{ flex: 1, gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[
                      ['Present', course.attendedClasses, cu.green],
                      ['Held', course.deliveredClasses, cu.text],
                      ['Missed', missed, missed > 0 ? cu.red : cu.muted],
                    ].map(([label, value, tint]) => (
                      <View
                        key={String(label)}
                        style={{
                          flex: 1,
                          backgroundColor: cu.cardAlt,
                          borderRadius: 12,
                          paddingVertical: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: tint as string,
                            fontSize: 18,
                            fontWeight: '800',
                          }}
                        >
                          {value}
                        </Text>
                        <Text
                          style={{
                            color: cu.muted,
                            fontSize: 10,
                            fontWeight: '700',
                            marginTop: 1,
                          }}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {String(label).toUpperCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Pill
                    label={
                      tone === 'short'
                        ? 'Below requirement'
                        : tone === 'edge'
                        ? 'On the edge'
                        : 'On track'
                    }
                    color={color}
                  />
                  {stats.lastMarked ? (
                    <Text style={{ color: cu.muted, fontSize: 12 }}>
                      Last class marked {dayLabel(stats.lastMarked)}
                    </Text>
                  ) : null}
                </View>
              </Surface>
            </FadeIn>

            <FadeIn delay={40}>
              <Surface style={{ gap: 12 }}>
                <Text
                  style={{ color: cu.muted, fontSize: 12, fontWeight: '800' }}
                >
                  {teachers.length > 1 ? 'TEACHERS' : 'TEACHER'}
                </Text>
                {teachers.length === 0 ? (
                  <Text style={{ color: cu.muted, lineHeight: 20 }}>
                    The portal did not list a teacher for this subject.
                  </Text>
                ) : (
                  teachers.map((teacher, index) => (
                    <TeacherRow
                      key={teacher.name}
                      teacher={teacher}
                      divider={index > 0}
                    />
                  ))
                )}
              </Surface>
            </FadeIn>
            <FadeIn delay={80}>
              <Surface style={{ gap: 12 }}>
                <Text
                  style={{ color: cu.muted, fontSize: 12, fontWeight: '800' }}
                >
                  PREDICTION · TARGET
                </Text>
                {targetChips}
                <View style={{ gap: 3 }}>
                  <Text
                    style={{
                      color: headlineColor,
                      fontSize: 21,
                      fontWeight: '800',
                    }}
                  >
                    {headline}
                  </Text>
                  <Text style={{ color: cu.muted, lineHeight: 20 }}>
                    {detail}
                  </Text>
                </View>
                <AnimatedBar
                  percent={course.percentage}
                  color={color}
                  marker={target}
                  height={8}
                />
              </Surface>
            </FadeIn>

            {series.length >= 2 ? (
              <FadeIn delay={200}>
                <Surface style={{ gap: 8, paddingHorizontal: 8 }}>
                  <Text
                    style={{
                      color: cu.muted,
                      fontSize: 12,
                      fontWeight: '800',
                      paddingHorizontal: 8,
                    }}
                  >
                    ATTENDANCE TREND
                  </Text>
                  <Trend
                    series={series}
                    target={target}
                    width={width - 40 - 18}
                    color={color}
                  />
                </Surface>
              </FadeIn>
            ) : null}
          </>
        ) : null}
        {tab === 'plan' ? (
          <>
            <FadeIn>
              <Surface style={{ gap: 10 }}>
                <Text
                  style={{ color: cu.muted, fontSize: 12, fontWeight: '800' }}
                >
                  TARGET
                </Text>
                {targetChips}
              </Surface>
            </FadeIn>
            <FadeIn delay={140}>
              {courseSlots.length > 0 ? (
                <ClassPlanner
                  course={course}
                  slots={courseSlots}
                  target={target}
                />
              ) : (
                <Surface style={{ gap: 12 }}>
                  <Text
                    style={{ color: cu.muted, fontSize: 12, fontWeight: '800' }}
                  >
                    WHAT IF…
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Stepper
                      label="Attend next"
                      value={attendNext}
                      onChange={setAttendNext}
                      color={cu.green}
                    />
                    <Stepper
                      label="Miss next"
                      value={missNext}
                      onChange={setMissNext}
                      color={cu.red}
                    />
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      gap: 10,
                    }}
                  >
                    <CountText
                      value={projected}
                      decimals={1}
                      suffix="%"
                      style={{
                        color: projectedColor,
                        fontSize: 34,
                        fontWeight: '800',
                      }}
                    />
                    <Text
                      style={{
                        color:
                          delta === 0
                            ? cu.muted
                            : delta > 0
                            ? cu.green
                            : cu.red,
                        fontWeight: '800',
                      }}
                    >
                      {delta === 0
                        ? 'no change'
                        : `${delta > 0 ? '+' : ''}${delta}%`}
                    </Text>
                  </View>
                  <Text style={{ color: cu.muted, fontSize: 12 }}>
                    {projected >= target
                      ? `That keeps you above ${target}%.`
                      : `That would leave you below ${target}%.`}
                  </Text>
                </Surface>
              )}
            </FadeIn>
          </>
        ) : null}
        {tab === 'history' ? (
          <>
            {hasHistory ? (
              <FadeIn delay={240}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    ['Current streak', `${stats.streak}`, cu.blue],
                    ['Present', `${stats.present}`, cu.green],
                    ['Absent', `${stats.absent}`, cu.red],
                  ].map(([label, value, tint]) => (
                    <View
                      key={String(label)}
                      style={{
                        flex: 1,
                        backgroundColor: cu.card,
                        borderRadius: 16,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: cu.line,
                      }}
                    >
                      <Text
                        style={{
                          color: tint as string,
                          fontSize: 22,
                          fontWeight: '800',
                        }}
                      >
                        {value}
                      </Text>
                      <Text
                        style={{
                          color: cu.muted,
                          fontSize: 11,
                          fontWeight: '700',
                          marginTop: 2,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </FadeIn>
            ) : null}

            <Text
              style={{
                color: cu.text,
                fontSize: 20,
                fontWeight: '800',
                marginTop: 0,
              }}
            >
              Attendance history
            </Text>
            {!hasHistory ? (
              <Surface>
                <Text style={{ color: cu.muted, lineHeight: 20 }}>
                  Lecture-by-lecture history is not loaded yet. Refresh from
                  CUIMS (the refresh button on Home) to load it.
                </Text>
              </Surface>
            ) : (
              groups.map(group => (
                <View key={group.key} style={{ gap: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: cu.text,
                        fontWeight: '800',
                        fontSize: 15,
                      }}
                    >
                      {group.label}
                    </Text>
                    <Text
                      style={{
                        color: cu.muted,
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {group.present} present · {group.absent} absent
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: cu.card,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: cu.line,
                      overflow: 'hidden',
                    }}
                  >
                    {group.entries.map((entry, index) => {
                      const look = statusStyle[entry.status];
                      return (
                        <View
                          key={`${entry.date}-${entry.timing}-${index}`}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderTopWidth: index === 0 ? 0 : 1,
                            borderTopColor: cu.line,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: look.color,
                            }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: cu.text, fontWeight: '700' }}>
                              {dayLabel(entry.date)}
                            </Text>
                            {entry.timing ? (
                              <Text
                                style={{
                                  color: cu.muted,
                                  fontSize: 12,
                                  marginTop: 1,
                                }}
                              >
                                {entry.timing}
                              </Text>
                            ) : null}
                          </View>
                          <Pill label={look.label} color={look.color} />
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function AttendanceSheet({
  course,
  timetable = [],
  visible,
  onClose,
}: {
  course: AttendanceCourse | null;
  timetable?: TimetableSlotItem[];
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.92}>
      {course ? (
        <Body course={course} timetable={timetable} onClose={onClose} />
      ) : null}
    </BottomSheet>
  );
}
