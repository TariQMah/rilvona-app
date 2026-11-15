import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiData } from '../../api/client';
import { Button, ErrorState, LoadingBlock } from '../../components/ui';
import { errorMessage } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';

type Report = {
  id: string;
  targetType:
    | 'POST'
    | 'COMMENT'
    | 'QUESTION'
    | 'ANSWER'
    | 'USER'
    | 'EVENT'
    | 'COMMUNITY';
  targetId: string;
  reason: string;
  status: string;
  createdAt: string;
};

export function ModerationScreen() {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const reports = useQuery({
    queryKey: ['reports'],
    queryFn: () => apiData<Report[]>('/admin/reports'),
  });
  const act = useMutation({
    mutationFn: (input: {
      report: Report;
      action: 'DISMISS' | 'REMOVE_CONTENT';
    }) =>
      apiData('/admin/moderation', {
        method: 'POST',
        body: JSON.stringify({
          reportId: input.report.id,
          action: input.action,
          targetType: input.report.targetType,
          targetId: input.report.targetId,
        }),
      }),
    onSuccess: () => {
      setMessage('Moderation action recorded.');
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  if (reports.isLoading) return <LoadingBlock />;
  if (reports.isError)
    return (
      <ErrorState
        message={errorMessage(reports.error)}
        onRetry={() => reports.refetch()}
      />
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
        Reports
      </Text>
      {message ? <Text style={{ color: colors.leaf }}>{message}</Text> : null}
      {(reports.data ?? []).map(report => (
        <View
          key={report.id}
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 12,
            gap: 8,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={{ color: colors.ink, fontWeight: '800' }}>
            {report.reason}
          </Text>
          <Text style={{ color: colors.muted }}>
            {report.targetType} · {report.status} ·{' '}
            {formatWhen(report.createdAt)}
          </Text>
          <Button
            label="Dismiss"
            variant="secondary"
            onPress={() => act.mutate({ report, action: 'DISMISS' })}
          />
          {report.targetType !== 'USER' ? (
            <Button
              label="Remove content"
              variant="danger"
              onPress={() => act.mutate({ report, action: 'REMOVE_CONTENT' })}
            />
          ) : null}
        </View>
      ))}
      {reports.data?.length === 0 ? (
        <Text style={{ color: colors.muted }}>No open reports.</Text>
      ) : null}
      {act.error ? (
        <Text style={{ color: colors.danger }}>{errorMessage(act.error)}</Text>
      ) : null}
    </ScrollView>
  );
}
