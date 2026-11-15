import { createEventSchema, createQuestionSchema } from '@hiihive/contracts';
import { useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Text, TextInput } from '../../components/typography';
import { Share } from 'react-native';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, apiData } from '../../api/client';
import type {
  CampusEvent,
  Page,
  QuestionDetail,
  QuestionSummary,
} from '../../api/types';
import { ReportModal } from '../../components/PostCard';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  ScreenHeader,
} from '../../components/ui';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { formatEventWhen, formatWhen, toIsoDateTime } from '../../lib/format';
import { useRootNav } from '../../navigation/useRootNav';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { useSession } from '../../api/session';

export function EventsScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const events = useInfiniteQuery({
    queryKey: ['events'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<CampusEvent>>(
        `/events?limit=20${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const rows = events.data?.pages.flatMap(page => page.data) ?? [];
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      data={rows}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={events.isRefetching}
          onRefresh={() => void events.refetch()}
        />
      }
      onEndReached={() => {
        if (events.hasNextPage && !events.isFetchingNextPage)
          events.fetchNextPage();
      }}
      ListHeaderComponent={
        <ScreenHeader
          title="Events"
          subtitle="College and inter-college gatherings"
        />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('EventDetail', { eventId: item.id })
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
          <Text style={{ color: colors.honey, fontWeight: '700' }}>
            {formatEventWhen(item.startsAt)}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>
            {item.title}
          </Text>
          <Text style={{ color: colors.muted }}>{item.location}</Text>
          <Text style={{ color: colors.ink, fontSize: 13 }}>
            {item.registeredCount}
            {item.capacity ? ` / ${item.capacity}` : ''} going ·{' '}
            {item.scope === 'INTERCOLLEGE' ? 'Inter-college' : 'College'}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        events.isLoading ? (
          <LoadingBlock />
        ) : events.isError ? (
          <ErrorState
            message={errorMessage(events.error)}
            onRetry={() => events.refetch()}
          />
        ) : (
          <EmptyState
            title="No upcoming events"
            body="When a student hosts something, it will land here."
          />
        )
      }
    />
  );
}

export function EventDetailScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'EventDetail'>) {
  const { colors } = useTheme();
  const navigation = useRootNav();
  const queryClient = useQueryClient();
  const user = useSession(state => state.user);
  const [reporting, setReporting] = useState(false);
  const event = useQuery({
    queryKey: ['event', route.params.eventId],
    queryFn: () => apiData<CampusEvent>(`/events/${route.params.eventId}`),
  });
  const registration = useMutation({
    mutationFn: (action: 'register' | 'cancel') =>
      apiData(
        action === 'register'
          ? `/events/${route.params.eventId}/register`
          : `/events/${route.params.eventId}/register`,
        {
          method: action === 'register' ? 'POST' : 'DELETE',
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['event', route.params.eventId],
      }),
  });
  const checkIn = useMutation({
    mutationFn: () =>
      apiData(`/events/${route.params.eventId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['event', route.params.eventId],
      }),
  });
  const cancelEvent = useMutation({
    mutationFn: () =>
      apiData(`/events/${route.params.eventId}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  if (event.isLoading) return <LoadingBlock />;
  if (event.isError || !event.data)
    return (
      <ErrorState
        message={errorMessage(event.error)}
        onRetry={() => event.refetch()}
      />
    );
  const item = event.data;
  const going =
    item.myStatus === 'REGISTERED' ||
    item.myStatus === 'WAITLISTED' ||
    item.myStatus === 'ATTENDED';

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
        flexGrow: 1,
      }}
    >
      <Text style={{ color: colors.honey, fontWeight: '700' }}>
        {formatEventWhen(item.startsAt)} – {formatEventWhen(item.endsAt)}
      </Text>
      <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '800' }}>
        {item.title}
      </Text>
      <Text style={{ color: colors.muted, lineHeight: 22 }}>
        {item.description}
      </Text>
      <Text style={{ color: colors.ink }}>{item.location}</Text>
      <Text style={{ color: colors.ink }}>
        {item.registeredCount}
        {item.capacity ? ` of ${item.capacity}` : ''} registered
        {item.waitlistEnabled ? ' · waitlist on' : ''}
      </Text>
      <Text
        style={{ color: colors.muted }}
        onPress={() =>
          navigation.navigate('PublicProfile', {
            username: item.organizer.username,
          })
        }
      >
        Hosted by {item.organizer.displayName}
      </Text>
      {item.myStatus ? (
        <Text style={{ color: colors.leaf, fontWeight: '700' }}>
          Your status: {item.myStatus}
        </Text>
      ) : null}
      <Button
        label={going ? 'Cancel registration' : 'Register'}
        variant={going ? 'secondary' : 'primary'}
        onPress={() => registration.mutate(going ? 'cancel' : 'register')}
        loading={registration.isPending}
      />
      {item.myStatus === 'REGISTERED' ? (
        <Button
          label="Check in"
          variant="secondary"
          onPress={() => checkIn.mutate()}
          loading={checkIn.isPending}
        />
      ) : null}
      <Button
        label="Share"
        variant="ghost"
        onPress={() =>
          Share.share({ message: item.sharePath }).catch(() => undefined)
        }
      />
      <Text
        onPress={() => setReporting(true)}
        style={{ color: colors.muted, fontWeight: '700' }}
      >
        Report event
      </Text>
      {user?.id === item.organizer.id || user?.role === 'PLATFORM_ADMIN' ? (
        <Button
          label="Cancel event"
          variant="danger"
          onPress={() => cancelEvent.mutate()}
          loading={cancelEvent.isPending}
        />
      ) : null}
      {registration.error || checkIn.error || cancelEvent.error ? (
        <Text style={{ color: colors.danger }}>
          {errorMessage(
            registration.error ?? checkIn.error ?? cancelEvent.error,
          )}
        </Text>
      ) : null}
      <ReportModal
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="EVENT"
        targetId={item.id}
      />
    </ScrollView>
  );
}

export function CreateEventScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'CreateEvent'>) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    title: '',
    description: '',
    location: '',
    startsAt: '',
    endsAt: '',
    capacity: '',
  });
  const [waitlist, setWaitlist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: async () => {
      const startsAt = toIsoDateTime(values.startsAt);
      const endsAt = toIsoDateTime(values.endsAt);
      const parsed = createEventSchema.safeParse({
        title: values.title,
        description: values.description,
        location: values.location,
        startsAt,
        endsAt,
        scope: 'COLLEGE',
        capacity: values.capacity ? Number(values.capacity) : null,
        waitlistEnabled: waitlist,
      });
      if (!parsed.success)
        throw new Error(
          fieldErrors(parsed.error).form ?? parsed.error.issues[0]?.message,
        );
      return apiData<CampusEvent>('/events', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: event => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigation.replace('EventDetail', { eventId: event.id });
    },
    onError: err => setError(errorMessage(err)),
  });

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}>
        New event
      </Text>
      <Field
        label="Title"
        value={values.title}
        onChangeText={title => setValues({ ...values, title })}
        autoCapitalize="sentences"
      />
      <Field
        label="Description"
        value={values.description}
        onChangeText={description => setValues({ ...values, description })}
        multiline
        autoCapitalize="sentences"
      />
      <Field
        label="Location"
        value={values.location}
        onChangeText={location => setValues({ ...values, location })}
        autoCapitalize="sentences"
      />
      <Field
        label="Starts"
        value={values.startsAt}
        onChangeText={startsAt => setValues({ ...values, startsAt })}
        placeholder="2026-10-21 18:00"
      />
      <Field
        label="Ends"
        value={values.endsAt}
        onChangeText={endsAt => setValues({ ...values, endsAt })}
        placeholder="2026-10-21 20:00"
      />
      <Field
        label="Capacity"
        value={values.capacity}
        onChangeText={capacity => setValues({ ...values, capacity })}
        keyboardType="number-pad"
        placeholder="Optional"
      />
      <Button
        label={waitlist ? 'Waitlist on' : 'Turn on waitlist'}
        variant="secondary"
        onPress={() => setWaitlist(value => !value)}
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Publish event"
        onPress={() => create.mutate()}
        loading={create.isPending}
      />
    </ScrollView>
  );
}

export function QuestionsScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const questions = useInfiniteQuery({
    queryKey: ['questions'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api<Page<QuestionSummary>>(
        `/questions?limit=20${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    getNextPageParam: last => last.meta.nextCursor ?? undefined,
  });
  const rows = questions.data?.pages.flatMap(page => page.data) ?? [];
  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
      data={rows}
      keyExtractor={item => item.id}
      refreshControl={
        <RefreshControl
          refreshing={questions.isRefetching}
          onRefresh={() => void questions.refetch()}
        />
      }
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <ScreenHeader
            title="Questions"
            subtitle="Names are hidden from other students"
          />
          <Button
            label="Ask anonymously"
            onPress={() => navigation.navigate('AskQuestion')}
          />
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() =>
            navigation.navigate('QuestionDetail', { questionId: item.id })
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
            {item.title}
          </Text>
          <Text style={{ color: colors.muted }} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {item.pseudonym} · {item.answerCount} answers ·{' '}
            {formatWhen(item.createdAt)}
            {item.askedByMe ? ' · yours' : ''}
            {item.accepted ? ' · answered' : ''}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={
        questions.isLoading ? (
          <LoadingBlock />
        ) : questions.isError ? (
          <ErrorState
            message={errorMessage(questions.error)}
            onRetry={() => questions.refetch()}
          />
        ) : (
          <EmptyState
            title="No questions yet"
            body="Ask something your classmates can answer."
          />
        )
      }
    />
  );
}

export function AskQuestionScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'AskQuestion'>) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ask = useMutation({
    mutationFn: async () => {
      const parsed = createQuestionSchema.safeParse({
        title,
        body,
        communityId: route.params?.communityId,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return apiData<QuestionDetail>('/questions', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: question => {
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      navigation.replace('QuestionDetail', { questionId: question.id });
    },
    onError: err => setError(errorMessage(err)),
  });
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}>
        Ask anonymously
      </Text>
      <Text style={{ color: colors.muted }}>
        Other students see a pseudonym. Platform admins can reveal an identity
        only for a documented safety review.
      </Text>
      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        autoCapitalize="sentences"
      />
      <Field
        label="Details"
        value={body}
        onChangeText={setBody}
        multiline
        autoCapitalize="sentences"
      />
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Post question"
        onPress={() => ask.mutate()}
        loading={ask.isPending}
      />
    </ScrollView>
  );
}

export function QuestionDetailScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'QuestionDetail'>) {
  const { colors } = useTheme();
  const user = useSession(state => state.user);
  const queryClient = useQueryClient();
  const [answer, setAnswer] = useState('');
  const [reason, setReason] = useState('');
  const [identity, setIdentity] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const question = useQuery({
    queryKey: ['question', route.params.questionId],
    queryFn: () =>
      apiData<QuestionDetail>(`/questions/${route.params.questionId}`),
  });
  const reply = useMutation({
    mutationFn: () =>
      apiData(`/questions/${route.params.questionId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ body: answer }),
      }),
    onSuccess: () => {
      setAnswer('');
      queryClient.invalidateQueries({
        queryKey: ['question', route.params.questionId],
      });
    },
  });
  const vote = useMutation({
    mutationFn: ({ id, value }: { id: string; value: 1 | -1 }) =>
      apiData(`/answers/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['question', route.params.questionId],
      }),
  });
  const accept = useMutation({
    mutationFn: (answerId: string) =>
      apiData(`/questions/${route.params.questionId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ answerId }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['question', route.params.questionId],
      }),
  });
  const reveal = useMutation({
    mutationFn: () =>
      apiData<{ username: string | null; email: string }>(
        `/admin/questions/${route.params.questionId}/identity`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        },
      ),
    onSuccess: result =>
      setIdentity(`${result.username ?? 'student'} · ${result.email}`),
  });

  if (question.isLoading) return <LoadingBlock />;
  if (question.isError || !question.data)
    return (
      <ErrorState
        message={errorMessage(question.error)}
        onRetry={() => question.refetch()}
      />
    );
  const item = question.data;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.muted }}>
        {item.pseudonym} · {formatWhen(item.createdAt)}
        {item.askedByMe ? ' · you asked this' : ''}
      </Text>
      <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '800' }}>
        {item.title}
      </Text>
      <Text style={{ color: colors.ink, lineHeight: 22 }}>{item.body}</Text>
      <Text
        onPress={() => setReporting(true)}
        style={{ color: colors.muted, fontWeight: '700' }}
      >
        Report question
      </Text>
      {item.answers.map(row => (
        <View
          key={row.id}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: row.accepted ? colors.leaf : colors.line,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.muted }}>
            {row.pseudonym}
            {row.accepted ? ' · accepted' : ''}
          </Text>
          <Text style={{ color: colors.ink, lineHeight: 21 }}>{row.body}</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Text
              onPress={() => vote.mutate({ id: row.id, value: 1 })}
              style={{ color: colors.ink, fontWeight: '700' }}
            >
              Helpful {row.score}
            </Text>
            <Text
              onPress={() => vote.mutate({ id: row.id, value: -1 })}
              style={{ color: colors.muted, fontWeight: '700' }}
            >
              Not helpful
            </Text>
            {item.askedByMe && !row.accepted ? (
              <Text
                onPress={() => accept.mutate(row.id)}
                style={{ color: colors.accent, fontWeight: '700' }}
              >
                Accept
              </Text>
            ) : null}
          </View>
        </View>
      ))}
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        placeholder="Write an answer"
        placeholderTextColor={colors.muted}
        multiline
        style={{
          minHeight: 90,
          color: colors.ink,
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      />
      {reply.error || vote.error || accept.error ? (
        <Text style={{ color: colors.danger }}>
          {errorMessage(reply.error ?? vote.error ?? accept.error)}
        </Text>
      ) : null}
      <Button
        label="Answer"
        onPress={() => reply.mutate()}
        disabled={!answer.trim()}
        loading={reply.isPending}
      />
      {user?.role === 'PLATFORM_ADMIN' ? (
        <View style={{ gap: 8 }}>
          <Field
            label="Safety review reason"
            value={reason}
            onChangeText={setReason}
            autoCapitalize="sentences"
          />
          <Button
            label="Reveal identity"
            variant="secondary"
            onPress={() => reveal.mutate()}
            loading={reveal.isPending}
          />
          {identity ? (
            <Text style={{ color: colors.warning }}>{identity}</Text>
          ) : null}
          {reveal.error ? (
            <Text style={{ color: colors.danger }}>
              {errorMessage(reveal.error)}
            </Text>
          ) : null}
        </View>
      ) : null}
      <ReportModal
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="QUESTION"
        targetId={item.id}
      />
    </ScrollView>
  );
}
