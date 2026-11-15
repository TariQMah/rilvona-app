import { createPostSchema } from '@hiihive/contracts';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { launchImageLibrary } from 'react-native-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiData } from '../../api/client';
import type { Post } from '../../api/types';
import { Button, Chip, Field } from '../../components/ui';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { base64ByteSize, normalizeImageMime } from '../../lib/media';
import type { RootStackParamList } from '../../navigation/types';
import { useRootNav } from '../../navigation/useRootNav';
import { useTheme } from '../../theme/ThemeProvider';

type CreateProps = NativeStackScreenProps<RootStackParamList, 'CreatePost'>;

export function CreateHubScreen() {
  const navigation = useRootNav();
  const { colors } = useTheme();
  const items = [
    [
      'Write a post',
      'Share something with your college or a hive.',
      () => navigation.navigate('CreatePost'),
    ],
    [
      'Ask anonymously',
      'Your name stays off the question.',
      () => navigation.navigate('AskQuestion'),
    ],
    [
      'Host an event',
      'Open registration for a campus gathering.',
      () => navigation.navigate('CreateEvent'),
    ],
  ] as const;
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
        flexGrow: 1,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}>
        Create
      </Text>
      <Text style={{ color: colors.muted }}>
        Post, ask, or gather people. Email verification is required.
      </Text>
      {items.map(([title, body, onPress]) => (
        <Pressable
          key={title}
          onPress={onPress}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.line,
            gap: 4,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 18 }}>
            {title}
          </Text>
          <Text style={{ color: colors.muted }}>{body}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function CreatePostScreen({ route, navigation }: CreateProps) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<
    'PUBLIC' | 'COLLEGE' | 'COMMUNITY'
  >(route.params?.communityId ? 'COMMUNITY' : 'PUBLIC');
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async () => {
      const picked = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
        selectionLimit: 1,
      });
      const asset = picked.assets?.[0];
      if (!asset?.base64) return;
      const mimeType = normalizeImageMime(asset.type);
      if (!mimeType) throw new Error('Use a JPEG, PNG, or WebP image.');
      const byteSize = base64ByteSize(asset.base64);
      if (byteSize > 5 * 1024 * 1024)
        throw new Error('Images must be 5 MB or smaller.');
      const signed = await apiData<{ uploadId: string }>('/uploads/sign', {
        method: 'POST',
        body: JSON.stringify({ mimeType, byteSize }),
      });
      await apiData(`/uploads/${signed.uploadId}/bytes`, {
        method: 'POST',
        body: JSON.stringify({ dataBase64: asset.base64 }),
      });
      setMediaId(signed.uploadId);
      setPreview(`data:${mimeType};base64,${asset.base64}`);
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      const parsed = createPostSchema.safeParse({
        body,
        visibility,
        communityId: route.params?.communityId,
        mediaIds: mediaId ? [mediaId] : undefined,
      });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        throw new Error(parsed.error.issues[0]?.message ?? 'Check the post');
      }
      setErrors({});
      return apiData<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: post => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      navigation.replace('PostDetail', { postId: post.id });
    },
    onError: error => setFormError(errorMessage(error)),
  });

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        backgroundColor: colors.background,
        flexGrow: 1,
      }}
    >
      <Text style={{ color: colors.ink, fontSize: 28, fontWeight: '800' }}>
        {route.params?.communityName
          ? `Post in ${route.params.communityName}`
          : 'New post'}
      </Text>
      {!route.params?.communityId ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip
            label="Public"
            selected={visibility === 'PUBLIC'}
            onPress={() => setVisibility('PUBLIC')}
          />
          <Chip
            label="College"
            selected={visibility === 'COLLEGE'}
            onPress={() => setVisibility('COLLEGE')}
          />
        </View>
      ) : null}
      <Field
        label="What is happening?"
        value={body}
        onChangeText={setBody}
        multiline
        error={errors.body}
        autoCapitalize="sentences"
      />
      {preview ? (
        <Image
          source={{ uri: preview }}
          style={{ width: '100%', height: 180, borderRadius: 14 }}
        />
      ) : null}
      <Button
        label={mediaId ? 'Replace photo' : 'Add photo'}
        variant="secondary"
        onPress={() => upload.mutate()}
        loading={upload.isPending}
      />
      {upload.error ? (
        <Text style={{ color: colors.danger }}>
          {errorMessage(upload.error)}
        </Text>
      ) : null}
      {formError ? (
        <Text style={{ color: colors.danger }}>{formError}</Text>
      ) : null}
      <Button
        label="Publish"
        onPress={() => publish.mutate()}
        loading={publish.isPending}
      />
    </ScrollView>
  );
}

export function CreateTabScreen() {
  return <CreateHubScreen />;
}
