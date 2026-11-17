import { useEffect } from 'react';
import { useSite } from '../context/SiteContext';

type PolicyKey = 'editorial_policy' | 'corrections_policy' | 'privacy_policy' | 'terms_conditions';

export function PolicyPage({ title, settingKey }: { title: string; settingKey: PolicyKey }) {
  const { settings } = useSite();

  useEffect(() => {
    document.title = `${title} | THE CONTINENTAL`;
  }, [title]);

  const body = settings[settingKey] || '';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-200 pb-4 mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">Publication Governance</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">{title}</h1>
      </div>

      <div className="font-prose text-base sm:text-lg text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-line space-y-4">
        {body}
      </div>
    </main>
  );
}
