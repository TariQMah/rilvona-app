import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  AttendanceCourse,
  CourseMarkItem,
  TimetableSlotItem,
} from '../../api/types';
import { PageHeader } from './PageShell';
import {
  clock12,
  groupMarks,
  guidanceText,
  kindBreakdown,
  kindOf,
  MARK_KIND_LABEL,
  slotsOfCourse,
  sortAssessments,
  subjectColors,
  teachersOfCourse,
  toneOf,
  type ConnectedOverview,
  type Tone,
} from './model';
import { cu, Icon, Ring } from './ui/graphics';
import { AnimatedBar, Chevron, FadeIn, PressScale } from './ui/motion';
import { Chip, EmptyPanel, Pill, Surface } from './ui/parts';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Monday first; the timetable has no Sunday classes. */
const dayRank = (day: number) => (day + 6) % 7;

const TONE_COLOR: Record<Tone, string> = {
  safe: cu.green,
  edge: cu.orange,
  short: cu.red,
};

const num = (value: number) => String(Math.round(value * 10) / 10);

const titleCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

function Label({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: cu.muted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
      }}
    >
      {children}
    </Text>
  );
}

function Fact({
  label,
  value,
  color = cu.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cu.cardAlt,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 10,
        gap: 2,
      }}
    >
      <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text
        numberOfLines={1}
        style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
      >
        {label}
      </Text>
    </View>
  );
}

function AttendanceBlock({ course }: { course: AttendanceCourse }) {
  const color = TONE_COLOR[toneOf(course)];
  return (
    <View style={{ gap: 10 }}>
      <Label>ATTENDANCE</Label>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Fact
          label="Attended"
          value={`${course.attendedClasses}/${course.deliveredClasses}`}
        />
        <Fact label="Duty leave" value={String(course.dutyLeave)} />
        <Fact
          label={`Min ${course.minRequired}%`}
          value={`${num(course.percentage)}%`}
          color={color}
        />
      </View>
      <AnimatedBar
        percent={course.percentage}
        color={color}
        marker={course.minRequired}
        height={6}
      />
      <Text style={{ color, fontSize: 13, fontWeight: '700' }}>
        {guidanceText(course)}
      </Text>
    </View>
  );
}

function FacultyBlock({
  course,
  slots,
}: {
  course: AttendanceCourse;
  slots: TimetableSlotItem[];
}) {
  const teachers = useMemo(
    () => teachersOfCourse(course, slots),
    [course, slots],
  );
  if (teachers.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Label>FACULTY</Label>
      {teachers.map(teacher => (
        <View
          key={teacher.name}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: `${cu.blue}22`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="user" size={16} color={cu.blue} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: cu.text, fontWeight: '700' }}
            >
              {teacher.name}
            </Text>
            <Text numberOfLines={1} style={{ color: cu.muted, fontSize: 12 }}>
              {[
                teacher.roles.join(' · '),
                teacher.days.map(d => DAYS[d]).join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ScheduleBlock({ slots }: { slots: TimetableSlotItem[] }) {
  const sorted = useMemo(
    () =>
      [...slots].sort(
        (a, b) =>
          dayRank(a.dayOfWeek) - dayRank(b.dayOfWeek) ||
          a.startTime.localeCompare(b.startTime),
      ),
    [slots],
  );
  if (sorted.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Label>{`WEEKLY SCHEDULE · ${sorted.length} CLASS${
        sorted.length === 1 ? '' : 'ES'
      }`}</Label>
      {sorted.map(slot => (
        <View
          key={slot.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Text
            style={{
              width: 38,
              color: cu.text,
              fontWeight: '800',
              fontSize: 13,
            }}
          >
            {DAYS[slot.dayOfWeek]}
          </Text>
          <Text style={{ flex: 1, color: cu.muted, fontSize: 13 }}>
            {clock12(slot.startTime)} – {clock12(slot.endTime)}
          </Text>
          <Text style={{ color: cu.muted, fontSize: 12 }} numberOfLines={1}>
            {[titleCase(slot.slotType || 'Lecture'), slot.room]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MarksBlock({ items }: { items: CourseMarkItem[] }) {
  const sorted = useMemo(() => sortAssessments(items), [items]);
  const kinds = useMemo(() => kindBreakdown(items), [items]);
  const total = useMemo(() => groupMarks(items)[0] ?? null, [items]);
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Label>{`MARKS · ${items.length} ASSESSMENT${
        items.length === 1 ? '' : 'S'
      }`}</Label>
      {total && total.percent !== null ? (
        <Text style={{ color: cu.text, fontWeight: '800' }}>
          {num(total.obtained)} of {num(total.max)} scored ·{' '}
          <Text style={{ color: cu.muted, fontWeight: '700' }}>
            {total.percent}%
          </Text>
        </Text>
      ) : null}
      {kinds.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {kinds.map(kind => (
            <Chip
              key={kind.kind}
              label={`${MARK_KIND_LABEL[kind.kind]} ${
                kind.percent === null ? '–' : `${Math.round(kind.percent)}%`
              }`}
            />
          ))}
        </View>
      ) : null}
      {sorted.map(item => (
        <View
          key={item.id}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View style={{ flex: 1, gap: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: cu.text, fontWeight: '600', fontSize: 14 }}
            >
              {item.assessmentName}
            </Text>
            <Text style={{ color: cu.muted, fontSize: 11 }}>
              {MARK_KIND_LABEL[kindOf(item.category)]}
            </Text>
          </View>
          <Text style={{ color: cu.text, fontWeight: '800' }}>
            {num(item.obtainedMarks)}
            <Text style={{ color: cu.muted, fontWeight: '600' }}>
              {' '}
              / {num(item.maxMarks)}
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function SubjectCard({
  course,
  slots,
  marks,
  accent,
  open,
  onToggle,
}: {
  course: AttendanceCourse;
  slots: TimetableSlotItem[];
  marks: CourseMarkItem[];
  accent: string;
  open: boolean;
  onToggle: () => void;
}) {
  const tone = toneOf(course);
  const color = TONE_COLOR[tone];
  const types = useMemo(
    () =>
      Array.from(new Set(slots.map(s => titleCase(s.slotType || 'Lecture')))),
    [slots],
  );
  return (
    <View
      style={{
        backgroundColor: cu.card,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: open ? `${accent}55` : cu.line,
        overflow: 'hidden',
      }}
    >
      <PressScale
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
        }}
      >
        <Ring percent={course.percentage} size={58} stroke={6} color={color}>
          <Text style={{ color: cu.text, fontSize: 15, fontWeight: '800' }}>
            {Math.round(course.percentage)}
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            numberOfLines={2}
            style={{ color: cu.text, fontSize: 16, fontWeight: '800' }}
          >
            {course.courseName}
          </Text>
          <Text numberOfLines={1} style={{ color: cu.muted, fontSize: 12 }}>
            {[course.courseCode, types.join(' + ')].filter(Boolean).join(' · ')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Pill
              label={
                tone === 'short'
                  ? 'Shortage'
                  : tone === 'edge'
                  ? 'Borderline'
                  : 'Safe'
              }
              color={color}
            />
            {marks.length > 0 ? (
              <Pill
                label={`${marks.length} assessment${
                  marks.length === 1 ? '' : 's'
                }`}
                color={cu.blue}
              />
            ) : null}
          </View>
        </View>
        <Chevron open={open}>
          <Icon name="chevron" size={20} color={cu.muted} />
        </Chevron>
      </PressScale>
      {open ? (
        <FadeIn distance={6}>
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 18,
              paddingTop: 4,
              gap: 20,
              borderTopWidth: 1,
              borderTopColor: cu.line,
            }}
          >
            <View style={{ height: 6 }} />
            <AttendanceBlock course={course} />
            <FacultyBlock course={course} slots={slots} />
            <ScheduleBlock slots={slots} />
            <MarksBlock items={marks} />
          </View>
        </FadeIn>
      ) : null}
    </View>
  );
}

/** Everything the app knows about each subject in one place: attendance, faculty, weekly schedule and marks. */
export function SubjectsPage({
  data,
  onClose,
}: {
  data: ConnectedOverview;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [openId, setOpenId] = useState<string | null>(null);
  const colors = useMemo(() => subjectColors(data.timetable), [data.timetable]);

  const rows = useMemo(
    () =>
      data.attendance.map(course => ({
        course,
        slots: slotsOfCourse(course, data.timetable),
        marks: data.marks.filter(m => m.courseCode === course.courseCode),
      })),
    [data.attendance, data.timetable, data.marks],
  );
  const weekly = rows.reduce((sum, row) => sum + row.slots.length, 0);
  const shortage = rows.filter(r => toneOf(r.course) === 'short').length;

  return (
    <View style={{ flex: 1 }}>
      <PageHeader
        title="Subjects"
        subtitle={`${rows.length} subject${rows.length === 1 ? '' : 's'}${
          data.connection.semester
            ? ` · Semester ${data.connection.semester}`
            : ''
        }`}
        onBack={onClose}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 28 + insets.bottom,
          gap: 12,
        }}
      >
        {rows.length === 0 ? (
          <EmptyPanel
            icon="book"
            title="No subjects yet"
            body="Your subjects appear here once attendance is imported from CUIMS."
          />
        ) : (
          <>
            <FadeIn>
              <Surface style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
                <Fact label="Subjects" value={String(rows.length)} />
                <Fact label="Classes / week" value={String(weekly)} />
                <Fact
                  label="Below minimum"
                  value={String(shortage)}
                  color={shortage > 0 ? cu.red : cu.green}
                />
              </Surface>
            </FadeIn>
            {rows.map((row, index) => (
              <FadeIn key={row.course.id} delay={60 + index * 40}>
                <SubjectCard
                  course={row.course}
                  slots={row.slots}
                  marks={row.marks}
                  accent={
                    colors.get(
                      row.course.courseCode || row.course.courseName,
                    ) ?? cu.blue
                  }
                  open={openId === row.course.id}
                  onToggle={() =>
                    setOpenId(openId === row.course.id ? null : row.course.id)
                  }
                />
              </FadeIn>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
