import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { FaqChatPanel } from './faq/FaqChatPanel';

export function FaqChatWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-red-600 to-red-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-bold">SOMCARE Help</p>
              <p className="text-[11px] text-white/80">Offline FAQ assistant</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <FaqChatPanel compact />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-red-600 to-red-700 text-white shadow-[0_8px_24px_rgba(185,28,28,0.4)] transition-transform hover:scale-105"
        aria-label="Open help assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </>
  );
}
