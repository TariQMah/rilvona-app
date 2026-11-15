import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from '../../../components/typography';
import { cu } from './graphics';

/** What to tell the student after `seconds` of waiting, so a slow load never looks like a frozen app. */
export function loadingMessage(seconds: number): {
  title: string;
  hint: string;
} {
  if (seconds < 4) {
    return {
      title: 'Loading your dashboard',
      hint: 'Getting your attendance, timetable and marks.',
    };
  }
  if (seconds < 10) {
    return {
      title: 'Still working…',
      hint: 'Contacting Rilvona. This usually takes a few seconds.',
    };
  }
  return {
    title: 'Taking longer than usual',
    hint: 'Check your internet connection. We will keep trying and show an error if it does not work out.',
  };
}

/** A spinner with a plain sentence about what is happening, which changes as the wait gets longer. */
export function LoadingNotice() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  const { title, hint } = loadingMessage(seconds);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: cu.card,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <ActivityIndicator color={cu.blue} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: cu.text, fontSize: 15, fontWeight: '800' }}>
          {title}
        </Text>
        <Text style={{ color: cu.muted, fontSize: 13, lineHeight: 18 }}>
          {hint}
        </Text>
      </View>
    </View>
  );
}
