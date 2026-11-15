import { View } from 'react-native';
import { EmptyPanel, TabScroll, TabTitle } from './ui/parts';

export function ResultTab({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <TabScroll refreshing={refreshing} onRefresh={onRefresh}>
      <TabTitle title="Result" />
      <View>
        <EmptyPanel
          icon="doc"
          title="No Semester Results Yet"
          body="Your semester results will appear here once Rilvona can import them from CUIMS."
        />
      </View>
    </TabScroll>
  );
}
