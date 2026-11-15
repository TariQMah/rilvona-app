import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Text, TextInput } from '../../components/typography';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, apiData } from '../../api/client';
import type { Comment, Page, Post } from '../../api/types';
import { PostCard, ReportModal } from '../../components/PostCard';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  LoadingBlock,
} from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import { useRootNav } from '../../navigation/useRootNav';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'PostDetail'>;

export function PostDetailScreen({ route }: Props) {
  const { colors } = useTheme();
  const navigation = useRootNav();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);
  const post = useQuery({
    queryKey: ['post', route.params.postId],
    queryFn: () => apiData<Post>(`/posts/${route.params.postId}`),
  });
  const comments = useInfiniteQuery({
    queryKey: ['comments', route.params.postId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<Comment>>(
        `/posts/${route.params.postId}/comments?limit=30${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const send = useMutation({
    mutationFn: () =>
      apiData<Comment>(`/posts/${route.params.postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setBody('');
      queryClient.invalidateQueries({
        queryKey: ['comments', route.params.postId],
      });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
  const rows = comments.data?.pages.flatMap(page => page.data) ?? [];

  if (post.isLoading) return <LoadingBlock />;
  if (post.isError || !post.data)
    return (
      <ErrorState
        message={errorMessage(post.error)}
        onRetry={() => post.refetch()}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={rows}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <PostCard
              post={post.data}
              onAuthor={username =>
                navigation.navigate('PublicProfile', { username })
              }
            />
            <Text
              style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}
            >
              Comments
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.line,
              gap: 6,
            }}
          >
            <View
              style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
            >
              <Avatar name={item.author.displayName} size={28} />
              <Text style={{ color: colors.ink, fontWeight: '700', flex: 1 }}>
                {item.author.displayName}
              </Text>
              <Text style={{ color: colors.muted }}>
                {formatWhen(item.createdAt)}
              </Text>
            </View>
            <Text style={{ color: colors.ink, lineHeight: 21 }}>
              {item.body}
            </Text>
            <Text
              onPress={() => setReportId(item.id)}
              style={{ color: colors.muted, fontWeight: '600' }}
            >
              Report
            </Text>
          </View>
        )}
        ListEmptyComponent={
          comments.isError ? (
            <ErrorState message={errorMessage(comments.error)} />
          ) : (
            <EmptyState title="No comments yet" body="Be the first to reply." />
          )
        }
        onEndReached={() => {
          if (comments.hasNextPage && !comments.isFetchingNextPage)
            comments.fetchNextPage();
        }}
      />
      <View
        style={{
          padding: 12,
          gap: 8,
          borderTopWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.surface,
        }}
      >
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write a comment"
          placeholderTextColor={colors.muted}
          style={{ color: colors.ink, minHeight: 44 }}
        />
        {send.error ? (
          <Text style={{ color: colors.danger }}>
            {errorMessage(send.error)}
          </Text>
        ) : null}
        <Button
          label="Reply"
          onPress={() => send.mutate()}
          disabled={!body.trim()}
          loading={send.isPending}
        />
      </View>
      <ReportModal
        visible={Boolean(reportId)}
        onClose={() => setReportId(null)}
        targetType="COMMENT"
        targetId={reportId ?? ''}
      />
    </View>
  );
}
