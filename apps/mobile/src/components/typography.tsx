import type { ComponentRef, Ref } from 'react';
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

/** The one typeface used across Rilvona. It is bundled with the app, so every phone draws text at the same width. */
export const FONT_FAMILY = 'Inter';

/** Drop-in for react-native's Text that always uses the app typeface. Pass a style to override it. */
export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ fontFamily: FONT_FAMILY }, style]} />;
}

/** The instance type, so `useRef<TextInput>(null)` keeps working with this component. */
export type TextInput = ComponentRef<typeof NativeTextInput>;

/** Drop-in for react-native's TextInput that always uses the app typeface. */
export function TextInput({
  style,
  ref,
  ...props
}: TextInputProps & { ref?: Ref<TextInput> }) {
  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={[{ fontFamily: FONT_FAMILY }, style]}
    />
  );
}
