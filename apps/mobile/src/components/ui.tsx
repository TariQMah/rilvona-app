import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Text, TextInput } from './typography';
import { useTheme } from '../theme/ThemeProvider';
import type { Palette } from '../theme/palette';

export function HiveMark({ size = 36 }: { size?: number }) {
  const { colors } = useTheme();
  const cell = size * 0.42;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[mark(colors.accent, cell), { top: 0, left: size * 0.29 }]}
      />
      <View style={[mark(colors.honey, cell), { bottom: 0, left: 0 }]} />
      <View style={[mark(colors.leaf, cell), { bottom: 0, right: 0 }]} />
    </View>
  );
}

/** The Rilvona logo, on the same soft tile as the app icon. */
export function BrandLogo({ size = 120 }: { size?: number }) {
  return (
    <Image
      source={require('../assets/logo.png')}
      accessibilityLabel="Rilvona logo"
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    />
  );
}

function mark(backgroundColor: string, size: number) {
  return {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size * 0.32,
    backgroundColor,
  };
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const styles = useStyles();
  const variantStyle =
    variant === 'secondary'
      ? styles.secondary
      : variant === 'ghost'
      ? styles.ghost
      : variant === 'danger'
      ? styles.danger
      : styles.primary;
  const textStyle =
    variant === 'primary' || variant === 'danger'
      ? styles.primaryText
      : styles.secondaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'danger' ? '#fff' : undefined
          }
        />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  multiline?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.inputError : null,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  const styles = useStyles();
  return (
    <View style={styles.state}>
      <HiveMark size={42} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.state}>
      <Text style={styles.stateTitle}>Could not load this</Text>
      <Text style={styles.stateBody}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="secondary" />
      ) : null}
    </View>
  );
}

export function LoadingBlock() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const letters = name.trim().slice(0, 1).toUpperCase() || 'H';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ color: colors.ink, fontWeight: '700', fontSize: size * 0.38 }}
      >
        {letters}
      </Text>
    </View>
  );
}

export function Banner({
  text,
  tone = 'warning',
}: {
  text: string;
  tone?: 'warning' | 'info';
}) {
  const styles = useStyles();
  return (
    <View style={[styles.banner, tone === 'info' && styles.bannerInfo]}>
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

export function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: Palette) {
  const text: TextStyle = { color: colors.ink };
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingBottom: 12,
      gap: 12,
    },
    headerTitle: {
      ...text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    headerSubtitle: { color: colors.muted, marginTop: 2, fontSize: 14 },
    button: {
      minHeight: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    primary: { backgroundColor: colors.accent },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.danger },
    primaryText: { color: colors.accentInk, fontWeight: '700', fontSize: 16 },
    secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 16 },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.85 },
    field: { gap: 6 },
    label: { color: colors.ink, fontWeight: '600', fontSize: 14 },
    input: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      color: colors.ink,
      paddingHorizontal: 14,
      fontSize: 16,
    },
    multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 },
    inputError: { borderColor: colors.danger },
    error: { color: colors.danger, fontSize: 13 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
    chipTextSelected: { color: colors.background },
    state: {
      alignItems: 'center',
      gap: 8,
      paddingVertical: 36,
      paddingHorizontal: 24,
    },
    stateTitle: {
      ...text,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    stateBody: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      gap: 8,
    },
    banner: { backgroundColor: '#F8E7C4', borderRadius: 12, padding: 12 },
    bannerInfo: { backgroundColor: colors.surfaceMuted },
    bannerText: { color: '#5C4108', fontSize: 14, lineHeight: 20 },
  });
}

export type { ViewStyle };
