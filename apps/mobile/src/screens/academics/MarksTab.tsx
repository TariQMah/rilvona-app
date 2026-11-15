import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '../../components/typography';
import { formatWhen } from '../../lib/format';
import {
  Chip,
  EmptyPanel,
  Pill,
  Surface,
  TabScroll,
  TabTitle,
} from './ui/parts';
import { cu, Icon, Ring } from './ui/graphics';
import {
  AnimatedBar,
  Chevron,
  CountText,
  FadeIn,
  PressScale,
} from './ui/motion';
import {
  filterMarks,
  groupMarks,
  kindBreakdown,
  kindOf,
  MARK_KIND_LABEL,
  markPercent,
  marksInsights,
  marksKinds,
  marksTone,
  sortAssessments,
  type ConnectedOverview,
  type MarkKind,
  type SubjectMarks,
} from './model';

const toneColor = (percent: number | null) => {
  const tone = marksTone(percent);
  return tone === 'safe'
    ? cu.green
    : tone === 'edge'
    ? cu.orange
    : tone === 'short'
    ? cu.red
    : cu.muted;
};

const num = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

type Filter = MarkKind | 'ALL';

function Segments({
  options,
  value,
  onChange,
}: {
  options: { id: Filter; label: string }[];
  value: Filter;
  onChange: (value: Filter) => void;
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
      {options.map(option => (
        <Pressable
          key={option.id}
          onPress={() => onChange(option.id)}
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: 9,
            borderRadius: 13,
            backgroundColor:
              value === option.id ? `${cu.blue}33` : 'transparent',
          }}
        >
          <Text
            style={{
              color: value === option.id ? cu.blue : cu.muted,
              fontWeight: '800',
              fontSize: 13,
            }}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Standout({
  label,
  icon,
  group,
  color,
}: {
  label: string;
  icon: 'arrowUp' | 'arrowDown';
  group: SubjectMarks;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: cu.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: cu.line,
        padding: 14,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: `${color}26`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={13} color={color} />
        </View>
        <Text
          style={{
            color: cu.muted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.6,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={{
          color: cu.text,
          fontWeight: '700',
          fontSize: 14,
          minHeight: 36,
        }}
      >
        {group.courseName}
      </Text>
      <Text style={{ color, fontSize: 24, fontWeight: '800' }}>
        {group.percent}%
      </Text>
    </View>
  );
}

function Hero({
  groups,
  insights,
  count,
  latest,
}: {
  groups: SubjectMarks[];
  insights: ReturnType<typeof marksInsights>;
  count: number;
  latest: string | undefined;
}) {
  const color = toneColor(insights.average);
  return (
    <Surface style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <Ring
          percent={insights.average ?? 0}
          size={112}
          stroke={10}
          color={color}
        >
          <CountText
            value={insights.average}
            suffix="%"
            style={{ color: cu.text, fontSize: 24, fontWeight: '800' }}
          />
        </Ring>
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              color: cu.muted,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 0.6,
            }}
          >
            AVERAGE ACROSS SUBJECTS
          </Text>
          <Text style={{ color: cu.text, fontSize: 15, fontWeight: '700' }}>
            {insights.obtained > 0 || insights.max > 0
              ? `${num(insights.obtained)} of ${num(insights.max)} marks scored`
              : 'No scored assessments yet'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Chip
              label={`${groups.length} subject${
                groups.length === 1 ? '' : 's'
              }`}
              icon="book"
            />
            <Chip
              label={`${count} assessment${count === 1 ? '' : 's'}`}
              icon="doc"
            />
          </View>
        </View>
      </View>
      {latest ? (
        <Text style={{ color: cu.muted, fontSize: 12 }}>
          Last imported {formatWhen(latest)}
        </Text>
      ) : null}
    </Surface>
  );
}

function NeedsLook({
  weak,
}: {
  weak: ReturnType<typeof marksInsights>['weak'];
}) {
  return (
    <View
      style={{
        backgroundColor: `${cu.orange}12`,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: `${cu.orange}40`,
        padding: 16,
        gap: 12,
      }}
    >
      <Text
        style={{
          color: cu.orange,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.6,
        }}
      >
        WORTH A LOOK
      </Text>
      {weak.map(item => (
        <View
          key={`${item.courseCode}${item.assessmentName}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{ color: cu.text, fontWeight: '700' }}
            >
              {item.assessmentName}
            </Text>
            <Text numberOfLines={1} style={{ color: cu.muted, fontSize: 12 }}>
              {item.courseName}
            </Text>
          </View>
          <Text style={{ color: toneColor(item.percent), fontWeight: '800' }}>
            {num(item.obtained)}
            <Text style={{ color: cu.muted, fontWeight: '600' }}>
              {' '}
              / {num(item.max)}
            </Text>
          </Text>
        </View>
      ))}
    </View>
  );
}

function KindDot({
  label,
  percent,
}: {
  label: string;
  percent: number | null;
}) {
  const color = toneColor(percent);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }}
      />
      <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}>
        {label} {percent === null ? '—' : `${Math.round(percent)}%`}
      </Text>
    </View>
  );
}

function Subject({
  group,
  open,
  onToggle,
}: {
  group: SubjectMarks;
  open: boolean;
  onToggle: () => void;
}) {
  const color = toneColor(group.percent);
  const kinds = useMemo(() => kindBreakdown(group.items), [group.items]);
  const items = useMemo(() => sortAssessments(group.items), [group.items]);
  return (
    <View
      style={{
        backgroundColor: cu.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: cu.line,
        overflow: 'hidden',
      }}
    >
      <PressScale
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 14,
        }}
      >
        <Ring percent={group.percent ?? 0} size={56} stroke={6} color={color}>
          <Text style={{ color: cu.text, fontWeight: '800', fontSize: 13 }}>
            {group.percent === null ? '—' : Math.round(group.percent)}
          </Text>
        </Ring>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: cu.text, fontWeight: '800', fontSize: 16 }}>
            {group.courseName}
          </Text>
          <Text style={{ color: cu.muted, fontSize: 12 }}>
            {group.courseCode} · {group.items.length} assessment
            {group.items.length === 1 ? '' : 's'}
            {group.max > 0 ? ` · ${num(group.obtained)}/${num(group.max)}` : ''}
          </Text>
          {kinds.length > 1 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 2,
              }}
            >
              {kinds.map(k => (
                <KindDot
                  key={k.kind}
                  label={MARK_KIND_LABEL[k.kind]}
                  percent={k.percent}
                />
              ))}
            </View>
          ) : null}
        </View>
        <Chevron open={open}>
          <Icon name="chevron" size={20} color={cu.muted} />
        </Chevron>
      </PressScale>
      {open ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: cu.line,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 14,
            gap: 12,
          }}
        >
          {items.map((item, index) => {
            const percent = markPercent(item);
            const itemColor = toneColor(percent);
            return (
              <FadeIn
                key={item.id}
                delay={index * 40}
                distance={8}
                style={{ gap: 6 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: cu.text, fontWeight: '600' }}>
                      {item.assessmentName}
                    </Text>
                    <Text
                      style={{
                        color: cu.muted,
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.4,
                      }}
                    >
                      {MARK_KIND_LABEL[kindOf(item.category)].toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={{ color: cu.text, fontWeight: '800', fontSize: 15 }}
                  >
                    {num(item.obtainedMarks)}
                    {item.maxMarks > 0 ? (
                      <Text style={{ color: cu.muted, fontWeight: '600' }}>
                        {' '}
                        / {num(item.maxMarks)}
                      </Text>
                    ) : null}
                  </Text>
                  {percent !== null ? (
                    <Text
                      style={{
                        color: itemColor,
                        fontWeight: '800',
                        fontSize: 12,
                        minWidth: 42,
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(percent)}%
                    </Text>
                  ) : null}
                </View>
                {percent !== null ? (
                  <AnimatedBar percent={percent} color={itemColor} height={4} />
                ) : null}
              </FadeIn>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function MarksTab({
  data,
  refreshing,
  onRefresh,
}: {
  data: ConnectedOverview;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const kinds = useMemo(() => marksKinds(data.marks), [data.marks]);
  const active: Filter =
    filter === 'ALL' || kinds.includes(filter) ? filter : 'ALL';
  const shown = useMemo(
    () => filterMarks(data.marks, active),
    [data.marks, active],
  );
  const groups = useMemo(() => groupMarks(shown), [shown]);
  const insights = useMemo(() => marksInsights(groups), [groups]);
  const latest = data.marks
    .map(m => m.publishedAt)
    .sort()
    .pop();

  return (
    <TabScroll refreshing={refreshing} onRefresh={onRefresh}>
      <TabTitle
        title="Marks"
        right={
          data.connection.semester ? (
            <Pill
              label={`Semester ${data.connection.semester}`}
              color={cu.blue}
            />
          ) : undefined
        }
      />
      {data.marks.length === 0 ? (
        <EmptyPanel
          icon="marks"
          title="No marks yet"
          body="Marks will appear here once they are imported from CUIMS."
        />
      ) : (
        <>
          {kinds.length > 1 ? (
            <Segments
              value={active}
              onChange={setFilter}
              options={[
                { id: 'ALL', label: 'All' },
                ...kinds.map(kind => ({
                  id: kind as Filter,
                  label: MARK_KIND_LABEL[kind],
                })),
              ]}
            />
          ) : null}
          <FadeIn scaleFrom={0.96} distance={0}>
            <Hero
              groups={groups}
              insights={insights}
              count={shown.length}
              latest={latest}
            />
          </FadeIn>
          {insights.best && insights.lowest ? (
            <FadeIn delay={80}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Standout
                  label="STRONGEST"
                  icon="arrowUp"
                  group={insights.best}
                  color={toneColor(insights.best.percent)}
                />
                <Standout
                  label="NEEDS WORK"
                  icon="arrowDown"
                  group={insights.lowest}
                  color={toneColor(insights.lowest.percent)}
                />
              </View>
            </FadeIn>
          ) : null}
          {insights.weak.length > 0 ? (
            <FadeIn delay={200}>
              <NeedsLook weak={insights.weak} />
            </FadeIn>
          ) : null}
          <Text
            style={{
              color: cu.muted,
              fontSize: 12,
              fontWeight: '800',
              letterSpacing: 0.6,
              marginTop: 4,
            }}
          >
            BY SUBJECT
          </Text>
          {groups.map((group, index) => (
            <FadeIn key={group.courseCode} delay={240 + index * 50}>
              <Subject
                group={group}
                open={openCode === group.courseCode}
                onToggle={() =>
                  setOpenCode(
                    openCode === group.courseCode ? null : group.courseCode,
                  )
                }
              />
            </FadeIn>
          ))}
        </>
      )}
    </TabScroll>
  );
}
