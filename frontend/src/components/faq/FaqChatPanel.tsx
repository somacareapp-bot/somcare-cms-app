import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User as UserIcon } from 'lucide-react';
import { faqApi } from '../../services/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const STARTERS = [
  'How do I schedule an appointment?',
  'How do I reset my password?',
  'How do I register a new patient?',
  'Where do I find the profit & loss report?',
];

export function FaqChatPanel({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        "Hi! I'm the SOMCARE help assistant. Ask me anything about using the app \u2014 I answer entirely offline from SOMCARE's own help content, so I can't chat about anything outside that.",
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || isSending) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', text: question }]);
    setInput('');
    setIsSending(true);
    try {
      const res = await faqApi.ask(question);
      const answer = res.data?.answer ?? "Sorry, I couldn't find an answer for that.";
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', text: answer }]);
    } catch {
      setMessages((m) => [
        ...m,
        { id: `a-${Date.now()}`, role: 'assistant', text: 'Sorry, something went wrong answering that. Try again.' },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className={`flex-1 overflow-y-auto space-y-3 ${compact ? 'p-3' : 'p-4'}`}>
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                <Bot size={14} />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-red-600 text-white rounded-br-sm'
                  : 'bg-neutral-100 text-neutral-800 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
            {m.role === 'user' && (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500">
                <UserIcon size={14} />
              </div>
            )}
          </div>
        ))}
        {isSending && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Bot size={14} /> Thinking\u2026
          </div>
        )}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 border-t border-neutral-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about SOMCARE..."
          className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-red-600 to-red-700 text-white disabled:opacity-50"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
