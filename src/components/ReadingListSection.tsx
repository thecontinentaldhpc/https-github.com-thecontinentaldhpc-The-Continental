import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { formatHistoricalArticleDate } from '../lib/dateIst';
import { EditorialImage } from './EditorialImage';

export function ReadingListSection() {
  const { user, readingList, readingListLoading, removeSavedArticle, openLoginModal } = useSite();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async (articleId: string) => {
    setError(null);
    setRemovingId(articleId);
    try {
      await removeSavedArticle(articleId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove article from reading list.');
    } finally {
      setRemovingId(null);
    }
  };

  if (!user) {
    return (
      <section
        aria-label="Reading List Sign In"
        className="border-2 border-neutral-950 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] p-8 sm:p-10 text-center max-w-2xl mx-auto"
      >
        <div className="inline-flex items-center justify-center w-11 h-11 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#121212] text-[#8C1D24] dark:text-[#eb7a80] mb-4">
          <Bookmark className="w-5 h-5" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-neutral-950 dark:text-neutral-50">
          Sign In to Access Your Reading List
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 max-w-md mx-auto leading-relaxed">
          Articles you save for later are stored on your reader profile so you can return to long-form dispatches and analyses anytime.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-testid="reading-list-signin-btn"
            onClick={() => openLoginModal('/reading-list')}
            className="px-6 py-2.5 bg-[#8C1D24] text-white text-xs font-semibold uppercase tracking-wider hover:bg-[#6e151a] transition-colors"
          >
            Sign In to Continue
          </button>
          <Link
            to="/"
            className="px-5 py-2.5 border border-neutral-900 dark:border-neutral-400 text-xs font-semibold uppercase tracking-wider text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-950 transition-colors"
          >
            Browse Front Page
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Saved Articles Reading List" data-testid="reading-list-section" className="space-y-6">
      <div className="border border-neutral-300 dark:border-neutral-700 bg-[#FAF9F6] dark:bg-[#181818] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8C1D24] dark:text-[#eb7a80]">
            Reader Dashboard · Saved Dispatches
          </p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">
            Signed in as <strong className="text-neutral-950 dark:text-neutral-100">{user.fullName}</strong>
            {user.email ? ` (${user.email})` : user.phoneNumber ? ` (${user.phoneNumber})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="border-l border-neutral-300 dark:border-neutral-700 pl-4">
            <span className="block text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              Saved Articles
            </span>
            <span
              data-testid="reading-list-count"
              className="font-mono text-lg font-bold text-neutral-950 dark:text-neutral-50 tabular-nums"
            >
              {readingList.length}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-xs font-medium text-[#8C1D24] dark:text-[#eb7a80]">
          {error}
        </p>
      )}

      {readingListLoading && readingList.length === 0 ? (
        <div className="border border-neutral-200 dark:border-neutral-800 p-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading your saved reading list...
        </div>
      ) : readingList.length === 0 ? (
        <div
          data-testid="reading-list-empty"
          className="border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181818] p-10 text-center space-y-3"
        >
          <Bookmark className="w-7 h-7 mx-auto text-neutral-400 dark:text-neutral-500" />
          <h2 className="font-serif text-xl font-bold text-neutral-950 dark:text-neutral-100">
            Your reading list is empty
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
            Click &ldquo;Save for Later&rdquo; on any dispatch to bookmark it here for offline review and weekend reading.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-block px-5 py-2.5 bg-[#111111] dark:bg-neutral-100 text-white dark:text-neutral-950 text-xs font-semibold uppercase tracking-wider hover:bg-[#8C1D24] dark:hover:bg-[#8C1D24] dark:hover:text-white transition-colors"
            >
              Explore Today&apos;s Edition
            </Link>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#181818]">
          {readingList.map((item) => {
            const isRemoving = removingId === item.articleId;
            return (
              <article
                key={item.articleId}
                data-testid={`reading-list-item-${item.articleId}`}
                className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start"
              >
                {item.featuredImageUrl && (
                  <Link
                    to={`/article/${item.slug}`}
                    className="w-full sm:w-44 shrink-0 block overflow-hidden border border-neutral-200 dark:border-neutral-700"
                  >
                    <EditorialImage
                      src={item.featuredImageUrl}
                      alt={item.title}
                      aspectClass="aspect-[16/10]"
                    />
                  </Link>
                )}

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
                    <Link
                      to={`/${item.categorySlug}`}
                      className="font-bold text-[#8C1D24] dark:text-[#eb7a80] hover:underline"
                    >
                      {item.categoryName}
                    </Link>
                    <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">·</span>
                    <span className="text-neutral-500 dark:text-neutral-400">
                      Saved {formatHistoricalArticleDate(item.savedAt)}
                    </span>
                  </div>

                  <h3 className="font-serif text-xl font-bold leading-snug text-neutral-950 dark:text-neutral-50">
                    <Link
                      to={`/article/${item.slug}`}
                      className="hover:text-[#8C1D24] dark:hover:text-[#eb7a80] transition-colors"
                    >
                      {item.title}
                    </Link>
                  </h3>

                  {item.summary && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2 leading-relaxed">
                      {item.summary}
                    </p>
                  )}

                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <p className="text-neutral-500 dark:text-neutral-400">
                      By <span className="font-semibold text-neutral-800 dark:text-neutral-200">{item.authorName}</span>
                      {item.publishedAt ? ` · Published ${formatHistoricalArticleDate(item.publishedAt)}` : ''}
                    </p>

                    <div className="flex items-center gap-2.5">
                      <Link
                        to={`/article/${item.slug}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-900 dark:border-neutral-400 text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:bg-neutral-900 dark:hover:bg-neutral-100 hover:text-white dark:hover:text-neutral-950 transition-colors"
                      >
                        <span>Read Article</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <button
                        type="button"
                        data-testid={`remove-saved-article-${item.articleId}`}
                        disabled={isRemoving}
                        onClick={() => handleRemove(item.articleId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:border-[#8C1D24] hover:text-[#8C1D24] dark:hover:border-[#eb7a80] dark:hover:text-[#eb7a80] transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isRemoving ? 'Removing...' : 'Remove'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
