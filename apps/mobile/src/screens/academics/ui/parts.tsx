import {
  Image,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../../components/typography';
import { cu, Icon, type IconName } from './graphics';
import { FadeIn } from './motion';

/** The student's portal photo when there is one, otherwise their initial. */
export function Avatar({
  photo,
  name,
  size = 46,
}: {
  photo?: string | null;
  name: string;
  size?: number;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden' as const,
  };
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[frame, { backgroundColor: cu.cardAlt }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={[
        frame,
        {
          backgroundColor: `${cu.blue}33`,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text style={{ color: cu.blue, fontWeight: '800', fontSize: size * 0.4 }}>
        {(name.trim().charAt(0) || 'S').toUpperCase()}
      </Text>
    </View>
  );
}

export function Surface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: cu.card,
          borderRadius: 20,
          padding: 16,
          borderWidth: 1,
          borderColor: cu.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Pill({
  label,
  color,
  icon,
  filled = false,
}: {
  label: string;
  color: string;
  icon?: IconName;
  filled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: filled ? color : `${color}26`,
      }}
    >
      {icon ? (
        <Icon name={icon} size={13} color={filled ? '#fff' : color} />
      ) : null}
      <Text
        style={{
          color: filled ? '#fff' : color,
          fontWeight: '800',
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function Chip({ label, icon }: { label: string; icon?: IconName }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: cu.cardAlt,
      }}
    >
      {icon ? <Icon name={icon} size={13} color={cu.muted} /> : null}
      <Text style={{ color: cu.text, fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

/** Height of the floating bottom bar without the phone's bottom inset: 8 top padding + the 60 button. */
export const BAR_HEIGHT = 68;

export function TabScroll({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const insets = useSafeAreaInsets();
  // The bottom bar floats over the page, so the last item has to be able to scroll clear of it.
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 28 + BAR_HEIGHT + Math.max(insets.bottom, 10),
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={cu.blue}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

export function TabTitle({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ color: cu.text, fontSize: 30, fontWeight: '800' }}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export function EmptyPanel({
  icon,
  title,
  body,
}: {
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <FadeIn
      scaleFrom={0.94}
      style={{
        alignItems: 'center',
        paddingVertical: 56,
        paddingHorizontal: 24,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: cu.card,
          borderWidth: 1,
          borderColor: cu.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={36} color={cu.muted} />
      </View>
      <Text
        style={{
          color: cu.text,
          fontSize: 20,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: cu.muted,
          fontSize: 14,
          lineHeight: 21,
          textAlign: 'center',
        }}
      >
        {body}
      </Text>
    </FadeIn>
  );
}
