import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState, Linking, Modal, ScrollView, View } from 'react-native';
import { Text } from './typography';
import { checkForUpdate, installedBuild } from '../lib/appVersion';
import { useTheme } from '../theme/ThemeProvider';
import { BrandLogo, Button } from './ui';

/**
 * Version control. When the server says this build is too old, a full screen stops the app until the student
 * updates. When a newer build merely exists, a card offers the update and can be dismissed.
 */
export function UpdateGate() {
  const { colors } = useTheme();
  const query = useQuery({
    queryKey: ['app-update'],
    queryFn: checkForUpdate,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const { refetch } = query;
  const [dismissedCode, setDismissedCode] = useState<number | null>(null);

  // Check again each time the app comes back to the front, so a forced update reaches people who never close it.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  const check = query.data;
  if (!check || (!check.updateRequired && !check.updateAvailable)) return null;
  if (!check.updateRequired && dismissedCode === check.latestVersionCode)
    return null;

  const required = check.updateRequired;
  const build = installedBuild();
  const openStore = () => {
    if (check.storeUrl) void Linking.openURL(check.storeUrl);
  };

  return (
    <Modal
      visible
      transparent={!required}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!required) setDismissedCode(check.latestVersionCode);
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          backgroundColor: required ? colors.background : colors.overlay,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            maxHeight: '85%',
            gap: 14,
            alignItems: 'center',
            padding: 24,
            borderRadius: 24,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <BrandLogo size={72} />
          <Text
            style={{
              color: colors.ink,
              fontSize: 22,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            {required ? 'Update required' : 'A new version is ready'}
          </Text>
          <Text style={{ color: colors.muted, textAlign: 'center' }}>
            {required
              ? 'This version of Rilvona is no longer supported. Update to keep using the app.'
              : 'Update to get the latest features and fixes.'}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {build
              ? `You have ${build.versionName} (${build.versionCode}). `
              : ''}
            Latest is {check.latestVersionName} ({check.latestVersionCode}).
          </Text>
          {check.releaseNotes ? (
            <ScrollView
              style={{ alignSelf: 'stretch', maxHeight: 160 }}
              contentContainerStyle={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ color: colors.ink, lineHeight: 20 }}>
                {check.releaseNotes}
              </Text>
            </ScrollView>
          ) : null}
          <View style={{ alignSelf: 'stretch', gap: 8 }}>
            {check.storeUrl ? (
              <Button label="Update now" onPress={openStore} />
            ) : (
              <Text style={{ color: colors.muted, textAlign: 'center' }}>
                Open your app store and update Rilvona.
              </Text>
            )}
            {required ? null : (
              <Button
                label="Later"
                variant="ghost"
                onPress={() => setDismissedCode(check.latestVersionCode)}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
