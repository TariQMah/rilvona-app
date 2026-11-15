import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import type { PortalNotice } from '../../api/types';
import { realMentor, type ConnectedOverview } from './model';
import { cu, Icon, type IconName } from './ui/graphics';
import { BottomSheet, FadeIn, PressScale } from './ui/motion';
import { Avatar, Chip, Pill, Surface } from './ui/parts';

const KIND_COLOR: Record<PortalNotice['kind'], string> = {
  MESSAGE: cu.red,
  ANNOUNCEMENT: cu.blue,
  NOTIFICATION: cu.orange,
};
export const KIND_LABEL: Record<PortalNotice['kind'], string> = {
  MESSAGE: 'Important',
  ANNOUNCEMENT: 'Announcement',
  NOTIFICATION: 'Notification',
};

export function NoticeRow({
  notice,
  expanded = false,
}: {
  notice: PortalNotice;
  expanded?: boolean;
}) {
  const color = KIND_COLOR[notice.kind];
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 4, borderRadius: 2, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 3 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color, fontSize: 11, fontWeight: '800' }}>
            {KIND_LABEL[notice.kind].toUpperCase()}
          </Text>
          {notice.date ? (
            <Text style={{ color: cu.muted, fontSize: 11 }}>{notice.date}</Text>
          ) : null}
        </View>
        <Text
          style={{ color: cu.text, fontWeight: '700', fontSize: 14 }}
          numberOfLines={expanded ? undefined : 3}
        >
          {notice.title}
        </Text>
        {notice.body ? (
          <Text
            style={{ color: cu.muted, fontSize: 12, lineHeight: 18 }}
            numberOfLines={expanded ? undefined : 3}
          >
            {notice.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ContactButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressScale onPress={onPress}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: `${cu.blue}26`,
        }}
      >
        <Icon name={icon} size={14} color={cu.blue} />
        <Text style={{ color: cu.blue, fontWeight: '800', fontSize: 12 }}>
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

function MentorCard({
  mentor,
}: {
  mentor: NonNullable<ConnectedOverview['connection']['mentor']>;
}) {
  const extra = mentor.lines
    .filter(line => line !== mentor.name && !/^(mentor|name)\b/i.test(line))
    .slice(0, 6);
  const recognised = Boolean(
    mentor.designation || mentor.department || mentor.phone || mentor.email,
  );
  return (
    <Surface style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: `${cu.purple}26`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="user" size={22} color={cu.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: cu.muted, fontSize: 11, fontWeight: '800' }}>
            YOUR MENTOR
          </Text>
          <Text
            style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}
            numberOfLines={2}
          >
            {mentor.name ?? 'Mentor'}
          </Text>
          {mentor.designation ? (
            <Text style={{ color: cu.muted, fontSize: 12 }}>
              {mentor.designation}
            </Text>
          ) : null}
        </View>
      </View>
      {mentor.department ? (
        <Chip label={mentor.department} icon="book" />
      ) : null}
      {!recognised && extra.length > 0 ? (
        <View style={{ gap: 4 }}>
          {extra.map((line, index) => (
            <Text
              key={`${line}-${index}`}
              style={{ color: cu.muted, fontSize: 13 }}
            >
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      {mentor.phone || mentor.email ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {mentor.phone ? (
            <ContactButton
              icon="phone"
              label={`Call ${mentor.phone}`}
              onPress={() => void Linking.openURL(`tel:${mentor.phone}`)}
            />
          ) : null}
          {mentor.email ? (
            <ContactButton
              icon="mail"
              label={mentor.email}
              onPress={() => void Linking.openURL(`mailto:${mentor.email}`)}
            />
          ) : null}
        </View>
      ) : null}
    </Surface>
  );
}

type Props = { data: ConnectedOverview; visible: boolean; onClose: () => void };

export function ProfileSheet({ data, visible, onClose }: Props) {
  const { connection, summary, notices } = data;
  const name = connection.studentName ?? 'Student';
  const mentor = realMentor(connection.mentor);
  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.92}>
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <FadeIn style={{ alignItems: 'center', gap: 10 }}>
          <View
            style={{
              padding: 4,
              borderRadius: 60,
              borderWidth: 2,
              borderColor: `${cu.blue}66`,
            }}
          >
            <Avatar photo={connection.photo} name={name} size={104} />
          </View>
          <Text
            style={{
              color: cu.text,
              fontSize: 22,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            {name}
          </Text>
          <Text style={{ color: cu.muted, fontWeight: '600' }}>
            {connection.studentUid}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              justifyContent: 'center',
            }}
          >
            {connection.program ? (
              <Chip label={connection.program} icon="book" />
            ) : null}
            <Chip label={`Semester ${connection.semester}`} icon="calendar" />
            {connection.section ? (
              <Chip label={`Section ${connection.section}`} icon="user" />
            ) : null}
            {connection.sectionGroup ? (
              <Chip label={`Group ${connection.sectionGroup}`} icon="user" />
            ) : null}
          </View>
        </FadeIn>

        <FadeIn delay={80}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              {
                label: 'Attendance',
                value:
                  summary.overallAttendance === null
                    ? '–'
                    : `${summary.overallAttendance}%`,
              },
              { label: 'Subjects', value: String(data.attendance.length) },
              {
                label: 'Avg score',
                value:
                  summary.averageScorePct === null
                    ? '–'
                    : `${summary.averageScorePct}%`,
              },
            ].map(tile => (
              <View
                key={tile.label}
                style={{
                  flex: 1,
                  backgroundColor: cu.card,
                  borderRadius: 16,
                  padding: 12,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: cu.line,
                }}
              >
                <Text
                  style={{ color: cu.text, fontSize: 20, fontWeight: '800' }}
                >
                  {tile.value}
                </Text>
                <Text
                  style={{ color: cu.muted, fontSize: 11, fontWeight: '700' }}
                >
                  {tile.label}
                </Text>
              </View>
            ))}
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          {mentor ? (
            <MentorCard mentor={mentor} />
          ) : (
            <Surface style={{ gap: 4 }}>
              <Text style={{ color: cu.text, fontWeight: '800' }}>
                Mentor details
              </Text>
              <Text style={{ color: cu.muted, lineHeight: 20 }}>
                Your portal did not show a mentor for you on the last refresh.
              </Text>
            </Surface>
          )}
        </FadeIn>

        <FadeIn delay={200}>
          <Surface style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
                Important notices
              </Text>
              <Pill label={String(notices.length)} color={cu.blue} />
            </View>
            {notices.length === 0 ? (
              <Text style={{ color: cu.muted }}>
                Nothing new on your portal.
              </Text>
            ) : (
              notices
                .slice(0, 6)
                .map((notice, index) => (
                  <NoticeRow key={`${notice.title}-${index}`} notice={notice} />
                ))
            )}
          </Surface>
        </FadeIn>

        <Pressable
          onPress={onClose}
          style={{ alignItems: 'center', padding: 12 }}
        >
          <Text style={{ color: cu.muted, fontWeight: '700' }}>Close</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}
