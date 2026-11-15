import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';
import { Text } from '../../components/typography';
import { ID_CARD_ASPECT } from '../../cuims/idCardClient';
import { errorMessage } from '../../lib/errors';
import { formatWhen } from '../../lib/format';
import { useIdCard } from './useIdCard';
import { cu, Icon } from './ui/graphics';
import { FadeIn, Skeleton } from './ui/motion';
import { Surface } from './ui/parts';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Opens the CUIMS sign-in sheet, used when the saved session has expired. */
  onRefresh: () => void;
};

function Notice({
  title,
  body,
  action,
  onPress,
  icon,
}: {
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  icon: 'doc' | 'refresh';
}) {
  return (
    <Surface style={{ gap: 12, alignItems: 'center', paddingVertical: 28 }}>
      <Icon name={icon} size={34} color={cu.muted} />
      <Text style={{ color: cu.text, fontSize: 17, fontWeight: '800' }}>
        {title}
      </Text>
      <Text style={{ color: cu.muted, textAlign: 'center', lineHeight: 20 }}>
        {body}
      </Text>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: cu.blue,
          paddingHorizontal: 22,
          paddingVertical: 12,
          borderRadius: 14,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{action}</Text>
      </Pressable>
    </Surface>
  );
}

/**
 * The student's virtual ID card shown as a popup over the dashboard. The card is downloaded from CUIMS and kept on
 * the phone; tapping outside the card or the close button dismisses it.
 */
export function IdCardPopup({ visible, onClose, onRefresh }: Props) {
  const query = useIdCard();
  const result = query.data;

  const body = (() => {
    if (query.isLoading)
      return (
        <View style={{ gap: 12 }}>
          <Skeleton height={220} radius={22} />
          <Text style={{ color: '#fff', textAlign: 'center', fontSize: 13 }}>
            Getting your ID card from CUIMS…
          </Text>
        </View>
      );
    if (query.isError)
      return (
        <Notice
          icon="doc"
          title="Could not load the ID card"
          body={errorMessage(query.error)}
          action="Try again"
          onPress={() => void query.refetch()}
        />
      );
    if (!result?.data)
      return (
        <Notice
          icon="refresh"
          title="Sign in to load your ID card"
          body="Your CUIMS session has expired. Refresh from CUIMS once and your ID card will appear here."
          action="Refresh from CUIMS"
          onPress={() => {
            onClose();
            onRefresh();
          }}
        />
      );
    return (
      <View style={{ gap: 12 }}>
        <FadeIn>
          <View
            style={{
              borderRadius: 18,
              overflow: 'hidden',
              backgroundColor: '#fff',
              padding: 6,
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            <Image
              accessibilityLabel="Your virtual ID card"
              source={{ uri: `data:image/png;base64,${result.data.png}` }}
              resizeMode="contain"
              style={{ width: '100%', aspectRatio: ID_CARD_ASPECT }}
            />
          </View>
        </FadeIn>
        {result.expired || result.fromCache ? (
          <Pressable
            onPress={() => {
              onClose();
              onRefresh();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 14,
              padding: 10,
            }}
          >
            <Icon name="refresh" size={16} color={cu.orange} />
            <Text
              style={{
                color: cu.orange,
                flex: 1,
                fontSize: 12,
                fontWeight: '700',
                lineHeight: 17,
              }}
            >
              {result.expired
                ? 'Showing the saved copy. Your CUIMS session expired, tap to refresh.'
                : 'Showing the saved copy. The portal could not be reached.'}
            </Text>
          </Pressable>
        ) : null}
        <Text
          style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: 11,
            lineHeight: 16,
            textAlign: 'center',
          }}
        >
          Last updated {formatWhen(result.data.fetchedAt)}. Saved on this phone
          only. The card on the portal is the official one.
        </Text>
      </View>
    );
  })();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.72)',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <Pressable
          accessibilityLabel="Close ID card"
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <View style={{ gap: 18 }} pointerEvents="box-none">
          {body}
          <View style={{ alignItems: 'center', height: 44 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close ID card"
              onPress={onClose}
              hitSlop={10}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {query.isFetching && !query.isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}
                >
                  ✕
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
