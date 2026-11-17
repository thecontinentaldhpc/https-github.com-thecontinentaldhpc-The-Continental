import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookMarked, PenSquare } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { ReadingListSection } from '../components/ReadingListSection';

export function ReadingListPage() {
  const { user, isAdmin } = useSite();

  useEffect(() => {
    document.title = 'My Reading List | THE CONTINENTAL';
  }, []);

  return (
    <main className="max-w-[1160px] mx-auto px-4 sm:px-6 py-8">
      <div className="border-b-2 border-neutral-950 dark:border-neutral-700 pb-5 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80] flex items-center gap-1.5">
            <BookMarked className="w-3.5 h-3.5" />
            <span>Reader Dashboard</span>
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-neutral-950 dark:text-neutral-50 mt-1">
            Saved Reading List
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1.5">
            Your personal archive of bookmarked dispatches, investigations, and editorials.
          </p>
        </div>

        {user && (
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/publish-your-writing"
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1a1a1a] text-xs font-semibold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 hover:border-neutral-900 dark:hover:border-neutral-400 transition-colors"
            >
              <PenSquare className="w-3.5 h-3.5" />
              <span>Publish Your Writing</span>
            </Link>
            {isAdmin && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
              >
                <span>Admin Console</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <ReadingListSection />
    </main>
  );
}
