import { useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/typography';
import type { AttendanceCourse, TimetableSlotItem } from '../../api/types';
import { AttendanceSheet } from './AttendanceSheet';
import { EmptyPanel, Pill, TabScroll, TabTitle } from './ui/parts';
import { cu, Icon } from './ui/graphics';
import { AnimatedBar, FadeIn, PressScale, PulseDot } from './ui/motion';
import {
  bunkImpact,
  clock12,
  dateKey,
  dayCounts,
  defaultDay,
  durationLabel,
  findCourse,
  guidanceShort,
  radarLabel,
  slotKeyOf,
  slotMinutes,
  slotProgress,
  slotsForDay,
  subjectColors,
  toMinutes,
  toneOf,
  weekDates,
  type ConnectedOverview,
  type Tone,
} from './model';

const DAYS = [
  { day: 1, short: 'Mon', full: 'Monday' },
  { day: 2, short: 'Tue', full: 'Tuesday' },
  { day: 3, short: 'Wed', full: 'Wednesday' },
  { day: 4, short: 'Thu', full: 'Thursday' },
  { day: 5, short: 'Fri', full: 'Friday' },
  { day: 6, short: 'Sat', full: 'Saturday' },
];
const toneColor: Record<Tone, string> = {
  safe: cu.green,
  edge: cu.orange,
  short: cu.red,
};

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** 10:40 AM becomes 10:40; the day summary above the timeline carries the AM/PM context. */
const clockShort = (time: string) => clock12(time).replace(/\s?[AP]M$/i, '');

const typeLabel = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
const isLab = (type: string) => /^(pra|lab)/i.test(type);

type Mode = 'day' | 'week';

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: cu.card,
        borderRadius: 16,
        padding: 3,
        borderWidth: 1,
        borderColor: cu.line,
      }}
    >
      {(['day', 'week'] as const).map(m => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 13,
            backgroundColor: mode === m ? `${cu.blue}33` : 'transparent',
          }}
        >
          <Text
            style={{
              color: mode === m ? cu.blue : cu.muted,
              fontWeight: '800',
              fontSize: 13,
            }}
          >
            {m === 'day' ? 'Day' : 'Week'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Monday to Saturday of this week with real dates, a dot per class (in the subject's colour) and today marked. */
function DayStrip({
  timetable,
  selected,
  onSelect,
  now,
}: {
  timetable: TimetableSlotItem[];
  selected: number;
  onSelect: (day: number) => void;
  now: Date;
}) {
  const dates = weekDates(now);
  const counts = dayCounts(timetable);
  return (
    <View style={{ flexDirection: 'row', gap: 7 }}>
      {DAYS.map(({ day, short }, index) => {
        const active = day === selected;
        const date = dates[index];
        const isToday = date !== undefined && dateKey(date) === dateKey(now);
        return (
          <View key={day} style={{ flex: 1 }}>
            <PressScale
              onPress={() => onSelect(day)}
              style={{
                alignItems: 'center',
                paddingTop: 10,
                paddingBottom: 9,
                borderRadius: 18,
                backgroundColor: active ? cu.blue : cu.card,
                borderWidth: 1,
                borderColor: active
                  ? cu.blue
                  : isToday
                  ? `${cu.blue}88`
                  : cu.line,
                gap: 3,
              }}
            >
              <Text
                style={{
                  color: active ? '#ffffffcc' : cu.muted,
                  fontWeight: '800',
                  fontSize: 11,
                }}
              >
                {short.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: active ? '#fff' : cu.text,
                  fontWeight: '800',
                  fontSize: 18,
                }}
              >
                {date?.getDate()}
              </Text>
              <Text
                style={{
                  color: active ? '#ffffffcc' : cu.muted,
                  fontSize: 10,
                  fontWeight: '700',
                }}
              >
                {counts[day] ?? 0} cls
              </Text>
            </PressScale>
          </View>
        );
      })}
    </View>
  );
}

/** The day at a glance, plus what skipping the whole day would do to attendance. */
function DaySummary({
  dayName,
  slots,
  data,
  isToday,
  now,
}: {
  dayName: string;
  slots: TimetableSlotItem[];
  data: ConnectedOverview;
  isToday: boolean;
  now: Date;
}) {
  const first = slots[0];
  const last = slots[slots.length - 1];
  const minutes = now.getHours() * 60 + now.getMinutes();
  const done = isToday
    ? slots.filter(s => toMinutes(s.endTime) <= minutes).length
    : 0;
  const labs = slots.filter(s => isLab(s.slotType)).length;
  const total = slots.reduce((sum, s) => sum + slotMinutes(s), 0);
  const impact = useMemo(
    () => bunkImpact(data.attendance, slots),
    [data.attendance, slots],
  );
  if (!first || !last) return null;
  const drop = Math.round((impact.before - impact.after) * 10) / 10;
  return (
    <View
      style={{
        backgroundColor: cu.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: cu.line,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: cu.text, fontSize: 19, fontWeight: '800' }}>
          {dayName}
        </Text>
        {isToday ? <Pill label="TODAY" color={cu.blue} filled /> : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{
            flex: 1,
            textAlign: 'right',
            color: cu.muted,
            fontWeight: '700',
            fontSize: 13,
          }}
        >
          {clock12(first.startTime)} – {clock12(last.endTime)}
        </Text>
      </View>
      <Text
        style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}
        numberOfLines={2}
      >
        {[
          `${slots.length} class${slots.length === 1 ? '' : 'es'}`,
          `${durationLabel(total)} of teaching`,
          labs > 0 ? `${labs} lab${labs === 1 ? '' : 's'}` : null,
          isToday ? `${done} done, ${slots.length - done} left` : null,
        ]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>
      {impact.classes > 0 ? (
        <View
          style={{
            backgroundColor: cu.cardAlt,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 9,
            gap: 4,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text
              style={{
                color: cu.muted,
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.4,
                flexShrink: 1,
              }}
              numberOfLines={1}
            >
              SKIP THE DAY
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}
            >
              <Text
                style={{ color: cu.muted, fontSize: 13, fontWeight: '700' }}
              >
                {impact.before.toFixed(1)}%
              </Text>
              <Text style={{ color: cu.muted, fontSize: 12 }}>→</Text>
              <Text
                style={{
                  color:
                    impact.falls.length > 0 || impact.after < 75
                      ? cu.red
                      : cu.green,
                  fontSize: 18,
                  fontWeight: '800',
                }}
              >
                {impact.after.toFixed(1)}%
              </Text>
              <Text
                style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
              >
                (−{drop})
              </Text>
            </View>
          </View>
          {impact.falls.length > 0 ? (
            <Text
              style={{
                color: cu.red,
                fontSize: 12,
                fontWeight: '700',
                lineHeight: 17,
              }}
              numberOfLines={2}
            >
              {impact.falls.map(f => f.course.courseName).join(', ')} would drop
              below {Math.round(impact.falls[0]?.course.minRequired ?? 75)}%.
            </Text>
          ) : impact.alreadyShort > 0 ? (
            <Text style={{ color: cu.orange, fontSize: 12, fontWeight: '700' }}>
              {impact.alreadyShort} subject
              {impact.alreadyShort === 1 ? ' is' : 's are'} already below the
              minimum.
            </Text>
          ) : (
            <Text style={{ color: cu.green, fontSize: 12, fontWeight: '700' }}>
              Every subject stays above its minimum.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function GapRow({ minutes }: { minutes: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 80,
        paddingVertical: 2,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: cu.line }} />
      <Text style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}>
        {minutes <= 30 ? 'Break' : 'Free period'} · {durationLabel(minutes)}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: cu.line }} />
    </View>
  );
}

type SlotState = 'past' | 'live' | 'upcoming' | 'plain';

function TimelineCard({
  slot,
  course,
  color,
  state,
  now,
  onOpen,
  last,
}: {
  slot: TimetableSlotItem;
  course?: AttendanceCourse;
  color: string;
  state: SlotState;
  now: Date;
  onOpen: () => void;
  last: boolean;
}) {
  const live = state === 'live';
  const minutes = now.getHours() * 60 + now.getMinutes();
  const left = toMinutes(slot.endTime) - minutes;
  const until = toMinutes(slot.startTime) - minutes;
  const tone = course ? toneColor[toneOf(course)] : cu.muted;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        opacity: state === 'past' ? 0.55 : 1,
      }}
    >
      <View style={{ width: 38, alignItems: 'flex-end' }}>
        <Text
          style={{
            color: live ? color : cu.text,
            fontWeight: '800',
            fontSize: 13,
            marginTop: 14,
          }}
        >
          {clockShort(slot.startTime)}
        </Text>
        <Text style={{ color: cu.muted, fontSize: 11, marginTop: 2 }}>
          {clockShort(slot.endTime)}
        </Text>
      </View>
      <View style={{ alignItems: 'center', width: 12 }}>
        <View
          style={{
            width: live ? 14 : 10,
            height: live ? 14 : 10,
            borderRadius: 7,
            marginTop: live ? 14 : 16,
            backgroundColor: state === 'past' ? cu.line : color,
            borderWidth: live ? 3 : 0,
            borderColor: `${color}55`,
          }}
        />
        {!last ? (
          <View
            style={{
              flex: 1,
              width: 2,
              backgroundColor: cu.line,
              marginTop: 4,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, marginBottom: 12 }}>
        <PressScale onPress={onOpen}>
          <View
            style={{
              backgroundColor: live ? `${color}26` : cu.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: live ? `${color}88` : cu.line,
              borderLeftWidth: 4,
              borderLeftColor: color,
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 7,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              {live ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: 3,
                    paddingRight: 10,
                    borderRadius: 999,
                    backgroundColor: `${color}30`,
                  }}
                >
                  <PulseDot color={color} size={6} />
                  <Text style={{ color, fontWeight: '800', fontSize: 11 }}>
                    LIVE · {left}m left
                  </Text>
                </View>
              ) : state === 'upcoming' && until > 0 && until <= 90 ? (
                <Text style={{ color, fontWeight: '800', fontSize: 11 }}>
                  IN {durationLabel(until).toUpperCase()}
                </Text>
              ) : state === 'past' ? (
                <Text
                  style={{ color: cu.muted, fontWeight: '800', fontSize: 11 }}
                >
                  DONE
                </Text>
              ) : null}
              <View style={{ flex: 1 }} />
              <Text
                style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
              >
                {typeLabel(slot.slotType)} · {durationLabel(slotMinutes(slot))}
              </Text>
            </View>
            <Text
              style={{
                color: cu.text,
                fontSize: 16,
                fontWeight: '800',
                lineHeight: 21,
              }}
            >
              {slot.courseName}
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              {slot.room ? (
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                >
                  <Icon name="pin" size={13} color={cu.muted} />
                  <Text
                    style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}
                  >
                    {slot.room}
                  </Text>
                </View>
              ) : null}
              {slot.facultyName ? (
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Icon name="user" size={13} color={cu.muted} />
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: cu.muted,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {slot.facultyName}
                  </Text>
                </View>
              ) : null}
            </View>
            {live ? (
              <AnimatedBar
                percent={slotProgress(slot, now) * 100}
                color={color}
                height={5}
              />
            ) : null}
            {course ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: cu.line,
                  paddingTop: 9,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: `${tone}26`,
                  }}
                >
                  <Text
                    style={{ color: tone, fontWeight: '800', fontSize: 12 }}
                  >
                    {Math.round(course.percentage)}%
                  </Text>
                </View>
                <Text
                  style={{
                    color: cu.muted,
                    fontSize: 12,
                    fontWeight: '600',
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {guidanceShort(course)}
                </Text>
                <Text
                  style={{ color: cu.blue, fontSize: 12, fontWeight: '800' }}
                >
                  Plan ›
                </Text>
              </View>
            ) : null}
          </View>
        </PressScale>
      </View>
    </View>
  );
}

/** Every start time down the side, Monday to Saturday across, one coloured block per class. */
function WeekGrid({
  data,
  colors,
  now,
  onPick,
}: {
  data: ConnectedOverview;
  colors: Map<string, string>;
  now: Date;
  onPick: (day: number) => void;
}) {
  const { width } = useWindowDimensions();
  const rows = useMemo(
    () =>
      Array.from(new Set(data.timetable.map(s => s.startTime))).sort(
        (a, b) => toMinutes(a) - toMinutes(b),
      ),
    [data.timetable],
  );
  const timeCol = 46;
  const gap = 4;
  const cell = Math.floor((width - 32 - timeCol - gap * 6) / 6);
  const today = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const used = useMemo(() => {
    const seen = new Map<string, TimetableSlotItem>();
    data.timetable.forEach(s => seen.set(slotKeyOf(s), s));
    return Array.from(seen.values());
  }, [data.timetable]);
  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          backgroundColor: cu.card,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: cu.line,
          padding: 10,
          gap: gap,
        }}
      >
        <View style={{ flexDirection: 'row', gap }}>
          <View style={{ width: timeCol }} />
          {DAYS.map(({ day, short }) => (
            <View
              key={day}
              style={{
                width: cell,
                alignItems: 'center',
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor: day === today ? `${cu.blue}26` : 'transparent',
              }}
            >
              <Text
                style={{
                  color: day === today ? cu.blue : cu.muted,
                  fontWeight: '800',
                  fontSize: 11,
                }}
              >
                {short}
              </Text>
            </View>
          ))}
        </View>
        {rows.map(time => (
          <View
            key={time}
            style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}
          >
            <View
              style={{
                width: timeCol,
                justifyContent: 'center',
                alignItems: 'flex-end',
                paddingRight: 4,
              }}
            >
              <Text
                style={{ color: cu.muted, fontSize: 10, fontWeight: '700' }}
              >
                {clock12(time).replace(' ', '\n')}
              </Text>
            </View>
            {DAYS.map(({ day }) => {
              const slot = slotsForDay(data.timetable, day).find(
                s => s.startTime === time,
              );
              if (!slot)
                return (
                  <View
                    key={day}
                    style={{
                      width: cell,
                      height: 52,
                      borderRadius: 10,
                      backgroundColor: `${cu.text}06`,
                    }}
                  />
                );
              const color = colors.get(slotKeyOf(slot)) ?? cu.blue;
              const live =
                day === today &&
                toMinutes(slot.startTime) <= minutes &&
                minutes < toMinutes(slot.endTime);
              return (
                <Pressable
                  key={day}
                  onPress={() => onPick(day)}
                  style={{
                    width: cell,
                    height: 52,
                    borderRadius: 10,
                    backgroundColor: `${color}${live ? '55' : '2e'}`,
                    borderWidth: live ? 1.5 : 0,
                    borderColor: color,
                    padding: 4,
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{ color: cu.text, fontSize: 11, fontWeight: '800' }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {radarLabel(slot.courseName).replace(/ Lab$/, '')}
                  </Text>
                  <Text
                    style={{ color, fontSize: 9, fontWeight: '800' }}
                    numberOfLines={1}
                  >
                    {isLab(slot.slotType) ? 'LAB' : slot.slotType.charAt(0)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View
        style={{
          backgroundColor: cu.card,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: cu.line,
          padding: 14,
          gap: 10,
        }}
      >
        <Text
          style={{
            color: cu.muted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.4,
          }}
        >
          SUBJECTS
        </Text>
        {used.map(slot => {
          const course = findCourse(data.attendance, slot);
          const perWeek = data.timetable.filter(
            s => slotKeyOf(s) === slotKeyOf(slot),
          ).length;
          return (
            <View
              key={slotKeyOf(slot)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colors.get(slotKeyOf(slot)),
                }}
              />
              <Text
                style={{ color: cu.text, fontWeight: '700', flex: 1 }}
                numberOfLines={1}
              >
                {slot.courseName}
              </Text>
              <Text style={{ color: cu.muted, fontSize: 12 }}>
                {perWeek}/wk
              </Text>
              {course ? (
                <Text
                  style={{
                    color: toneColor[toneOf(course)],
                    fontWeight: '800',
                    width: 40,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(course.percentage)}%
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function TimetableTab({
  data,
  refreshing,
  onRefresh,
}: {
  data: ConnectedOverview;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const now = useNow();
  const { width } = useWindowDimensions();
  const colors = useMemo(() => subjectColors(data.timetable), [data.timetable]);
  const [selected, setSelected] = useState<number>(() =>
    defaultDay(data.timetable),
  );
  // Wide screens (tablets, unfolded phones) have room for the whole week, so open on that.
  const [mode, setMode] = useState<Mode>(width >= 700 ? 'week' : 'day');
  const [openCourse, setOpenCourse] = useState<AttendanceCourse | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const slots = slotsForDay(data.timetable, selected);
  const isToday = selected === now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const dayName = DAYS.find(d => d.day === selected)?.full ?? '';

  return (
    <>
      <TabScroll refreshing={refreshing} onRefresh={onRefresh}>
        <TabTitle
          title="Timetable"
          right={
            data.timetable.length > 0 ? (
              <ModeToggle mode={mode} onChange={setMode} />
            ) : undefined
          }
        />
        {data.timetable.length === 0 ? (
          <EmptyPanel
            icon="calendar"
            title="No timetable imported"
            body="Your timetable will show here once it is imported from CUIMS."
          />
        ) : mode === 'week' ? (
          <FadeIn key="week">
            <WeekGrid
              data={data}
              colors={colors}
              now={now}
              onPick={day => {
                setSelected(day);
                setMode('day');
              }}
            />
          </FadeIn>
        ) : (
          <>
            <DayStrip
              timetable={data.timetable}
              selected={selected}
              onSelect={setSelected}
              now={now}
            />
            <FadeIn key={`summary-${selected}`} distance={10}>
              {slots.length === 0 ? (
                <EmptyPanel
                  icon="calendar"
                  title="No classes"
                  body={`Nothing scheduled on ${dayName}.`}
                />
              ) : (
                <DaySummary
                  dayName={dayName}
                  slots={slots}
                  data={data}
                  isToday={isToday}
                  now={now}
                />
              )}
            </FadeIn>
            <View style={{ marginTop: 4 }}>
              {slots.map((slot, index) => {
                const state: SlotState = !isToday
                  ? 'plain'
                  : toMinutes(slot.endTime) <= minutes
                  ? 'past'
                  : toMinutes(slot.startTime) <= minutes
                  ? 'live'
                  : 'upcoming';
                const previous = slots[index - 1];
                const gap = previous
                  ? toMinutes(slot.startTime) - toMinutes(previous.endTime)
                  : 0;
                const course = findCourse(data.attendance, slot);
                return (
                  <FadeIn
                    key={`${selected}-${slot.id}`}
                    delay={80 + index * 70}
                    distance={16}
                  >
                    {gap >= 15 ? <GapRow minutes={gap} /> : null}
                    <TimelineCard
                      slot={slot}
                      course={course}
                      color={colors.get(slotKeyOf(slot)) ?? cu.blue}
                      state={state}
                      now={now}
                      last={index === slots.length - 1}
                      onOpen={() => {
                        if (!course) return;
                        setOpenCourse(course);
                        setSheetOpen(true);
                      }}
                    />
                  </FadeIn>
                );
              })}
            </View>
          </>
        )}
      </TabScroll>
      <AttendanceSheet
        course={openCourse}
        timetable={data.timetable}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
