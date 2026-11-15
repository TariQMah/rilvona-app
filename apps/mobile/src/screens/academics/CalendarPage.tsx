import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  calendarDayMarks,
  daysUntilIso,
  itemsInMonth,
  upcomingHolidays,
  type CalendarVariant,
  type DayMark,
} from '../../cuims/calendarData';
import { formatWhen } from '../../lib/format';
import { Choice, PageHeader, SectionLabel } from './PageShell';
import { useAcademicCalendar, useCalendarVariant } from './useAcademicCalendar';
import { dateKey, type ConnectedOverview } from './model';
import { cu, Icon } from './ui/graphics';
import { FadeIn, Skeleton } from './ui/motion';
import { Surface } from './ui/parts';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_SHORT = MONTH_NAMES.map(m => m.slice(0, 3));
const WEEK_HEADS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const markColor: Record<DayMark, string> = {
  holiday: cu.red,
  break: cu.orange,
  exam: cu.purple,
  event: cu.blue,
};
const markLabel: Record<DayMark, string> = {
  holiday: 'Holiday',
  break: 'Break',
  exam: 'Exams',
  event: 'Event',
};

const prettyDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTH_SHORT[(m ?? 1) - 1]}${
    y !== new Date().getFullYear() ? ` ${y}` : ''
  }`;
};

const weekdayName = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getDay()
  ];
};

const whenText = (days: number) =>
  days === 0
    ? 'Today'
    : days === 1
    ? 'Tomorrow'
    : days < 0
    ? `${-days} days ago`
    : `In ${days} days`;

function MonthGrid({
  year,
  month0,
  marks,
  today,
  onPrev,
  onNext,
}: {
  year: number;
  month0: number;
  marks: Map<string, DayMark>;
  today: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const first = new Date(year, month0, 1);
  const lead = (first.getDay() + 6) % 7;
  const total = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) =>
    cells.slice(r * 7, r * 7 + 7),
  );
  const arrow = (rotate: string, onPress: () => void, label: string) => (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: cu.cardAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ transform: [{ rotate }] }}>
        <Icon name="chevron" size={18} />
      </View>
    </Pressable>
  );
  return (
    <Surface style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {arrow('90deg', onPrev, 'Previous month')}
        <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
          {MONTH_NAMES[month0]} {year}
        </Text>
        {arrow('-90deg', onNext, 'Next month')}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEK_HEADS.map((head, i) => (
          <Text
            key={`${head}${i}`}
            style={{
              flex: 1,
              textAlign: 'center',
              color: cu.muted,
              fontSize: 11,
              fontWeight: '800',
            }}
          >
            {head}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 4 }}>
          {row.map((day, c) => {
            if (day === null)
              return <View key={c} style={{ flex: 1, height: 38 }} />;
            const iso = dateKey(new Date(year, month0, day));
            const mark = marks.get(iso);
            const tint = mark ? markColor[mark] : null;
            const isToday = iso === today;
            const sunday = c === 6;
            return (
              <View
                key={c}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tint ? `${tint}30` : 'transparent',
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: cu.blue,
                }}
              >
                <Text
                  style={{
                    color: tint ?? (sunday ? cu.muted : cu.text),
                    fontWeight: tint || isToday ? '800' : '600',
                    fontSize: 14,
                  }}
                >
                  {day}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 14,
          paddingTop: 4,
        }}
      >
        {(Object.keys(markColor) as DayMark[]).map(key => (
          <View
            key={key}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: markColor[key],
              }}
            />
            <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}>
              {markLabel[key]}
            </Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

type Props = {
  data: ConnectedOverview;
  onClose: () => void;
};

/** The university's holidays and academic calendar, read from its public website. */
export function CalendarPage({ data, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);
  const today = dateKey(now);
  const [variant, chooseVariant] = useCalendarVariant(data.connection);
  const calendar = useAcademicCalendar(variant);
  const [cursor, setCursor] = useState({
    year: now.getFullYear(),
    month0: now.getMonth(),
  });
  const step = (by: number) =>
    setCursor(({ year, month0 }) => {
      const d = new Date(year, month0 + by, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });

  const marks = useMemo(
    () =>
      calendar.data
        ? calendarDayMarks(calendar.data)
        : new Map<string, DayMark>(),
    [calendar.data],
  );
  const monthItems = useMemo(
    () =>
      calendar.data
        ? itemsInMonth(calendar.data, cursor.year, cursor.month0 + 1)
        : [],
    [calendar.data, cursor],
  );
  const next = calendar.data ? upcomingHolidays(calendar.data, now, 4) : [];
  const hero = next[0];
  const pick = (v: CalendarVariant) => chooseVariant(v);

  return (
    <View style={{ flex: 1 }}>
      <PageHeader
        title="Academic calendar"
        subtitle="Holidays, breaks and exams"
        onBack={onClose}
        right={
          calendar.isFetching && !calendar.isLoading ? (
            <ActivityIndicator color={cu.blue} />
          ) : null
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 28 + insets.bottom,
          gap: 14,
        }}
      >
        <Surface style={{ gap: 10 }}>
          <SectionLabel>CALENDAR FOR</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Choice
              label="BCA / MCA (Computing)"
              on={variant === 'UIC'}
              onPress={() => pick('UIC')}
            />
            <Choice
              label="Other institutes"
              on={variant === 'GENERAL'}
              onPress={() => pick('GENERAL')}
            />
          </View>
        </Surface>

        {calendar.isLoading ? (
          <>
            <Skeleton height={110} radius={22} />
            <Skeleton height={330} radius={22} />
            <Skeleton height={90} radius={22} />
          </>
        ) : calendar.isError || !calendar.data ? (
          <Surface
            style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}
          >
            <Icon name="calendar" size={34} color={cu.muted} />
            <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
              Could not load the calendar
            </Text>
            <Text
              style={{ color: cu.muted, textAlign: 'center', lineHeight: 20 }}
            >
              The university website did not answer and there is no saved copy
              on this phone yet. Check your connection and try again.
            </Text>
            <Pressable
              onPress={() => void calendar.refetch()}
              style={{
                backgroundColor: cu.blue,
                paddingHorizontal: 22,
                paddingVertical: 12,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>
                Try again
              </Text>
            </Pressable>
          </Surface>
        ) : (
          <>
            {hero ? (
              <FadeIn>
                <View
                  style={{
                    backgroundColor: cu.card,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: `${cu.red}40`,
                    padding: 18,
                    gap: 6,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      right: -50,
                      top: -60,
                      width: 180,
                      height: 180,
                      borderRadius: 90,
                      backgroundColor: `${cu.red}14`,
                    }}
                  />
                  <Text
                    style={{ color: cu.red, fontSize: 12, fontWeight: '800' }}
                  >
                    NEXT HOLIDAY
                  </Text>
                  <Text
                    style={{ color: cu.text, fontSize: 24, fontWeight: '800' }}
                  >
                    {hero.name}
                  </Text>
                  <Text style={{ color: cu.muted, fontWeight: '700' }}>
                    {weekdayName(hero.date)}, {prettyDay(hero.date)} ·{' '}
                    {whenText(daysUntilIso(hero.date, now))}
                  </Text>
                  {next.length > 1 ? (
                    <View style={{ gap: 6, paddingTop: 10 }}>
                      {next.slice(1).map(h => (
                        <View
                          key={h.date + h.name}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              color: cu.text,
                              fontSize: 13,
                              fontWeight: '600',
                              flex: 1,
                            }}
                          >
                            {h.name}
                          </Text>
                          <Text
                            style={{
                              color: cu.muted,
                              fontSize: 13,
                              fontWeight: '700',
                            }}
                          >
                            {prettyDay(h.date)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </FadeIn>
            ) : null}

            <FadeIn delay={60}>
              <MonthGrid
                year={cursor.year}
                month0={cursor.month0}
                marks={marks}
                today={today}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
              />
            </FadeIn>

            <FadeIn delay={120}>
              <Surface style={{ gap: 12 }}>
                <SectionLabel>
                  {`${MONTH_NAMES[cursor.month0]?.toUpperCase()} ${
                    cursor.year
                  }`}
                </SectionLabel>
                {monthItems.length === 0 ? (
                  <Text style={{ color: cu.muted }}>
                    Nothing listed for this month.
                  </Text>
                ) : (
                  monthItems.map((item, index) => (
                    <View
                      key={`${item.date}-${item.title}-${index}`}
                      style={{
                        flexDirection: 'row',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <View
                        style={{
                          width: 4,
                          alignSelf: 'stretch',
                          borderRadius: 2,
                          backgroundColor: markColor[item.mark],
                        }}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={{
                            color: cu.text,
                            fontWeight: '700',
                            lineHeight: 20,
                          }}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={{
                            color: cu.muted,
                            fontSize: 12,
                            fontWeight: '600',
                          }}
                        >
                          {item.endDate && item.endDate !== item.date
                            ? `${prettyDay(item.date)} – ${prettyDay(
                                item.endDate,
                              )}`
                            : `${weekdayName(item.date)}, ${prettyDay(
                                item.date,
                              )}`}
                          {' · '}
                          {markLabel[item.mark]}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </Surface>
            </FadeIn>

            <Text
              style={{
                color: cu.muted,
                fontSize: 12,
                lineHeight: 18,
                paddingHorizontal: 4,
              }}
            >
              Read from the public pages on cuchd.in, last updated{' '}
              {formatWhen(calendar.data.fetchedAt)}. Dates can change, so
              confirm with your department.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}
