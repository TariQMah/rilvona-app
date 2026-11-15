import { useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEGAL, type LegalKind } from './legal';
import { cu, Icon } from './ui/graphics';
import { BottomSheet } from './ui/motion';

type Props = {
  /** Which document to show; `null` closes the sheet. */
  kind: LegalKind | null;
  onClose: () => void;
};

/** Terms and conditions or the privacy policy, as a scrollable bottom sheet. */
export function LegalSheet({ kind, onClose }: Props) {
  const insets = useSafeAreaInsets();
  // Keep the text on screen while the sheet slides away.
  const last = useRef<LegalKind>('terms');
  if (kind) last.current = kind;
  const doc = LEGAL[last.current];
  return (
    <BottomSheet visible={kind !== null} onClose={onClose} heightRatio={0.92}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          paddingBottom: 10,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            backgroundColor: `${cu.blue}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={last.current === 'terms' ? 'doc' : 'shield'}
            size={20}
            color={cu.blue}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: cu.text, fontSize: 20, fontWeight: '800' }}>
            {doc.title}
          </Text>
          <Text style={{ color: cu.muted, fontSize: 12, fontWeight: '600' }}>
            Updated {doc.updated}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: cu.card,
            borderWidth: 1,
            borderColor: cu.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="close" size={18} />
        </Pressable>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingBottom: 28 + insets.bottom,
          gap: 18,
        }}
      >
        <Text style={{ color: cu.muted, fontSize: 14, lineHeight: 21 }}>
          {doc.intro}
        </Text>
        {doc.sections.map((section, index) => (
          <View key={section.heading} style={{ gap: 8 }}>
            <Text style={{ color: cu.text, fontSize: 16, fontWeight: '800' }}>
              {index + 1}. {section.heading}
            </Text>
            {section.body.map(paragraph => (
              <Text
                key={paragraph}
                style={{ color: cu.muted, fontSize: 14, lineHeight: 21 }}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
