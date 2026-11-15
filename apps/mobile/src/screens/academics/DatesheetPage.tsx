import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  daysToExam,
  nextExam,
  sheetsOf,
  type ExamEntry,
} from '../../cuims/datesheetData';
import { errorMessage } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import { PageHeader, Segmented } from './PageShell';
import { useDatesheet } from './useDatesheet';
import { clock12 } from './model';
import { cu, Icon } from './ui/graphics';
import { FadeIn, Skeleton } from './ui/motion';
import { EmptyPanel, Pill, Surface } from './ui/parts';

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

const partsOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return {
    day: d ?? 1,
    month: MONTH[date.getMonth()] ?? '',
    weekday: WEEKDAY[date.getDay()] ?? '',
  };
};

const whenText = (days: number) =>
  days === 0
    ? 'Today'
    : days === 1
    ? 'Tomorrow'
    : days > 0
    ? `In ${days} days`
    : 'Done';

function ExamCard({ exam, now }: { exam: ExamEntry; now: Date }) {
  const days = daysToExam(exam.date, now);
  const past = days < 0;
  const soon = days >= 0 && days <= 1;
  const accent = past ? cu.muted : soon ? cu.orange : cu.blue;
  const { day, month, weekday } = partsOf(exam.date);
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 14,
        backgroundColor: cu.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: soon ? `${accent}60` : cu.line,
        padding: 12,
        opacity: past ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 60,
          borderRadius: 16,
          backgroundColor: `${accent}1f`,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
        }}
      >
        <Text style={{ color: accent, fontSize: 11, fontWeight: '800' }}>
          {weekday.toUpperCase()}
        </Text>
        <Text
          style={{
            color: cu.text,
            fontSize: 24,
            fontWeight: '800',
            lineHeight: 28,
          }}
        >
          {day}
        </Text>
        <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}>
          {month}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: cu.text,
                fontSize: 15,
                fontWeight: '800',
                lineHeight: 20,
              }}
            >
              {exam.courseName}
            </Text>
            {exam.courseCode ? (
              <Text
                style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}
              >
                {exam.courseCode}
                {exam.slot ? ` · Slot ${exam.slot}` : ''}
              </Text>
            ) : null}
          </View>
          <Pill label={whenText(days)} color={accent} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {exam.time ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Icon name="clock" size={14} color={cu.muted} />
              <Text style={{ color: cu.text, fontSize: 13, fontWeight: '700' }}>
                {clock12(exam.time)}
              </Text>
            </View>
          ) : null}
          {exam.venue ? (
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Icon name="pin" size={14} color={cu.muted} />
              <Text style={{ color: cu.text, fontSize: 13, fontWeight: '700' }}>
                {exam.venue}
              </Text>
            </View>
          ) : null}
          {exam.mode ? (
            <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '700' }}>
              {exam.mode}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

type Props = {
  onClose: () => void;
  /** Opens the CUIMS sign-in sheet, used when the saved session has expired. */
  onRefresh: () => void;
};

/** The student's exam date sheet, read from CUIMS and kept on the phone. */
export function DatesheetPage({ onClose, onRefresh }: Props) {
  const insets = useSafeAreaInsets();
  const now = useMemo(() => new Date(), []);
  const query = useDatesheet();
  const result = query.data;
  const entries = useMemo(() => result?.data?.entries ?? [], [result]);
  const sheets = useMemo(() => sheetsOf(entries), [entries]);
  const [picked, setPicked] = useState<string | null>(null);
  const sheet = picked && sheets.includes(picked) ? picked : sheets[0] ?? null;
  const shown = entries.filter(e => e.sheet === sheet);
  const next = nextExam(entries, now);
  const left = entries.filter(e => daysToExam(e.date, now) >= 0).length;

  const body = (() => {
    if (query.isLoading)
      return (
        <>
          <Skeleton height={120} radius={22} />
          <Skeleton height={96} radius={20} />
          <Skeleton height={96} radius={20} />
        </>
      );
    if (query.isError)
      return (
        <Surface style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="doc" size={34} color={cu.muted} />
          <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
            Could not load the date sheet
          </Text>
          <Text
            style={{ color: cu.muted, textAlign: 'center', lineHeight: 20 }}
          >
            {errorMessage(query.error)}
          </Text>
          <Pressable
            onPress={() => void query.refetch()}
            style={{
              backgroundColor: cu.blue,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>Try again</Text>
          </Pressable>
        </Surface>
      );
    if (!result?.data)
      return (
        <Surface style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="refresh" size={34} color={cu.muted} />
          <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
            Sign in to load your date sheet
          </Text>
          <Text
            style={{ color: cu.muted, textAlign: 'center', lineHeight: 20 }}
          >
            Your CUIMS session has expired. Refresh from CUIMS once and the date
            sheet will appear here.
          </Text>
          <Pressable
            onPress={onRefresh}
            style={{
              backgroundColor: cu.blue,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800' }}>
              Refresh from CUIMS
            </Text>
          </Pressable>
        </Surface>
      );
    return (
      <>
        {result.expired || result.fromCache ? (
          <Pressable
            onPress={onRefresh}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: `${cu.orange}1a`,
              borderRadius: 16,
              padding: 12,
            }}
          >
            <Icon name="refresh" size={16} color={cu.orange} />
            <Text
              style={{
                color: cu.orange,
                flex: 1,
                fontSize: 13,
                fontWeight: '700',
                lineHeight: 18,
              }}
            >
              {result.expired
                ? 'Showing the saved copy. Your CUIMS session expired, tap to refresh.'
                : 'Showing the saved copy. The portal could not be reached.'}
            </Text>
          </Pressable>
        ) : null}

        {entries.length === 0 ? (
          <EmptyPanel
            icon="doc"
            title="No exams published yet"
            body="CUIMS has not listed a date sheet for you. It will show up here once the university publishes it."
          />
        ) : (
          <>
            {next ? (
              <FadeIn>
                <View
                  style={{
                    backgroundColor: cu.card,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: `${cu.purple}50`,
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
                      backgroundColor: `${cu.purple}16`,
                    }}
                  />
                  <Text
                    style={{
                      color: cu.purple,
                      fontSize: 12,
                      fontWeight: '800',
                    }}
                  >
                    NEXT EXAM · {left} LEFT
                  </Text>
                  <Text
                    style={{
                      color: cu.text,
                      fontSize: 22,
                      fontWeight: '800',
                      lineHeight: 28,
                    }}
                  >
                    {next.courseName}
                  </Text>
                  <Text style={{ color: cu.muted, fontWeight: '700' }}>
                    {partsOf(next.date).weekday}, {partsOf(next.date).day}{' '}
                    {partsOf(next.date).month}
                    {next.time ? ` · ${clock12(next.time)}` : ''}
                    {next.venue ? ` · ${next.venue}` : ''}
                  </Text>
                  <Text
                    style={{
                      color: cu.purple,
                      fontSize: 18,
                      fontWeight: '800',
                      paddingTop: 4,
                    }}
                  >
                    {whenText(daysToExam(next.date, now))}
                  </Text>
                </View>
              </FadeIn>
            ) : (
              <Surface>
                <Text style={{ color: cu.text, fontWeight: '800' }}>
                  All exams on your date sheet are done.
                </Text>
              </Surface>
            )}
            {shown.map((exam, index) => (
              <FadeIn
                key={`${exam.date}-${exam.courseCode}-${exam.courseName}-${index}`}
                delay={Math.min(index, 8) * 40}
              >
                <ExamCard exam={exam} now={now} />
              </FadeIn>
            ))}
          </>
        )}

        {result.data.practicalChecked &&
        !entries.some(e => e.kind === 'practical') ? (
          <Text
            style={{
              color: cu.muted,
              fontSize: 12,
              lineHeight: 18,
              paddingHorizontal: 4,
            }}
          >
            Practical date sheet: nothing published on CUIMS yet.
          </Text>
        ) : null}
        <Text
          style={{
            color: cu.muted,
            fontSize: 12,
            lineHeight: 18,
            paddingHorizontal: 4,
          }}
        >
          Read from CUIMS, last updated {formatWhen(result.data.fetchedAt)}. The
          official date sheet on the portal is the one that counts.
        </Text>
      </>
    );
  })();

  return (
    <View style={{ flex: 1 }}>
      <PageHeader
        title="Date sheet"
        subtitle={
          entries.length > 0
            ? `${entries.length} exams`
            : 'Exam dates and timings'
        }
        onBack={onClose}
        right={
          query.isFetching && !query.isLoading ? (
            <ActivityIndicator color={cu.blue} />
          ) : null
        }
      />
      {sheets.length > 1 ? (
        <View style={{ paddingTop: 8 }}>
          <Segmented
            options={sheets.map(name => ({ key: name, label: name }))}
            value={sheet ?? sheets[0] ?? ''}
            onChange={setPicked}
          />
        </View>
      ) : null}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 8,
          paddingBottom: 28 + insets.bottom,
          gap: 12,
        }}
      >
        {body}
      </ScrollView>
    </View>
  );
}
