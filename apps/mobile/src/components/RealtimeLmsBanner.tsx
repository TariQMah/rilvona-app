import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Vibration, View } from 'react-native';
import { Text } from './typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, apiData } from '../api/client';
import { useSession } from '../api/session';
import type { AppNotification, Page } from '../api/types';
import { useTheme } from '../theme/ThemeProvider';

export function RealtimeLmsBanner({ onOpenLms }: { onOpenLms: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useSession(state => state.user);
  const seenLatestId = useRef<string | null>(null);
  const registeredUser = useRef<string | null>(null);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  // Register device push token once per authenticated session
  useEffect(() => {
    if (!user || registeredUser.current === user.id) return;
    registeredUser.current = user.id;
    const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    const token = `hiihive-local-${platform.toLowerCase()}-${user.id.slice(
      0,
      12,
    )}`;
    void apiData('/devices', {
      method: 'PUT',
      body: JSON.stringify({ token, platform }),
    }).catch(() => undefined);
  }, [user]);

  const notificationsPoll = useQuery({
    queryKey: ['lms-realtime-watch', user?.id],
    enabled: Boolean(user),
    refetchInterval: 4500,
    queryFn: () => api<Page<AppNotification>>('/notifications?limit=5'),
  });

  useEffect(() => {
    const items = notificationsPoll.data?.data;
    if (!items || items.length === 0) return;
    const latest = items[0];
    if (!latest) return;

    if (seenLatestId.current === null) {
      seenLatestId.current = latest.id;
      return;
    }

    if (latest.id !== seenLatestId.current) {
      seenLatestId.current = latest.id;
      if (latest.type === 'LMS' || !latest.readAt) {
        setActiveToast(latest);
        try {
          Vibration.vibrate(200);
        } catch {
          // Ignore if vibration permission is unavailable
        }
        void queryClient.invalidateQueries({ queryKey: ['academics'] });
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    }
  }, [notificationsPoll.data, queryClient]);

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => setActiveToast(null), 6500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  if (!activeToast) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: Math.max(insets.top + 8, 16),
        left: 12,
        right: 12,
        zIndex: 1000,
        backgroundColor: colors.ink,
        borderRadius: 16,
        padding: 14,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
        gap: 6,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }}>
          {activeToast.type === 'LMS'
            ? 'CUIMS / CU LMS · LIVE PUSH'
            : 'CAMPUS ALERT'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable
            onPress={() => {
              setActiveToast(null);
              onOpenLms();
            }}
          >
            <Text
              style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}
            >
              Open LMS
            </Text>
          </Pressable>
          <Pressable onPress={() => setActiveToast(null)}>
            <Text
              style={{
                color: colors.background,
                opacity: 0.7,
                fontWeight: '700',
                fontSize: 12,
              }}
            >
              Dismiss
            </Text>
          </Pressable>
        </View>
      </View>
      <Text
        style={{ color: colors.background, fontWeight: '800', fontSize: 15 }}
      >
        {activeToast.title}
      </Text>
      <Text
        style={{
          color: colors.background,
          opacity: 0.9,
          fontSize: 13,
          lineHeight: 18,
        }}
        numberOfLines={3}
      >
        {activeToast.body}
      </Text>
    </View>
  );
}
