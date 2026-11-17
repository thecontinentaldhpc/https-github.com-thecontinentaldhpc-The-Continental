import { Link } from 'react-router-dom';
import type { Article } from '../types/publication';
import { useSite } from '../context/SiteContext';

export function BreakingNewsBar({ items }: { items: Article[] }) {
  const { settings } = useSite();

  if (!settings.breaking_ticker_enabled || items.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#FAF8F5] dark:bg-[#181818] border-b border-neutral-300 dark:border-neutral-800 no-print">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 flex items-center gap-4 py-2 overflow-hidden">
        <span className="bg-[#8C1D24] text-white text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 shrink-0">
          Breaking
        </span>
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-ticker flex items-center gap-10">
            {[...items, ...items].map((item, idx) => (
              <Link
                key={`${item.id}-${idx}`}
                to={`/article/${item.slug}`}
                className="text-sm font-medium text-neutral-900 dark:text-neutral-100 hover:text-[#8C1D24] dark:hover:text-[#eb7a80] whitespace-nowrap shrink-0 transition-colors"
              >
                <span className="text-[#8C1D24] dark:text-[#eb7a80] font-semibold mr-2">{item.category_name}:</span>
                {item.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
