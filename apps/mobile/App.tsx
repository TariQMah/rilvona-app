import NetInfo from '@react-native-community/netinfo';
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { Component, useEffect, useState, type ReactNode } from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { restoreQueryCache, subscribeQueryCache } from './src/api/queryCache';
import { useSession } from './src/api/session';
import { ExitSheet } from './src/components/ExitSheet';
import { SplashScreen } from './src/components/SplashScreen';
import { Text } from './src/components/typography';
import { UpdateGate } from './src/components/UpdateGate';
import { Button } from './src/components/ui';
import { loadCampus } from './src/cuims/campus';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

onlineManager.setEventListener(setOnline => {
  return NetInfo.addEventListener(state => {
    setOnline(Boolean(state.isConnected));
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
      gcTime: 7 * 24 * 60 * 60 * 1000,
    },
  },
});

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '800' }}>
            Rilvona hit a snag
          </Text>
          <Text>{this.state.error.message}</Text>
          <Button
            label="Try again"
            onPress={() => this.setState({ error: null })}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  const { colors, isDark } = useTheme();
  const hydrate = useSession(state => state.hydrate);
  const sessionReady = useSession(state => state.hydrated);
  const userId = useSession(state => state.user?.id ?? null);
  // The portal address depends on the saved campus, so it is read before any screen can talk to the portal.
  const [campusReady, setCampusReady] = useState(false);
  // The last dashboard (and a few other screens) are read from the phone before anything asks the network.
  const [cacheReady, setCacheReady] = useState(false);
  const hydrated = sessionReady && campusReady && cacheReady;
  const [offline, setOffline] = useState(false);
  // The splash stays for at least a moment (so the animation reads), and until the saved sign in has been read.
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 1700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void loadCampus().finally(() => setCampusReady(true));
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    const ready = () => {
      if (!cancelled) setCacheReady(true);
    };
    if (!userId) {
      ready();
      return;
    }
    setCacheReady(false);
    void restoreQueryCache(queryClient, userId)
      .catch(() => 0)
      .finally(() => {
        if (cancelled) return;
        stop = subscribeQueryCache(queryClient, userId);
        ready();
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [sessionReady, userId]);

  useEffect(() => {
    hydrate();
    const unsubscribe = NetInfo.addEventListener(state =>
      setOffline(state.isConnected === false),
    );
    return unsubscribe;
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {offline ? (
        <View
          style={{
            backgroundColor: colors.ink,
            paddingVertical: 8,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: colors.background, textAlign: 'center' }}>
            You are offline. Saved screens stay visible, new requests will
            retry.
          </Text>
        </View>
      ) : null}
      {hydrated ? <RootNavigator /> : null}
      {splashGone ? <UpdateGate /> : null}
      <ExitSheet />
      {splashGone ? null : (
        <SplashScreen
          visible={!(hydrated && minTimePassed)}
          onHidden={() => setSplashGone(true)}
        />
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ErrorBoundary>
          <AppShell />
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
