import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/typography';
import type { AttendanceCourse } from '../../api/types';
import { AttendanceSheet } from './AttendanceSheet';
import { CountText, FadeIn, PressScale, PulseDot } from './ui/motion';
import { Surface, TabScroll } from './ui/parts';
import { cu, Icon, Ring, type IconName } from './ui/graphics';
import {
  classStatus,
  clock12,
  findCourse,
  nextDayClass,
  realMentor,
  guidanceText,
  percentIfAttend,
  percentIfSkip,
  slotAfter,
  slotProgress,
  toneOf,
  type ConnectedOverview,
  type Tone,
} from './model';

const toneColor: Record<Tone, string> = {
  safe: cu.green,
  edge: cu.orange,
  short: cu.red,
};

type Props = {
  data: ConnectedOverview;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenPrediction: () => void;
  onOpenCalendar: () => void;
  onOpenSubjects: () => void;
  onOpenDatesheet: () => void;
  onOpenIdCard: () => void;
  onOpenUpdates: () => void;
  onOpenProfile: () => void;
  onRefreshPortal: () => void;
};

function useNow(intervalMs = 20000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** One compact "what happens to my percentage" chip: arrow, the new percentage and the change, tinted by the outcome. */
function ProjectionChip({
  label,
  value,
  current,
  minRequired,
}: {
  label: string;
  value: number;
  current: number;
  minRequired: number;
}) {
  const color = value >= minRequired ? cu.green : cu.red;
  const delta = Math.round((value - current) * 10) / 10;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: `${color}14`,
        borderWidth: 1,
        borderColor: `${color}30`,
        borderRadius: 14,
        paddingHorizontal: 9,
        paddingVertical: 7,
      }}
    >
      <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      <CountText
        value={value}
        suffix="%"
        style={{ color, fontSize: 14, fontWeight: '800' }}
      />
      <Text style={{ color, fontSize: 11, fontWeight: '800' }}>
        {delta > 0 ? '+' : delta < 0 ? '−' : ''}
        {Math.abs(delta).toFixed(1)}
      </Text>
    </View>
  );
}

function ClassCard({ data }: { data: ConnectedOverview }) {
  const now = useNow();
  const status = classStatus(data.timetable, now);
  if (status.kind === 'none') {
    const upcoming = nextDayClass(data.timetable, now);
    return (
      <Surface style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: `${cu.green}1f`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="check" size={23} color={cu.green} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
              No more classes today
            </Text>
            <Text style={{ color: cu.muted, fontSize: 13 }}>
              {upcoming
                ? 'Here is what is next.'
                : 'Open the Timetable tab to see your week.'}
            </Text>
          </View>
        </View>
        {upcoming ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: cu.cardAlt,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <View style={{ alignItems: 'center', minWidth: 64 }}>
              <Text style={{ color: cu.blue, fontSize: 11, fontWeight: '800' }}>
                {upcoming.dayName.toUpperCase()}
              </Text>
              <Text
                style={{
                  color: cu.text,
                  fontSize: 14,
                  fontWeight: '800',
                  marginTop: 2,
                }}
              >
                {clock12(upcoming.slot.startTime)}
              </Text>
            </View>
            <View
              style={{
                width: 1,
                alignSelf: 'stretch',
                backgroundColor: cu.line,
              }}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{ color: cu.text, fontSize: 15, fontWeight: '700' }}
                numberOfLines={1}
              >
                {upcoming.slot.courseName}
              </Text>
              <Text style={{ color: cu.muted, fontSize: 12 }} numberOfLines={1}>
                {[upcoming.slot.room, upcoming.slot.facultyName]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
        ) : null}
      </Surface>
    );
  }
  const { slot } = status;
  const live = status.kind === 'live';
  const accent = live ? cu.green : cu.blue;
  const course = findCourse(data.attendance, slot);
  const minutes = live ? status.minutesLeft : status.minutesUntil;
  const progress = live
    ? slotProgress(slot, now)
    : 1 - Math.min(minutes, 60) / 60;
  const big = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : String(minutes);
  const following = live ? slotAfter(data.timetable, slot) : undefined;
  const type = slot.slotType.charAt(0) + slot.slotType.slice(1).toLowerCase();
  return (
    <View
      style={{
        backgroundColor: cu.card,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: `${accent}40`,
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
          backgroundColor: `${accent}18`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 40,
          top: -110,
          width: 150,
          height: 150,
          borderRadius: 75,
          backgroundColor: `${accent}0f`,
        }}
      />
      <View style={{ padding: 14, gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingLeft: live ? 4 : 8,
              paddingRight: 9,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: `${accent}26`,
            }}
          >
            {live ? (
              <PulseDot color={accent} size={7} />
            ) : (
              <Icon name="clock" size={12} color={accent} />
            )}
            <Text
              style={{
                color: accent,
                fontWeight: '800',
                fontSize: 11,
                letterSpacing: 0.3,
              }}
            >
              {live ? 'LIVE NOW' : 'UP NEXT'}
            </Text>
          </View>
          <Text
            style={{
              color: cu.muted,
              fontSize: 12,
              fontWeight: '700',
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {clock12(slot.startTime)} – {clock12(slot.endTime)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ring percent={progress * 100} size={62} stroke={6} color={accent}>
            <Text
              style={{
                color: cu.text,
                fontSize: minutes >= 60 ? 20 : 22,
                fontWeight: '800',
                lineHeight: 24,
              }}
            >
              {big}
            </Text>
            <Text style={{ color: cu.muted, fontSize: 8, fontWeight: '800' }}>
              {minutes >= 60 ? `${minutes % 60}M` : 'MIN'}
            </Text>
          </Ring>
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                color: cu.text,
                fontSize: 17,
                fontWeight: '800',
                lineHeight: 22,
              }}
              numberOfLines={2}
            >
              {slot.courseName}
            </Text>
            <Text
              style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}
              numberOfLines={1}
            >
              {[type, slot.room, slot.facultyName].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        {course ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ProjectionChip
              label="Attend"
              value={percentIfAttend(course)}
              current={course.percentage}
              minRequired={course.minRequired}
            />
            <ProjectionChip
              label="Skip"
              value={percentIfSkip(course)}
              current={course.percentage}
              minRequired={course.minRequired}
            />
          </View>
        ) : null}

        {following ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderTopWidth: 1,
              borderTopColor: cu.line,
              paddingTop: 10,
            }}
          >
            <Text style={{ color: cu.muted, fontSize: 11, fontWeight: '800' }}>
              THEN
            </Text>
            <Text
              style={{
                color: cu.text,
                fontSize: 13,
                fontWeight: '700',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {following.courseName}
            </Text>
            <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}>
              {clock12(following.startTime)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type Action = {
  icon: IconName;
  color: string;
  label: string;
  onPress: () => void;
  dot?: boolean;
};

function ActionTile({ action, divider }: { action: Action; divider: boolean }) {
  return (
    <View
      style={{
        flex: 1,
        borderLeftWidth: divider ? 1 : 0,
        borderLeftColor: cu.line,
      }}
    >
      <PressScale
        onPress={action.onPress}
        style={{ alignItems: 'center', gap: 9, paddingVertical: 6 }}
      >
        <View>
          <Icon name={action.icon} size={26} color={action.color} />
          {action.dot ? (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -6,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: cu.red,
              }}
            />
          ) : null}
        </View>
        <Text
          style={{ color: cu.text, fontSize: 12, fontWeight: '700' }}
          numberOfLines={1}
        >
          {action.label}
        </Text>
      </PressScale>
    </View>
  );
}

/**
 * The top of the dashboard in one card: programme, mentor, the overall attendance, and the pages students open
 * most. The chevron opens the day's numbers and a few more shortcuts.
 */
function DashboardCard({
  data,
  onOpenProfile,
  onOpenUpdates,
  onOpenPrediction,
  onOpenDatesheet,
  onOpenIdCard,
  onOpenCalendar,
  onOpenSubjects,
  onRefreshPortal,
}: {
  data: ConnectedOverview;
  onOpenProfile: () => void;
  onOpenUpdates: () => void;
  onOpenPrediction: () => void;
  onOpenDatesheet: () => void;
  onOpenIdCard: () => void;
  onOpenCalendar: () => void;
  onOpenSubjects: () => void;
  onRefreshPortal: () => void;
}) {
  const { connection, summary, attendance } = data;
  const [open, setOpen] = useState(false);
  const overall = summary.overallAttendance;
  const color = overall === null ? cu.muted : overall >= 75 ? cu.green : cu.red;
  const mentorName = realMentor(connection.mentor)?.name;
  const main: Action[] = [
    {
      icon: 'mail',
      color: cu.blue,
      label: 'Updates',
      onPress: onOpenUpdates,
      dot: summary.alertCount > 0,
    },
    {
      icon: 'chart',
      color: cu.orange,
      label: 'Prediction',
      onPress: onOpenPrediction,
    },
    {
      icon: 'doc',
      color: cu.red,
      label: 'Date Sheet',
      onPress: onOpenDatesheet,
    },
    {
      icon: 'idcard',
      color: cu.purple,
      label: 'ID Card',
      onPress: onOpenIdCard,
    },
  ];
  const more: Action[] = [
    {
      icon: 'book',
      color: cu.blue,
      label: 'Subjects',
      onPress: onOpenSubjects,
    },
    { icon: 'user', color: cu.green, label: 'Profile', onPress: onOpenProfile },
    {
      icon: 'calendar',
      color: cu.purple,
      label: 'Calendar',
      onPress: onOpenCalendar,
    },
    {
      icon: 'refresh',
      color: cu.blue,
      label: 'Refresh',
      onPress: onRefreshPortal,
    },
  ];
  const stats: { label: string; value: string; color?: string }[] = [
    { label: 'Classes today', value: String(summary.todayClasses) },
    {
      label: 'Avg score',
      value:
        summary.averageScorePct === null ? '–' : `${summary.averageScorePct}%`,
    },
    {
      label: 'Subjects safe',
      value: `${summary.safeCourses}/${attendance.length}`,
      color: summary.shortageCourses > 0 ? cu.orange : cu.green,
    },
  ];
  return (
    <View
      style={{
        backgroundColor: cu.card,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: cu.line,
        padding: 18,
        gap: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 9 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="book" size={16} color={cu.muted} />
            <Text
              style={{
                color: cu.text,
                fontSize: 16,
                fontWeight: '800',
                flex: 1,
              }}
              numberOfLines={1}
            >
              {connection.program ?? 'Chandigarh University'}
            </Text>
          </View>
          <PressScale onPress={onOpenProfile}>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <Icon name="user" size={16} color={cu.muted} />
              <Text
                style={{
                  color: cu.muted,
                  fontSize: 14,
                  fontWeight: '600',
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {mentorName ?? 'Mentor details'}
              </Text>
            </View>
          </PressScale>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              color: cu.muted,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 0.8,
            }}
          >
            OVERALL
          </Text>
          <CountText
            value={overall}
            decimals={0}
            suffix="%"
            style={{ color, fontSize: 30, fontWeight: '800' }}
          />
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: cu.line }} />
      <View style={{ flexDirection: 'row' }}>
        {main.map((action, index) => (
          <ActionTile key={action.label} action={action} divider={index > 0} />
        ))}
      </View>
      {open ? (
        <FadeIn distance={-6} style={{ gap: 14 }}>
          <View style={{ height: 1, backgroundColor: cu.line }} />
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: cu.cardAlt,
              borderRadius: 18,
              paddingVertical: 12,
            }}
          >
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  gap: 2,
                  borderLeftWidth: index === 0 ? 0 : 1,
                  borderLeftColor: cu.line,
                }}
              >
                <Text
                  style={{
                    color: stat.color ?? cu.text,
                    fontSize: 18,
                    fontWeight: '800',
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            {more.map((action, index) => (
              <ActionTile
                key={action.label}
                action={action}
                divider={index > 0}
              />
            ))}
          </View>
        </FadeIn>
      ) : null}
      <PressScale
        onPress={() => setOpen(value => !value)}
        style={{ alignItems: 'center', marginTop: -6 }}
      >
        <View
          style={{
            paddingHorizontal: 30,
            paddingVertical: 4,
            transform: [{ rotate: open ? '180deg' : '0deg' }],
          }}
        >
          <Icon name="chevron" size={18} color={cu.muted} />
        </View>
      </PressScale>
    </View>
  );
}

/** Subjects under the required attendance, worst first, with what to do about each. */
function AttentionCard({
  attendance,
  onOpen,
}: {
  attendance: AttendanceCourse[];
  onOpen: (course: AttendanceCourse) => void;
}) {
  const short = attendance
    .filter(c => c.percentage < c.minRequired)
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 3);
  if (short.length === 0) return null;
  return (
    <Surface style={{ gap: 12, borderColor: `${cu.red}40` }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: `${cu.red}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="arrowDown" size={16} color={cu.red} />
        </View>
        <Text
          style={{ color: cu.text, fontSize: 14, fontWeight: '800', flex: 1 }}
        >
          Needs attention
        </Text>
        <Text style={{ color: cu.red, fontSize: 12, fontWeight: '800' }}>
          {short.length} below minimum
        </Text>
      </View>
      {short.map(course => (
        <PressScale key={course.id} onPress={() => onOpen(course)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text
              style={{
                color: cu.red,
                fontSize: 15,
                fontWeight: '800',
                width: 46,
              }}
            >
              {Math.round(course.percentage)}%
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: cu.text, fontSize: 14, fontWeight: '700' }}
                numberOfLines={1}
              >
                {course.courseName}
              </Text>
              <Text style={{ color: cu.muted, fontSize: 12 }}>
                {guidanceText(course)}
              </Text>
            </View>
          </View>
        </PressScale>
      ))}
    </Surface>
  );
}

function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 6,
      }}
    >
      <View>
        <Text style={{ color: cu.text, fontSize: 20, fontWeight: '800' }}>
          {title}
        </Text>
        {hint ? (
          <Text style={{ color: cu.muted, fontSize: 12, marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

/** A compact subject row: ring, name, counts, and the one-line advice in the status colour. */
function SubjectRow({
  course,
  onPress,
}: {
  course: AttendanceCourse;
  onPress: () => void;
}) {
  const color = toneColor[toneOf(course)];
  return (
    <PressScale
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: cu.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: cu.line,
        padding: 12,
      }}
    >
      <Ring percent={course.percentage} size={54} stroke={6} color={color}>
        <Text style={{ color: cu.text, fontWeight: '800', fontSize: 13 }}>
          {Math.round(course.percentage)}
        </Text>
      </Ring>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ color: cu.text, fontSize: 15, fontWeight: '800' }}
          numberOfLines={1}
        >
          {course.courseName}
        </Text>
        <Text style={{ color: cu.muted, fontSize: 12 }} numberOfLines={1}>
          {course.courseCode} · {course.attendedClasses}/
          {course.deliveredClasses} classes
        </Text>
        <Text style={{ color, fontSize: 12, fontWeight: '800' }}>
          {guidanceText(course)}
        </Text>
      </View>
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Icon name="chevron" size={18} color={cu.muted} />
      </View>
    </PressScale>
  );
}

export function HomeTab({
  data,
  refreshing,
  onRefresh,
  onOpenPrediction,
  onOpenCalendar,
  onOpenSubjects,
  onOpenDatesheet,
  onOpenIdCard,
  onOpenUpdates,
  onOpenProfile,
  onRefreshPortal,
}: Props) {
  const { summary, attendance } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const selected = attendance.find(c => c.id === selectedId) ?? null;
  const open = (course: AttendanceCourse) => {
    setSelectedId(course.id);
    setSheetOpen(true);
  };
  return (
    <>
      <TabScroll refreshing={refreshing} onRefresh={onRefresh}>
        <FadeIn>
          <DashboardCard
            data={data}
            onOpenProfile={onOpenProfile}
            onOpenUpdates={onOpenUpdates}
            onOpenPrediction={onOpenPrediction}
            onOpenDatesheet={onOpenDatesheet}
            onOpenIdCard={onOpenIdCard}
            onOpenCalendar={onOpenCalendar}
            onOpenSubjects={onOpenSubjects}
            onRefreshPortal={onRefreshPortal}
          />
        </FadeIn>
        <FadeIn delay={80}>
          <ClassCard data={data} />
        </FadeIn>
        <FadeIn delay={140}>
          <AttentionCard attendance={attendance} onOpen={open} />
        </FadeIn>
        <FadeIn delay={220}>
          <SectionTitle
            title="Subjects"
            hint="Tap a subject for prediction and history"
            right={`${summary.safeCourses} safe · ${summary.shortageCourses} short`}
          />
        </FadeIn>
        {attendance.length === 0 ? (
          <Text style={{ color: cu.muted }}>
            No attendance has been imported yet.
          </Text>
        ) : (
          attendance.map((course, index) => (
            <FadeIn key={course.id} delay={260 + index * 60}>
              <SubjectRow course={course} onPress={() => open(course)} />
            </FadeIn>
          ))
        )}
      </TabScroll>
      <AttendanceSheet
        course={selected}
        timetable={data.timetable}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
