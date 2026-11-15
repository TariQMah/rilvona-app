import { BackHandler, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExitPrompt } from '../lib/backHandler';
import { cu } from '../screens/academics/ui/graphics';
import { BottomSheet, PressScale } from '../screens/academics/ui/motion';
import { Text } from './typography';
import { BrandLogo } from './ui';

/** "Exit Rilvona?" confirmation, opened by the back button or swipe from the first screen. */
export function ExitSheet() {
  const visible = useExitPrompt(state => state.visible);
  const hide = useExitPrompt(state => state.hide);
  const insets = useSafeAreaInsets();
  return (
    <BottomSheet visible={visible} onClose={hide} heightRatio={0.36}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          paddingHorizontal: 22,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 16),
          gap: 14,
        }}
      >
        <BrandLogo size={52} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Text style={{ color: cu.text, fontSize: 21, fontWeight: '800' }}>
            Exit Rilvona?
          </Text>
          <Text
            style={{
              color: cu.muted,
              fontSize: 14,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            Are you sure you want to close the app?
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          <View style={{ flex: 1 }}>
            <PressScale
              onPress={hide}
              style={{
                alignItems: 'center',
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: cu.cardAlt,
                borderWidth: 1,
                borderColor: cu.line,
              }}
            >
              <Text style={{ color: cu.text, fontSize: 15, fontWeight: '800' }}>
                Stay
              </Text>
            </PressScale>
          </View>
          <View style={{ flex: 1 }}>
            <PressScale
              onPress={() => BackHandler.exitApp()}
              style={{
                alignItems: 'center',
                paddingVertical: 14,
                borderRadius: 16,
                backgroundColor: cu.red,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                Exit
              </Text>
            </PressScale>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
