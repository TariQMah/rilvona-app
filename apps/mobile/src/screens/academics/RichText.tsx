import { View } from 'react-native';
import { Text } from '../../components/typography';
import { cu } from './ui/graphics';

/** **bold** inside a line. */
function Inline({ text, color }: { text: string; color: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={index} style={{ fontWeight: '800', color }}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * The little formatting the assistant uses: **bold**, "- " bullets, "1." lists and blank lines between paragraphs.
 * Anything else is shown as plain text.
 */
export function RichText({
  text,
  color = cu.text,
  size = 15,
}: {
  text: string;
  color?: string;
  size?: number;
}) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: 5 }}>
      {lines.map((raw, index) => {
        const line = raw.trim();
        if (!line) return <View key={`s${index}`} style={{ height: 3 }} />;
        const bullet = /^[-*•]\s+(.*)$/.exec(line);
        const numbered = /^(\d+)[.)]\s+(.*)$/.exec(line);
        const heading = /^#{1,4}\s+(.*)$/.exec(line);
        const lead = bullet ? '•' : numbered ? `${numbered[1]}.` : null;
        const body = bullet?.[1] ?? numbered?.[2] ?? heading?.[1] ?? line;
        return (
          <View
            key={`l${index}`}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
          >
            {lead ? (
              <Text
                style={{
                  color,
                  fontSize: size,
                  lineHeight: size + 6,
                  minWidth: 14,
                  fontWeight: '700',
                }}
              >
                {lead}
              </Text>
            ) : null}
            <Text
              style={{
                color,
                fontSize: size,
                lineHeight: size + 6,
                flexShrink: 1,
                fontWeight: heading ? '800' : '500',
              }}
            >
              <Inline text={body} color={color} />
            </Text>
          </View>
        );
      })}
    </View>
  );
}
