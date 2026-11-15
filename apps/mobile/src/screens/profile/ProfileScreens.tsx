import {
  notificationPrefsSchema,
  updateProfileSchema,
} from '@hiihive/contracts';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api, apiData } from '../../api/client';
import { useSession } from '../../api/session';
import type { College, Me, Page, Post, PublicProfile } from '../../api/types';
import { PostCard } from '../../components/PostCard';
import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  ScreenHeader,
} from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { splitTags } from '../../lib/format';
import { useRootNav } from '../../navigation/useRootNav';
import type { RootStackParamList } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';

export function ProfileScreen() {
  const navigation = useRootNav();
  const { colors, mode, setMode } = useTheme();
  const clear = useSession(state => state.clear);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiData<Me>('/users/me'),
  });
  const logout = useMutation({
    mutationFn: async () => {
      const refreshToken = useSession.getState().refreshToken;
      if (refreshToken)
        await apiData('/auth/logout', {
          method: 'POST',
          auth: false,
          body: JSON.stringify({ refreshToken }),
        });
      await clear();
    },
  });

  if (me.isLoading) return <LoadingBlock />;
  if (me.isError || !me.data?.profile)
    return (
      <ErrorState
        message={errorMessage(me.error)}
        onRetry={() => me.refetch()}
      />
    );
  const profile = me.data.profile;
  const links: [string, () => void][] = [
    [
      'CUIMS & LMS (Attendance, Timetable, Marks)',
      () => navigation.navigate('Academics'),
    ],
    ['Edit profile', () => navigation.navigate('EditProfile')],
    ['College verification', () => navigation.navigate('Verification')],
    ['Saved posts', () => navigation.navigate('Bookmarks')],
    ['Blocked students', () => navigation.navigate('Blocks')],
    ['Questions', () => navigation.navigate('Questions')],
    ['Settings', () => navigation.navigate('Settings')],
  ];
  if (me.data.role === 'PLATFORM_ADMIN' || me.data.role === 'COLLEGE_ADMIN') {
    links.push(['Moderation', () => navigation.navigate('Moderation')]);
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 14,
        backgroundColor: colors.background,
        flexGrow: 1,
      }}
    >
      <ScreenHeader title="You" subtitle={`@${profile.username}`} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Avatar name={profile.displayName} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>
            {profile.displayName}
          </Text>
          <Text style={{ color: colors.muted }}>
            {me.data.college?.name ?? 'No college selected'}
          </Text>
          <Text style={{ color: colors.leaf }}>
            {me.data.verificationStatus}
          </Text>
        </View>
      </View>
      {profile.bio ? (
        <Text style={{ color: colors.ink, lineHeight: 21 }}>{profile.bio}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {profile.interests.map(interest => (
          <Chip key={interest} label={interest} />
        ))}
      </View>
      {links.map(([label, onPress]) => (
        <Pressable
          key={label}
          onPress={onPress}
          style={{
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '700' }}>
            {label}
          </Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['system', 'light', 'dark'] as const).map(item => (
          <Chip
            key={item}
            label={item}
            selected={mode === item}
            onPress={() => setMode(item)}
          />
        ))}
      </View>
      <Button
        label="Log out"
        variant="secondary"
        onPress={() => logout.mutate()}
        loading={logout.isPending}
      />
    </ScrollView>
  );
}

export function EditProfileScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiData<Me>('/users/me'),
  });
  const profile = me.data?.profile;
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [course, setCourse] = useState(profile?.course ?? '');
  const [year, setYear] = useState(
    profile?.graduationYear ? String(profile.graduationYear) : '',
  );
  const [interests, setInterests] = useState(
    profile?.interests.join(', ') ?? '',
  );
  const [skills, setSkills] = useState(profile?.skills.join(', ') ?? '');
  const [visibility, setVisibility] = useState<
    'PUBLIC' | 'COLLEGE' | 'PRIVATE'
  >(profile?.profileVisibility ?? 'PUBLIC');
  const [ready, setReady] = useState(Boolean(profile));
  if (profile && !ready) {
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? '');
    setCourse(profile.course ?? '');
    setYear(profile.graduationYear ? String(profile.graduationYear) : '');
    setInterests(profile.interests.join(', '));
    setSkills(profile.skills.join(', '));
    setVisibility(profile.profileVisibility);
    setReady(true);
  }
  const save = useMutation({
    mutationFn: async () => {
      const parsed = updateProfileSchema.safeParse({
        displayName,
        bio: bio || null,
        course: course || null,
        graduationYear: year ? Number(year) : null,
        interests: splitTags(interests),
        skills: splitTags(skills),
        profileVisibility: visibility,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return apiData<Me>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  if (me.isLoading) return <LoadingBlock />;
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <Field
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
      />
      <Field
        label="Bio"
        value={bio}
        onChangeText={setBio}
        multiline
        autoCapitalize="sentences"
      />
      <Field
        label="Course"
        value={course}
        onChangeText={setCourse}
        autoCapitalize="words"
      />
      <Field
        label="Graduation year"
        value={year}
        onChangeText={setYear}
        keyboardType="number-pad"
      />
      <Field
        label="Interests"
        value={interests}
        onChangeText={setInterests}
        placeholder="music, football, design"
      />
      <Field
        label="Skills"
        value={skills}
        onChangeText={setSkills}
        placeholder="python, writing"
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['PUBLIC', 'COLLEGE', 'PRIVATE'] as const).map(item => (
          <Chip
            key={item}
            label={item}
            selected={visibility === item}
            onPress={() => setVisibility(item)}
          />
        ))}
      </View>
      {save.isSuccess ? (
        <Text style={{ color: colors.leaf }}>Profile saved.</Text>
      ) : null}
      {save.error ? (
        <Text style={{ color: colors.danger }}>{errorMessage(save.error)}</Text>
      ) : null}
      <Button
        label="Save profile"
        onPress={() => save.mutate()}
        loading={save.isPending}
      />
    </ScrollView>
  );
}

export function PublicProfileScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'PublicProfile'>) {
  const { colors } = useTheme();
  const profile = useQuery({
    queryKey: ['profile', route.params.username],
    queryFn: () => apiData<PublicProfile>(`/users/${route.params.username}`),
  });
  const block = useMutation({
    mutationFn: () =>
      apiData(`/users/${route.params.username}/block`, { method: 'POST' }),
  });
  if (profile.isLoading) return <LoadingBlock />;
  if (profile.isError || !profile.data)
    return <ErrorState message={errorMessage(profile.error)} />;
  const person = profile.data;
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <Avatar name={person.displayName} size={72} />
      <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}>
        {person.displayName}
      </Text>
      <Text style={{ color: colors.muted }}>@{person.username}</Text>
      <Text style={{ color: colors.ink }}>
        {person.college?.name ?? 'College not shown'} ·{' '}
        {person.verificationStatus}
      </Text>
      {person.bio ? (
        <Text style={{ color: colors.ink, lineHeight: 22 }}>{person.bio}</Text>
      ) : null}
      {person.course ? (
        <Text style={{ color: colors.muted }}>
          {person.course}
          {person.graduationYear ? ` · ${person.graduationYear}` : ''}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[...person.interests, ...person.skills].map(item => (
          <Chip key={item} label={item} />
        ))}
      </View>
      <Button
        label="Block"
        variant="danger"
        onPress={() => block.mutate()}
        loading={block.isPending}
      />
      {block.isSuccess ? (
        <Text style={{ color: colors.leaf }}>
          Blocked. Their posts will leave your feeds.
        </Text>
      ) : null}
      {block.error ? (
        <Text style={{ color: colors.danger }}>
          {errorMessage(block.error)}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export function VerificationScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiData<Me>('/users/me'),
  });
  const colleges = useQuery({
    queryKey: ['colleges'],
    queryFn: () => apiData<College[]>('/colleges'),
  });
  const [collegeId, setCollegeId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: (method: 'COLLEGE_EMAIL' | 'MANUAL') =>
      apiData('/verification', {
        method: 'POST',
        body: JSON.stringify({ collegeId, method, note: note || undefined }),
      }),
    onSuccess: () => {
      setMessage('Verification submitted.');
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
  const selected = colleges.data?.find(college => college.id === collegeId);
  const emailMatches = Boolean(
    selected?.emailDomain &&
      me.data?.email.endsWith(`@${selected.emailDomain}`),
  );

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>
        College verification
      </Text>
      <Text style={{ color: colors.muted }}>
        If your college has no email domain, submit a manual request for a
        moderator.
      </Text>
      {me.data ? (
        <Text style={{ color: colors.ink }}>
          Current status: {me.data.verificationStatus}
        </Text>
      ) : null}
      {(colleges.data ?? []).map(college => (
        <Pressable
          key={college.id}
          onPress={() => setCollegeId(college.id)}
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: collegeId === college.id ? colors.accent : colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '700' }}>
            {college.name}
          </Text>
          <Text style={{ color: colors.muted }}>
            {college.city}
            {college.emailDomain
              ? ` · @${college.emailDomain}`
              : ' · manual review'}
          </Text>
        </Pressable>
      ))}
      <Field
        label="Note for reviewers"
        value={note}
        onChangeText={setNote}
        autoCapitalize="sentences"
      />
      {emailMatches ? (
        <Button
          label="Verify with college email"
          onPress={() => request.mutate('COLLEGE_EMAIL')}
          loading={request.isPending}
        />
      ) : null}
      <Button
        label="Request manual review"
        variant="secondary"
        onPress={() => request.mutate('MANUAL')}
        disabled={!collegeId}
        loading={request.isPending}
      />
      {message ? <Text style={{ color: colors.leaf }}>{message}</Text> : null}
      {request.error ? (
        <Text style={{ color: colors.danger }}>
          {errorMessage(request.error)}
        </Text>
      ) : null}
    </ScrollView>
  );
}

export function BookmarksScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const bookmarks = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => api<Page<Post>>('/bookmarks?limit=30'),
  });
  const posts = bookmarks.data?.data ?? [];
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 10,
        backgroundColor: colors.background,
        flexGrow: 1,
      }}
    >
      <ScreenHeader title="Saved" />
      {bookmarks.isLoading ? <LoadingBlock /> : null}
      {bookmarks.isError ? (
        <ErrorState
          message={errorMessage(bookmarks.error)}
          onRetry={() => bookmarks.refetch()}
        />
      ) : null}
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
        />
      ))}
      {!bookmarks.isLoading && posts.length === 0 ? (
        <EmptyState
          title="Nothing saved"
          body="Bookmark a post from the feed."
        />
      ) : null}
    </ScrollView>
  );
}

export function BlocksScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const blocks = useQuery({
    queryKey: ['blocks'],
    queryFn: () =>
      apiData<{ username: string; displayName: string }[]>('/users/me/blocks'),
  });
  const unblock = useMutation({
    mutationFn: (username: string) =>
      apiData(`/users/${username}/block`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
  });
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 10,
        backgroundColor: colors.background,
      }}
    >
      {(blocks.data ?? []).map(person => (
        <View
          key={person.username}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '700' }}>
            {person.displayName}
          </Text>
          <Button
            label="Unblock"
            variant="secondary"
            onPress={() => unblock.mutate(person.username)}
          />
        </View>
      ))}
      {blocks.data?.length === 0 ? (
        <EmptyState
          title="No blocked students"
          body="People you block disappear from your feeds and search."
        />
      ) : null}
    </ScrollView>
  );
}

export function SettingsScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const clear = useSession(state => state.clear);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiData<Me>('/users/me'),
  });
  const prefs = me.data?.notifications;
  const update = useMutation({
    mutationFn: (patch: Record<string, boolean>) => {
      const parsed = notificationPrefsSchema.parse(patch);
      return apiData('/users/me/notifications', {
        method: 'PATCH',
        body: JSON.stringify(parsed),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });
  const dangerous = useMutation({
    mutationFn: async (
      action: 'deactivate' | 'delete' | 'logout-all' | 'export',
    ) => {
      if (action === 'export')
        return apiData<Record<string, unknown>>('/users/me/export');
      if (action === 'logout-all') {
        await apiData('/auth/logout-all', { method: 'POST' });
        await clear();
        return null;
      }
      await apiData(
        action === 'deactivate' ? '/users/me/deactivate' : '/users/me',
        { method: action === 'deactivate' ? 'POST' : 'DELETE' },
      );
      await clear();
      return null;
    },
  });

  const confirm = (title: string, action: 'deactivate' | 'delete') => {
    Alert.alert(
      title,
      action === 'delete'
        ? 'Your public profile becomes a tombstone and sessions are revoked.'
        : 'You can reactivate later by signing in with Google again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: title,
          style: 'destructive',
          onPress: () => dangerous.mutate(action),
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 10,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 24, fontWeight: '800' }}>
        Notifications
      </Text>
      {prefs
        ? (
            [
              'replies',
              'community',
              'events',
              'moderation',
              'security',
              'lms',
              'pushEnabled',
            ] as const
          ).map(key => (
            <Pressable
              key={key}
              onPress={() => update.mutate({ [key]: !prefs[key] })}
              style={{ paddingVertical: 10 }}
            >
              <Text style={{ color: colors.ink, fontWeight: '700' }}>
                {key} · {prefs[key] ? 'on' : 'off'}
              </Text>
            </Pressable>
          ))
        : null}
      <Button
        label="Export my data"
        variant="secondary"
        onPress={() => dangerous.mutate('export')}
      />
      {dangerous.data && typeof dangerous.data === 'object' ? (
        <Text style={{ color: colors.muted }}>
          Export ready. Posts:{' '}
          {Array.isArray((dangerous.data as { posts?: unknown[] }).posts)
            ? (dangerous.data as { posts: unknown[] }).posts.length
            : 0}
          .
        </Text>
      ) : null}
      <Button
        label="Log out everywhere"
        variant="secondary"
        onPress={() => dangerous.mutate('logout-all')}
      />
      <Button
        label="Deactivate account"
        variant="secondary"
        onPress={() => confirm('Deactivate', 'deactivate')}
      />
      <Button
        label="Delete account"
        variant="danger"
        onPress={() => confirm('Delete account', 'delete')}
      />
      {dangerous.error ? (
        <Text style={{ color: colors.danger }}>
          {errorMessage(dangerous.error)}
        </Text>
      ) : null}
    </ScrollView>
  );
}
