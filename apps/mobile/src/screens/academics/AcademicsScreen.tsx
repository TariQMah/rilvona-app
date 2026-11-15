import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiData } from '../../api/client';
import { clearPortalSession } from '../../cuims/client';
import { clearCachedDatesheet } from '../../cuims/datesheetClient';
import { clearCachedIdCard } from '../../cuims/idCardClient';
import { forgetCuimsCredentials } from '../../cuims/credentials';
import { confirmExit } from '../../lib/backHandler';
import { useFocusedBackHandler } from '../../lib/useFocusedBackHandler';
import type {
  AcademicsOverview,
  LmsPortalAlertItem,
  PortalNotice,
} from '../../api/types';
import { useSession } from '../../api/session';
import { errorMessage } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import { CalendarPage } from './CalendarPage';
import { DatesheetPage } from './DatesheetPage';
import { IdCardPopup } from './IdCardPopup';
import { HomeTab } from './HomeTab';
import { LegalSheet } from './LegalSheet';
import type { LegalKind } from './legal';
import { SubjectsPage } from './SubjectsPage';
import { PredictionPage } from './PredictionPage';
import { CuimsLoginSheet } from './CuimsLoginSheet';
import { MenuSheet } from './MenuSheet';
import { NoticeRow, ProfileSheet } from './ProfileSheet';
import { AiChatTab } from './AiChatTab';
import { MarksTab } from './MarksTab';
import { ResultTab } from './ResultTab';
import { TimetableTab } from './TimetableTab';
import { usePortalSession } from './usePortalSession';
import { firstName, greeting, type ConnectedOverview } from './model';
import { cu, Icon, type IconName } from './ui/graphics';
import { LoadingNotice } from './ui/LoadingNotice';
import { FadeIn, Skeleton } from './ui/motion';
import { Avatar, EmptyPanel, Pill, Surface } from './ui/parts';

type TabKey = 'marks' | 'home' | 'timetable' | 'result' | 'ai';
type PageKey = 'predict' | 'calendar' | 'datesheet' | 'subjects';

const TABS: { key: Exclude<TabKey, 'ai'>; label: string; icon: IconName }[] = [
  { key: 'marks', label: 'Marks', icon: 'marks' },
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'timetable', label: 'TimeTable', icon: 'calendar' },
  { key: 'result', label: 'Result', icon: 'chart' },
];

const categoryColor: Record<LmsPortalAlertItem['category'], string> = {
  ATTENDANCE: cu.green,
  TIMETABLE: cu.blue,
  MARKS: cu.purple,
  ASSIGNMENT: cu.orange,
  ANNOUNCEMENT: cu.blue,
  EXAM: cu.red,
};

function IconButton({
  icon,
  onPress,
  dot,
  bare,
}: {
  icon: IconName;
  onPress: () => void;
  dot?: boolean;
  /** No circle behind the icon: used in the dashboard header. */
  bare?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        width: bare ? 30 : 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: bare ? 'transparent' : cu.card,
        borderWidth: bare ? 0 : 1,
        borderColor: cu.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} size={20} />
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: bare ? 5 : 10,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: cu.red,
          }}
        />
      ) : null}
    </Pressable>
  );
}

function BarItem({
  tab,
  on,
  onPress,
}: {
  tab: (typeof TABS)[number];
  on: boolean;
  onPress: () => void;
}) {
  const progress = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: on ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [on, progress]);
  return (
    <Animated.View
      style={{
        height: 48,
        flexGrow: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.2],
        }),
        flexBasis: 0,
      }}
    >
      <Pressable onPress={onPress}>
        <Animated.View
          style={{
            height: 48,
            borderRadius: 24,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            overflow: 'hidden',
            backgroundColor: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(59,155,232,0)', 'rgba(59,155,232,0.18)'],
            }),
          }}
        >
          <Icon name={tab.icon} size={22} color={on ? cu.blue : cu.muted} />
          <Animated.Text
            numberOfLines={1}
            style={{
              color: cu.blue,
              fontWeight: '800',
              fontSize: 13,
              maxWidth: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 90],
              }),
              opacity: progress,
            }}
          >
            {tab.label}
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** The AI button: round, purple and set apart from the tab bar, at its right. */
function AiButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Rilvona AI"
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: on ? cu.purple : cu.card,
        borderWidth: 1,
        borderColor: on ? cu.purple : `${cu.purple}55`,
      }}
    >
      <Icon name="sparkle" size={26} color={on ? '#fff' : cu.purple} />
    </Pressable>
  );
}

function BottomBar({
  active,
  onChange,
  bottomInset,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
  bottomInset: number;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingTop: 8,
        paddingBottom: Math.max(bottomInset, 10),
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          backgroundColor: cu.card,
          borderRadius: 30,
          padding: 6,
          borderWidth: 1,
          borderColor: cu.line,
          gap: 4,
        }}
      >
        {TABS.map(tab => (
          <BarItem
            key={tab.key}
            tab={tab}
            on={tab.key === active}
            onPress={() => onChange(tab.key)}
          />
        ))}
      </View>
      <AiButton on={active === 'ai'} onPress={() => onChange('ai')} />
    </View>
  );
}

type UpdatesTab = 'changes' | 'notices';

function Segment({
  label,
  count,
  on,
  onPress,
}: {
  label: string;
  count: number;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: on ? `${cu.blue}26` : 'transparent',
      }}
    >
      <Text style={{ color: on ? cu.blue : cu.muted, fontWeight: '800' }}>
        {label}
      </Text>
      <Text
        style={{
          color: on ? cu.blue : cu.muted,
          fontWeight: '800',
          opacity: 0.7,
        }}
      >
        {count}
      </Text>
    </Pressable>
  );
}

function UpdatesView({
  alerts,
  notices,
  initialTab,
  onClose,
}: {
  alerts: LmsPortalAlertItem[];
  notices: PortalNotice[];
  initialTab: UpdatesTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<UpdatesTab>(initialTab);
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
        }}
      >
        <Text style={{ color: cu.text, fontSize: 30, fontWeight: '800' }}>
          Updates
        </Text>
        <IconButton icon="close" onPress={onClose} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          marginBottom: 12,
          padding: 4,
          borderRadius: 18,
          backgroundColor: cu.card,
          borderWidth: 1,
          borderColor: cu.line,
        }}
      >
        <Segment
          label="Portal notices"
          count={notices.length}
          on={tab === 'notices'}
          onPress={() => setTab('notices')}
        />
        <Segment
          label="Changes"
          count={alerts.length}
          on={tab === 'changes'}
          onPress={() => setTab('changes')}
        />
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 12 }}
      >
        {tab === 'notices' ? (
          notices.length === 0 ? (
            <EmptyPanel
              icon="bell"
              title="No portal notices"
              body="Important messages, announcements and notifications from your university portal appear here after a refresh."
            />
          ) : (
            notices.map((notice, index) => (
              <Surface key={`${notice.title}-${index}`}>
                <NoticeRow notice={notice} expanded />
              </Surface>
            ))
          )
        ) : alerts.length === 0 ? (
          <EmptyPanel
            icon="bell"
            title="No updates yet"
            body="You will see changes to attendance, timetable and marks here as soon as they are detected."
          />
        ) : (
          alerts.map(alert => (
            <Surface key={alert.id} style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Pill
                  label={alert.category}
                  color={categoryColor[alert.category]}
                />
                <Text style={{ color: cu.muted, fontSize: 12 }}>
                  {formatWhen(alert.publishedAt)}
                </Text>
              </View>
              <Text style={{ color: cu.text, fontWeight: '800', fontSize: 16 }}>
                {alert.title}
              </Text>
              <Text style={{ color: cu.muted, lineHeight: 20 }}>
                {alert.body}
              </Text>
            </Surface>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// Declarative, so it wins over the app-level bar (which follows the system theme and re-applies itself on re-render).
// This screen is always dark, so the system icons must stay light.
function AcademicsStatusBar() {
  const focused = useIsFocused();
  return focused ? <StatusBar barStyle="light-content" /> : null;
}

export function AcademicsScreen() {
  return (
    <>
      <AcademicsStatusBar />
      <AcademicsContent />
    </>
  );
}

function AcademicsContent() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const sessionUser = useSession(state => state.user);
  const [tab, setTab] = useState<TabKey>('home');
  const [showUpdates, setShowUpdates] = useState(false);
  const [updatesTab, setUpdatesTab] = useState<UpdatesTab>('changes');
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [page, setPage] = useState<PageKey | null>(null);
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Back (button or swipe) steps out one level at a time: an opened page, the updates list, another tab, and only
  // from the dashboard itself does it ask whether to leave the app. Sheets and popups close themselves.
  useFocusedBackHandler(() => {
    if (page) {
      setPage(null);
    } else if (showUpdates) {
      setShowUpdates(false);
    } else if (tab !== 'home') {
      setTab('home');
    } else {
      confirmExit();
    }
    return true;
  });

  const overview = useQuery({
    queryKey: ['academics'],
    queryFn: () => apiData<AcademicsOverview>('/academics/overview'),
    staleTime: 60 * 1000,
    networkMode: 'offlineFirst',
  });

  // The dashboard shows what the server saved, so it cannot tell by itself that the university session has lapsed.
  // Ask the portal, and open the captcha sheet once per launch when it has.
  const portalLinked =
    !!overview.data?.connected && !overview.data.connection.isDemo;
  const portal = usePortalSession(portalLinked, loginOpen);
  const autoPrompted = useRef(false);
  useEffect(() => {
    if (portal.expired && !autoPrompted.current) {
      autoPrompted.current = true;
      setLoginOpen(true);
    }
  }, [portal.expired]);

  const demoMutation = useMutation({
    mutationFn: () =>
      apiData<AcademicsOverview>('/academics/demo', { method: 'POST' }),
    onSuccess: data => queryClient.setQueryData(['academics'], data),
    onError: err => setFormError(errorMessage(err)),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiData('/academics/connect', { method: 'DELETE' });
      // The password only ever lived on this phone, so it goes with the link.
      await forgetCuimsCredentials();
      await clearPortalSession();
      await clearCachedDatesheet();
      await clearCachedIdCard();
    },
    onSuccess: () => {
      setMenuOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['academics'] });
    },
  });

  // Signing out takes the portal session and saved date sheet off this phone; the linked account stays on the server,
  // so signing in again brings it back.
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const refreshToken = useSession.getState().refreshToken;
      if (refreshToken) {
        await apiData('/auth/logout', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({ refreshToken }),
        }).catch(() => undefined);
      }
      // The saved university login stays on the phone for this Rilvona account, so signing back in only needs the
      // captcha. The portal session and the saved date sheet are removed.
      await clearPortalSession().catch(() => undefined);
      await clearCachedDatesheet();
      await clearCachedIdCard();
      queryClient.clear();
      await useSession.getState().clear();
    },
  });

  const openCuimsLogin = () => setLoginOpen(true);
  const loginSheet = (
    <CuimsLoginSheet visible={loginOpen} onClose={() => setLoginOpen(false)} />
  );
  const legalSheet = <LegalSheet kind={legal} onClose={() => setLegal(null)} />;
  const frame = {
    flex: 1,
    backgroundColor: cu.bg,
    paddingTop: insets.top,
  } as const;

  if (!overview.data && overview.isLoading) {
    return (
      <View style={[frame, { padding: 16, gap: 14 }]}>
        <Skeleton height={46} radius={23} style={{ width: 200 }} />
        <LoadingNotice />
        <Skeleton height={190} />
        <Skeleton height={100} />
        <Skeleton height={100} />
      </View>
    );
  }

  if (!overview.data) {
    return (
      <View style={[frame, { padding: 24, justifyContent: 'center', gap: 14 }]}>
        <Text style={{ color: cu.text, fontSize: 20, fontWeight: '800' }}>
          Could not load
        </Text>
        <Text style={{ color: cu.muted }}>{errorMessage(overview.error)}</Text>
        <Pressable
          onPress={() => void overview.refetch()}
          style={{
            backgroundColor: cu.blue,
            padding: 14,
            borderRadius: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '800' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!overview.data.connected) {
    return (
      <View style={frame}>
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 16,
            flexGrow: 1,
            justifyContent: 'center',
          }}
        >
          <EmptyPanel
            icon="marks"
            title="Connect your university"
            body="Sign in to Chandigarh University once. After that, each refresh only needs the captcha, and your attendance, timetable and marks show right here."
          />
          <Surface style={{ gap: 6 }}>
            <Text style={{ color: cu.text, fontWeight: '800' }}>
              Your password stays on this phone
            </Text>
            <Text style={{ color: cu.muted, lineHeight: 20 }}>
              It is kept in the secure keychain and is only ever sent to
              Chandigarh University. Rilvona never sees it.
            </Text>
          </Surface>
          <Text
            style={{
              color: cu.muted,
              fontSize: 12,
              lineHeight: 18,
              textAlign: 'center',
            }}
          >
            By connecting you agree to the{' '}
            <Text
              onPress={() => setLegal('terms')}
              style={{ color: cu.blue, fontWeight: '800' }}
            >
              Terms
            </Text>{' '}
            and{' '}
            <Text
              onPress={() => setLegal('privacy')}
              style={{ color: cu.blue, fontWeight: '800' }}
            >
              Privacy policy
            </Text>
            .
          </Text>
          <Pressable
            onPress={openCuimsLogin}
            style={{
              backgroundColor: cu.blue,
              padding: 16,
              borderRadius: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
              Connect Chandigarh University
            </Text>
          </Pressable>
          {formError ? (
            <Text style={{ color: cu.red, fontWeight: '600' }}>
              {formError}
            </Text>
          ) : null}
          {overview.data.demoAvailable ? (
            <Pressable
              onPress={() => demoMutation.mutate()}
              disabled={demoMutation.isPending}
              style={{
                padding: 14,
                borderRadius: 16,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: cu.line,
                backgroundColor: cu.card,
              }}
            >
              <Text style={{ color: cu.orange, fontWeight: '800' }}>
                {demoMutation.isPending
                  ? 'Loading…'
                  : 'Preview with DEMO data (not real)'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() =>
              Alert.alert(
                'Sign out of Rilvona?',
                'You can sign in again any time.',
                [
                  { text: 'Stay signed in', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => signOutMutation.mutate(),
                  },
                ],
              )
            }
            disabled={signOutMutation.isPending}
            style={{ alignItems: 'center', padding: 10 }}
          >
            <Text style={{ color: cu.muted, fontWeight: '700' }}>
              {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </ScrollView>
        {loginSheet}
        {legalSheet}
      </View>
    );
  }

  const data: ConnectedOverview = overview.data;
  const name = firstName(
    data.connection.studentName ?? sessionUser?.displayName,
  );
  const refreshing = overview.isRefetching;
  const onRefresh = () => void overview.refetch();

  const openUpdates = () => {
    setUpdatesTab(
      data.alerts.length === 0 && data.notices.length > 0
        ? 'notices'
        : 'changes',
    );
    setShowUpdates(true);
  };

  return (
    <View style={frame}>
      {portal.expired && !loginOpen ? (
        <Pressable
          accessibilityRole="button"
          onPress={openCuimsLogin}
          style={{
            backgroundColor: `${cu.orange}26`,
            paddingVertical: 10,
            paddingHorizontal: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text
            style={{
              color: cu.orange,
              fontWeight: '800',
              fontSize: 12,
              flex: 1,
            }}
          >
            YOUR UNIVERSITY SESSION EXPIRED · numbers may be out of date
          </Text>
          <Text style={{ color: cu.orange, fontWeight: '800', fontSize: 12 }}>
            Sign in ›
          </Text>
        </Pressable>
      ) : null}
      {data.connection.isDemo ? (
        <Pressable
          onPress={openCuimsLogin}
          style={{
            backgroundColor: `${cu.orange}26`,
            paddingVertical: 8,
            paddingHorizontal: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: cu.orange, fontWeight: '800', fontSize: 12 }}>
            DEMO DATA · invented sample values
          </Text>
          <Text style={{ color: cu.orange, fontWeight: '800', fontSize: 12 }}>
            Use my real data ›
          </Text>
        </Pressable>
      ) : null}

      {page === 'predict' ? (
        <PredictionPage
          data={data}
          onClose={() => setPage(null)}
          onOpenCalendar={() => setPage('calendar')}
        />
      ) : page === 'datesheet' ? (
        <DatesheetPage
          onClose={() => setPage(null)}
          onRefresh={openCuimsLogin}
        />
      ) : page === 'calendar' ? (
        <CalendarPage data={data} onClose={() => setPage(null)} />
      ) : page === 'subjects' ? (
        <SubjectsPage data={data} onClose={() => setPage(null)} />
      ) : showUpdates ? (
        <UpdatesView
          alerts={data.alerts}
          notices={data.notices}
          initialTab={updatesTab}
          onClose={() => setShowUpdates(false)}
        />
      ) : (
        <>
          {tab === 'home' ? (
            <FadeIn
              distance={-8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingTop: 14,
              }}
            >
              <Pressable onPress={() => setProfileOpen(true)} hitSlop={6}>
                <Avatar photo={data.connection.photo} name={name} size={54} />
              </Pressable>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => setProfileOpen(true)}
              >
                <Text
                  style={{ color: cu.muted, fontSize: 13, fontWeight: '600' }}
                >
                  {greeting()}
                </Text>
                <Text
                  style={{ color: cu.text, fontSize: 24, fontWeight: '800' }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {data.connection.section ? (
                  <Text
                    style={{ color: cu.muted, fontSize: 13, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    Section: {data.connection.section}
                  </Text>
                ) : null}
              </Pressable>
              <IconButton
                bare
                icon="bell"
                onPress={openUpdates}
                dot={data.summary.alertCount > 0}
              />
              <IconButton bare icon="refresh" onPress={openCuimsLogin} />
              <IconButton bare icon="menu" onPress={() => setMenuOpen(true)} />
            </FadeIn>
          ) : null}
          <FadeIn key={tab} distance={10} style={{ flex: 1 }}>
            {tab === 'home' ? (
              <HomeTab
                data={data}
                refreshing={refreshing}
                onRefresh={onRefresh}
                onOpenPrediction={() => setPage('predict')}
                onOpenCalendar={() => setPage('calendar')}
                onOpenSubjects={() => setPage('subjects')}
                onOpenDatesheet={() => setPage('datesheet')}
                onOpenIdCard={() => setIdCardOpen(true)}
                onOpenUpdates={openUpdates}
                onOpenProfile={() => setProfileOpen(true)}
                onRefreshPortal={openCuimsLogin}
              />
            ) : null}
            {tab === 'timetable' ? (
              <TimetableTab
                data={data}
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            ) : null}
            {tab === 'marks' ? (
              <MarksTab
                data={data}
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            ) : null}
            {tab === 'result' ? (
              <ResultTab refreshing={refreshing} onRefresh={onRefresh} />
            ) : null}
            {tab === 'ai' ? (
              <AiChatTab data={data} onBack={() => setTab('home')} />
            ) : null}
          </FadeIn>
          {tab === 'ai' ? null : (
            <BottomBar
              active={tab}
              onChange={setTab}
              bottomInset={insets.bottom}
            />
          )}
        </>
      )}
      {loginSheet}
      {legalSheet}
      <MenuSheet
        data={data}
        visible={menuOpen}
        unlinking={disconnectMutation.isPending}
        signingOut={signOutMutation.isPending}
        unreadCount={data.summary.alertCount}
        onClose={() => setMenuOpen(false)}
        onProfile={() => {
          setMenuOpen(false);
          setProfileOpen(true);
        }}
        onUpdates={() => {
          setMenuOpen(false);
          openUpdates();
        }}
        onRefresh={() => {
          setMenuOpen(false);
          openCuimsLogin();
        }}
        onPredict={() => {
          setMenuOpen(false);
          setPage('predict');
        }}
        onDatesheet={() => {
          setMenuOpen(false);
          setPage('datesheet');
        }}
        onIdCard={() => {
          setMenuOpen(false);
          setIdCardOpen(true);
        }}
        onCalendar={() => {
          setMenuOpen(false);
          setPage('calendar');
        }}
        onLegal={kind => {
          setLegal(kind);
        }}
        onUnlink={() => disconnectMutation.mutate()}
        onSignOut={() => signOutMutation.mutate()}
      />
      <ProfileSheet
        data={data}
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
      <IdCardPopup
        visible={idCardOpen}
        onClose={() => setIdCardOpen(false)}
        onRefresh={openCuimsLogin}
      />
    </View>
  );
}
