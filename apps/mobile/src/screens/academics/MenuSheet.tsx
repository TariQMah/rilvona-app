import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { formatWhen } from '../../lib/format';
import { cu, Icon, type IconName } from './ui/graphics';
import { BottomSheet, FadeIn, PressScale } from './ui/motion';
import { Avatar } from './ui/parts';
import type { LegalKind } from './legal';
import type { ConnectedOverview } from './model';

type Props = {
  data: ConnectedOverview;
  visible: boolean;
  unlinking: boolean;
  signingOut: boolean;
  unreadCount: number;
  onClose: () => void;
  onProfile: () => void;
  onUpdates: () => void;
  onRefresh: () => void;
  onPredict: () => void;
  onCalendar: () => void;
  onDatesheet: () => void;
  onIdCard: () => void;
  onLegal: (kind: LegalKind) => void;
  onUnlink: () => void;
  onSignOut: () => void;
};

function Row({
  icon,
  label,
  hint,
  color = cu.blue,
  badge,
  soon,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  color?: string;
  badge?: number;
  soon?: boolean;
  onPress?: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={soon}
      style={{
        opacity: soon ? 0.6 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          backgroundColor: `${color}22`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color: cu.text, fontSize: 15, fontWeight: '700' }}>
          {label}
        </Text>
        <Text style={{ color: cu.muted, fontSize: 12 }} numberOfLines={1}>
          {hint}
        </Text>
      </View>
      {soon ? (
        <View
          style={{
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: `${color}26`,
          }}
        >
          <Text style={{ color, fontSize: 11, fontWeight: '800' }}>SOON</Text>
        </View>
      ) : null}
      {badge ? (
        <View
          style={{
            minWidth: 22,
            height: 22,
            paddingHorizontal: 6,
            borderRadius: 11,
            backgroundColor: cu.red,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
      {soon ? null : (
        <View style={{ transform: [{ rotate: '-90deg' }] }}>
          <Icon name="chevron" size={18} color={cu.muted} />
        </View>
      )}
    </PressScale>
  );
}

function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: cu.line, marginLeft: 68 }} />
  );
}

function Confirm({
  icon,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  icon: IconName;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <FadeIn distance={10} style={{ gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 6 }}>
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: `${cu.red}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={28} color={cu.red} />
        </View>
        <Text style={{ color: cu.text, fontSize: 20, fontWeight: '800' }}>
          {title}
        </Text>
        <Text
          style={{
            color: cu.muted,
            lineHeight: 20,
            textAlign: 'center',
            paddingHorizontal: 8,
          }}
        >
          {body}
        </Text>
      </View>
      <Pressable
        onPress={onConfirm}
        disabled={busy}
        style={{
          backgroundColor: cu.red,
          borderRadius: 16,
          paddingVertical: 15,
          alignItems: 'center',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
            {confirmLabel}
          </Text>
        )}
      </Pressable>
      <Pressable
        onPress={onCancel}
        disabled={busy}
        style={{
          backgroundColor: cu.card,
          borderRadius: 16,
          paddingVertical: 15,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: cu.line,
        }}
      >
        <Text style={{ color: cu.text, fontWeight: '700', fontSize: 16 }}>
          {cancelLabel}
        </Text>
      </Pressable>
    </FadeIn>
  );
}

export function MenuSheet({
  data,
  visible,
  unlinking,
  signingOut,
  unreadCount,
  onClose,
  onProfile,
  onUpdates,
  onRefresh,
  onPredict,
  onCalendar,
  onDatesheet,
  onIdCard,
  onLegal,
  onUnlink,
  onSignOut,
}: Props) {
  const [confirming, setConfirming] = useState<'unlink' | 'signout' | null>(
    null,
  );
  const { connection } = data;
  const name = connection.studentName ?? 'Student';

  useEffect(() => {
    if (!visible) setConfirming(null);
  }, [visible]);

  const synced = connection.lastSyncedAt
    ? formatWhen(connection.lastSyncedAt)
    : null;
  const syncText = connection.isDemo
    ? 'Demo data, not your real records'
    : synced
    ? synced === 'Just now'
      ? 'Refreshed just now'
      : /^\d+[mhd]$/.test(synced)
      ? `Refreshed ${synced} ago`
      : `Refreshed ${synced}`
    : 'Not refreshed yet';

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.9}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
      >
        {confirming === 'unlink' ? (
          <Confirm
            icon="unlink"
            title={`Unlink ${connection.studentUid}?`}
            body="Rilvona will delete the attendance, timetable, marks, notices and profile it stored for you, and remove your CUIMS password from this phone. You can link again any time."
            confirmLabel="Yes, unlink my account"
            cancelLabel="Keep it linked"
            busy={unlinking}
            onCancel={() => setConfirming(null)}
            onConfirm={onUnlink}
          />
        ) : confirming === 'signout' ? (
          <Confirm
            icon="user"
            title="Sign out of Rilvona?"
            body="You will be signed out on this phone and your saved portal data will be removed from it. Your linked account stays, and your CUIMS login stays in this phone’s keychain for your Rilvona account, so signing in again only needs the captcha."
            confirmLabel="Yes, sign me out"
            cancelLabel="Stay signed in"
            busy={signingOut}
            onCancel={() => setConfirming(null)}
            onConfirm={onSignOut}
          />
        ) : (
          <>
            <FadeIn
              distance={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: cu.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: cu.line,
                padding: 14,
              }}
            >
              <Avatar photo={connection.photo} name={name} size={54} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}
                >
                  {name}
                </Text>
                <Text
                  style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}
                >
                  {connection.studentUid} · Semester {connection.semester}
                </Text>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: connection.isDemo ? cu.orange : cu.green,
                    }}
                  />
                  <Text
                    style={{
                      color: connection.isDemo ? cu.orange : cu.green,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {syncText}
                  </Text>
                </View>
              </View>
            </FadeIn>

            <FadeIn
              delay={40}
              distance={8}
              style={{
                backgroundColor: cu.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: cu.line,
                overflow: 'hidden',
              }}
            >
              <Row
                icon="chart"
                label="Attendance prediction"
                hint="Where your overall % ends up"
                color={cu.green}
                onPress={onPredict}
              />
              <Divider />
              <Row
                icon="doc"
                label="Date sheet"
                hint="Exam dates and timings"
                color={cu.purple}
                onPress={onDatesheet}
              />
              <Divider />
              <Row
                icon="calendar"
                label="Academic calendar"
                hint="Holidays, breaks and exams"
                color={cu.orange}
                onPress={onCalendar}
              />
              <Divider />
              <Row
                icon="idcard"
                label="Virtual ID card"
                hint="Your student ID from CUIMS"
                color={cu.blue}
                onPress={onIdCard}
              />
            </FadeIn>

            <FadeIn
              delay={60}
              distance={8}
              style={{
                backgroundColor: cu.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: cu.line,
                overflow: 'hidden',
              }}
            >
              <Row
                icon="user"
                label="My profile"
                hint="Section, mentor and portal details"
                onPress={onProfile}
              />
              <Divider />
              <Row
                icon="bell"
                label="Updates and notices"
                hint={
                  unreadCount > 0
                    ? `${unreadCount} new since your last refresh`
                    : 'Portal notices and recent changes'
                }
                color={cu.purple}
                badge={unreadCount}
                onPress={onUpdates}
              />
              <Divider />
              <Row
                icon="refresh"
                label="Refresh from CUIMS"
                hint="Pull fresh data with a captcha"
                color={cu.green}
                onPress={onRefresh}
              />
              <Divider />
              <Row
                icon="hive"
                label="Rilvona community"
                hint="Posts and your campus feed"
                color={cu.orange}
                soon
              />
            </FadeIn>

            <FadeIn
              delay={100}
              distance={8}
              style={{
                backgroundColor: cu.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: cu.line,
                overflow: 'hidden',
              }}
            >
              <Row
                icon="doc"
                label="Terms and conditions"
                hint="How Rilvona may be used"
                color={cu.muted}
                onPress={() => onLegal('terms')}
              />
              <Divider />
              <Row
                icon="shield"
                label="Privacy policy"
                hint="What is stored and where it goes"
                color={cu.muted}
                onPress={() => onLegal('privacy')}
              />
            </FadeIn>

            <FadeIn
              delay={120}
              distance={8}
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Icon name="shield" size={18} color={cu.muted} />
              <Text
                style={{
                  color: cu.muted,
                  fontSize: 12,
                  flex: 1,
                  lineHeight: 17,
                }}
              >
                Your password stays in this phone's keychain and is only sent to
                Chandigarh University.
              </Text>
            </FadeIn>

            <FadeIn delay={180} distance={8} style={{ gap: 10 }}>
              <PressScale
                onPress={() => setConfirming('signout')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 15,
                  borderRadius: 18,
                  backgroundColor: cu.card,
                  borderWidth: 1,
                  borderColor: cu.line,
                }}
              >
                <Icon name="user" size={19} color={cu.text} />
                <Text
                  style={{ color: cu.text, fontWeight: '800', fontSize: 15 }}
                >
                  Sign out
                </Text>
              </PressScale>
              <PressScale
                onPress={() => setConfirming('unlink')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  paddingVertical: 15,
                  borderRadius: 18,
                  backgroundColor: `${cu.red}14`,
                  borderWidth: 1,
                  borderColor: `${cu.red}40`,
                }}
              >
                <Icon name="unlink" size={19} color={cu.red} />
                <Text
                  style={{ color: cu.red, fontWeight: '800', fontSize: 15 }}
                >
                  Unlink account
                </Text>
              </PressScale>
            </FadeIn>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
