import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './palette';

type Mode = 'system' | 'light' | 'dark';

type ThemeValue = {
  colors: Palette;
  mode: Mode;
  isDark: boolean;
  setMode: (mode: Mode) => void;
};

const STORAGE_KEY = 'hiihive.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (stored === 'light' || stored === 'dark' || stored === 'system')
          setModeState(stored);
      })
      .catch(() => undefined);
  }, []);

  const setMode = (next: Mode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  const value = useMemo<ThemeValue>(
    () => ({
      colors: isDark ? darkPalette : lightPalette,
      mode,
      isDark,
      setMode,
    }),
    [isDark, mode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
