import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../../api/session';
import { Text, TextInput } from '../../components/typography';
import { useAiChat, type AiMessage } from './aiChat';
import { firstName, type ConnectedOverview } from './model';
import { PageHeader } from './PageShell';
import { RichText } from './RichText';
import { cu, Icon } from './ui/graphics';
import { FadeIn, PressScale } from './ui/motion';

const SUGGESTIONS = [
  'Which subjects are at risk?',
  'Can I skip tomorrow’s classes?',
  'What is my plan for today?',
  'Make me a study plan for this week',
  'How are my marks going?',
];

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((2 - index) * 140),
        ]),
      ),
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [dots]);
  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingVertical: 6 }}>
      {dots.map((dot, index) => (
        <Animated.View
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: cu.purple,
            opacity: dot.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 1],
            }),
            transform: [
              {
                translateY: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -3],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

function AiBadge({ size = 38 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2.4,
        backgroundColor: `${cu.purple}26`,
        borderWidth: 1,
        borderColor: `${cu.purple}55`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="sparkle" size={size * 0.55} color={cu.purple} />
    </View>
  );
}

function Bubble({
  message,
  onRetry,
}: {
  message: AiMessage;
  onRetry: () => void;
}) {
  if (message.role === 'user') {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <View
          style={{
            maxWidth: '86%',
            backgroundColor: cu.blue,
            borderRadius: 20,
            borderBottomRightRadius: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 15,
              lineHeight: 21,
              fontWeight: '600',
            }}
          >
            {message.content}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <AiBadge size={30} />
      <View
        style={{
          maxWidth: '84%',
          backgroundColor: message.failed ? `${cu.red}14` : cu.card,
          borderWidth: 1,
          borderColor: message.failed ? `${cu.red}40` : cu.line,
          borderRadius: 20,
          borderTopLeftRadius: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 8,
        }}
      >
        {message.failed ? (
          <>
            <Text
              style={{
                color: cu.red,
                fontSize: 14,
                lineHeight: 20,
                fontWeight: '700',
              }}
            >
              {message.content}
            </Text>
            <Pressable onPress={onRetry} hitSlop={8}>
              <Text style={{ color: cu.blue, fontWeight: '800', fontSize: 13 }}>
                Try again ›
              </Text>
            </Pressable>
          </>
        ) : (
          <RichText text={message.content} />
        )}
      </View>
    </View>
  );
}

/** The AI helper: a chat that knows the student's attendance, timetable and marks. */
export function AiChatTab({
  data,
  onBack,
}: {
  data: ConnectedOverview;
  onBack: () => void;
}) {
  const userId = useSession(state => state.user?.id);
  const messages = useAiChat(state => state.messages);
  const pending = useAiChat(state => state.pending);
  const { load, send, retry, clear } = useAiChat.getState();
  const [draft, setDraft] = useState('');
  const insets = useSafeAreaInsets();
  // Edge to edge windows are not resized for the keyboard, so measure how far it covers this screen and lift the
  // composer by that much.
  const root = useRef<ComponentRef<typeof View>>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => {
      const keyboardTop = event.endCoordinates.screenY;
      requestAnimationFrame(() => {
        root.current?.measureInWindow((_x, y, _w, height) =>
          setLift(Math.max(0, Math.round(y + height - keyboardTop))),
        );
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const keyboardUp = lift > 0;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const name = firstName(data.connection.studentName);

  useEffect(() => {
    if (userId) void load(userId);
  }, [userId, load]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || pending) return;
    setDraft('');
    void send(value);
  };
  const canSend = draft.trim().length > 0 && !pending;

  return (
    <View ref={root} style={{ flex: 1, paddingBottom: lift }}>
      <PageHeader
        title="Rilvona AI"
        subtitle="Knows your attendance, timetable and marks"
        onBack={onBack}
        right={
          messages.length > 0 ? (
            <Pressable
              onPress={clear}
              hitSlop={8}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: cu.card,
                borderWidth: 1,
                borderColor: cu.line,
              }}
            >
              <Text
                style={{ color: cu.muted, fontSize: 12, fontWeight: '800' }}
              >
                New chat
              </Text>
            </Pressable>
          ) : (
            <AiBadge size={40} />
          )
        }
      />

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onContentSizeChange={() =>
          scroller.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.length === 0 ? (
          <FadeIn
            distance={8}
            style={{ flex: 1, justifyContent: 'center', gap: 18 }}
          >
            <View style={{ alignItems: 'center', gap: 10 }}>
              <AiBadge size={64} />
              <Text
                style={{
                  color: cu.text,
                  fontSize: 22,
                  fontWeight: '800',
                  textAlign: 'center',
                }}
              >
                Hi {name}, I’m your study buddy
              </Text>
              <Text
                style={{
                  color: cu.muted,
                  fontSize: 14,
                  lineHeight: 20,
                  textAlign: 'center',
                  fontWeight: '600',
                }}
              >
                Ask me anything about your classes, attendance, marks or how to
                plan your week.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {SUGGESTIONS.map(text => (
                <PressScale
                  key={text}
                  onPress={() => submit(text)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: cu.card,
                    borderWidth: 1,
                    borderColor: cu.line,
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Icon name="sparkle" size={16} color={cu.purple} />
                  <Text
                    style={{
                      color: cu.text,
                      fontSize: 14,
                      fontWeight: '700',
                      flex: 1,
                    }}
                  >
                    {text}
                  </Text>
                </PressScale>
              ))}
            </View>
            <Text
              style={{ color: cu.muted, fontSize: 11, textAlign: 'center' }}
            >
              AI can make mistakes. Check important dates with your university.
            </Text>
          </FadeIn>
        ) : (
          <>
            {messages.map(message => (
              <Bubble
                key={message.id}
                message={message}
                onRetry={() => void retry()}
              />
            ))}
            {pending ? (
              <View
                style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
              >
                <AiBadge size={30} />
                <View
                  style={{
                    backgroundColor: cu.card,
                    borderWidth: 1,
                    borderColor: cu.line,
                    borderRadius: 20,
                    borderTopLeftRadius: 6,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <TypingDots />
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 14,
          paddingTop: 6,
          paddingBottom: keyboardUp ? 8 : Math.max(insets.bottom, 10),
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about attendance, classes, marks…"
          placeholderTextColor={cu.muted}
          multiline
          maxLength={2000}
          style={{
            flex: 1,
            maxHeight: 110,
            minHeight: 46,
            color: cu.text,
            fontSize: 15,
            backgroundColor: cu.card,
            borderWidth: 1,
            borderColor: cu.line,
            borderRadius: 23,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        />
        <Pressable
          onPress={() => submit(draft)}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canSend ? cu.purple : cu.card,
            borderWidth: 1,
            borderColor: canSend ? cu.purple : cu.line,
          }}
        >
          <Icon name="arrowUp" size={22} color={canSend ? '#fff' : cu.muted} />
        </Pressable>
      </View>
    </View>
  );
}
