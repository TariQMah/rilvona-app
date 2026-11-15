import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Text } from '../../components/typography';
import { api, apiData } from '../../api/client';
import type { Me, Page, Post } from '../../api/types';
import { PostCard } from '../../components/PostCard';
import {
  Banner,
  Button,
  EmptyState,
  ErrorState,
  HiveMark,
  LoadingBlock,
  ScreenHeader,
} from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { useRootNav } from '../../navigation/useRootNav';
import { useTheme } from '../../theme/ThemeProvider';

export function HomeScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiData<Me>('/users/me'),
  });
  const feed = useInfiniteQuery({
    queryKey: ['feed'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<Post>>(
        `/feed?limit=15${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const posts = feed.data?.pages.flatMap(page => page.data) ?? [];

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      data={posts}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching}
          onRefresh={() => void feed.refetch()}
          tintColor={colors.accent}
        />
      }
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <ScreenHeader
            title="Home"
            subtitle={me.data?.college?.name ?? 'Your campus feed'}
            right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityLabel="Search"
                  onPress={() => navigation.navigate('Search')}
                >
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>
                    Search
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Notifications"
                  onPress={() => navigation.navigate('Notifications')}
                >
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>
                    Alerts
                  </Text>
                </Pressable>
              </View>
            }
          />
          {me.data && !me.data.emailVerified ? (
            <Banner text="Verify your email before posting or joining events." />
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('Questions')}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.line,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <HiveMark size={32} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '800' }}>
                Ask the hive
              </Text>
              <Text style={{ color: colors.muted }}>
                Anonymous questions stay anonymous.
              </Text>
            </View>
          </Pressable>
        </View>
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
        feed.isLoading ? (
          <LoadingBlock />
        ) : feed.isError ? (
          <ErrorState
            message={errorMessage(feed.error)}
            onRetry={() => feed.refetch()}
          />
        ) : (
          <View style={{ gap: 12 }}>
            <EmptyState
              title="The campus is quiet"
              body="Join a hive or share the first post. The feed stays chronological."
            />
            <Button
              label="Write a post"
              onPress={() => navigation.navigate('CreatePost')}
            />
          </View>
        )
      }
    />
  );
}
