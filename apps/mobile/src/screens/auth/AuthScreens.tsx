import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';
import { apiData } from '../../api/client';
import { useSession } from '../../api/session';
import type { AuthResult } from '../../api/types';
import { getGoogleIdToken } from '../../auth/google';
import { releaseCredentialsNotOwnedBy } from '../../cuims/credentials';
import { BrandLogo } from '../../components/ui';
import { confirmExit, useBackHandler } from '../../lib/backHandler';
import { errorMessage } from '../../lib/errors';
import type { LegalKind } from '../academics/legal';
import { LegalSheet } from '../academics/LegalSheet';

const WELCOME = {
  bg: '#0f0f10',
  card: '#1b1b1d',
  line: '#2c2c30',
  text: '#f5f5f7',
  muted: '#8d8d93',
  orange: '#f08a3e',
  danger: '#ff7a70',
};

function GoogleMark({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

/** The only way in: agree to the terms and privacy policy, then continue with Google. */
export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const setSession = useSession(state => state.setSession);
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legal, setLegal] = useState<LegalKind | null>(null);

  // The sign in screen is the only screen here, so back would close the app; ask first.
  useBackHandler(() => {
    confirmExit();
    return true;
  });

  const signIn = async () => {
    if (busy) return;
    if (!accepted) {
      setError('Please agree to the Terms and Privacy policy to continue.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      const result = await apiData<AuthResult>('/auth/google', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({
          idToken,
          acceptedTerms: true,
          acceptedPrivacy: true,
        }),
      });
      // Clear first: saving the session opens the dashboard at once, and clearing afterwards would cancel its first
      // request and leave it loading until the app is reopened.
      queryClient.clear();
      await releaseCredentialsNotOwnedBy(result.user.id);
      await setSession({ ...result.tokens, user: result.user });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const link = (label: string, kind: LegalKind) => (
    <Text
      onPress={() => setLegal(kind)}
      style={{ color: WELCOME.orange, fontWeight: '800' }}
    >
      {label}
    </Text>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: WELCOME.bg,
        paddingHorizontal: 22,
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 18,
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <BrandLogo size={170} />
        <Text
          style={{
            color: WELCOME.text,
            fontSize: 40,
            fontWeight: '800',
            letterSpacing: -1,
            marginTop: 10,
          }}
        >
          Rilvona
        </Text>
        <Text
          style={{
            color: WELCOME.muted,
            fontSize: 17,
            lineHeight: 24,
            textAlign: 'center',
          }}
        >
          Your smart companion for university life
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        <View
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
        >
          <Pressable
            onPress={() => {
              setAccepted(value => !value);
              setError(null);
            }}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            accessibilityLabel="Agree to the terms and privacy policy"
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              marginTop: 1,
              borderWidth: 2,
              borderColor: accepted ? WELCOME.orange : WELCOME.muted,
              backgroundColor: accepted ? WELCOME.orange : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {accepted ? (
              <Text
                style={{ color: '#1c120c', fontWeight: '800', fontSize: 14 }}
              >
                ✓
              </Text>
            ) : null}
          </Pressable>
          <Text
            style={{
              color: WELCOME.muted,
              flex: 1,
              lineHeight: 21,
              fontSize: 14,
            }}
          >
            I agree to the {link('Terms and conditions', 'terms')} and the{' '}
            {link('Privacy policy', 'privacy')}.
          </Text>
        </View>

        {error ? (
          <Text
            accessibilityRole="alert"
            style={{ color: WELCOME.danger, fontSize: 14, lineHeight: 20 }}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ busy }}
          onPress={() => void signIn()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            backgroundColor: '#ffffff',
            borderRadius: 18,
            paddingVertical: 16,
            opacity: accepted ? 1 : 0.55,
          }}
        >
          {busy ? <ActivityIndicator color="#1f1f1f" /> : <GoogleMark />}
          <Text style={{ color: '#1f1f1f', fontSize: 16, fontWeight: '800' }}>
            Continue with Google
          </Text>
        </Pressable>
      </View>
      <LegalSheet kind={legal} onClose={() => setLegal(null)} />
    </View>
  );
}
