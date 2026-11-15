import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  daysUntilIso,
  lastTeachingDay,
  nonTeachingDates,
} from '../../cuims/calendarData';
import { Choice, PageHeader, SectionLabel } from './PageShell';
import { useAcademicCalendar, useCalendarVariant } from './useAcademicCalendar';
import {
  dateKey,
  futureClasses,
  predictOverall,
  TARGETS,
  type ConnectedOverview,
} from './model';
import { cu, Icon, Ring, Trend } from './ui/graphics';
import { AnimatedBar, CountText, FadeIn, PressScale } from './ui/motion';
import { Slider } from './ui/Slider';
import { Surface } from './ui/parts';

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

/** "3 weeks 2 days" style length of the prediction window. */
const spanText = (days: number) => {
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const parts = [
    weeks > 0 ? `${weeks} week${weeks === 1 ? '' : 's'}` : '',
    rest > 0 ? `${rest} day${rest === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  return parts.join(' ');
};

const shortDate = (date: Date) =>
  `${date.getDate()} ${MONTH[date.getMonth()]} ${date.getFullYear()}`;

const round1 = (value: number) => Math.round(value * 10) / 10;

function Stat({
  label,
  value,
  color = cu.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function Stepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const button = (label: string, disabled: boolean, next: number) => (
    <PressScale
      disabled={disabled}
      onPress={() => onChange(next)}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: cu.cardAlt,
        borderWidth: 1,
        borderColor: cu.line,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ color: cu.text, fontSize: 20, fontWeight: '800' }}>
        {label}
      </Text>
    </PressScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {button('−', value <= 0, Math.max(0, value - 1))}
      <Text
        style={{
          color: cu.text,
          fontSize: 20,
          fontWeight: '800',
          minWidth: 28,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>
      {button('+', value >= max, Math.min(max, value + 1))}
    </View>
  );
}

type Props = {
  data: ConnectedOverview;
  onClose: () => void;
  onOpenCalendar: () => void;
};

/**
 * Predicts where overall attendance ends up. It takes the real timetable, removes holidays and breaks from the
 * university calendar, and lets the student try skipping weekdays or a number of classes.
 */
export function PredictionPage({ data, onClose, onOpenCalendar }: Props) {
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);
  const [variant] = useCalendarVariant(data.connection);
  const calendar = useAcademicCalendar(variant);
  // Days from today to predict for; `null` means "as far as the semester goes".
  const [picked, setPicked] = useState<number | null>(null);
  const [target, setTarget] = useState<number>(75);
  const [skipDays, setSkipDays] = useState<number[]>([]);
  const [extra, setExtra] = useState(0);
  const [chartWidth, setChartWidth] = useState(0);

  const semesterEnd = calendar.data
    ? lastTeachingDay(calendar.data, now)
    : null;
  const maxDays = semesterEnd
    ? Math.max(1, daysUntilIso(semesterEnd, now) + 1)
    : 120;
  const chosen =
    typeof picked === 'number' && Number.isFinite(picked) ? picked : null;
  const days = Math.min(
    maxDays,
    Math.max(1, chosen ?? (semesterEnd ? maxDays : 28)),
  );
  const atSemesterEnd = semesterEnd !== null && days === maxDays;
  const until = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days - 1),
    [days, now],
  );

  const nonTeaching = useMemo(
    () => (calendar.data ? nonTeachingDates(calendar.data) : new Set<string>()),
    [calendar.data],
  );
  const classes = useMemo(
    () =>
      futureClasses(data.timetable, data.attendance, now, until, nonTeaching),
    [data.timetable, data.attendance, now, until, nonTeaching],
  );
  const freeCount = classes.filter(
    c => !skipDays.includes(c.date.getDay()),
  ).length;
  const extraShown = Math.min(extra, freeCount);
  const prediction = useMemo(
    () =>
      predictOverall(data.attendance, classes, {
        skipDays,
        extraSkips: extraShown,
        target,
      }),
    [data.attendance, classes, skipDays, extraShown, target],
  );

  const holidaysInWindow = useMemo(() => {
    const classDays = new Set(data.timetable.map(s => s.dayOfWeek));
    let hits = 0;
    const end = new Date(
      until.getFullYear(),
      until.getMonth(),
      until.getDate(),
    );
    for (
      let day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      day <= end;
      day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    )
      if (nonTeaching.has(dateKey(day)) && classDays.has(day.getDay()))
        hits += 1;
    return hits;
  }, [data.timetable, nonTeaching, now, until]);

  const classWeekdays = useMemo(
    () =>
      [...new Set(data.timetable.map(s => s.dayOfWeek))]
        .filter(d => d >= 0 && d <= 6)
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)),
    [data.timetable],
  );

  const { projected, current } = prediction;
  const ok = projected !== null && projected + 1e-9 >= target;
  const color = projected === null ? cu.muted : ok ? cu.green : cu.red;
  const delta =
    projected !== null && current !== null ? round1(projected - current) : 0;
  const bestCase = prediction.ifAttendAll;
  const targetReachable = bestCase !== null && bestCase + 1e-9 >= target;

  const verdict = (() => {
    if (projected === null)
      return 'There is no attendance to predict from yet. Refresh from CUIMS first.';
    if (prediction.remaining === 0)
      return 'No classes are left in this window, so your attendance stays where it is.';
    if (ok)
      return `You finish ${round1(
        projected - target,
      )}% above your ${target}% target.`;
    if (!targetReachable)
      return `Even attending every class you would end at ${round1(
        bestCase ?? 0,
      )}%, below ${target}%.`;
    return `You would end ${round1(
      target - projected,
    )}% below ${target}%. Attending every class gets you to ${round1(
      bestCase ?? 0,
    )}%.`;
  })();

  const toggleDay = (day: number) =>
    setSkipDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day],
    );
  const limit = prediction.maxMissable;

  return (
    <View style={{ flex: 1 }}>
      <PageHeader
        title="Attendance prediction"
        subtitle={`Until ${shortDate(until)}`}
        onBack={onClose}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 28 + insets.bottom,
          gap: 14,
        }}
      >
        <FadeIn>
          <View
            style={{
              backgroundColor: cu.card,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: `${color}40`,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                right: -60,
                top: -70,
                width: 210,
                height: 210,
                borderRadius: 105,
                backgroundColor: `${color}16`,
              }}
            />
            <View style={{ padding: 18, gap: 14 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
              >
                <Ring
                  percent={projected ?? 0}
                  size={104}
                  stroke={10}
                  color={color}
                >
                  <CountText
                    value={projected}
                    decimals={1}
                    suffix="%"
                    style={{ color: cu.text, fontSize: 22, fontWeight: '800' }}
                  />
                  <Text
                    style={{
                      color: cu.muted,
                      fontSize: 9,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                    }}
                  >
                    PREDICTED
                  </Text>
                </Ring>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}
                  >
                    NOW {current === null ? '–' : `${round1(current)}%`}
                  </Text>
                  {projected !== null && current !== null ? (
                    <Text style={{ color, fontSize: 20, fontWeight: '800' }}>
                      {delta === 0
                        ? 'No change'
                        : `${delta > 0 ? '+' : '−'}${Math.abs(delta)}%`}
                    </Text>
                  ) : null}
                  <Text style={{ color: cu.muted, fontSize: 12 }}>
                    {prediction.remaining} class
                    {prediction.remaining === 1 ? '' : 'es'} ahead ·{' '}
                    {prediction.skipped} skipped
                  </Text>
                </View>
              </View>
              {projected !== null ? (
                <AnimatedBar
                  percent={projected}
                  color={color}
                  marker={target}
                  height={7}
                />
              ) : null}
              <Text
                style={{ color: cu.text, fontWeight: '700', lineHeight: 20 }}
              >
                {verdict}
              </Text>
            </View>
          </View>
        </FadeIn>

        <FadeIn delay={60}>
          <Surface style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <SectionLabel>PREDICT UNTIL</SectionLabel>
              {atSemesterEnd ? (
                <Text
                  style={{ color: cu.green, fontSize: 12, fontWeight: '800' }}
                >
                  SEMESTER END
                </Text>
              ) : null}
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ color: cu.text, fontSize: 22, fontWeight: '800' }}>
                {shortDate(until)}
              </Text>
              <Text
                style={{ color: cu.muted, fontSize: 13, fontWeight: '600' }}
              >
                {spanText(days)} from today
              </Text>
            </View>
            {maxDays > 1 ? (
              <View>
                <View style={{ paddingHorizontal: 14 }}>
                  <Slider
                    label="Prediction length in days"
                    value={days}
                    min={1}
                    max={maxDays}
                    onChange={setPicked}
                    color={atSemesterEnd ? cu.green : cu.blue}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
                  >
                    Today
                  </Text>
                  <Text
                    style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
                  >
                    {semesterEnd
                      ? `Semester end · ${shortDate(
                          new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate() + maxDays - 1,
                          ),
                        )}`
                      : spanText(maxDays)}
                  </Text>
                </View>
              </View>
            ) : null}
            <Pressable
              onPress={() =>
                calendar.isError ? void calendar.refetch() : onOpenCalendar()
              }
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <Icon
                name="calendar"
                size={15}
                color={calendar.isError ? cu.orange : cu.muted}
              />
              <Text
                style={{
                  flex: 1,
                  color: calendar.isError ? cu.orange : cu.muted,
                  fontSize: 12,
                  lineHeight: 17,
                }}
              >
                {calendar.isLoading
                  ? 'Checking the university holiday calendar…'
                  : calendar.isError
                  ? 'Holiday calendar unavailable, so every timetable class is assumed to run. Tap to retry.'
                  : holidaysInWindow > 0
                  ? `Skipping ${holidaysInWindow} class day${
                      holidaysInWindow === 1 ? '' : 's'
                    } that fall on holidays or breaks. View calendar ›`
                  : 'No holidays fall on your class days in this window. View calendar ›'}
              </Text>
            </Pressable>
          </Surface>
        </FadeIn>

        <FadeIn delay={100}>
          <Surface style={{ gap: 12 }}>
            <SectionLabel>YOUR TARGET</SectionLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TARGETS.map(t => (
                <Choice
                  key={t}
                  label={`${t}%`}
                  on={t === target}
                  onPress={() => setTarget(t)}
                />
              ))}
            </View>
          </Surface>
        </FadeIn>

        <FadeIn delay={140}>
          <Surface style={{ gap: 14 }}>
            <View style={{ gap: 3 }}>
              <SectionLabel>WHAT IF I SKIP…</SectionLabel>
              <Text style={{ color: cu.muted, fontSize: 12, lineHeight: 18 }}>
                Pick weekdays you will not attend, or a number of classes to
                skip spread evenly.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {classWeekdays.map(day => (
                <Choice
                  key={day}
                  label={WEEKDAY[day] ?? '?'}
                  color={cu.orange}
                  on={skipDays.includes(day)}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: cu.text, fontWeight: '700' }}>
                  Extra classes to skip
                </Text>
                <Text style={{ color: cu.muted, fontSize: 12 }}>
                  of {freeCount} remaining
                </Text>
              </View>
              <Stepper value={extraShown} max={freeCount} onChange={setExtra} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {limit !== null && limit > 0 ? (
                <Choice
                  label={`Skip my limit (${limit})`}
                  on={false}
                  color={cu.green}
                  onPress={() => {
                    setSkipDays([]);
                    setExtra(limit);
                  }}
                />
              ) : null}
              {skipDays.length > 0 || extraShown > 0 ? (
                <Choice
                  label="Attend everything"
                  on={false}
                  onPress={() => {
                    setSkipDays([]);
                    setExtra(0);
                  }}
                />
              ) : null}
            </View>
            <Text
              style={{
                color: limit === null ? cu.orange : cu.muted,
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {projected === null || prediction.remaining === 0
                ? ''
                : limit === null
                ? `You cannot reach ${target}% overall in this window, even attending everything.`
                : limit === 0
                ? `You must attend every class to finish at ${target}% or above.`
                : `You can miss up to ${limit} of ${prediction.remaining} classes and still finish at ${target}% or above.`}
            </Text>
          </Surface>
        </FadeIn>

        {projected !== null ? (
          <FadeIn delay={180}>
            <Surface style={{ gap: 12 }}>
              <SectionLabel>WEEK BY WEEK</SectionLabel>
              <View
                onLayout={e => setChartWidth(e.nativeEvent.layout.width)}
                style={{ alignItems: 'center' }}
              >
                {chartWidth > 0 && prediction.weekly.length > 1 ? (
                  <Trend
                    series={prediction.weekly}
                    target={target}
                    width={chartWidth}
                    height={130}
                    color={color}
                  />
                ) : (
                  <Text style={{ color: cu.muted, fontSize: 12 }}>
                    Not enough weeks ahead to draw a line.
                  </Text>
                )}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: cu.cardAlt,
                  borderRadius: 16,
                  paddingVertical: 12,
                }}
              >
                <Stat
                  label="Best case"
                  value={bestCase === null ? '–' : `${round1(bestCase)}%`}
                  color={targetReachable ? cu.green : cu.red}
                />
                <Stat
                  label="Lowest point"
                  value={
                    prediction.lowest === null
                      ? '–'
                      : `${round1(prediction.lowest)}%`
                  }
                  color={
                    prediction.lowest !== null &&
                    prediction.lowest + 1e-9 < target
                      ? cu.orange
                      : cu.text
                  }
                />
                <Stat
                  label="Can miss"
                  value={limit === null ? '–' : String(limit)}
                />
              </View>
            </Surface>
          </FadeIn>
        ) : null}

        {prediction.perCourse.length > 0 ? (
          <FadeIn delay={220}>
            <Surface style={{ gap: 12 }}>
              <SectionLabel>BY SUBJECT</SectionLabel>
              {prediction.perCourse.map(row => {
                const rowOk = row.projected + 1e-9 >= target;
                const rowColor = rowOk ? cu.green : cu.red;
                return (
                  <View
                    key={row.course.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: cu.text, fontWeight: '700' }}
                      >
                        {row.course.courseName}
                      </Text>
                      <Text style={{ color: cu.muted, fontSize: 12 }}>
                        {row.remaining === 0
                          ? 'No classes in this window'
                          : row.canMiss === null
                          ? `Cannot reach ${target}% in this window`
                          : row.canMiss === 0
                          ? 'Attend all of its classes'
                          : `Can skip ${row.canMiss} of ${row.remaining}`}
                        {row.skipped > 0 ? ` · ${row.skipped} skipped` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text
                        style={{
                          color: rowColor,
                          fontSize: 16,
                          fontWeight: '800',
                        }}
                      >
                        {round1(row.projected)}%
                      </Text>
                      <Text
                        style={{
                          color: cu.muted,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        now {round1(row.course.percentage)}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Surface>
          </FadeIn>
        ) : null}

        <Text
          style={{
            color: cu.muted,
            fontSize: 12,
            lineHeight: 18,
            paddingHorizontal: 4,
          }}
        >
          This is an estimate. It assumes your timetable repeats every week,
          every class takes place and is recorded, and no extra or cancelled
          classes. Holidays and breaks come from the university's public
          calendar. Your official attendance on CUIMS is what counts.
        </Text>
      </ScrollView>
    </View>
  );
}
