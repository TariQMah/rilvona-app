import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/** Same as `useBackHandler`, but only while the screen is the focused one in its navigator. */
export function useFocusedBackHandler(handler: () => boolean) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => latest.current(),
      );
      return () => subscription.remove();
    }, []),
  );
}
