import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Text, TextInput } from '../../components/typography';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api, apiData } from '../../api/client';
import type { AppNotification, Page, SearchHit } from '../../api/types';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ScreenHeader,
} from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import { useDebounced } from '../../lib/useDebounced';
import { useRootNav } from '../../navigation/useRootNav';
import { useTheme } from '../../theme/ThemeProvider';

const TYPES = [
  'posts',
  'communities',
  'questions',
  'events',
  'people',
] as const;

export function SearchScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('posts');
  const query = useDebounced(text.trim());
  const results = useInfiniteQuery({
    queryKey: ['search', type, query],
    enabled: query.length >= 2,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ q: query, type, limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      return api<Page<SearchHit>>(`/search?${params.toString()}`, { signal });
    },
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const rows = results.data?.pages.flatMap(page => page.data) ?? [];

  const open = (item: SearchHit) => {
    if (type === 'posts')
      navigation.navigate('PostDetail', { postId: item.id });
    if (type === 'communities' && item.slug)
      navigation.navigate('CommunityDetail', { slug: item.slug });
    if (type === 'questions')
      navigation.navigate('QuestionDetail', { questionId: item.id });
    if (type === 'events')
      navigation.navigate('EventDetail', { eventId: item.id });
    if (type === 'people' && item.username)
      navigation.navigate('PublicProfile', { username: item.username });
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      data={rows}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <ScreenHeader
            title="Search"
            subtitle="Posts, hives, questions, events, people"
          />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search campus"
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.surface,
              color: colors.ink,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.line,
              minHeight: 48,
              paddingHorizontal: 14,
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TYPES.map(item => (
              <Chip
                key={item}
                label={item}
                selected={type === item}
                onPress={() => setType(item)}
              />
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => open(item)}
          style={{
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '700' }}>
            {item.title || item.name || item.displayName || item.body}
          </Text>
          <Text style={{ color: colors.muted }} numberOfLines={2}>
            {item.username
              ? `@${item.username}`
              : item.location || item.pseudonym || item.description || ''}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        query.length < 2 ? (
          <EmptyState
            title="Search the campus"
            body="Type at least two characters. Private hives and blocked students stay hidden."
          />
        ) : results.isLoading ? (
          <LoadingBlock />
        ) : results.isError ? (
          <ErrorState
            message={errorMessage(results.error)}
            onRetry={() => results.refetch()}
          />
        ) : (
          <EmptyState
            title="No matches"
            body="Try another word or a different category."
          />
        )
      }
    />
  );
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const list = useInfiniteQuery({
    queryKey: ['notifications'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<AppNotification>>(
        `/notifications?limit=30${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const read = useMutation({
    mutationFn: (id: string) =>
      apiData(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAll = useMutation({
    mutationFn: () => apiData('/notifications/read-all', { method: 'POST' }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const rows = list.data?.pages.flatMap(page => page.data) ?? [];

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      data={rows}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <View style={{ gap: 8 }}>
          <ScreenHeader title="Alerts" />
          <Button
            label="Mark all read"
            variant="secondary"
            onPress={() => readAll.mutate()}
          />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => read.mutate(item.id)}
          style={{
            backgroundColor: item.readAt ? colors.surface : colors.surfaceMuted,
            borderRadius: 14,
            padding: 12,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '800' }}>
            {item.title}
          </Text>
          <Text style={{ color: colors.muted }}>{item.body}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {item.type} · {formatWhen(item.createdAt)}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        list.isLoading ? (
          <LoadingBlock />
        ) : list.isError ? (
          <ErrorState message={errorMessage(list.error)} />
        ) : (
          <EmptyState
            title="You are caught up"
            body="Replies, events, and moderation updates land here."
          />
        )
      }
    />
  );
}
