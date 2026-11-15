import { useState } from 'react';
import { Modal, Pressable, Share, View } from 'react-native';
import { Text } from './typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiData } from '../api/client';
import type { Post } from '../api/types';
import { formatWhen } from '../lib/format';
import { errorMessage } from '../lib/errors';
import { mediaUrl } from '../lib/media';
import { useTheme } from '../theme/ThemeProvider';
import { Avatar, Button, useStyles } from './ui';
import { Image } from 'react-native';

const REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Misinformation',
  'Unsafe',
  'Other',
];

export function PostCard({
  post,
  onPress,
  onAuthor,
}: {
  post: Post;
  onPress?: () => void;
  onAuthor?: (username: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [reportOpen, setReportOpen] = useState(false);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.counts.likes);
  const [saved, setSaved] = useState(post.bookmarkedByMe);

  const like = useMutation({
    mutationFn: async () => {
      const next = !liked;
      setLiked(next);
      setLikes(count => count + (next ? 1 : -1));
      try {
        await apiData(
          next ? `/posts/${post.id}/reaction` : `/posts/${post.id}/reaction`,
          {
            method: next ? 'PUT' : 'DELETE',
          },
        );
      } catch (error) {
        setLiked(!next);
        setLikes(count => count + (next ? -1 : 1));
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });

  const bookmark = useMutation({
    mutationFn: async () => {
      const next = !saved;
      setSaved(next);
      try {
        await apiData(`/posts/${post.id}/bookmark`, {
          method: next ? 'PUT' : 'DELETE',
        });
      } catch (error) {
        setSaved(!next);
        throw error;
      }
    },
  });

  const image = mediaUrl(post.media[0]?.url ?? null);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Avatar name={post.author.displayName} />
        <Pressable
          style={{ flex: 1 }}
          onPress={() => onAuthor?.(post.author.username)}
        >
          <Text style={{ color: colors.ink, fontWeight: '700' }}>
            {post.author.displayName}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            @{post.author.username} · {formatWhen(post.createdAt)}
            {post.community ? ` · ${post.community.name}` : ''}
          </Text>
        </Pressable>
      </View>
      <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 23 }}>
        {post.body}
      </Text>
      {image ? (
        <Image
          source={{ uri: image }}
          style={{ width: '100%', height: 180, borderRadius: 12 }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Action
          label={liked ? `Liked ${likes}` : `Like ${likes}`}
          onPress={() => like.mutate()}
        />
        <Action label={`Comment ${post.counts.comments}`} onPress={onPress} />
        <Action
          label={saved ? 'Saved' : 'Save'}
          onPress={() => bookmark.mutate()}
        />
        <Action
          label="Share"
          onPress={() =>
            Share.share({ message: post.sharePath }).catch(() => undefined)
          }
        />
        <Action label="Report" onPress={() => setReportOpen(true)} />
      </View>
      {like.error ? (
        <Text style={{ color: colors.danger }}>{errorMessage(like.error)}</Text>
      ) : null}
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="POST"
        targetId={post.id}
      />
    </Pressable>
  );
}

function Action({ label, onPress }: { label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ paddingVertical: 6, paddingRight: 8 }}
    >
      <Text style={{ color: colors.muted, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
}: {
  visible: boolean;
  onClose: () => void;
  targetType:
    | 'POST'
    | 'COMMENT'
    | 'QUESTION'
    | 'ANSWER'
    | 'USER'
    | 'EVENT'
    | 'COMMUNITY';
  targetId: string;
}) {
  const { colors } = useTheme();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const report = useMutation({
    mutationFn: () =>
      apiData('/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId, reason }),
      }),
    onSuccess: onClose,
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'flex-end',
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            padding: 18,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800' }}>
            Report
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REPORT_REASONS.map(item => (
              <Pressable
                key={item}
                onPress={() => setReason(item)}
                style={{ padding: 8 }}
              >
                <Text
                  style={{
                    color: item === reason ? colors.accent : colors.ink,
                    fontWeight: '700',
                  }}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
          {report.error ? (
            <Text style={{ color: colors.danger }}>
              {errorMessage(report.error)}
            </Text>
          ) : null}
          {report.isSuccess ? (
            <Text style={{ color: colors.leaf }}>
              Report sent. A moderator will review it.
            </Text>
          ) : null}
          <Button
            label="Submit report"
            onPress={() => report.mutate()}
            loading={report.isPending}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
