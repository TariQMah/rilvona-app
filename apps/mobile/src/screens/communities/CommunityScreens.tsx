import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Text, TextInput } from '../../components/typography';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, apiData } from '../../api/client';
import type { Community, CommunityDetail, Page, Post } from '../../api/types';
import { PostCard, ReportModal } from '../../components/PostCard';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  LoadingBlock,
  ScreenHeader,
} from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { useDebounced } from '../../lib/useDebounced';
import { useRootNav } from '../../navigation/useRootNav';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';

const CATEGORIES = ['ALL', 'COLLEGE', 'DEPARTMENT', 'INTEREST'] as const;

export function CommunitiesScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('ALL');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query);
  const list = useInfiniteQuery({
    queryKey: ['communities', category, debouncedQuery],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (category !== 'ALL') params.set('category', category);
      if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
      if (pageParam) params.set('cursor', pageParam);
      return api<Page<Community>>(`/communities?${params.toString()}`);
    },
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const rows = list.data?.pages.flatMap(page => page.data) ?? [];

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      data={rows}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
        />
      }
      onEndReached={() => {
        if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <ScreenHeader
            title="Hives"
            subtitle="College, department, and interest communities"
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search hives"
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.line,
              color: colors.ink,
              paddingHorizontal: 14,
              minHeight: 46,
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(item => (
              <Chip
                key={item}
                label={
                  item === 'ALL' ? 'All' : item[0] + item.slice(1).toLowerCase()
                }
                selected={category === item}
                onPress={() => setCategory(item)}
              />
            ))}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('CommunityDetail', { slug: item.slug })
          }
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.line,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 17 }}>
            {item.name}
          </Text>
          <Text style={{ color: colors.muted }}>{item.description}</Text>
          <Text style={{ color: colors.ink, fontSize: 13 }}>
            {item.memberCount} members ·{' '}
            {item.visibility === 'RESTRICTED' ? 'Restricted' : 'Public'}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        list.isLoading ? (
          <LoadingBlock />
        ) : list.isError ? (
          <ErrorState
            message={errorMessage(list.error)}
            onRetry={() => list.refetch()}
          />
        ) : (
          <EmptyState
            title="No hives yet"
            body="Communities for your college will show up here."
          />
        )
      }
    />
  );
}

export function CommunityDetailScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'CommunityDetail'>) {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const community = useQuery({
    queryKey: ['community', route.params.slug],
    queryFn: () =>
      apiData<CommunityDetail>(`/communities/${route.params.slug}`),
  });
  const posts = useInfiniteQuery({
    queryKey: ['community-posts', route.params.slug],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<Post>>(
        `/communities/${route.params.slug}/posts?limit=15${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const membership = useMutation({
    mutationFn: (action: 'join' | 'leave') =>
      apiData(`/communities/${route.params.slug}/${action}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['community', route.params.slug],
      });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  const detail = community.data;
  const rows = posts.data?.pages.flatMap(page => page.data) ?? [];
  const joined = detail?.membership?.status === 'ACTIVE';

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      data={rows}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={community.isRefetching}
          onRefresh={() => {
            void community.refetch();
            void posts.refetch();
          }}
        />
      }
      ListHeaderComponent={
        community.isLoading ? (
          <LoadingBlock />
        ) : community.isError || !detail ? (
          <ErrorState
            message={errorMessage(community.error)}
            onRetry={() => community.refetch()}
          />
        ) : (
          <View style={{ gap: 10, marginBottom: 8 }}>
            <Text
              style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}
            >
              {detail.name}
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 21 }}>
              {detail.description}
            </Text>
            <Text style={{ color: colors.ink }}>
              {detail.memberCount} members ·{' '}
              {detail.visibility === 'RESTRICTED' ? 'Restricted' : 'Public'}
              {detail.college ? ` · ${detail.college.name}` : ''}
            </Text>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>Rules</Text>
            <Text style={{ color: colors.muted }}>{detail.rules}</Text>
            <Text style={{ color: colors.ink, fontWeight: '700' }}>
              Moderators
            </Text>
            {detail.moderators.map(mod => (
              <Text
                key={mod.username}
                style={{ color: colors.muted }}
                onPress={() =>
                  navigation.navigate('PublicProfile', {
                    username: mod.username,
                  })
                }
              >
                {mod.displayName} @{mod.username}
              </Text>
            ))}
            <Button
              label={
                joined
                  ? 'Leave hive'
                  : detail.membership?.status === 'PENDING'
                  ? 'Request pending'
                  : 'Join hive'
              }
              variant={joined ? 'secondary' : 'primary'}
              onPress={() => membership.mutate(joined ? 'leave' : 'join')}
              loading={membership.isPending}
              disabled={detail.membership?.status === 'PENDING'}
            />
            {joined ? (
              <Button
                label="Post here"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('CreatePost', {
                    communityId: detail.id,
                    communityName: detail.name,
                  })
                }
              />
            ) : null}
            <Text
              onPress={() => setReporting(true)}
              style={{ color: colors.muted, fontWeight: '700' }}
            >
              Report community
            </Text>
            {membership.error ? (
              <Text style={{ color: colors.danger }}>
                {errorMessage(membership.error)}
              </Text>
            ) : null}
            <ReportModal
              visible={reporting}
              onClose={() => setReporting(false)}
              targetType="COMMUNITY"
              targetId={detail.id}
            />
          </View>
        )
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          onAuthor={username =>
            navigation.navigate('PublicProfile', { username })
          }
        />
      )}
      ListEmptyComponent={
        posts.isLoading ? undefined : (
          <EmptyState
            title="No posts in this hive"
            body="Members can start the conversation."
          />
        )
      }
    />
  );
}
