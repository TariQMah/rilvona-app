import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import { create } from 'zustand';

type ExitPrompt = { visible: boolean; show: () => void; hide: () => void };

/** Whether the "Exit Rilvona?" sheet is open. `ExitSheet`, mounted once at the app root, draws it. */
export const useExitPrompt = create<ExitPrompt>(set => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

/** Asks before leaving the app, so a stray back swipe cannot close it. */
export function confirmExit() {
  useExitPrompt.getState().show();
}

/**
 * Runs `handler` when the Android back button or gesture is used. Return `true` when the press was handled; returning
 * `false` lets the next handler (the navigator, then the system) deal with it.
 */
export function useBackHandler(handler: () => boolean, enabled = true) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () =>
      latest.current(),
    );
    return () => subscription.remove();
  }, [enabled]);
}
