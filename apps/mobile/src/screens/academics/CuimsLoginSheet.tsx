import AsyncStorage from '@react-native-async-storage/async-storage';
import { cuUidSchema, importLmsSchema } from '@hiihive/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  View,
  type TextInputProps,
} from 'react-native';
import { Text, TextInput } from '../../components/typography';
import { apiData } from '../../api/client';
import {
  beginLogin,
  clearPortalSession,
  collectPortalTables,
  CuimsError,
  resumeSession,
  submitLogin,
  type LoginChallenge,
  type PortalPage,
} from '../../cuims/client';
import {
  CAMPUSES,
  getCampus,
  setCampus,
  type CampusId,
} from '../../cuims/campus';
import {
  forgetCuimsCredentials,
  loadCuimsCredentials,
  saveCuimsCredentials,
  type CuimsCredentials,
} from '../../cuims/credentials';
import { errorMessage } from '../../lib/errors';
import { LegalSheet } from './LegalSheet';
import type { LegalKind } from './legal';
import { cu, Icon } from './ui/graphics';
import { BottomSheet, FadeIn, PressScale } from './ui/motion';

type ImportResult = {
  imported: boolean;
  recognized: { attendance: number; timetable: number; marks: number };
  notificationsCreated: number;
};

type InputHandle = ComponentRef<typeof TextInput>;

const CONSENT_KEY = 'hiihive:legal-accepted:v1';

type Phase = 'loading' | 'ready' | 'working' | 'done';

function Input({
  label,
  inputRef,
  ...props
}: TextInputProps & { label: string; inputRef?: Ref<InputHandle> }) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: cu.muted,
          fontSize: 12,
          fontWeight: '800',
          letterSpacing: 0.6,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <TextInput
        ref={inputRef}
        placeholderTextColor={cu.muted}
        autoCorrect={false}
        {...props}
        style={{
          backgroundColor: cu.card,
          borderWidth: 1,
          borderColor: cu.line,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 13,
          color: cu.text,
          fontSize: 16,
          fontWeight: '600',
        }}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={busy}
      style={{
        backgroundColor: cu.blue,
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
          {label}
        </Text>
      )}
    </PressScale>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: cu.text, fontSize: 22, fontWeight: '800' }}>
        {title}
      </Text>
      <Text style={{ color: cu.muted, lineHeight: 20 }}>{subtitle}</Text>
    </View>
  );
}

function Consent({
  accepted,
  onToggle,
  onOpen,
}: {
  accepted: boolean;
  onToggle: () => void;
  onOpen: (kind: LegalKind) => void;
}) {
  const link = (label: string, kind: LegalKind) => (
    <Text
      onPress={() => onOpen(kind)}
      style={{ color: cu.blue, fontWeight: '800' }}
    >
      {label}
    </Text>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel="Accept the terms and privacy policy"
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          marginTop: 1,
          borderWidth: 2,
          borderColor: accepted ? cu.blue : cu.muted,
          backgroundColor: accepted ? cu.blue : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {accepted ? (
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>
            ✓
          </Text>
        ) : null}
      </Pressable>
      <Text style={{ color: cu.muted, flex: 1, lineHeight: 20, fontSize: 13 }}>
        I have read and agree to the {link('Terms and conditions', 'terms')} and
        the {link('Privacy policy', 'privacy')}.
      </Text>
    </View>
  );
}

type BodyProps = {
  onBusy: (busy: boolean) => void;
  onClose: () => void;
};

/** Mounted only while the sheet is open, so every open starts from a clean state. */
function LoginBody({ onBusy, onClose }: BodyProps) {
  const queryClient = useQueryClient();
  const captchaRef = useRef<InputHandle>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [keyboard, setKeyboard] = useState(0);
  const [saved, setSaved] = useState<CuimsCredentials | null>(null);
  const [uid, setUid] = useState('');
  const [campus, setCampusChoice] = useState<CampusId>(() => getCampus().id);
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [challenge, setChallenge] = useState<LoginChallenge | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  // True while a saved portal session is being checked and used, before any captcha is needed.
  const [resuming, setResuming] = useState(true);
  const [expired, setExpired] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const mounted = useRef(true);
  const started = useRef(false);

  // The sheet sits behind the keyboard, so give the content room and keep the button in view.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboard(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(CONSENT_KEY)
      .then(value => {
        if (value && mounted.current) setAccepted(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onBusy(phase === 'working' || resuming);
  }, [phase, resuming, onBusy]);

  const loadChallenge = useCallback(async (forUid: string) => {
    setPhase('working');
    setStatus('Loading captcha…');
    setError(null);
    setCaptcha('');
    try {
      setChallenge(await beginLogin(forUid));
      setPhase('ready');
    } catch (err) {
      setChallenge(null);
      setError(err instanceof CuimsError ? err.message : errorMessage(err));
      setPhase('ready');
    }
  }, []);

  /** Read the portal pages from a signed-in dashboard and save them. */
  const importFrom = useCallback(
    async (page: PortalPage, forUid: string): Promise<ImportResult> => {
      setStatus('Reading your attendance, timetable and marks…');
      const {
        tables,
        report: found,
        attendanceLog,
        profile,
      } = await collectPortalTables(page);
      // Headers and counts only; never cell values.
      found.pages.forEach((entry, index) =>
        console.log(`[cuims-page ${index}]`, JSON.stringify(entry)),
      );
      found.notes.forEach(note => console.log('[cuims-note]', note));
      const parsed = importLmsSchema.safeParse({
        provider: 'CHANDIGARH_UNIVERSITY',
        studentUid: forUid,
        sourceUrl: page.url.split('?')[0],
        tables,
        attendanceLog,
        profile,
      });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? 'Could not read your portal pages',
        );
      setStatus('Saving…');
      return apiData<ImportResult>('/academics/import', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    },
    [],
  );

  /** Close once the dashboard has the fresh numbers, or explain when nothing was recognised. */
  const finish = useCallback(
    async (res: ImportResult) => {
      if (res.imported) {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        void queryClient.invalidateQueries({ queryKey: ['datesheet'] });
        void queryClient.invalidateQueries({ queryKey: ['idcard'] });
        // Wait for the refreshed data so the dashboard never flashes the old numbers.
        setStatus('Opening your dashboard…');
        await queryClient.invalidateQueries({ queryKey: ['academics'] });
        if (mounted.current) {
          setPhase('ready');
          onClose();
        }
        return;
      }
      setResult(res);
      setPhase('done');
    },
    [queryClient, onClose],
  );

  // On open: use the saved portal session if it is still alive, otherwise ask for a captcha.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const stored = await loadCuimsCredentials();
      if (!mounted.current) return;
      setSaved(stored);
      if (!stored) {
        setResuming(false);
        setPhase('ready');
        return;
      }
      setUid(stored.uid);
      setPhase('working');
      setStatus('Checking your saved session…');
      let res: ImportResult | null = null;
      try {
        const page = await resumeSession();
        if (page) res = await importFrom(page, stored.uid);
      } catch (err) {
        console.log(
          '[cuims-note] saved session could not be used:',
          errorMessage(err),
        );
      }
      if (!mounted.current) return;
      if (res?.imported) {
        console.log(
          '[cuims-note] refreshed with the saved session, no captcha',
        );
        await finish(res);
        return;
      }
      setResuming(false);
      setExpired(true);
      void loadChallenge(stored.uid);
    })();
  }, [loadChallenge, importFrom, finish]);

  useEffect(() => {
    if (challenge && phase === 'ready') {
      const id = setTimeout(() => captchaRef.current?.focus(), 350);
      return () => clearTimeout(id);
    }
  }, [challenge, phase]);

  const startFirstTime = () => {
    const parsed = cuUidSchema.safeParse(uid);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter your CU UID');
      return;
    }
    if (password.length < 1) {
      setError('Enter your CUIMS password');
      return;
    }
    if (!accepted) {
      setError('Please accept the Terms and Privacy policy to continue');
      return;
    }
    void AsyncStorage.setItem(CONSENT_KEY, new Date().toISOString()).catch(
      () => undefined,
    );
    setUid(parsed.data);
    void setCampus(campus).then(() => loadChallenge(parsed.data));
  };

  const signIn = async () => {
    if (!challenge) return;
    const pass = saved?.password ?? password;
    if (!captcha.trim()) {
      setError('Enter the captcha shown above');
      return;
    }
    setPhase('working');
    setError(null);
    try {
      setStatus('Signing in…');
      const login = await submitLogin(challenge, pass, captcha);
      if (!login.ok) {
        setError(login.message);
        setChallenge(login.challenge);
        setCaptcha('');
        setPhase('ready');
        return;
      }
      if (!saved) {
        const credentials = { uid: challenge.uid, password: pass };
        await saveCuimsCredentials(credentials);
        setSaved(credentials);
      }
      await finish(await importFrom(login.page, challenge.uid));
    } catch (err) {
      setError(err instanceof CuimsError ? err.message : errorMessage(err));
      setPhase('ready');
    }
  };

  const forget = async () => {
    await forgetCuimsCredentials();
    await clearPortalSession();
    setSaved(null);
    setExpired(false);
    setPassword('');
    setChallenge(null);
    setError(null);
  };

  const working = phase === 'working';
  const showProgress = resuming || phase === 'loading';
  const firstTime = !saved && !challenge;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 28 + keyboard,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {showProgress ? (
          <View style={{ paddingVertical: 56, alignItems: 'center', gap: 14 }}>
            <ActivityIndicator color={cu.blue} />
            <Text style={{ color: cu.muted, fontWeight: '600' }}>
              {status || 'Just a moment…'}
            </Text>
          </View>
        ) : null}

        {!showProgress && phase === 'done' && result ? (
          <FadeIn distance={10} style={{ gap: 14 }}>
            <Header
              title="Signed in, but nothing was recognised"
              subtitle="Your login worked, but no attendance, timetable or marks tables were found in the portal pages. Try refreshing again in a moment."
            />
            <PrimaryButton label="Done" onPress={onClose} />
          </FadeIn>
        ) : null}

        {!showProgress && phase !== 'done' && firstTime ? (
          <FadeIn distance={10} style={{ gap: 16 }}>
            <Header
              title="Connect your university"
              subtitle="Enter your UID and CUIMS password once. After that you only type a captcha each time you refresh."
            />
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: cu.muted,
                  fontSize: 12,
                  fontWeight: '800',
                  letterSpacing: 0.6,
                }}
              >
                YOUR CAMPUS
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {CAMPUSES.map(option => {
                  const on = option.id === campus;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setCampusChoice(option.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={{
                        flex: 1,
                        gap: 2,
                        padding: 12,
                        borderRadius: 16,
                        backgroundColor: on ? `${cu.blue}1f` : cu.cardAlt,
                        borderWidth: 1,
                        borderColor: on ? cu.blue : cu.line,
                      }}
                    >
                      <Text
                        style={{
                          color: on ? cu.blue : cu.text,
                          fontWeight: '800',
                          fontSize: 15,
                        }}
                      >
                        {option.name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: cu.muted, fontSize: 11 }}
                      >
                        {option.place}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input
              label="CU UID"
              value={uid}
              onChangeText={v => setUid(v.toUpperCase())}
              placeholder="For example 23BCS10452"
              autoCapitalize="characters"
            />
            <Input
              label="CUIMS password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Your CUIMS password"
              autoCapitalize="none"
            />
            <View
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
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
                Your password is kept in this phone's keychain and only sent to
                Chandigarh University.
              </Text>
            </View>
            <Consent
              accepted={accepted}
              onToggle={() => {
                setAccepted(v => !v);
                setError(null);
              }}
              onOpen={setLegal}
            />
            {error ? (
              <Text style={{ color: cu.red, fontWeight: '600' }}>{error}</Text>
            ) : null}
            <PrimaryButton
              label="Continue"
              onPress={startFirstTime}
              busy={working}
            />
          </FadeIn>
        ) : null}

        {!showProgress && phase !== 'done' && !firstTime ? (
          <FadeIn distance={10} style={{ gap: 16 }}>
            <Header
              title={saved ? `Refresh ${saved.uid}` : 'Enter the captcha'}
              subtitle={
                saved
                  ? expired
                    ? 'Your last session expired. Type the captcha to sign in again.'
                    : 'Your saved login is ready. Just type the captcha.'
                  : 'Type the characters you see to sign in.'
              }
            />
            {challenge ? (
              <View style={{ gap: 10 }}>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    height: 72,
                    padding: 6,
                  }}
                >
                  <Image
                    source={{ uri: challenge.captchaDataUri }}
                    style={{ flex: 1 }}
                    resizeMode="contain"
                    accessibilityLabel="Captcha"
                  />
                </View>
                <Pressable
                  onPress={() => void loadChallenge(challenge.uid)}
                  disabled={working}
                  hitSlop={8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    alignSelf: 'flex-end',
                  }}
                >
                  <Icon name="refresh" size={15} color={cu.blue} />
                  <Text style={{ color: cu.blue, fontWeight: '800' }}>
                    New captcha
                  </Text>
                </Pressable>
              </View>
            ) : (
              <PrimaryButton
                label="Load captcha"
                onPress={() => void loadChallenge(uid)}
                busy={working}
              />
            )}
            {challenge ? (
              <Input
                label="Captcha"
                inputRef={captchaRef}
                value={captcha}
                onChangeText={setCaptcha}
                placeholder="Type the characters"
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={() => void signIn()}
                editable={!working}
              />
            ) : null}
            {error ? (
              <Text style={{ color: cu.red, fontWeight: '600' }}>{error}</Text>
            ) : null}
            {working ? (
              <View
                style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
              >
                <ActivityIndicator color={cu.blue} />
                <Text style={{ color: cu.muted, flex: 1 }}>{status}</Text>
              </View>
            ) : null}
            {challenge ? (
              <PrimaryButton
                label="Log in and refresh"
                onPress={() => void signIn()}
                busy={working}
              />
            ) : null}
            {saved && !working ? (
              <Pressable onPress={() => void forget()} hitSlop={8}>
                <Text
                  style={{
                    color: cu.muted,
                    textAlign: 'center',
                    fontWeight: '700',
                  }}
                >
                  Use a different account
                </Text>
              </Pressable>
            ) : null}
          </FadeIn>
        ) : null}
      </ScrollView>
      <LegalSheet kind={legal} onClose={() => setLegal(null)} />
    </>
  );
}

/**
 * Captcha and first-time login as a bottom sheet over the dashboard.
 * Closing is blocked while a sign-in or import is running so it cannot be cut off half way.
 */
export function CuimsLoginSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const busy = useRef(false);
  const setBusy = useCallback((value: boolean) => {
    busy.current = value;
  }, []);
  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        if (!busy.current) onClose();
      }}
      heightRatio={0.78}
    >
      <LoginBody onBusy={setBusy} onClose={onClose} />
    </BottomSheet>
  );
}
