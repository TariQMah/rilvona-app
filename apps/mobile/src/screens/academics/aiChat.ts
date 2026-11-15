import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiData } from '../../api/client';
import { errorMessage } from '../../lib/errors';

export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** The reply never came: shown with a retry button and never sent back to the model. */
  failed?: boolean;
};

type AiChatState = {
  userId: string | null;
  messages: AiMessage[];
  pending: boolean;
  /** Loads the saved conversation of this student (and drops the previous student's). */
  load: (userId: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  retry: () => Promise<void>;
  clear: () => void;
};

const KEY = (userId: string) => `rilvona_ai_chat_v1:${userId}`;
const KEEP = 40;
const SENT = 14;
let counter = 0;
const nextId = () => `${Date.now().toString(36)}-${(counter += 1)}`;

function save(userId: string | null, messages: AiMessage[]) {
  if (!userId) return;
  const trimmed = messages.filter(m => !m.failed).slice(-KEEP);
  void AsyncStorage.setItem(KEY(userId), JSON.stringify(trimmed)).catch(
    () => undefined,
  );
}

async function ask(history: AiMessage[]): Promise<string> {
  const result = await apiData<{ reply: string }>('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: history
        .filter(m => !m.failed)
        .slice(-SENT)
        .map(m => ({ role: m.role, content: m.content })),
      clientTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
  return result.reply;
}

export const useAiChat = create<AiChatState>((set, get) => {
  const run = async () => {
    set({ pending: true });
    const userId = get().userId;
    try {
      const reply = await ask(get().messages);
      const messages = [
        ...get().messages,
        { id: nextId(), role: 'assistant' as const, content: reply },
      ];
      set({ messages });
      save(userId, messages);
    } catch (error) {
      set({
        messages: [
          ...get().messages,
          {
            id: nextId(),
            role: 'assistant',
            content: errorMessage(error),
            failed: true,
          },
        ],
      });
    } finally {
      set({ pending: false });
    }
  };

  return {
    userId: null,
    messages: [],
    pending: false,
    load: async userId => {
      if (get().userId === userId) return;
      set({ userId, messages: [], pending: false });
      try {
        const raw = await AsyncStorage.getItem(KEY(userId));
        const saved = raw ? (JSON.parse(raw) as AiMessage[]) : [];
        // Do not overwrite messages typed while this was loading.
        if (get().userId === userId && get().messages.length === 0)
          set({ messages: saved });
      } catch {
        // A damaged or missing save only means the chat starts empty.
      }
    },
    send: async text => {
      const content = text.trim().slice(0, 2000);
      if (!content || get().pending) return;
      const messages = [
        ...get().messages.filter(m => !m.failed),
        { id: nextId(), role: 'user' as const, content },
      ];
      set({ messages });
      save(get().userId, messages);
      await run();
    },
    retry: async () => {
      if (get().pending) return;
      set({ messages: get().messages.filter(m => !m.failed) });
      if (get().messages[get().messages.length - 1]?.role === 'user')
        await run();
    },
    clear: () => {
      const userId = get().userId;
      set({ messages: [], pending: false });
      if (userId)
        void AsyncStorage.removeItem(KEY(userId)).catch(() => undefined);
    },
  };
});
