import { Pressable, View } from 'react-native';
import { Text } from '../../components/typography';
import { cu, Icon } from './ui/graphics';

/** Top bar of a full-screen page: a back button, the title and an optional action on the right. */
export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 6,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: cu.card,
          borderWidth: 1,
          borderColor: cu.line,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chevron" size={20} />
        </View>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ color: cu.text, fontSize: 24, fontWeight: '800' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** A selectable pill used for options such as the target percentage or the weekdays to skip. */
export function Choice({
  label,
  on,
  onPress,
  color = cu.blue,
  disabled,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: on ? color : cu.cardAlt,
        borderWidth: 1,
        borderColor: on ? color : cu.line,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        style={{
          color: on ? '#fff' : cu.text,
          fontWeight: '800',
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: cu.muted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.4,
      }}
    >
      {children}
    </Text>
  );
}

/** A row of two to four tabs that switch what a page or sheet shows, so long content is not one endless scroll. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 4,
        borderRadius: 18,
        backgroundColor: cu.card,
        borderWidth: 1,
        borderColor: cu.line,
      }}
    >
      {options.map(option => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: on ? `${cu.blue}26` : 'transparent',
            }}
          >
            <Text
              style={{
                color: on ? cu.blue : cu.muted,
                fontWeight: '800',
                fontSize: 14,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
