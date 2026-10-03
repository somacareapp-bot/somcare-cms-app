import { useEffect, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { faqApi } from '../../services/api';
import { FaqChatPanel } from '../../components/faq/FaqChatPanel';

interface CategoryGroup {
  category: string;
  questions: { id: string; question: string }[];
}

export function HelpPage() {
  const [categories, setCategories] = useState<CategoryGroup[]>([]);

  useEffect(() => {
    faqApi.getCategories().then((r) => setCategories(r.data ?? [])).catch(() => setCategories([]));
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-4 flex items-center gap-2">
          <HelpCircle size={20} className="text-red-600" />
          <h1 className="text-xl font-bold text-clinical-900">Help &amp; FAQ</h1>
        </div>
        <div className="space-y-4">
          {categories.map((group) => (
            <div key={group.category}>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-clinical-400">
                {group.category}
              </p>
              <ul className="space-y-1">
                {group.questions.map((q) => (
                  <li key={q.id} className="text-sm text-clinical-600">
                    {q.question}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-clinical-400">Loading topics\u2026</p>}
        </div>
      </div>
      <div className="h-[70vh] overflow-hidden rounded-xl border border-clinical-200 bg-white">
        <FaqChatPanel />
      </div>
    </div>
  );
}
